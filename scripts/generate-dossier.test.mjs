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

const TEST_WORD_LABELS = new Map([
  ["ai", "AI"],
  ["ctf", "CTF"],
  ["faq", "FAQ"],
  ["github", "GitHub"],
  ["id", "ID"],
  ["url", "URL"],
]);

function testLabelFor(key) {
  return key
    .split("_")
    .map((word) => TEST_WORD_LABELS.get(word.toLowerCase()) ?? `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function extractRootSection(markdown, label) {
  const lines = markdown.split("\n");
  const start = lines.indexOf(`## ${label}`);
  assert.notEqual(start, -1, `Markdown must include the ${label} root section`);
  const relativeEnd = lines.slice(start + 1).findIndex((line) => line.startsWith("## "));
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  return lines.slice(start, end).join("\n");
}

function assertRenderedField(section, key, value, sourcePath) {
  const expectedLine = `- **${testLabelFor(key)}:** ${String(value)}`;
  assert.ok(
    section.split("\n").includes(expectedLine),
    `${sourcePath} must render as an exact field line in its root section`,
  );
}

function assertRenderedListItem(section, value, sourcePath) {
  const expectedLine = `- ${String(value)}`;
  assert.ok(
    section.split("\n").includes(expectedLine),
    `${sourcePath} must render as an exact list item in its root section`,
  );
}

function expectedPublicProfile(source) {
  const currentRole = source.timeline.find(
    (entry) => entry.type === "role" && entry.org === source.identity.employer,
  );
  const founderRecord = source.timeline.find(
    (entry) => entry.type === "role" && entry.title === "Founder",
  );
  const universityEducation = source.timeline.find(
    (entry) => entry.type === "education" && entry.org.includes("University"),
  );
  const identityAward = source.proof_wall.awards[0];
  const identity = {
    name: source.identity.name,
    roles: source.identity.roles.map((role) => role),
    tagline: source.identity.tagline,
    one_liner: source.identity.bio_hook,
  };

  if (currentRole) identity.role = `${currentRole.title} @ ${currentRole.org}`;
  if (founderRecord) identity.founder = `${founderRecord.org}, ${founderRecord.period}`;
  identity.location = `${source.identity.location.city} ${source.identity.location.timezone}`;
  if (universityEducation) identity.education = `${universityEducation.title}, ${universityEducation.org}`;
  if (identityAward) identity.award = `${identityAward.title}, ${identityAward.year}`;
  identity.email = source.identity.email;
  identity.socials = source.identity.socials.map((social) => ({
    label: social.platform,
    url: social.url,
  }));
  identity.metrics = source.identity.metrics.map((metric) => ({
    value: metric.value,
    label: metric.label,
  }));
  identity.portrait_alt = source.identity.portrait.alt;

  return {
    identity,
    intro: {
      bullets: source.intro.bullets.map((bullet) => bullet),
    },
    capabilities: {
      acts: source.capabilities.acts.map((act) => ({
        act: act.act,
        title: act.title,
        narrative: act.narrative,
        skills: act.skills.map((skill) => {
          const expectedSkill = { name: skill.name };
          if (skill.since !== undefined) expectedSkill.since = skill.since;
          if (skill.detail !== undefined) expectedSkill.detail = skill.detail;
          return expectedSkill;
        }),
      })),
    },
    stack: {
      categories: source.stack.categories.map((category) => ({
        name: category.name,
        items: category.items.map((item) => item),
      })),
    },
    work: source.work_cases.map((workCase) => {
      const expectedWorkCase = {
        kicker: workCase.kicker,
        title: workCase.title,
        period: workCase.period,
        summary: workCase.summary,
        stack: workCase.stack.map((item) => item),
        links: workCase.links.map((link) => {
          const expectedLink = { label: link.label, url: link.url };
          if (link.note !== undefined) expectedLink.note = link.note;
          return expectedLink;
        }),
      };
      if (workCase.note !== undefined) expectedWorkCase.note = workCase.note;
      return expectedWorkCase;
    }),
    timeline: source.timeline
      .filter((entry) => entry.type !== "education")
      .map((entry) => ({
        type: entry.type,
        org: entry.org,
        title: entry.title,
        period: entry.period,
        summary: entry.summary,
      })),
    education: source.timeline
      .filter((entry) => entry.type === "education")
      .sort((left, right) => {
        const leftYear = Number.parseInt(left.period.match(/\d{4}/)?.[0] ?? "0", 10);
        const rightYear = Number.parseInt(right.period.match(/\d{4}/)?.[0] ?? "0", 10);
        return rightYear - leftYear;
      })
      .map((entry) => ({
        org: entry.org,
        title: entry.title,
        period: entry.period,
        summary: entry.summary,
      })),
    proof_wall: {
      certifications: source.proof_wall.certifications.map((certification) => {
        const expectedCertification = {
          title: certification.title,
          issuer: certification.issuer,
        };
        if (certification.year !== undefined) expectedCertification.year = certification.year;
        if (certification.validity !== undefined) expectedCertification.validity = certification.validity;
        if (certification.caption !== undefined) expectedCertification.caption = certification.caption;
        return expectedCertification;
      }),
      awards: source.proof_wall.awards.map((award) => {
        const expectedAward = {
          title: award.title,
          issuer: award.issuer,
          year: award.year,
        };
        if (award.caption !== undefined) expectedAward.caption = award.caption;
        return expectedAward;
      }),
      ctf_results: source.proof_wall.ctf_results.map((result) => {
        const expectedResult = {
          title: result.title,
          organizer: result.organizer,
          year: result.year,
          result: result.result,
        };
        if (result.caption !== undefined) expectedResult.caption = result.caption;
        return expectedResult;
      }),
      publications: source.proof_wall.publications.map((publication) => ({
        title: publication.title,
        year: publication.year,
        link: publication.link,
        format: publication.format,
      })),
    },
    products: source.products.map((product) => {
      const expectedProduct = { name: product.name };
      if (product.origin_story) expectedProduct.kicker = "Origin story";
      if (product.period !== undefined) expectedProduct.period = product.period;
      expectedProduct.summary = product.summary;
      expectedProduct.stack = product.stack.map((item) => item);
      expectedProduct.links = product.links.map((link) => {
        const expectedLink = { label: link.label, url: link.url };
        if (link.note !== undefined) expectedLink.note = link.note;
        return expectedLink;
      });
      if (product.note !== undefined) expectedProduct.note = product.note;
      return expectedProduct;
    }),
    stack_brands: {
      disclaimer: source.stack_brands.disclaimer,
      brands: source.stack_brands.brands.map((brand) => ({
        name: brand.name,
        context: brand.context,
      })),
    },
    faq: source.faq.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  };
}

function assertNoIdKeys(value, path = "projection") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoIdKeys(item, `${path}[${index}]`));
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert.doesNotMatch(key, /id$/i, `${path}.${key} must not expose an ID field`);
      assertNoIdKeys(child, `${path}.${key}`);
    }
  }
}

function collectObjectReferences(value, references = new Set()) {
  if (value === null || typeof value !== "object" || references.has(value)) {
    return references;
  }

  references.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectReferences(item, references));
  } else {
    Object.values(value).forEach((child) => collectObjectReferences(child, references));
  }
  return references;
}

function assertFreshObjects(value, sourceReferences, path = "projection") {
  if (value === null || typeof value !== "object") return;

  assert.ok(!sourceReferences.has(value), `${path} must not reuse a source object or array`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFreshObjects(item, sourceReferences, `${path}[${index}]`));
  } else {
    Object.entries(value).forEach(([key, child]) => assertFreshObjects(child, sourceReferences, `${path}.${key}`));
  }
}

test("renders the explicit public profile projection as clean Markdown", () => {
  const projectPublicProfile = requireSubjectFunction("projectPublicProfile");
  const renderDossierMarkdown = requireSubjectFunction("renderDossierMarkdown");
  const projection = projectPublicProfile(profile);
  const markdown = renderDossierMarkdown(profile);
  const expected = expectedPublicProfile(profile);

  assert.deepEqual(projection, expected);

  assert.notStrictEqual(projection.identity, profile.identity);
  assert.notStrictEqual(projection.identity.roles, profile.identity.roles);
  assert.notStrictEqual(projection.capabilities.acts, profile.capabilities.acts);
  assert.notStrictEqual(projection.capabilities.acts[0], profile.capabilities.acts[0]);
  assert.notStrictEqual(projection.capabilities.acts[0].skills, profile.capabilities.acts[0].skills);
  assert.notStrictEqual(projection.stack.categories, profile.stack.categories);
  assert.notStrictEqual(projection.stack.categories[0].items, profile.stack.categories[0].items);
  assert.notStrictEqual(projection.work, profile.work_cases);
  assert.notStrictEqual(projection.work[0].links, profile.work_cases[0].links);
  assert.notStrictEqual(projection.timeline, profile.timeline);
  assert.notStrictEqual(projection.education[0], profile.timeline.find((entry) => entry.type === "education"));
  assert.notStrictEqual(projection.proof_wall.certifications[0], profile.proof_wall.certifications[0]);
  assert.notStrictEqual(projection.products[0], profile.products[0]);
  assert.notStrictEqual(projection.faq[0], profile.faq[0]);
  assertNoIdKeys(projection);
  assertFreshObjects(projection, collectObjectReferences(profile));
  assert.equal("extras" in projection.proof_wall, false);

  assert.match(markdown, /^# Zuriel Shanley Tanyory$/m);
  const identitySection = extractRootSection(markdown, "Identity");
  const introductionSection = extractRootSection(markdown, "Introduction");
  const capabilitiesSection = extractRootSection(markdown, "Capabilities");
  const stackSection = extractRootSection(markdown, "Stack");
  const workSection = extractRootSection(markdown, "Selected Work");
  const timelineSection = extractRootSection(markdown, "Timeline");
  const educationSection = extractRootSection(markdown, "Education");
  const proofSection = extractRootSection(markdown, "Proof Wall");
  const productsSection = extractRootSection(markdown, "Products");
  const brandsSection = extractRootSection(markdown, "Stack Brands");
  const faqSection = extractRootSection(markdown, "FAQ");

  assertRenderedField(identitySection, "name", expected.identity.name, "identity.name");
  expected.identity.roles.forEach((role, index) => {
    assertRenderedListItem(identitySection, role, `identity.roles[${index}]`);
  });
  for (const key of ["tagline", "one_liner", "role", "founder", "location", "education", "award", "email", "portrait_alt"]) {
    assertRenderedField(identitySection, key, expected.identity[key], `identity.${key}`);
  }
  expected.identity.socials.forEach((social, index) => {
    assertRenderedField(identitySection, "label", social.label, `identity.socials[${index}].label`);
    assertRenderedField(identitySection, "url", social.url, `identity.socials[${index}].url`);
  });
  expected.identity.metrics.forEach((metric, index) => {
    assertRenderedField(identitySection, "value", metric.value, `identity.metrics[${index}].value`);
    assertRenderedField(identitySection, "label", metric.label, `identity.metrics[${index}].label`);
  });

  expected.intro.bullets.forEach((bullet, index) => {
    assertRenderedListItem(introductionSection, bullet, `intro.bullets[${index}]`);
  });

  expected.capabilities.acts.forEach((act, actIndex) => {
    for (const key of ["act", "title", "narrative"]) {
      assertRenderedField(capabilitiesSection, key, act[key], `capabilities.acts[${actIndex}].${key}`);
    }
    act.skills.forEach((skill, skillIndex) => {
      assertRenderedField(capabilitiesSection, "name", skill.name, `capabilities.acts[${actIndex}].skills[${skillIndex}].name`);
      if (skill.since !== undefined) {
        assertRenderedField(capabilitiesSection, "since", skill.since, `capabilities.acts[${actIndex}].skills[${skillIndex}].since`);
      }
      if (skill.detail !== undefined) {
        assertRenderedField(capabilitiesSection, "detail", skill.detail, `capabilities.acts[${actIndex}].skills[${skillIndex}].detail`);
      }
    });
  });

  expected.stack.categories.forEach((category, categoryIndex) => {
    assertRenderedField(stackSection, "name", category.name, `stack.categories[${categoryIndex}].name`);
    category.items.forEach((item, itemIndex) => {
      assertRenderedListItem(stackSection, item, `stack.categories[${categoryIndex}].items[${itemIndex}]`);
    });
  });

  expected.work.forEach((workCase, workIndex) => {
    for (const key of ["kicker", "title", "period", "summary"]) {
      assertRenderedField(workSection, key, workCase[key], `work[${workIndex}].${key}`);
    }
    workCase.stack.forEach((item, itemIndex) => {
      assertRenderedListItem(workSection, item, `work[${workIndex}].stack[${itemIndex}]`);
    });
    workCase.links.forEach((link, linkIndex) => {
      assertRenderedField(workSection, "label", link.label, `work[${workIndex}].links[${linkIndex}].label`);
      assertRenderedField(workSection, "url", link.url, `work[${workIndex}].links[${linkIndex}].url`);
      if (link.note !== undefined) {
        assertRenderedField(workSection, "note", link.note, `work[${workIndex}].links[${linkIndex}].note`);
      }
    });
    if (workCase.note !== undefined) {
      assertRenderedField(workSection, "note", workCase.note, `work[${workIndex}].note`);
    }
  });

  expected.timeline.forEach((entry, index) => {
    for (const key of ["type", "org", "title", "period", "summary"]) {
      assertRenderedField(timelineSection, key, entry[key], `timeline[${index}].${key}`);
    }
  });

  expected.education.forEach((entry, index) => {
    for (const key of ["org", "title", "period", "summary"]) {
      assertRenderedField(educationSection, key, entry[key], `education[${index}].${key}`);
    }
  });

  expected.proof_wall.certifications.forEach((certification, index) => {
    for (const key of ["title", "issuer", "year", "validity", "caption"]) {
      if (certification[key] !== undefined) {
        assertRenderedField(proofSection, key, certification[key], `proof_wall.certifications[${index}].${key}`);
      }
    }
  });
  expected.proof_wall.awards.forEach((award, index) => {
    for (const key of ["title", "issuer", "year", "caption"]) {
      if (award[key] !== undefined) {
        assertRenderedField(proofSection, key, award[key], `proof_wall.awards[${index}].${key}`);
      }
    }
  });
  expected.proof_wall.ctf_results.forEach((result, index) => {
    for (const key of ["title", "organizer", "year", "result", "caption"]) {
      if (result[key] !== undefined) {
        assertRenderedField(proofSection, key, result[key], `proof_wall.ctf_results[${index}].${key}`);
      }
    }
  });
  expected.proof_wall.publications.forEach((publication, index) => {
    for (const key of ["title", "year", "link", "format"]) {
      assertRenderedField(proofSection, key, publication[key], `proof_wall.publications[${index}].${key}`);
    }
  });

  expected.products.forEach((product, productIndex) => {
    for (const key of ["name", "period", "kicker", "summary"]) {
      if (product[key] !== undefined) {
        assertRenderedField(productsSection, key, product[key], `products[${productIndex}].${key}`);
      }
    }
    product.stack.forEach((item, itemIndex) => {
      assertRenderedListItem(productsSection, item, `products[${productIndex}].stack[${itemIndex}]`);
    });
    product.links.forEach((link, linkIndex) => {
      assertRenderedField(productsSection, "label", link.label, `products[${productIndex}].links[${linkIndex}].label`);
      assertRenderedField(productsSection, "url", link.url, `products[${productIndex}].links[${linkIndex}].url`);
      if (link.note !== undefined) {
        assertRenderedField(productsSection, "note", link.note, `products[${productIndex}].links[${linkIndex}].note`);
      }
    });
    if (product.note !== undefined) {
      assertRenderedField(productsSection, "note", product.note, `products[${productIndex}].note`);
    }
  });

  assertRenderedField(brandsSection, "disclaimer", expected.stack_brands.disclaimer, "stack_brands.disclaimer");
  expected.stack_brands.brands.forEach((brand, index) => {
    assertRenderedField(brandsSection, "name", brand.name, `stack_brands.brands[${index}].name`);
    assertRenderedField(brandsSection, "context", brand.context, `stack_brands.brands[${index}].context`);
  });

  expected.faq.forEach((item, index) => {
    assertRenderedField(faqSection, "question", item.question, `faq[${index}].question`);
    assertRenderedField(faqSection, "answer", item.answer, `faq[${index}].answer`);
  });

  assert.doesNotMatch(markdown, /```json/);
  assert.doesNotMatch(markdown, /\*\*ID:\*\*/);
  assert.doesNotMatch(markdown, /\*\*Data Policy:\*\*/);
  assert.doesNotMatch(markdown, /\*\*Employer:\*\*/);
  assert.doesNotMatch(markdown, /\*\*Origin Story:\*\* true/);
});

test("omits optional derived identity rows when their source records are absent", () => {
  const projectPublicProfile = requireSubjectFunction("projectPublicProfile");
  const renderDossierMarkdown = requireSubjectFunction("renderDossierMarkdown");
  const sparseProfile = structuredClone(profile);
  sparseProfile.timeline = sparseProfile.timeline.filter((entry) => {
    const isCurrentEmployerRole = entry.type === "role" && entry.org === sparseProfile.identity.employer;
    const isFounderRole = entry.type === "role" && entry.title === "Founder";
    const isUniversityEducation = entry.type === "education" && entry.org.includes("University");
    return !isCurrentEmployerRole && !isFounderRole && !isUniversityEducation;
  });
  sparseProfile.proof_wall.awards = [];

  let projection;
  let markdown;
  assert.doesNotThrow(() => {
    projection = projectPublicProfile(sparseProfile);
    markdown = renderDossierMarkdown(sparseProfile);
  });

  for (const key of ["role", "founder", "education", "award"]) {
    assert.equal(key in projection.identity, false, `identity.${key} must be omitted`);
  }
  const identitySection = extractRootSection(markdown, "Identity");
  assert.doesNotMatch(identitySection, /^- \*\*(Role|Founder|Education|Award):\*\*/m);
  assert.doesNotMatch(markdown, /undefined/);
});

test("does not invent placeholders for empty conditional lists", () => {
  const renderDossierMarkdown = requireSubjectFunction("renderDossierMarkdown");
  const markdown = renderDossierMarkdown(profile);

  assert.doesNotMatch(markdown, /None recorded/);
});

test("sorts projected education by descending start year like the education component", () => {
  const projectPublicProfile = requireSubjectFunction("projectPublicProfile");
  const reorderedProfile = structuredClone(profile);
  const nonEducationEntries = reorderedProfile.timeline.filter((entry) => entry.type !== "education");
  const reversedEducationEntries = reorderedProfile.timeline
    .filter((entry) => entry.type === "education")
    .reverse();
  reorderedProfile.timeline = [...nonEducationEntries, ...reversedEducationEntries];

  const projection = projectPublicProfile(reorderedProfile);
  const projectedOrganizations = projection.education.map((entry) => entry.org);
  const projectedStartYears = projection.education.map((entry) => Number.parseInt(entry.period.match(/\d{4}/)?.[0] ?? "0", 10));

  assert.deepEqual(
    reversedEducationEntries.map((entry) => entry.org),
    ["Ngee Ann Polytechnic", "National University of Singapore"],
  );
  assert.deepEqual(
    projectedOrganizations,
    ["National University of Singapore", "Ngee Ann Polytechnic"],
  );
  assert.deepEqual(projectedStartYears, [2024, 2019]);
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
    const excludedValues = new Map([
      ["identity.github.data_policy", profile.identity.github.data_policy],
      ["capabilities.acts[1].id", profile.capabilities.acts[1].id],
      ["work_cases[0].id", profile.work_cases[0].id],
      ["work_cases[1].evidence[0].media", profile.work_cases[1].evidence[0].media],
      ["timeline[0].id", profile.timeline[0].id],
      ["proof_wall.certifications[0].id", profile.proof_wall.certifications[0].id],
      ["proof_wall.certifications[1].image", profile.proof_wall.certifications[1].image],
      ["products[0].id", profile.products[0].id],
      ["products[0].media[0].media", profile.products[0].media[0].media],
      ["faq[0].id", profile.faq[0].id],
      ["proof_wall.extras[0].caption", profile.proof_wall.extras[0].caption],
      ["chat.disclaimer", profile.chat.disclaimer],
      ["chat.intent_chips[1]", profile.chat.intent_chips[1]],
      ["easter_eggs.terminal.source", profile.easter_eggs.terminal.source],
      ["easter_eggs.terminal.note", profile.easter_eggs.terminal.note],
      ["easter_eggs.towerblock.repo", profile.easter_eggs.towerblock.repo],
      ["meta.description", profile.meta.description],
      ["meta.og.image", profile.meta.og.image],
    ]);
    for (const [sourcePath, value] of excludedValues) {
      assert.ok(!dossier.includes(value), `dossier.md must exclude ${sourcePath}: ${value}`);
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
