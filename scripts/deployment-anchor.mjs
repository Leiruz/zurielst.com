import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function requestGitHubJson(endpoint, paginate = false) {
  const args = ["api", "--method", "GET", endpoint];
  if (paginate) args.push("--paginate", "--slurp");
  const data = JSON.parse(execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  if (!Array.isArray(data) || (paginate && !data.every(Array.isArray))) {
    throw new Error("Invalid deployment API response.");
  }
  return paginate ? data.flat() : data;
}

// GitHub lists statuses newest first. Only the latest state is release evidence:
// https://docs.github.com/en/rest/deployments/statuses#list-deployment-statuses
export function findDeploymentAnchor(repository, requestJson = requestGitHubJson) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    throw new Error("A valid GitHub repository is required to look up deployment evidence.");
  }
  const endpoint = `repos/${repository}/deployments`;
  const deployments = [];
  for (const environment of ["deploy", "deploy-auto"]) {
    const history = requestJson(`${endpoint}?environment=${environment}&per_page=100`, true);
    if (!Array.isArray(history) || history.some((deployment) =>
      !deployment || deployment.environment !== environment ||
      !Number.isSafeInteger(deployment.id) || deployment.id <= 0 ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(deployment.sha ?? "") ||
      !Number.isFinite(Date.parse(deployment.created_at)))) {
      throw new Error(`Invalid deployment evidence for ${environment}.`);
    }
    deployments.push(...history);
  }

  deployments.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  for (const deployment of deployments) {
    const statuses = requestJson(`${endpoint}/${deployment.id}/statuses?per_page=1`);
    if (!Array.isArray(statuses)) throw new Error("Invalid deployment status evidence.");
    if (statuses[0]?.state === "success") return deployment.sha;
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
