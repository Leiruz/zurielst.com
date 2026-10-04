import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSiteHandler } from "../workers/site/handler.mjs";

const headersText = (await readFile(new URL("../public/_headers", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const handler = createSiteHandler(headersText);

function fixture({ status = 200, extraHeaders = {} } = {}) {
  const requests = [];
  const env = { ASSETS: { async fetch(request) {
    requests.push(request);
    const markdown = new URL(request.url).pathname === "/dossier.md";
    const body = markdown ? "# Public dossier\n" : "<h1>Portfolio</h1>";
    return new Response(request.method === "HEAD" || status === 304 ? null : body, {
      status,
      headers: {
        "Content-Type": markdown ? "text/plain" : "text/html",
        "ETag": markdown ? '"dossier"' : '"html"',
        "Cache-Control": "public, max-age=3600",
        ...extraHeaders,
      },
    });
  } } };
  return { requests, env };
}

async function homepage(accept, options = {}) {
  const { env, requests } = fixture(options);
  const headers = accept === undefined ? {} : { Accept: accept };
  const response = await handler.fetch(new Request("https://zurielst.com/?source=test", {
    method: options.method ?? "GET", headers,
  }), env);
  return { response, requests };
}

test("HTML stays the default, including browsers and wildcards", async () => {
  for (const accept of [undefined, "*/*", "text/*", "text/html,application/xhtml+xml,*/*;q=0.8", "application/json"]) {
    const { response, requests } = await homepage(accept);
    assert.equal(requests[0].url, "https://zurielst.com/?source=test");
    assert.match(response.headers.get("Content-Type"), /text\/html/);
    assert.match(await response.text(), /Portfolio/);
  }
});

test("explicit Markdown preference serves the existing dossier at the canonical root", async () => {
  for (const accept of ["text/markdown", "TEXT/MARKDOWN; q=1", "text/markdown, text/html;q=0.9", "text/markdown, */*", "text/markdown;q=0.7,text/html;q=0.7"]) {
    const { response, requests } = await homepage(accept);
    assert.equal(new URL(requests[0].url).pathname, "/dossier.md");
    assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
    assert.equal(response.headers.get("Content-Location"), "https://zurielst.com/dossier.md");
    assert.equal(await response.text(), "# Public dossier\n");
    assert.match(response.headers.get("Link"), /<https:\/\/zurielst\.com\/>; rel="canonical"/);
    assert.match(response.headers.get("Link"), /rel="alternate"; type="text\/html"/);
  }
});

test("quality values and specificity prevent unwanted Markdown", async () => {
  for (const accept of ["text/markdown;q=0,*/*;q=1", "text/html,text/markdown;q=0.5", "text/*;q=0.9,text/markdown;q=0.4", "text/markdown;q=bogus", "text/markdown;q=1.1", "text/markdown;q=-1", "text/markdown;q=0.000"] ) {
    const { response } = await homepage(accept);
    assert.match(response.headers.get("Content-Type"), /text\/html/);
  }
  const { response } = await homepage("text/html;q=0,text/*;q=1,text/markdown;q=0.1");
  assert.match(response.headers.get("Content-Type"), /text\/markdown/);
});

test("both representations vary on Accept and cannot enter a shared cache", async () => {
  for (const accept of ["text/html", "text/markdown", "text/html", "text/markdown"]) {
    const { response } = await homepage(accept, { extraHeaders: { Vary: "Accept-Encoding" } });
    assert.equal(response.headers.get("Vary"), "Accept-Encoding, Accept");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("ETag"), accept === "text/html" ? '"html"' : '"dossier"');
  }
  const { response } = await homepage("text/markdown", { extraHeaders: { Vary: "accept" } });
  assert.equal(response.headers.get("Vary"), "accept");
});

test("HEAD selects the same representation metadata and has no body", async () => {
  for (const accept of ["text/html", "text/markdown"]) {
    const get = await homepage(accept);
    const head = await homepage(accept, { method: "HEAD" });
    assert.equal(head.requests[0].method, "HEAD");
    for (const header of ["Content-Type", "Content-Location", "ETag", "Link", "Vary", "Cache-Control"]) {
      assert.equal(head.response.headers.get(header), get.response.headers.get(header));
    }
    assert.equal(await head.response.text(), "");
  }
});

test("homepage advertises only existing public documents", async () => {
  const { response } = await homepage("text/html");
  const links = response.headers.get("Link");
  assert.match(links, /<https:\/\/zurielst\.com\/>; rel="canonical"/);
  assert.match(links, /<https:\/\/zurielst\.com\/dossier\.md>; rel="alternate"; type="text\/markdown"/);
  assert.match(links, /<https:\/\/zurielst\.com\/llms\.txt>; rel="describedby"; type="text\/plain"/);
});

test("Worker responses preserve the exact global security policy and preview noindex", async () => {
  const { response } = await homepage("text/markdown");
  const globalBlock = headersText.split("/*\n")[1].split("\n\n")[0];
  for (const line of globalBlock.trim().split("\n")) {
    const separator = line.indexOf(":");
    assert.equal(response.headers.get(line.slice(0, separator).trim()), line.slice(separator + 1).trim());
  }
  const { env } = fixture();
  const preview = await handler.fetch(new Request("https://version.site.workers.dev/"), env);
  assert.equal(preview.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(response.headers.get("X-Robots-Tag"), null);
});

test("non-root requests and unsupported methods pass through unchanged", async () => {
  for (const [path, method] of [["/llms.txt", "GET"], ["/missing", "GET"], ["/", "POST"], ["/", "OPTIONS"]]) {
    const { env, requests } = fixture({ status: 404 });
    const request = new Request(`https://zurielst.com${path}`, { method });
    const response = await handler.fetch(request, env);
    assert.equal(requests[0], request);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Vary"), null);
    assert.equal(response.headers.get("Link"), null);
  }
});

test("asset errors and conditional statuses stay intact", async () => {
  for (const status of [206, 304, 404, 500]) {
    const { response } = await homepage("text/markdown", { status });
    assert.equal(response.status, status);
    if (status === 304) assert.equal(await response.text(), "");
    if (status === 206) {
      assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
      assert.match(response.headers.get("Link"), /<https:\/\/zurielst\.com\/>; rel="canonical"/);
    }
    if (status >= 400) assert.notEqual(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  }
});

test("conditional and range headers reach the selected asset", async () => {
  const { env, requests } = fixture();
  await handler.fetch(new Request("https://zurielst.com/", {
    headers: { Accept: "text/markdown", "If-None-Match": '"dossier"', Range: "bytes=0-20" },
  }), env);
  assert.equal(requests[0].headers.get("If-None-Match"), '"dossier"');
  assert.equal(requests[0].headers.get("Range"), "bytes=0-20");
});

test("both site configurations bundle the handler and run it first only at root", async () => {
  for (const name of ["wrangler.jsonc", "wrangler.cutover.jsonc"]) {
    const source = await readFile(new URL(`../workers/site/${name}`, import.meta.url), "utf8");
    // These configs use full-line JSONC comments, with no inline comments.
    const config = JSON.parse(source.replace(/^\uFEFF/, "").replace(/^\s*\/\/.*$/gm, ""));
    assert.equal(config.main, "index.mjs");
    assert.equal(config.assets.binding, "ASSETS");
    assert.deepEqual(config.assets.run_worker_first, ["/"]);
    assert.equal(config.assets.not_found_handling, "404-page");
    assert.ok(config.rules.some((rule) => rule.type === "Text" && rule.globs.includes("**/_headers")));
  }
});

test("static discovery metadata connects dossier and llms without changing robots", async () => {
  assert.match(headersText, /\/dossier\.md\n\s+Content-Type: text\/markdown; charset=utf-8/);
  assert.match(headersText, /<https:\/\/zurielst\.com\/dossier\.md>; rel="canonical"/);
  assert.match(headersText, /<https:\/\/zurielst\.com\/llms\.txt>; rel="canonical"/);
  const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
  assert.equal(robots.replaceAll("\r\n", "\n"), "User-agent: *\nAllow: /\nSitemap: https://zurielst.com/sitemap.xml\n");
});
