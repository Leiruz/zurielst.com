import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function requestGitHubJson(endpoint, paginate = false) {
  const args = ["api", "--method", "GET", endpoint];
  if (paginate) args.push("--paginate", "--slurp");
  return JSON.parse(execFileSync("gh", args, {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024,
  }));
}

// Both push and workflow_dispatch runs of this workflow publish to production.
// https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow
export function findDeploymentAnchor(repository, requestJson = requestGitHubJson, cwd = process.cwd()) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    throw new Error("A valid GitHub repository is required to look up deployment evidence.");
  }
  const endpoint = `repos/${repository}/actions/workflows/deploy.yml/runs?status=success&branch=main&per_page=50`;
  const pages = requestJson(endpoint, true);
  if (!Array.isArray(pages) || !pages.every((page) => Array.isArray(page?.workflow_runs))) {
    throw new Error("Invalid deployment API response.");
  }
  const runs = pages.flatMap((page) => page.workflow_runs);
  if (runs.some((run) =>
    !run || !Number.isSafeInteger(run.id) || run.id <= 0 ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(run.head_sha ?? "") ||
    !Number.isFinite(Date.parse(run.created_at)))) {
    throw new Error("Invalid deployment evidence for deploy.yml.");
  }

  runs.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  for (const run of runs) {
    if (run.conclusion !== "success" || run.path !== ".github/workflows/deploy.yml") continue;
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", run.head_sha, "HEAD"], {
        cwd, stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      // A divergent or unavailable commit cannot anchor this checkout.
      if (error.status === 1 || error.status === 128) continue;
      throw error;
    }
    return run.head_sha;
  }
  throw new Error("No successful deployment evidence exists in deploy or deploy-auto; run a reviewer-approved deploy first.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    // stdout contains only the SHA so the workflow can pass it to the Git guard.
    console.log(findDeploymentAnchor(process.env.GITHUB_REPOSITORY));
  } catch (error) {
    const message = error.message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
    console.error(`::error::Could not establish a trusted deployment anchor: ${message}`);
    process.exitCode = 1;
  }
}
