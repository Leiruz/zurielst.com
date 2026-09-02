import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";

import * as performanceGate from "./perf-gate.mjs";
import {
  cleanupChromeProfile,
  contentTypeFor,
  createStaticServer,
  extractScriptSources,
  median,
  resolveOutputPath,
} from "./perf-gate.mjs";

const temporaryDirectories = new Set();

async function createTemporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.add(directory);
  return directory;
}

after(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function serveFixture(files) {
  const outputDirectory = await createTemporaryDirectory("perf-gate-server-");
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(outputDirectory, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  const server = createStaticServer(outputDirectory);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

async function request(server, { method = "GET", requestPath = "/", headers = {} } = {}) {
  const address = server.address();
  assert(address && typeof address === "object");

  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        agent: false,
        host: "127.0.0.1",
        port: address.port,
        method,
        path: requestPath,
        headers,
      },
      (incoming) => {
        const chunks = [];
        incoming.on("data", (chunk) => chunks.push(chunk));
        incoming.on("end", () =>
          resolve({
            body: Buffer.concat(chunks),
            headers: incoming.headers,
            statusCode: incoming.statusCode,
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test("median returns the middle value for an odd-sized sample", () => {
  assert.equal(median([0.93, 0.99, 0.95]), 0.95);
});

test("keeps the full registry adoption budget and Lighthouse minimum exact", async () => {
  const source = await readFile(new URL("./perf-gate.mjs", import.meta.url), "utf8");

  assert.match(source, /const PERFORMANCE_MINIMUM = 0\.9;/);
  assert.match(source, /const BROTLI_JAVASCRIPT_MAXIMUM = 200000;/);
  assert.match(source, /full registry adoption/i);
  assert.doesNotMatch(source, /BROTLI_JAVASCRIPT_MAXIMUM = 153600/);
});

test("documents the pinned brand sources and exceptional logo provenance", async () => {
  const docs = await readFile(new URL("../docs/components-map.md", import.meta.url), "utf8");

  assert.match(docs, /simple-icons\/simple-icons\/8a040dd8e1f7d99d27827efd4089a5434fdb7b5c/);
  assert.match(docs, /simple-icons\/simple-icons\/ce334b5bda8d8d054cfde7ce35caf40651078a28\/icons\/microsoft\.svg/);
  assert.match(docs, /73c31c01aad169e2ef0b04ced3c9d9f6225f0a8d/);
  assert.match(docs, /cyberark\/ark-sdk-python\/761b4a46971be6a6104860e1a5a6caeedea00ebc\/docs\/media\/logo\.svg/i);
  assert.match(docs, /translate\(0 64\) scale\(\.1 -\.1\)/);
  assert.match(docs, /metadata-only/i);
});

test("keeps LineNav native and outside the initial Motion runtime", async () => {
  const lineNav = await readFile(
    new URL("../components/registry/line-nav.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(lineNav, /from ['"]motion\/react['"]/);
  assert.doesNotMatch(lineNav, /<motion\./);
  assert.match(lineNav, /<a\b/);
  assert.match(
    lineNav,
    /window\.matchMedia\(['"]\(prefers-reduced-motion: reduce\)['"]\)\.matches/,
  );
  assert.match(
    lineNav,
    /behavior:\s*reduceMotion\s*\?\s*['"]auto['"]\s*:\s*['"]smooth['"]/,
  );
});

test("keeps the exact LineNav geometry in reduced-motion-safe CSS", async () => {
  const styles = await readFile(
    new URL("../styles/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\.line-nav-indicator\s*\{[^}]*width:\s*24px;[^}]*transition:\s*width\s+160ms\b[^}]*\}/,
  );
  assert.match(
    styles,
    /\.line-nav-anchor\[aria-current='location'\]\s+\.line-nav-indicator,\s*\.line-nav-anchor:hover\s+\.line-nav-indicator,\s*\.line-nav-anchor:focus-visible\s+\.line-nav-indicator\s*\{[^}]*width:\s*40px;/,
  );
  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transition-duration:\s*0\.01ms\s*!important/,
  );
});

test("keeps carousel wave direction and a progressive observer fallback", async () => {
  const [carousel, enhancement, sectionNav, styles] = await Promise.all([
    readFile(new URL("../components/registry/logos-carousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/registry/logos-carousel-enhancement.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/section-line-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../styles/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(carousel, /direction\?:\s*'ltr'\s*\|\s*'rtl'/);
  assert.match(enhancement, /direction === 'rtl'/);
  assert.match(enhancement, /dataset\.exiting = 'true'/);
  assert.match(enhancement, /500/);
  assert.match(enhancement, /step \+= 1;/);
  assert.doesNotMatch(enhancement, /\(step \+ 1\)\s*%\s*itemCount/);
  assert.match(enhancement, /document\.visibilityState === 'visible'/);
  assert.match(enhancement, /visibilitychange/);
  assert.match(enhancement, /if \(cycleId !== undefined\) return;/);
  assert.match(enhancement, /const pause = \(\) => \{[\s\S]*normalizeCarouselColumns\(columns, step\)/);
  assert.match(enhancement, /typeof IntersectionObserver === 'undefined'/);
  assert.match(sectionNav, /typeof IntersectionObserver === 'undefined'/);
  assert.match(styles, /logos-carousel-logo\[data-exiting='true'\][\s\S]*translateY\(-50%\)/);
  assert.match(styles, /@media\s*\(min-width:\s*48rem\)[\s\S]*\.logos-carousel[\s\S]*--logos-column-count/);
  assert.match(styles, /testimonials-marquee-primary \[data-slot='testimonial'\][\s\S]*width:\s*auto/);

  const columnLengths = [3, 3, 2, 2];
  const stepBefore = 9;
  const stepAfter = stepBefore + 1;
  const activeBefore = columnLengths.map((length) => stepBefore % length);
  const activeAfter = columnLengths.map((length) => stepAfter % length);
  assert.equal(
    activeAfter.every((activeIndex, index) => activeIndex !== activeBefore[index]),
    true,
    "a cadence tick must advance every uneven carousel column",
  );
});

test("landing-route controls avoid superseded identity motion code and unnecessary runtimes", async () => {
  const [appleHelloSource, fluidGradientSource, globalStyles, identitySource, siteNavSource, themeSwitcherSource] = await Promise.all(
    [
      "../components/registry/apple-hello-effect-english.tsx",
      "../components/registry/fluid-gradient-text.tsx",
      "../styles/globals.css",
      "../components/sections/identity-header.tsx",
      "../components/site-nav.tsx",
      "../components/registry/theme-switcher.tsx",
    ].map((relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8")),
  );

  for (const source of [appleHelloSource, themeSwitcherSource]) {
    assert.doesNotMatch(source, /from ["']motion\/react["']/);
  }
  assert.doesNotMatch(appleHelloSource, /from ["']@\/lib\/utils["']/);
  assert.doesNotMatch(themeSwitcherSource, /from ["']lucide-react["']/);
  assert.doesNotMatch(identitySource, /RoleRotator|role-light-up/);
  assert.doesNotMatch(globalStyles, /role-rotator|role-light-up|light-up-sweep/);
  assert.doesNotMatch(globalStyles, /scroll-fade-entrance\s*\{[^}]*animation-delay/s);
  assert.match(globalStyles, /animation-range-start:\s*entry var\(--scroll-fade-range-start/);
  assert.match(globalStyles, /animation-range-end:\s*cover var\(--scroll-fade-range-end/);
  assert.match(fluidGradientSource, /useReducedMotion/);
  assert.match(fluidGradientSource, /onPointerMove/);
  assert.match(fluidGradientSource, /resolveFluidGradientPosition/);
  assert.doesNotMatch(siteNavSource, /^["']use client["'];?/m);
  assert.match(siteNavSource, /site-nav-enhancement/);
});

test("consent runtime validates before analytics and keeps UI code split", async () => {
  const [enhancementsSource, integrationTestSource, managerSource, runtimeSource, uiSource] =
    await Promise.all(
      [
        "../components/registry/client-enhancements.tsx",
        "../components/registry/client-enhancements-consent.test.tsx",
        "../components/registry/consent-manager.tsx",
        "../components/registry/consent-runtime.tsx",
        "../components/registry/consent-manager-ui.tsx",
      ].map((relativePath) =>
        readFile(new URL(relativePath, import.meta.url), "utf8"),
      ),
    );

  assert.match(managerSource, /from ["']@c15t\/nextjs\/headless["']/);
  assert.match(managerSource, /if \(!persistedConsentCheck\) return null/);
  assert.doesNotMatch(managerSource, /@c15t\/react\/cookie-banner/);
  assert.match(runtimeSource, /validatePersistedConsent/);
  assert.match(runtimeSource, /deletePersistedConsentBestEffort/);
  assert.doesNotMatch(runtimeSource, /from ["']@c15t\//);
  assert.match(
    runtimeSource,
    /import\(["']@\/components\/registry\/consent-manager["']\)/,
  );
  assert.match(runtimeSource, /<CloudflareWebAnalyticsLoader/);
  assert.ok(
    runtimeSource.indexOf("if (!persistedConsentCheck) return null") <
      runtimeSource.indexOf("<CloudflareWebAnalyticsLoader"),
  );
  assert.match(
    enhancementsSource,
    /import\(["']@\/components\/registry\/consent-runtime["']\)/,
  );
  assert.match(
    enhancementsSource,
    /const loadConsentRuntime = introComplete \|\| ready/,
  );
  assert.match(
    enhancementsSource,
    /mountUi=\{shouldMountConsent\(\{ engaged, introComplete, ready \}\)\}/,
  );
  assert.match(
    managerSource,
    /import\(["']@\/components\/registry\/consent-manager-ui["']\)/,
  );
  assert.match(
    managerSource,
    /validationComplete && mountUi \? <PrivacyChoicesListener \/>/,
  );
  assert.match(
    managerSource,
    /validationComplete \? <CloudflareWebAnalyticsMount \/>/,
  );
  assert.doesNotMatch(managerSource, /<ConsentBanner/);
  assert.doesNotMatch(managerSource, /consent-manager-dialog/);
  assert.doesNotMatch(
    integrationTestSource,
    /node_modules\/@c15t\/react\/dist\/providers/,
  );

  assert.match(uiSource, /<ConsentBanner/);
  assert.match(uiSource, /isPrivacyDialogOpen/);
  assert.match(uiSource, /isOpen=\{isPrivacyDialogOpen\}/);
  assert.match(
    uiSource,
    /import\(["']@\/components\/registry\/consent-manager-dialog["']\)/,
  );

  const dialogSource = await readFile(
    new URL("../components/registry/consent-manager-dialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    dialogSource,
    /from ["']@c15t\/react\/consent-manager-dialog["']/,
  );
  const bannerSource = await readFile(
    new URL("../components/registry/consent-banner.tsx", import.meta.url),
    "utf8",
  );

  assert.match(bannerSource, /CONSENT_TRANSLATIONS/);
  assert.match(bannerSource, />Reject all</);
  assert.match(bannerSource, />Customize</);
  assert.match(bannerSource, />Accept all</);
  assert.match(bannerSource, /onReject/);
  assert.match(bannerSource, /onCustomize/);
  assert.match(bannerSource, /onAccept/);
});

test("documents consent restore, runtime, and UI gates", async () => {
  const docs = await readFile(
    new URL("../docs/components-map.md", import.meta.url),
    "utf8",
  );

  assert.match(
    docs,
    /validated result is then restored unconditionally through c15t's custom-consent save path/i,
  );
  assert.match(
    docs,
    /runtime loads dynamically after either the two-frame readiness signal or intro completion/i,
  );
  assert.match(
    docs,
    /c15t provider, privacy choices listener, banner, and dialog remain gated until engagement, readiness, and intro completion have all occurred/i,
  );
  assert.doesNotMatch(
    docs,
    /provider waits for both intro completion and the visitor's first/i,
  );
});

test("command palette code loads only from an explicit open interaction", async () => {
  const [loaderSource, enhancementsSource, modelSource] = await Promise.all(
    [
      "../components/command-palette-loader.tsx",
      "../components/registry/client-enhancements.tsx",
      "../lib/command-palette.ts",
    ].map((relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8")),
  );

  const importExpression = "import('@/components/command-palette')";
  const openHandlerStart = loaderSource.indexOf("async function openCommandPalette");
  const effectsStart = loaderSource.indexOf("useEffect(", openHandlerStart);
  const openHandlerSource = loaderSource.slice(openHandlerStart, effectsStart);
  const modelImportLines = loaderSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("@/lib/command-palette"));

  assert.ok(openHandlerStart >= 0, "the loader must define an explicit open handler");
  assert.equal(loaderSource.split(importExpression).length - 1, 1);
  assert.match(openHandlerSource, /import\(['"]@\/components\/command-palette['"]\)/);
  assert.doesNotMatch(loaderSource, /from ['"]@\/components\/command-palette['"]/);
  assert.doesNotMatch(loaderSource, /scheduleAfterPaint/);
  assert.doesNotMatch(enhancementsSource, /command-palette/);
  assert.deepEqual(
    modelImportLines,
    ["import type { CommandPaletteConfig } from '@/lib/command-palette';"],
    "the always-loaded listener must not import the palette runtime model",
  );
  assert.doesNotMatch(`${loaderSource}\n${modelSource}`, /toLocaleLowerCase/);
  assert.match(`${loaderSource}\n${modelSource}`, /toLowerCase/);
});

test(
  "collects and measures a dynamic import observed by a real cold Lighthouse run",
  { timeout: 120_000 },
  async () => {
    const outputDirectory = await createTemporaryDirectory(
      "perf-gate-lighthouse-dynamic-",
    );
    const entryScript = `
      addEventListener("load", () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => import("./dynamic.js"));
        });
      }, { once: true });
    `;
    const dynamicScript = "globalThis.dynamicChunkLoaded = true;";
    await writeFile(
      path.join(outputDirectory, "index.html"),
      '<!doctype html><html><head><title>Dynamic fixture</title></head><body><main><h1>Dynamic fixture</h1></main><script src="/entry.js"></script></body></html>',
    );
    await writeFile(path.join(outputDirectory, "entry.js"), entryScript);
    await writeFile(path.join(outputDirectory, "dynamic.js"), dynamicScript);

    const server = createStaticServer(outputDirectory);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert(address && typeof address === "object");
    const siteUrl = `http://127.0.0.1:${address.port}/`;

    try {
      assert.equal(
        typeof performanceGate.collectColdLighthouseRuns,
        "function",
        "the performance gate must expose its cold Lighthouse collection seam",
      );

      const { lighthouseResults, performanceScore } =
        await performanceGate.collectColdLighthouseRuns(siteUrl, 1);
      assert.equal(lighthouseResults.length, 1);
      assert.equal(Number.isFinite(performanceScore), true);

      const observedUrls = lighthouseResults[0].audits[
        "network-requests"
      ].details.items.map((item) => item.url);
      assert.equal(
        observedUrls.includes(new URL("/dynamic.js", siteUrl).href),
        true,
        "Lighthouse must observe the post-paint dynamic import",
      );

      const measuredBytes =
        await performanceGate.measureObservedBrotliJavaScript(
          outputDirectory,
          lighthouseResults,
          siteUrl,
        );
      const expectedBytes =
        brotliCompressSync(Buffer.from(entryScript)).byteLength +
        brotliCompressSync(Buffer.from(dynamicScript)).byteLength;
      assert.equal(measuredBytes, expectedBytes);
    } finally {
      await close(server);
    }
  },
);

test("counts each Lighthouse-observed local script once across cold runs", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-observed-scripts-");
  const entryScript = `
    addEventListener("load", () => {
      requestAnimationFrame(() => import("./dynamic.js"));
    });
  `;
  const dynamicScript = "globalThis.dynamicChunkLoaded = true;";
  await writeFile(
    path.join(outputDirectory, "index.html"),
    '<!doctype html><script src="/entry.js"></script>',
  );
  await writeFile(path.join(outputDirectory, "entry.js"), entryScript);
  await writeFile(path.join(outputDirectory, "dynamic.js"), dynamicScript);

  const lighthouseResults = Array.from({ length: 3 }, () => ({
    audits: {
      "network-requests": {
        details: {
          items: [
            { resourceType: "Script", url: "http://127.0.0.1:4173/entry.js" },
            { resourceType: "Other", url: "http://127.0.0.1:4173/dynamic.js" },
            { resourceType: "Other", url: "https://example.test/vendor.css" },
          ],
        },
      },
    },
  }));

  assert.equal(
    typeof performanceGate.measureObservedBrotliJavaScript,
    "function",
    "the performance gate must expose its observed-script measurement seam",
  );

  const measuredBytes = await performanceGate.measureObservedBrotliJavaScript(
    outputDirectory,
    lighthouseResults,
  );
  const expectedBytes =
    brotliCompressSync(Buffer.from(entryScript)).byteLength +
    brotliCompressSync(Buffer.from(dynamicScript)).byteLength;

  assert.equal(measuredBytes, expectedBytes);
});

test("rejects malformed Lighthouse network-request audit data", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-malformed-audit-");
  await writeFile(path.join(outputDirectory, "index.html"), "<!doctype html>");

  await assert.rejects(
    performanceGate.measureObservedBrotliJavaScript(outputDirectory, [
      { audits: { "network-requests": { details: {} } } },
    ]),
    /network-requests audit for run 1 is missing or malformed/,
  );
});

test("rejects a qualifying same-origin URL that cannot map safely to out", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-unsafe-audit-");
  await writeFile(path.join(outputDirectory, "index.html"), "<!doctype html>");

  await assert.rejects(
    performanceGate.measureObservedBrotliJavaScript(outputDirectory, [
      {
        audits: {
          "network-requests": {
            details: {
              items: [
                {
                  resourceType: "Script",
                  url: "http://127.0.0.1:4173/%2e%2e/package.json",
                },
              ],
            },
          },
        },
      },
    ]),
    /Lighthouse-observed JavaScript asset is missing or unsafe/,
  );
});

test("rejects a qualifying cross-origin script that cannot map to out", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-cross-origin-audit-");
  await writeFile(path.join(outputDirectory, "index.html"), "<!doctype html>");

  await assert.rejects(
    performanceGate.measureObservedBrotliJavaScript(outputDirectory, [
      {
        audits: {
          "network-requests": {
            details: {
              items: [
                {
                  resourceType: "Script",
                  url: "https://example.test/vendor.js",
                },
              ],
            },
          },
        },
      },
    ]),
    /Lighthouse-observed JavaScript asset is not same-origin/,
  );
});

test("cleanupChromeProfile waits for ChildProcess close before removing its profile", async () => {
  const childProcess = new EventEmitter();
  childProcess.exitCode = null;
  childProcess.signalCode = null;
  let killCalled = false;
  let childProcessClosed = false;
  childProcess.once("close", () => {
    childProcessClosed = true;
  });
  const chrome = {
    process: childProcess,
    kill() {
      killCalled = true;
      setImmediate(() => {
        childProcess.exitCode = 0;
        childProcess.emit("close", 0, null);
      });
    },
  };

  await cleanupChromeProfile(chrome, "chrome-profile", async (directory, options) => {
    assert.equal(killCalled, true);
    assert.equal(childProcessClosed, true);
    assert.equal(directory, "chrome-profile");
    assert.deepEqual(options, {
      force: true,
      maxRetries: 10,
      recursive: true,
      retryDelay: 100,
    });
  });
});

test("cleanupChromeProfile skips waiting for a ChildProcess already terminated by signal", async () => {
  const childProcess = new EventEmitter();
  childProcess.exitCode = null;
  childProcess.signalCode = "SIGTERM";
  let profileRemoved = false;
  const chrome = {
    process: childProcess,
    kill() {},
  };

  await cleanupChromeProfile(chrome, "chrome-profile", async () => {
    profileRemoved = true;
  });

  assert.equal(profileRemoved, true);
});

test("cleanupChromeProfile removes the profile when Chrome never launched", async () => {
  let profileRemoved = false;

  await cleanupChromeProfile(undefined, "chrome-profile", async () => {
    profileRemoved = true;
  });

  assert.equal(profileRemoved, true);
});

test("cleanupChromeProfile removes the profile when Chrome kill throws", async () => {
  const killError = new Error("kill failed");
  let profileRemovalAttempted = false;

  await assert.rejects(
    cleanupChromeProfile(
      {
        kill() {
          throw killError;
        },
      },
      "chrome-profile",
      async () => {
        profileRemovalAttempted = true;
      },
    ),
    killError,
  );

  assert.equal(profileRemovalAttempted, true);
});

test("extractScriptSources finds quoted and unquoted same-origin JavaScript sources", () => {
  const html = `
    <img src="/_next/static/ignored.js">
    <script defer src="/_next/static/a.js?v=1"></script>
    <script src='/_next/static/b.js#module'></script>
    <script async src=/_next/static/c.js?build=2#module></script>
    <script src="https://example.test/external.js"></script>
    <script src="/_next/static/not-javascript.css"></script>
  `;

  assert.deepEqual(extractScriptSources(html), [
    "/_next/static/a.js",
    "/_next/static/b.js",
    "/_next/static/c.js",
  ]);
});

test("extractScriptSources deduplicates JavaScript paths after removing query and hash", () => {
  const html = `
    <script src="/_next/static/app.js?first"></script>
    <script src='/_next/static/app.js#second'></script>
    <script src=/_next/static/app.js></script>
  `;

  assert.deepEqual(extractScriptSources(html), ["/_next/static/app.js"]);
});

test("extractScriptSources keeps scanning a script tag after a quoted greater-than sign", () => {
  const html = '<script data-note=">" src="/real.js"></script>';

  assert.deepEqual(extractScriptSources(html), ["/real.js"]);
});

test("extractScriptSources ignores src-like text inside another quoted attribute", () => {
  const html =
    '<script data-note="src=/fake.js" defer src="/real.js"></script>';

  assert.deepEqual(extractScriptSources(html), ["/real.js"]);
});

test("contentTypeFor maps the static asset types served by the performance server", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("app.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("styles.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("mark.svg"), "image/svg+xml");
  assert.equal(contentTypeFor("data.json"), "application/json; charset=utf-8");
});

test("resolveOutputPath rejects traversal outside the output directory", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-");
  await writeFile(path.join(outputDirectory, "index.html"), "safe");

  assert.equal(resolveOutputPath(outputDirectory, "/%2e%2e/package.json"), null);
  assert.equal(resolveOutputPath(outputDirectory, "/..%2fpackage.json"), null);
});

test("resolveOutputPath rejects missing assets and resolves existing assets", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-");
  const assetDirectory = path.join(outputDirectory, "_next", "static");
  await mkdir(assetDirectory, { recursive: true });
  const assetPath = path.join(assetDirectory, "app.js");
  await writeFile(assetPath, "console.log('safe')");

  assert.equal(resolveOutputPath(outputDirectory, "/missing.js"), null);
  assert.equal(resolveOutputPath(outputDirectory, "/_next/static/app.js"), assetPath);
});

test("resolveOutputPath returns the canonical path through an in-root directory link", async (t) => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-canonical-");
  const actualDirectory = path.join(outputDirectory, "actual");
  const linkedDirectory = path.join(outputDirectory, "linked");
  await mkdir(actualDirectory);
  const actualFile = path.join(actualDirectory, "app.js");
  await writeFile(actualFile, "console.log('canonical')");

  try {
    await symlink(actualDirectory, linkedDirectory, "junction");
  } catch (error) {
    if (["EACCES", "EPERM", "ENOSYS"].includes(error?.code)) {
      t.skip(`directory links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.equal(
    resolveOutputPath(outputDirectory, "/linked/app.js"),
    await realpath(actualFile),
  );
});

test("resolveOutputPath rejects a directory link outside the output root", async (t) => {
  const parentDirectory = await createTemporaryDirectory("perf-gate-link-escape-");
  const outputDirectory = path.join(parentDirectory, "out");
  const outsideDirectory = path.join(parentDirectory, "outside");
  const linkedDirectory = path.join(outputDirectory, "linked");
  await mkdir(outputDirectory);
  await mkdir(outsideDirectory);
  await writeFile(path.join(outsideDirectory, "secret.js"), "not public");

  try {
    await symlink(outsideDirectory, linkedDirectory, "junction");
  } catch (error) {
    if (["EACCES", "EPERM", "ENOSYS"].includes(error?.code)) {
      t.skip(`directory links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.equal(resolveOutputPath(outputDirectory, "/linked/secret.js"), null);
});

test("resolveOutputPath rejects malformed percent encoding", async () => {
  const outputDirectory = await createTemporaryDirectory("perf-gate-malformed-");
  await writeFile(path.join(outputDirectory, "index.html"), "safe");

  assert.equal(resolveOutputPath(outputDirectory, "/%E0%A4%A"), null);
});

test("static server Brotli-compresses accepted text responses", async () => {
  const html = "<!doctype html><p>production-equivalent compression</p>";
  const server = await serveFixture({ "index.html": html });

  try {
    const response = await request(server, {
      headers: { "Accept-Encoding": "gzip, br" },
    });
    const expectedBody = brotliCompressSync(Buffer.from(html));

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "br");
    assert.equal(response.headers.vary, "Accept-Encoding");
    assert.equal(response.headers["content-length"], String(expectedBody.byteLength));
    assert.equal(brotliDecompressSync(response.body).toString(), html);
  } finally {
    await close(server);
  }
});

test("static server sends Brotli headers without a body for HEAD", async () => {
  const javascript = "console.log('compressed');";
  const server = await serveFixture({ "app.js": javascript });

  try {
    const response = await request(server, {
      method: "HEAD",
      requestPath: "/app.js",
      headers: { "Accept-Encoding": "br" },
    });
    const expectedLength = brotliCompressSync(Buffer.from(javascript)).byteLength;

    assert.equal(response.headers["content-encoding"], "br");
    assert.equal(response.headers.vary, "Accept-Encoding");
    assert.equal(response.headers["content-length"], String(expectedLength));
    assert.equal(response.body.byteLength, 0);
  } finally {
    await close(server);
  }
});

test("static server keeps text raw when Brotli is not accepted", async () => {
  const css = "body { color: black; }";
  const server = await serveFixture({ "styles.css": css });

  try {
    const response = await request(server, { requestPath: "/styles.css" });

    assert.equal(response.headers["content-encoding"], undefined);
    assert.equal(response.headers.vary, "Accept-Encoding");
    assert.equal(response.body.toString(), css);
  } finally {
    await close(server);
  }
});

test("static server does not compress unknown binary assets", async () => {
  const binary = Buffer.from([0, 1, 2, 3, 255]);
  const server = await serveFixture({ "image.png": binary });

  try {
    const response = await request(server, {
      requestPath: "/image.png",
      headers: { "Accept-Encoding": "br" },
    });

    assert.equal(response.headers["content-encoding"], undefined);
    assert.equal(response.headers.vary, undefined);
    assert.deepEqual(response.body, binary);
  } finally {
    await close(server);
  }
});

test("static server sends raw HEAD length parity without a body", async () => {
  const json = '{"status":"raw"}';
  const server = await serveFixture({ "status.json": json });

  try {
    const getResponse = await request(server, { requestPath: "/status.json" });
    const headResponse = await request(server, {
      method: "HEAD",
      requestPath: "/status.json",
    });

    assert.equal(headResponse.statusCode, 200);
    assert.equal(headResponse.headers["content-encoding"], undefined);
    assert.equal(headResponse.headers["content-length"], getResponse.headers["content-length"]);
    assert.equal(headResponse.headers["content-length"], String(Buffer.byteLength(json)));
    assert.equal(headResponse.body.byteLength, 0);
  } finally {
    await close(server);
  }
});

test("static server rejects unsupported methods with an Allow header", async () => {
  const server = await serveFixture({ "index.html": "safe" });

  try {
    const response = await request(server, { method: "POST" });

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, "GET, HEAD");
  } finally {
    await close(server);
  }
});

test("static server returns the exported 404 document for a bogus page route", async () => {
  const notFound = "<!doctype html><title>Page Not Found</title><p>ZST missing document</p>";
  const server = await serveFixture({
    "404.html": notFound,
    "index.html": "safe",
  });

  try {
    const response = await request(server, { requestPath: "/records/not-here" });

    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(response.body.toString(), notFound);
  } finally {
    await close(server);
  }
});

test("static server keeps missing assets as plain 404 responses", async () => {
  const server = await serveFixture({
    "404.html": "<!doctype html><p>ZST missing document</p>",
    "index.html": "safe",
  });

  try {
    const response = await request(server, { requestPath: "/missing.js" });

    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["content-type"], "text/plain; charset=utf-8");
    assert.equal(response.body.toString(), "Not found");
  } finally {
    await close(server);
  }
});

test("static server does not expose an existing file outside its output directory", async () => {
  const parentDirectory = await createTemporaryDirectory("perf-gate-containment-");
  const outputDirectory = path.join(parentDirectory, "out");
  await mkdir(outputDirectory);
  await writeFile(path.join(outputDirectory, "index.html"), "safe");
  await writeFile(path.join(parentDirectory, "secret.txt"), "not public");
  const server = createStaticServer(outputDirectory);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const response = await request(server, {
      requestPath: "/..%2fsecret.txt",
    });

    assert.equal(response.statusCode, 404);
    assert.notEqual(response.body.toString(), "not public");
  } finally {
    await close(server);
  }
});
