import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyDataOnlyDeploy(anchor, cwd = process.cwd()) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (git("rev-parse", "--is-shallow-repository").trim() !== "false") {
    throw new Error("Data-only deploy requires full Git history; use checkout fetch-depth: 0.");
  }
  // A first-parent diff alone also accepts snapshot-only merge commits.
  const revisions = git("rev-list", "--parents", "-n", "1", "HEAD").trim().split(/\s+/);
  if (revisions.length !== 2) {
    throw new Error("Data-only deploy requires HEAD to have exactly one parent.");
  }
  if (!anchor) {
    throw new Error("No successful deployment evidence exists; refusing data-only deploy.");
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(anchor)) {
    throw new Error("The deployed anchor must be a full commit SHA.");
  }
  try {
    git("rev-parse", "--verify", `${anchor}^{commit}`);
  } catch {
    throw new Error("The deployed anchor is missing from Git history; refusing data-only deploy.");
  }
  try {
    git("merge-base", "--is-ancestor", anchor, "HEAD");
  } catch {
    throw new Error("The deployed anchor is not an ancestor of HEAD or ancestry could not be verified.");
  }
  // Compare the entire release delta so a snapshot cannot carry undeployed code.
  // NUL delimiters and disabled renames preserve exact path identity.
  const changedFiles = git("diff", "--name-only", "--no-renames", "-z", anchor, "HEAD", "--");
  if (changedFiles !== "content/analytics-snapshot.json\0") {
    throw new Error("Data-only deploy requires exactly content/analytics-snapshot.json to change since the deployed anchor.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyDataOnlyDeploy(process.argv[2]);
    console.log("Data-only deployment verified against the successfully deployed anchor.");
  } catch (error) {
    const message = error.message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
    console.error(`::error::${message}`);
    process.exitCode = 1;
  }
}
