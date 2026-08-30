import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

let dossierGenerator = {};
try {
  dossierGenerator = await import("./generate-dossier.mjs");
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const profile = JSON.parse(
  await readFile(new URL("../content/profile.json", import.meta.url), "utf8"),
);

function requireSubjectFunction(name) {
  assert.equal(
    typeof dossierGenerator[name],
    "function",
    `scripts/generate-dossier.mjs must export ${name}`,
  );
  return dossierGenerator[name];
}

function collectStrings(value, strings = []) {
  if (typeof value === "string") strings.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, strings));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, strings));
  }
  return strings;
}

test("renders the complete public profile as clean Markdown", () => {
  const renderDossierMarkdown = requireSubjectFunction("renderDossierMarkdown");
  const markdown = renderDossierMarkdown(profile);

  assert.match(markdown, /^# Zuriel Shanley Tanyory$/m);
  assert.match(markdown, /^## Identity$/m);
  assert.match(markdown, /^## Selected Work$/m);
  assert.match(markdown, /^## Proof Wall$/m);
  for (const value of collectStrings(profile)) {
    assert.ok(markdown.includes(value), `Markdown must include profile value: ${value}`);
  }
  assert.doesNotMatch(markdown, /```json/);
});

test("points llms.txt at the canonical dossier export", () => {
  const renderLlmsText = requireSubjectFunction("renderLlmsText");
  const output = renderLlmsText(profile);

  assert.match(output, /https:\/\/zurielst\.com\/dossier\.md/);
  assert.match(output, /Zuriel Shanley Tanyory/);
});

test("writes dossier.md and llms.txt into the static export", async () => {
  const generateDossierFiles = requireSubjectFunction("generateDossierFiles");
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "generate-dossier-"));

  try {
    await generateDossierFiles({
      outputDirectory,
      profilePath: new URL("../content/profile.json", import.meta.url),
    });

    const [dossier, llms] = await Promise.all([
      readFile(path.join(outputDirectory, "dossier.md"), "utf8"),
      readFile(path.join(outputDirectory, "llms.txt"), "utf8"),
    ]);
    assert.match(dossier, /Zuriel Shanley Tanyory/);
    assert.match(llms, /https:\/\/zurielst\.com\/dossier\.md/);
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});

test("ships a public vCard derived from profile data", async () => {
  const vcard = await readFile(
    new URL("../public/zurielst.vcf", import.meta.url),
    "utf8",
  ).catch((error) => (error?.code === "ENOENT" ? "" : Promise.reject(error)));
  const linkedIn = profile.identity.socials.find((social) => social.platform === "LinkedIn");

  assert.match(vcard, /BEGIN:VCARD/);
  assert.ok(vcard.includes(`FN:${profile.identity.name}`));
  assert.ok(vcard.includes(`TITLE:${profile.identity.roles[0]}`));
  assert.ok(vcard.includes(`EMAIL:${profile.identity.email}`));
  assert.ok(vcard.includes(`URL:${profile.meta.og.url}`));
  assert.ok(vcard.includes(linkedIn.url));
});
