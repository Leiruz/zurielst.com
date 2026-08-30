import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const faviconSource = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
).catch((error) => {
  if (error?.code === "ENOENT") return "";
  throw error;
});

test("uses the production canonical URL and profile description", () => {
  assert.match(layoutSource, /description: profile\.meta\.description/);
  assert.match(
    layoutSource,
    /alternates:\s*\{\s*canonical:\s*profile\.meta\.og\.url\s*\}/,
  );
});

test("publishes complete Open Graph profile metadata without a broken image", () => {
  assert.match(layoutSource, /siteName: profile\.identity\.name/);
  assert.match(layoutSource, /type: profile\.meta\.og\.type/);
  assert.match(layoutSource, /firstName(?:,|:)/);
  assert.match(layoutSource, /lastName(?:,|:)/);
  assert.match(layoutSource, /username: profile\.identity\.github\.username/);
  assert.doesNotMatch(layoutSource, /images:/);
  assert.doesNotMatch(layoutSource, /hasPublicMedia/);
});

test("publishes a large summary Twitter card without a premature image tag", () => {
  assert.match(layoutSource, /twitter:\s*\{/);
  assert.match(layoutSource, /card: 'summary_large_image'/);
  assert.match(layoutSource, /title: profile\.meta\.og\.title/);
  assert.match(layoutSource, /description: profile\.meta\.og\.description/);
  assert.doesNotMatch(layoutSource, /twitter:\s*\{[\s\S]*?images:/);
});

test("derives author and keyword metadata from the public profile", () => {
  assert.match(layoutSource, /authors:\s*\[\s*\{\s*name: profile\.identity\.name/);
  assert.match(layoutSource, /keywords:/);
  assert.match(layoutSource, /profile\.identity\.roles/);
  assert.match(layoutSource, /profile\.identity\.tagline/);
});

test("wires the SVG favicon through Next metadata", () => {
  assert.match(
    layoutSource,
    /icons:\s*\{\s*icon:\s*\[\s*\{\s*url:\s*['"]\/favicon\.svg['"],\s*type:\s*['"]image\/svg\+xml['"]\s*\}\s*\],?\s*\}/,
  );
});

test("ships a transparent fixed-grey ZST line-art favicon", () => {
  assert.match(faviconSource, /<svg\b/);
  assert.match(faviconSource, /viewBox="0 0 64 64"/);
  assert.match(faviconSource, /fill="none"/);
  assert.match(faviconSource, /stroke="#737780"/i);
  assert.doesNotMatch(faviconSource, /currentColor/i);
  assert.doesNotMatch(faviconSource, /<rect\b/i);
  assert.ok(
    [...faviconSource.matchAll(/<path\b/g)].length >= 3,
    "favicon must use hand-authored ZST paths",
  );
});
