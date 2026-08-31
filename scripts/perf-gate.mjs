import { brotliCompressSync } from "node:zlib";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const HOST = "127.0.0.1";
const PORT = 4173;
const SITE_URL = `http://${HOST}:${PORT}/`;
const PERFORMANCE_MINIMUM = 0.9;
// Full registry adoption adds deferred interaction components while Lighthouse remains the quality gate.
const BROTLI_JAVASCRIPT_MAXIMUM = 200000;
const COMPRESSIBLE_EXTENSIONS = new Set([".html", ".js", ".css", ".svg", ".json"]);
const BROTLI_CACHE = new Map();
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
]);

export function median(values) {
  if (values.length === 0) {
    throw new TypeError("median requires at least one value");
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  return sortedValues[Math.floor(sortedValues.length / 2)];
}

function openingScriptTags(html) {
  const tags = [];
  let cursor = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart === -1) break;

    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd === -1) break;
      cursor = commentEnd + 3;
      continue;
    }

    let quote = null;
    let tagEnd = tagStart + 1;
    for (; tagEnd < html.length; tagEnd += 1) {
      const character = html[tagEnd];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (tagEnd === html.length) break;

    const tag = html.slice(tagStart, tagEnd + 1);
    const tagName = /^<\s*([^\s/>]+)/.exec(tag)?.[1]?.toLowerCase();
    if (tagName !== "script") {
      cursor = tagEnd + 1;
      continue;
    }

    tags.push(tag);
    const closingTag = /<\/script\s*>/gi;
    closingTag.lastIndex = tagEnd + 1;
    const closingMatch = closingTag.exec(html);
    if (!closingMatch) break;
    cursor = closingTag.lastIndex;
  }

  return tags;
}

function sourceAttributeFromScriptTag(scriptTag) {
  let cursor = 1;
  while (cursor < scriptTag.length && /\s/.test(scriptTag[cursor])) cursor += 1;
  while (cursor < scriptTag.length && !/[\s/>]/.test(scriptTag[cursor])) cursor += 1;

  while (cursor < scriptTag.length) {
    while (cursor < scriptTag.length && /[\s/]/.test(scriptTag[cursor])) cursor += 1;
    if (cursor >= scriptTag.length || scriptTag[cursor] === ">") break;

    const nameStart = cursor;
    while (cursor < scriptTag.length && !/[\s=/>]/.test(scriptTag[cursor])) cursor += 1;
    const name = scriptTag.slice(nameStart, cursor).toLowerCase();
    while (cursor < scriptTag.length && /\s/.test(scriptTag[cursor])) cursor += 1;

    let value;
    if (scriptTag[cursor] === "=") {
      cursor += 1;
      while (cursor < scriptTag.length && /\s/.test(scriptTag[cursor])) cursor += 1;

      const quote = scriptTag[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < scriptTag.length && scriptTag[cursor] !== quote) cursor += 1;
        value = scriptTag.slice(valueStart, cursor);
        if (scriptTag[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < scriptTag.length && !/[\s>]/.test(scriptTag[cursor])) cursor += 1;
        value = scriptTag.slice(valueStart, cursor);
      }
    }

    if (name === "src" && value) return value;
  }

  return null;
}

export function extractScriptSources(html) {
  const sources = new Set();

  for (const scriptTag of openingScriptTags(html)) {
    const source = sourceAttributeFromScriptTag(scriptTag);
    if (!source) {
      continue;
    }

    let sourceUrl;
    try {
      sourceUrl = new URL(source, SITE_URL);
    } catch {
      continue;
    }

    if (sourceUrl.origin === new URL(SITE_URL).origin && sourceUrl.pathname.endsWith(".js")) {
      sources.add(sourceUrl.pathname);
    }
  }

  return [...sources];
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function isContained(outputDirectory, candidatePath) {
  const relativePath = path.relative(outputDirectory, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function resolveOutputPath(outputDirectory, requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0")) {
    return null;
  }

  const rootPath = path.resolve(outputDirectory);
  const relativeRequestPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[\\/]+/, "");
  const candidatePath = path.resolve(rootPath, relativeRequestPath);
  if (!isContained(rootPath, candidatePath) || !existsSync(candidatePath)) {
    return null;
  }

  let resolvedCandidate;
  try {
    if (!statSync(candidatePath).isFile()) {
      return null;
    }
    resolvedCandidate = realpathSync(candidatePath);
  } catch {
    return null;
  }

  let resolvedRoot;
  try {
    resolvedRoot = realpathSync(rootPath);
  } catch {
    return null;
  }
  return isContained(resolvedRoot, resolvedCandidate) ? resolvedCandidate : null;
}

function sendStaticResponse(outputDirectory, request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const requestPath = (request.url ?? "/").split(/[?#]/, 1)[0];
  const assetPath = resolveOutputPath(outputDirectory, requestPath);
  if (!assetPath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(assetPath).toLowerCase();
  const compressible = COMPRESSIBLE_EXTENSIONS.has(extension);
  const acceptsBrotli = (request.headers["accept-encoding"] ?? "")
    .split(",")
    .some((value) => {
      const [encoding, ...parameters] = value.trim().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim().match(/^q\s*=\s*([0-9.]+)$/i)?.[1])
        .find(Boolean);
      return encoding.toLowerCase() === "br" && (quality === undefined || Number(quality) > 0);
    });

  let body;
  if (compressible && acceptsBrotli) {
    body = BROTLI_CACHE.get(assetPath);
    if (!body) {
      body = brotliCompressSync(readFileSync(assetPath));
      BROTLI_CACHE.set(assetPath, body);
    }
  }

  const headers = {
    "Content-Length": body?.byteLength ?? statSync(assetPath).size,
    "Content-Type": contentTypeFor(assetPath),
  };
  if (compressible) {
    headers.Vary = "Accept-Encoding";
  }
  if (body) {
    headers["Content-Encoding"] = "br";
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  if (body) {
    response.end(body);
    return;
  }

  const stream = createReadStream(assetPath);
  stream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end();
  });
  stream.pipe(response);
}

export function createStaticServer(outputDirectory) {
  return http.createServer((request, response) => {
    try {
      sendStaticResponse(outputDirectory, request, response);
    } catch {
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("Unable to read asset");
    }
  });
}

async function startStaticServer(outputDirectory) {
  const server = createStaticServer(outputDirectory);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });
  return server;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function measureObservedBrotliJavaScript(
  outputDirectory,
  lighthouseResults,
  siteUrl = SITE_URL,
) {
  if (!Array.isArray(lighthouseResults) || lighthouseResults.length === 0) {
    throw new Error("Lighthouse results are missing or malformed");
  }

  const siteOrigin = new URL(siteUrl).origin;
  const observedScripts = new Map();
  for (const [runIndex, lighthouseResult] of lighthouseResults.entries()) {
    const items =
      lighthouseResult?.audits?.["network-requests"]?.details?.items;
    if (!Array.isArray(items)) {
      throw new Error(
        `Lighthouse network-requests audit for run ${runIndex + 1} is missing or malformed`,
      );
    }

    for (const [itemIndex, item] of items.entries()) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.url !== "string" ||
        (item.resourceType !== undefined && typeof item.resourceType !== "string")
      ) {
        throw new Error(
          `Lighthouse network-requests audit item ${itemIndex + 1} for run ${runIndex + 1} is malformed`,
        );
      }

      let requestUrl;
      try {
        requestUrl = new URL(item.url);
      } catch {
        throw new Error(
          `Lighthouse network-requests audit item ${itemIndex + 1} for run ${runIndex + 1} has an invalid URL`,
        );
      }

      if (
        item.resourceType === "Script" ||
        requestUrl.pathname.endsWith(".js")
      ) {
        observedScripts.set(requestUrl.href, requestUrl);
      }
    }
  }

  let totalBytes = 0;
  for (const requestUrl of observedScripts.values()) {
    if (requestUrl.origin !== siteOrigin) {
      throw new Error(
        `Lighthouse-observed JavaScript asset is not same-origin: ${requestUrl.href}`,
      );
    }

    const scriptPath = resolveOutputPath(outputDirectory, requestUrl.pathname);
    if (!scriptPath) {
      throw new Error(
        `Lighthouse-observed JavaScript asset is missing or unsafe: ${requestUrl.href}`,
      );
    }
    totalBytes += brotliCompressSync(await readFile(scriptPath)).byteLength;
  }
  return totalBytes;
}

function configureChromePath() {
  const windowsChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (process.platform === "win32" && !process.env.CHROME_PATH && existsSync(windowsChromePath)) {
    process.env.CHROME_PATH = windowsChromePath;
  }
}

export async function cleanupChromeProfile(chrome, userDataDirectory, removeDirectory = rm) {
  const childProcess = chrome?.process;
  const closePromise =
    childProcess?.exitCode === null && childProcess?.signalCode === null
      ? new Promise((resolve) => childProcess.once("close", resolve))
      : null;

  try {
    chrome?.kill();
    if (closePromise) {
      await closePromise;
    }
  } finally {
    await removeDirectory(userDataDirectory, {
      force: true,
      maxRetries: 10,
      recursive: true,
      retryDelay: 100,
    });
  }
}

export async function collectColdLighthouseRuns(
  siteUrl = SITE_URL,
  runCount = 3,
) {
  configureChromePath();
  const scores = [];
  const lighthouseResults = [];

  for (let run = 0; run < runCount; run += 1) {
    let chrome;
    const userDataDirectory = mkdtempSync(path.join(os.tmpdir(), "perf-gate-chrome-"));
    try {
      chrome = await launch({
        chromeFlags: ["--headless=new", "--no-sandbox"],
        userDataDir: userDataDirectory,
      });
      const result = await lighthouse(siteUrl, {
        logLevel: "error",
        onlyCategories: ["performance"],
        output: "json",
        port: chrome.port,
      });
      const lighthouseResult = result?.lhr;
      const score = lighthouseResult?.categories?.performance?.score;
      if (typeof score !== "number" || !Number.isFinite(score)) {
        throw new Error("Lighthouse returned no numeric performance score");
      }
      scores.push(score);
      lighthouseResults.push(lighthouseResult);
    } finally {
      await cleanupChromeProfile(chrome, userDataDirectory);
    }
  }

  return {
    lighthouseResults,
    performanceScore: median(scores),
  };
}

export async function runPerformanceGate() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const outputDirectory = path.resolve(scriptDirectory, "..", "out");
  const server = await startStaticServer(outputDirectory);

  try {
    const { lighthouseResults, performanceScore } =
      await collectColdLighthouseRuns();
    const brotliBytes = await measureObservedBrotliJavaScript(
      outputDirectory,
      lighthouseResults,
    );
    console.log(
      `Performance median: ${performanceScore.toFixed(2)} | Brotli JavaScript: ${brotliBytes} bytes`,
    );

    if (
      performanceScore < PERFORMANCE_MINIMUM ||
      brotliBytes > BROTLI_JAVASCRIPT_MAXIMUM
    ) {
      process.exitCode = 1;
    }
  } finally {
    await closeServer(server);
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryPoint) {
  runPerformanceGate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
