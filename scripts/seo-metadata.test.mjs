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

function extractNamedObjectLiteral(source, propertyName) {
  const propertyIndex = source.indexOf(`${propertyName}:`);
  assert.notEqual(propertyIndex, -1, `Expected ${propertyName} metadata.`);

  const openingBraceIndex = source.indexOf("{", propertyIndex);
  assert.notEqual(openingBraceIndex, -1, `Expected ${propertyName} to be an object.`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBraceIndex, index + 1);
    }
  }

  assert.fail(`Expected ${propertyName} metadata object to close.`);
}

const openGraphSource = extractNamedObjectLiteral(layoutSource, "openGraph");
const twitterSource = extractNamedObjectLiteral(layoutSource, "twitter");

test("an Open Graph block cannot borrow an image from a following Twitter block", () => {
  const syntheticMetadata = `
    openGraph: {
      title: 'Profile',
    },
    twitter: {
      images: [socialImage],
    },
  `;
  const syntheticOpenGraphSource = extractNamedObjectLiteral(syntheticMetadata, "openGraph");

  assert.doesNotMatch(syntheticOpenGraphSource, /images:/);
});

test("uses the production canonical URL and profile description", () => {
  assert.match(layoutSource, /description: profile\.meta\.description/);
  assert.match(
    layoutSource,
    /alternates:\s*\{\s*canonical:\s*profile\.meta\.og\.url\s*\}/,
  );
});

test("publishes complete Open Graph profile metadata with the committed share image", () => {
  assert.match(openGraphSource, /siteName: profile\.identity\.name/);
  assert.match(openGraphSource, /type: profile\.meta\.og\.type/);
  assert.match(openGraphSource, /firstName(?:,|:)/);
  assert.match(openGraphSource, /lastName(?:,|:)/);
  assert.match(openGraphSource, /username: profile\.identity\.github\.username/);
  assert.match(layoutSource, /const socialImage = \{[\s\S]*?url: profile\.meta\.og\.image,[\s\S]*?width: 1200,[\s\S]*?height: 630,[\s\S]*?alt:.*profile\.identity\.name[\s\S]*?AI\. Cyber\. Defence\./);
  assert.match(openGraphSource, /images: \[socialImage\]/);
  assert.doesNotMatch(openGraphSource, /hasPublicMedia/);
});

test("publishes a large Twitter card with the committed share image", () => {
  assert.match(twitterSource, /card: 'summary_large_image'/);
  assert.match(twitterSource, /title: profile\.meta\.og\.title/);
  assert.match(twitterSource, /description: profile\.meta\.og\.description/);
  assert.match(twitterSource, /images: \[socialImage\]/);
  assert.match(
    twitterSource,
    /The committed OG asset and its Open Graph and Twitter metadata ship together\./,
  );
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
