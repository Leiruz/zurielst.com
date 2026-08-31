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

async function readRepositoryFile(fileName) {
  return readFile(new URL(`../${fileName}`, import.meta.url), "utf8");
}

test("chat configs and operations docs agree on the resolved production limits", async () => {
  const [routelessConfig, cutoverConfig, runbook, cutoverRecord] = await Promise.all([
    readRepositoryFile("workers/chat-api/wrangler.jsonc"),
    readRepositoryFile("workers/chat-api/wrangler.cutover.jsonc"),
    readRepositoryFile("docs/runbook.md"),
    readRepositoryFile("docs/cutover-2026-08-30.md"),
  ]);

  for (const [name, config] of [
    ["routeless config", routelessConfig],
    ["cutover overlay", cutoverConfig],
  ]) {
    assert.match(config, /"DAILY_CAP":\s*"44"/, `${name} uses the 44-chat daily cap`);
    assert.match(
      config,
      /"namespace_id":\s*"4169117853"/,
      `${name} uses the production rate-limiter namespace`,
    );
  }

  for (const [name, document] of [
    ["runbook", runbook],
    ["cutover record", cutoverRecord],
  ]) {
    assert.match(document, /resolved on 2026-08-31/i, `${name} dates the resolution`);
    assert.match(document, /DAILY_CAP\s*"44"/i, `${name} states the resolved daily cap`);
    assert.match(
      document,
      /RATE_LIMITER[^\n]*4169117853/i,
      `${name} states the resolved rate-limiter namespace`,
    );
    assert.match(
      document,
      /differ(?:s)?\s+only\s+by\s+routes/i,
      `${name} states that the overlay now differs only by routes`,
    );
    assert.doesNotMatch(document, /Known drift|Config drift noticed|"120"|"29"|"1001"/i);
  }
});

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

test("monitor runs a secretless six-hour production canary", async () => {
  const workflow = await readWorkflow("monitor.yml");

  assert.match(workflow, /cron:\s*['"]0 \*\/6 \* \* \*['"]/);
  assert.ok(workflow.includes("workflow_dispatch:"), "operators may run the canary manually");
  assert.ok(workflow.includes("set -euo pipefail"), "curl or assertion failures stop the canary");
  assert.ok(workflow.includes("::error::"), "failures surface as workflow annotations");
  assert.ok(!workflow.includes("secrets."), "the canary has no secret dependency");
  assert.ok(!workflow.includes("actions/"), "the canary needs no action or checkout dependency");

  for (const expected of [
    "https://zurielst.com/",
    "https://www.zurielst.com/",
    "https://staging.zurielst.com/",
    "https://zurielst.com/api/chat",
    "https://zurielst.com/sitemap.xml",
    "https://zurielst.com/media/resume.pdf",
    "Zuriel Shanley Tanyory",
  ]) {
    assert.ok(workflow.includes(expected), `the canary includes ${expected}`);
  }

  assert.match(workflow, /check_status\s+"apex"[^\n]+200/);
  assert.match(workflow, /check_status\s+"www"[^\n]+301/);
  assert.match(workflow, /check_status\s+"staging"[^\n]+200/);
  assert.match(workflow, /check_status\s+"sitemap"[^\n]+200/);
  assert.match(workflow, /check_status\s+"resume"[^\n]+200/);
  assert.ok(workflow.includes("--request POST"), "chat is exercised with POST");
  assert.ok(workflow.includes("User-Agent: Mozilla/5.0"), "chat uses a browser-like user agent");
  assert.ok(workflow.includes("Origin: https://zurielst.com"), "chat carries its production origin");
  assert.ok(workflow.includes("text/event-stream"), "a streamed answer is accepted");
  assert.ok(workflow.includes("application/json"), "a canned JSON answer is accepted");
  assert.match(
    workflow,
    /CHAT_STATUS[^\n]+!= 200/,
    "any non-200 chat status fails the canary",
  );
  assert.ok(
    workflow.includes("ignore previous instructions"),
    "the probe message triggers the budget-free pre-filter deflection",
  );
  assert.ok(
    !/-ge 500/.test(workflow),
    "the permissive server-error-only rejection is gone",
  );
});
