import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const prerequisiteComment =
  "# Prerequisite: repo Settings -> Environments -> deploy must exist with a required reviewer and the CLOUDFLARE_* secrets; this workflow cannot create it.";
const environmentEndpoint =
  'repos/${{ github.repository }}/environments/deploy';

async function readWorkflow(fileName) {
  return readFile(new URL(`../.github/workflows/${fileName}`, import.meta.url), "utf8");
}

for (const [fileName, followingStep] of [
  ["deploy.yml", "- name: Deploy site worker"],
  ["preview-deploy.yml", "- name: Upload preview version (trusted base-branch config)"],
]) {
  test(`${fileName} verifies deploy reviewer protection before release`, async () => {
    const workflow = await readWorkflow(fileName);
    const stepName = "- name: Verify deploy environment protection";
    const stepIndex = workflow.indexOf(stepName);

    assert.notEqual(stepIndex, -1, "the release-evidence preflight step is present");
    assert.ok(workflow.includes(prerequisiteComment), "the prerequisite comment is retained");
    assert.ok(workflow.includes("actions: read"), "the workflow may read environment settings");
    assert.ok(workflow.includes("Release evidence"), "the step documents release evidence");
    assert.ok(workflow.includes("GH_TOKEN: ${{ github.token }}"), "the API uses the workflow token");
    assert.ok(workflow.includes("set -euo pipefail"), "the preflight fails safely");
    assert.ok(workflow.includes(environmentEndpoint), "the deploy environment is fetched");
    assert.ok(workflow.includes(".protection_rules[]?.type"), "the protection rules are inspected");
    assert.ok(workflow.includes("grep -Fx 'required_reviewers'"), "a required reviewer rule is required");
    assert.ok(workflow.includes("::error::"), "operators receive a workflow error");
    assert.ok(workflow.includes("Settings > Environments"), "operators are told how to fix configuration");
    assert.ok(stepIndex < workflow.indexOf(followingStep), "preflight runs before release");
  });
}

test("preview comments identify the enforced noindex header", async () => {
  const workflow = await readWorkflow("preview-deploy.yml");

  assert.ok(
    workflow.includes("X-Robots-Tag: noindex"),
    "the preview comment names the host-specific indexing control",
  );
  assert.ok(
    !workflow.includes("noindex hardening lands with M8"),
    "the completed M8 work is not described as future work",
  );
});
