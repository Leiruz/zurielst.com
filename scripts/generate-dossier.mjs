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

function renderObject(value, level, lines) {
  for (const [key, child] of Object.entries(value)) {
    const label = labelFor(key);

    if (Array.isArray(child)) {
      lines.push("", heading(level, label));
      if (child.length === 0) {
        lines.push("", "- None recorded.");
      } else if (child.every((item) => item === null || typeof item !== "object")) {
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
  return {
    identity: profile.identity,
    intro: profile.intro,
    capabilities: profile.capabilities,
    stack: profile.stack,
    work: profile.work_cases,
    timeline: profile.timeline.filter((entry) => entry.type !== "education"),
    education: profile.timeline.filter((entry) => entry.type === "education"),
    proof_wall: {
      certifications: profile.proof_wall.certifications,
      awards: profile.proof_wall.awards,
      ctf_results: profile.proof_wall.ctf_results,
      publications: profile.proof_wall.publications,
    },
    products: profile.products,
    stack_brands: profile.stack_brands,
    faq: profile.faq,
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
