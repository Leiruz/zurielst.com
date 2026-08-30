import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);

test("uses the production canonical URL and profile description", () => {
  assert.match(layoutSource, /description: profile\.meta\.description/);
  assert.match(
    layoutSource,
    /alternates:\s*\{\s*canonical:\s*profile\.meta\.og\.url\s*\}/,
  );
});

test("publishes complete Open Graph website metadata without a broken image", () => {
  assert.match(layoutSource, /siteName: profile\.identity\.name/);
  assert.match(layoutSource, /type: profile\.meta\.og\.type/);
  assert.doesNotMatch(layoutSource, /images:/);
  assert.doesNotMatch(layoutSource, /hasPublicMedia/);
});

test("publishes a summary Twitter card from profile metadata", () => {
  assert.match(layoutSource, /twitter:\s*\{/);
  assert.match(layoutSource, /card: 'summary'/);
  assert.match(layoutSource, /title: profile\.meta\.og\.title/);
  assert.match(layoutSource, /description: profile\.meta\.og\.description/);
});
