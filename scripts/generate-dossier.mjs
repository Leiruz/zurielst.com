import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_LABELS = new Map([
  ["identity", "Identity"],
  ["intro", "Introduction"],
  ["capabilities", "Capabilities"],
  ["stack", "Stack"],
  ["work", "Selected Work"],
  ["work_cases", "Selected Work"],
  ["timeline", "Timeline"],
  ["education", "Education"],
  ["proof_wall", "Proof Wall"],
  ["products", "Products"],
  ["faq", "FAQ"],
  ["chat", "Chat"],
  ["easter_eggs", "Easter Eggs"],
  ["stack_brands", "Stack Brands"],
  ["meta", "Metadata"],
]);

const WORD_LABELS = new Map([
  ["ai", "AI"],
  ["ctf", "CTF"],
  ["faq", "FAQ"],
  ["github", "GitHub"],
  ["id", "ID"],
  ["url", "URL"],
]);

function heading(level, label) {
  return `${"#".repeat(Math.min(level, 6))} ${label}`;
}

function labelFor(key) {
  return key
    .split("_")
    .map((word) => WORD_LABELS.get(word.toLowerCase()) ?? `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function recordLabel(value, index) {
  for (const key of ["name", "title", "question", "platform", "label", "id"]) {
    if (typeof value[key] === "string") return value[key];
  }
  return `Record ${index + 1}`;
}

function startYear(period) {
  return Number.parseInt(period.match(/\d{4}/)?.[0] ?? "0", 10);
}

function renderObject(value, level, lines) {
  for (const [key, child] of Object.entries(value)) {
    const label = labelFor(key);

    if (Array.isArray(child)) {
      if (child.length === 0) continue;

      lines.push("", heading(level, label));
      if (child.every((item) => item === null || typeof item !== "object")) {
        lines.push("", ...child.map((item) => `- ${String(item)}`));
      } else {
        child.forEach((item, index) => {
          lines.push("", heading(level + 1, recordLabel(item, index)));
          renderObject(item, level + 2, lines);
        });
      }
      continue;
    }

    if (child !== null && typeof child === "object") {
      lines.push("", heading(level, label));
      renderObject(child, level + 1, lines);
      continue;
    }

    lines.push(`- **${label}:** ${String(child)}`);
  }
}

export function projectPublicProfile(profile) {
  const currentRole = profile.timeline.find(
    (entry) => entry.type === "role" && entry.org === profile.identity.employer,
  );
  const founderRecord = profile.timeline.find(
    (entry) => entry.type === "role" && entry.title === "Founder",
  );
  const educationRecord = profile.timeline.find(
    (entry) => entry.type === "education" && entry.org.includes("University"),
  );
  const award = profile.proof_wall.awards[0];

  const identity = {
    name: profile.identity.name,
    roles: profile.identity.roles.map((role) => role),
    tagline: profile.identity.tagline,
    one_liner: profile.identity.bio_hook,
  };

  if (currentRole) identity.role = `${currentRole.title} @ ${currentRole.org}`;
  if (founderRecord) identity.founder = `${founderRecord.org}, ${founderRecord.period}`;
  identity.location = `${profile.identity.location.city} ${profile.identity.location.timezone}`;
  if (educationRecord) identity.education = `${educationRecord.title}, ${educationRecord.org}`;
  if (award) identity.award = `${award.title}, ${award.year}`;
  identity.email = profile.identity.email;
  identity.socials = profile.identity.socials.map((social) => ({
    label: social.platform,
    url: social.url,
  }));
  identity.metrics = profile.identity.metrics.map((metric) => ({
    value: metric.value,
    label: metric.label,
  }));
  identity.portrait_alt = profile.identity.portrait.alt;

  return {
    identity,
    intro: {
      bullets: profile.intro.bullets.map((bullet) => bullet),
    },
    capabilities: {
      acts: profile.capabilities.acts.map((act) => ({
        act: act.act,
        title: act.title,
        narrative: act.narrative,
        skills: act.skills.map((skill) => {
          const publicSkill = {
            name: skill.name,
          };

          if (skill.since !== undefined) publicSkill.since = skill.since;
          if (skill.detail !== undefined) publicSkill.detail = skill.detail;
          return publicSkill;
        }),
      })),
    },
    stack: {
      categories: profile.stack.categories.map((category) => ({
        name: category.name,
        items: category.items.map((item) => item),
      })),
    },
    work: profile.work_cases.map((workCase) => {
      const publicWorkCase = {
        kicker: workCase.kicker,
        title: workCase.title,
        period: workCase.period,
        summary: workCase.summary,
        stack: workCase.stack.map((item) => item),
        links: workCase.links.map((link) => {
          const publicLink = {
            label: link.label,
            url: link.url,
          };

          if (link.note !== undefined) publicLink.note = link.note;
          return publicLink;
        }),
      };

      if (workCase.note !== undefined) publicWorkCase.note = workCase.note;
      return publicWorkCase;
    }),
    timeline: profile.timeline
      .filter((entry) => entry.type !== "education")
      .map((entry) => ({
        type: entry.type,
        org: entry.org,
        title: entry.title,
        period: entry.period,
        summary: entry.summary,
      })),
    education: profile.timeline
      .filter((entry) => entry.type === "education")
      .sort((left, right) => startYear(right.period) - startYear(left.period))
      .map((entry) => ({
        org: entry.org,
        title: entry.title,
        period: entry.period,
        summary: entry.summary,
      })),
    proof_wall: {
      certifications: profile.proof_wall.certifications.map((certification) => {
        const publicCertification = {
          title: certification.title,
          issuer: certification.issuer,
        };

        if (certification.year !== undefined) publicCertification.year = certification.year;
        if (certification.validity !== undefined) publicCertification.validity = certification.validity;
        if (certification.caption !== undefined) publicCertification.caption = certification.caption;
        return publicCertification;
      }),
      awards: profile.proof_wall.awards.map((proofAward) => {
        const publicAward = {
          title: proofAward.title,
          issuer: proofAward.issuer,
          year: proofAward.year,
        };

        if (proofAward.caption !== undefined) publicAward.caption = proofAward.caption;
        return publicAward;
      }),
      ctf_results: profile.proof_wall.ctf_results.map((result) => {
        const publicResult = {
          title: result.title,
          organizer: result.organizer,
          year: result.year,
          result: result.result,
        };

        if (result.caption !== undefined) publicResult.caption = result.caption;
        return publicResult;
      }),
      publications: profile.proof_wall.publications.map((publication) => ({
        title: publication.title,
        year: publication.year,
        link: publication.link,
        format: publication.format,
      })),
    },
    products: profile.products.map((product) => {
      const publicProduct = {
        name: product.name,
      };

      if (product.origin_story) publicProduct.kicker = "Origin story";
      if (product.period !== undefined) publicProduct.period = product.period;
      publicProduct.summary = product.summary;
      publicProduct.stack = product.stack.map((item) => item);
      publicProduct.links = product.links.map((link) => {
        const publicLink = {
          label: link.label,
          url: link.url,
        };

        if (link.note !== undefined) publicLink.note = link.note;
        return publicLink;
      });
      if (product.note !== undefined) publicProduct.note = product.note;
      return publicProduct;
    }),
    stack_brands: {
      disclaimer: profile.stack_brands.disclaimer,
      brands: profile.stack_brands.brands.map((brand) => ({
        name: brand.name,
        context: brand.context,
      })),
    },
    faq: profile.faq.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  };
}

export function renderDossierMarkdown(profile) {
  const publicProfile = projectPublicProfile(profile);
  const lines = [
    `# ${publicProfile.identity.name}`,
  ];

  for (const [key, value] of Object.entries(publicProfile)) {
    lines.push("", heading(2, ROOT_LABELS.get(key) ?? labelFor(key)));
    renderObject(value, 3, lines);
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function renderLlmsText(profile) {
  return `# ${profile.identity.name}\n\n> ${profile.meta.description}\n\n- [Full public dossier](https://zurielst.com/dossier.md): Complete public profile, experience, work, proof, products, and contact details.\n`;
}

export async function generateDossierFiles({
  outputDirectory,
  profilePath,
}) {
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, "dossier.md"), renderDossierMarkdown(profile)),
    writeFile(path.join(outputDirectory, "llms.txt"), renderLlmsText(profile)),
  ]);
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);

if (isDirectExecution) {
  const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
  await generateDossierFiles({
    outputDirectory: path.join(repositoryRoot, "out"),
    profilePath: path.join(repositoryRoot, "content", "profile.json"),
  });
  console.log("Generated out/dossier.md and out/llms.txt");
}
