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

test("renders the explicit public profile projection as clean Markdown", () => {
  const projectPublicProfile = requireSubjectFunction("projectPublicProfile");
  const renderDossierMarkdown = requireSubjectFunction("renderDossierMarkdown");
  const projection = projectPublicProfile(profile);
  const markdown = renderDossierMarkdown(profile);

  assert.deepEqual(Object.keys(projection), [
    "identity",
    "intro",
    "capabilities",
    "stack",
    "work",
    "timeline",
    "education",
    "proof_wall",
    "products",
    "stack_brands",
    "faq",
  ]);
  assert.deepEqual(
    projection.timeline,
    profile.timeline.filter((entry) => entry.type !== "education"),
  );
  assert.deepEqual(
    projection.education,
    profile.timeline.filter((entry) => entry.type === "education"),
  );
  assert.equal("extras" in projection.proof_wall, false);

  assert.match(markdown, /^# Zuriel Shanley Tanyory$/m);
  assert.match(markdown, /^## Identity$/m);
  assert.match(markdown, /^## Selected Work$/m);
  assert.match(markdown, /^## Timeline$/m);
  assert.match(markdown, /^## Education$/m);
  assert.match(markdown, /^## Proof Wall$/m);
  for (const value of [
    profile.identity.email,
    profile.intro.bullets[0],
    profile.capabilities.acts[0].narrative,
    profile.stack.categories[0].items[0],
    profile.work_cases[0].summary,
    profile.timeline.find((entry) => entry.type === "role").summary,
    profile.timeline.find((entry) => entry.type === "education").summary,
    profile.proof_wall.certifications[0].title,
    profile.proof_wall.awards[0].title,
    profile.proof_wall.ctf_results[0].title,
    profile.proof_wall.publications[0].title,
    profile.products[0].summary,
    profile.stack_brands.disclaimer,
    profile.faq[0].answer,
  ]) {
    assert.ok(markdown.includes(value), `Markdown must include public value: ${value}`);
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
    for (const value of [
      profile.easter_eggs.terminal.note,
      profile.easter_eggs.terminal.source,
      profile.chat.disclaimer,
      ...profile.chat.intent_chips.slice(1),
      profile.meta.title,
      profile.meta.description,
      profile.meta.og.title,
      profile.meta.og.description,
      profile.meta.og.image,
      profile.meta.og.url,
      profile.proof_wall.extras[0].title,
      profile.proof_wall.extras[0].media,
      profile.proof_wall.extras[0].caption,
    ]) {
      assert.ok(!dossier.includes(value), `dossier.md must exclude non-public value: ${value}`);
    }
    assert.doesNotMatch(dossier, /^## (Chat|Easter Eggs|Metadata)$/m);
    assert.doesNotMatch(dossier, /^### Extras$/m);
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
