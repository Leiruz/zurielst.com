import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

let sitemapGenerator = {};
try {
  sitemapGenerator = await import("./generate-sitemap.mjs");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const temporaryDirectories = new Set();

function requireSubjectFunction(name) {
  assert.equal(
    typeof sitemapGenerator[name],
    "function",
    `scripts/generate-sitemap.mjs must export ${name}`,
  );
  return sitemapGenerator[name];
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "generate-sitemap-"));
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

test("discovers root, flat, nested, and encoded routes from exported HTML", async () => {
  const discoverExportedRoutes = requireSubjectFunction(
    "discoverExportedRoutes",
  );
  const outputDirectory = await createTemporaryDirectory();
  await Promise.all([
    writeFile(path.join(outputDirectory, "index.html"), "root"),
    writeFile(path.join(outputDirectory, "about.html"), "about"),
    writeFile(path.join(outputDirectory, "404.html"), "not found"),
    writeFile(path.join(outputDirectory, "_not-found.html"), "not found"),
  ]);
  await mkdir(path.join(outputDirectory, "work"));
  await writeFile(path.join(outputDirectory, "work", "index.html"), "work");
  await writeFile(path.join(outputDirectory, "résumé.html"), "resume");
  await mkdir(path.join(outputDirectory, "_next"));
  await writeFile(path.join(outputDirectory, "_next", "internal.html"), "internal");

  assert.deepEqual(await discoverExportedRoutes(outputDirectory), [
    "/",
    "/about",
    "/r%C3%A9sum%C3%A9",
    "/work/",
  ]);
});

test("renders deterministic sitemap XML with the production origin", () => {
  const renderSitemap = requireSubjectFunction("renderSitemap");

  assert.equal(
    renderSitemap(["/", "/security%26ai", "/work/"]),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://zurielst.com/</loc>
  </url>
  <url>
    <loc>https://zurielst.com/security%26ai</loc>
  </url>
  <url>
    <loc>https://zurielst.com/work/</loc>
  </url>
</urlset>
`,
  );
});

test("writes sitemap.xml after discovering the exported routes", async () => {
  const generateSitemap = requireSubjectFunction("generateSitemap");
  const outputDirectory = await createTemporaryDirectory();
  await writeFile(path.join(outputDirectory, "index.html"), "root");

  const sitemapPath = await generateSitemap(outputDirectory);

  assert.equal(sitemapPath, path.join(outputDirectory, "sitemap.xml"));
  assert.match(
    await readFile(sitemapPath, "utf8"),
    /<loc>https:\/\/zurielst\.com\/<\/loc>/,
  );
});

test("robots.txt allows production crawling and points to the sitemap", async () => {
  const robots = await readFile(
    new URL("../public/robots.txt", import.meta.url),
    "utf8",
  ).catch((error) => (error?.code === "ENOENT" ? "" : Promise.reject(error)));

  assert.equal(
    robots,
    "User-agent: *\nAllow: /\nSitemap: https://zurielst.com/sitemap.xml\n",
  );
});

test("the build generates the sitemap before verifying static output", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const buildScript = packageJson.scripts.build;

  assert.match(buildScript, /node scripts\/generate-sitemap\.mjs/);
  assert.match(buildScript, /node scripts\/verify-build\.mjs/);
  assert.ok(
    buildScript.indexOf("generate-sitemap.mjs") <
      buildScript.indexOf("verify-build.mjs"),
  );
});
