import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const prerequisiteComment =
  "# Prerequisite: repo Settings -> Environments -> deploy must exist with a required reviewer and the CLOUDFLARE_* secrets; this workflow cannot create it.";
const environmentEndpoint =
  'repos/${{ github.repository }}/environments/deploy';
const actionsPullRequestSetting =
  "Allow GitHub Actions to create and approve pull requests";

async function readWorkflow(fileName) {
  return readFile(new URL(`../.github/workflows/${fileName}`, import.meta.url), "utf8");
}

async function readRepositoryFile(fileName) {
  return readFile(new URL(`../${fileName}`, import.meta.url), "utf8");
}

test("Windows Vitest uses one worker without changing Linux isolation", async () => {
  const config = await readRepositoryFile("vitest.config.ts");

  assert.match(
    config,
    /singleWorker:\s*process\.platform\s*===\s*["']win32["']/,
    "Windows enables the pool's supported single-worker mode while Linux keeps the false default",
  );
  assert.doesNotMatch(
    config,
    /dangerouslyIgnoreUnhandledErrors|passWithNoTests/,
    "the configuration must not ignore real Vitest failures",
  );
});

test("operations docs record the Windows-only Vitest teardown fix", async () => {
  const documents = await Promise.all([
    readRepositoryFile("docs/runbook.md"),
    readRepositoryFile("docs/cutover-2026-08-30.md"),
  ]);

  for (const document of documents) {
    assert.match(document, /Windows[^.]*single-worker mode/i);
    assert.match(document, /Linux[\s\S]{0,120}default[\s\S]{0,120}strict/i);
    assert.doesNotMatch(document, /do not block on teardown-only failures/i);
  }
});

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

test("PR and deploy pipelines execute the Chromium layout gate after build", async () => {
  for (const fileName of ["pr-ci.yml", "deploy.yml"]) {
    const workflow = await readWorkflow(fileName);
    const buildIndex = workflow.indexOf("- run: npm run build");
    const gateIndex = workflow.indexOf("- run: npm run layout:gate");
    assert.notEqual(buildIndex, -1, `${fileName} builds the site`);
    assert.notEqual(gateIndex, -1, `${fileName} runs the layout gate`);
    assert.ok(gateIndex > buildIndex, `${fileName} runs the layout gate after the build`);
  }
});

test("production build injects the deployed commit SHA", async () => {
  const workflow = await readWorkflow("deploy.yml");
  const buildIndex = workflow.indexOf("- run: npm run build");
  const nextStepIndex = workflow.indexOf("\n      - ", buildIndex + 1);
  const buildStep = workflow.slice(buildIndex, nextStepIndex);

  assert.ok(buildIndex >= 0, "deploy workflow must build the static export");
  assert.ok(buildStep.includes("BUILD_SHA: ${{ github.sha }}"));
});

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
  assert.ok(
    workflow.includes("--user-agent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) zurielst-canary'"),
    "status checks probe with a browser-like user agent so heuristic bot challenges do not false-alarm the canary",
  );
  assert.ok(
    workflow.includes("^cf-mitigated: challenge"),
    "a 403 is tolerated only when Cloudflare marks it as a bot challenge",
  );
  assert.match(
    workflow,
    /HTTP_STATUS" = "403"[\s\S]*?cf-mitigated: challenge/,
    "the challenge tolerance is scoped to exactly 403 responses",
  );
  assert.ok(
    workflow.includes('if [ "$CHALLENGED" = "0" ]; then'),
    "the apex content fingerprint is skipped only for challenged probes",
  );
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

test("analytics snapshot refresh uses pinned actions and a direct gh pull request", async () => {
  const workflow = await readWorkflow("analytics-snapshot.yml");

  assert.match(workflow, /cron:\s*["']17 3 \* \* 1["']/);
  assert.ok(workflow.includes("workflow_dispatch:"), "operators may refresh manually");
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*write\s*\n\s+pull-requests:\s*write/);
  assert.ok(workflow.includes("concurrency:"), "overlapping refreshes are serialized");
  assert.ok(workflow.includes("timeout-minutes:"), "the job has a finite timeout");

  assert.ok(
    workflow.includes("actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"),
    "checkout reuses the repository pin",
  );
  assert.ok(
    workflow.includes("actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af"),
    "setup-node reuses the repository pin",
  );
  for (const line of workflow.split("\n").filter((candidate) => candidate.includes("uses:"))) {
    assert.match(line, /@[0-9a-f]{40}(?:\s|$)/, `action is SHA-pinned: ${line.trim()}`);
  }

  assert.ok(workflow.includes("node scripts/fetch-analytics.mjs"));
  assert.ok(workflow.includes("CF_ANALYTICS_TOKEN: ${{ secrets.CF_ANALYTICS_TOKEN }}"));
  assert.equal(
    workflow.match(/secrets\.CF_ANALYTICS_TOKEN/g)?.length,
    1,
    "the analytics secret is exposed to the fetch step only",
  );
  assert.ok(workflow.includes("git add -- content/analytics-snapshot.json"));
  assert.ok(workflow.includes("analytics/refresh"));
  assert.ok(workflow.includes("--force-with-lease"));
  assert.ok(workflow.includes("GH_TOKEN: ${{ github.token }}"));
  assert.ok(workflow.includes("gh pr list"));
  assert.ok(workflow.includes("gh pr create"));
  assert.ok(!workflow.includes("peter-evans/create-pull-request"));

  assert.ok(
    workflow.includes(`# Owner prerequisite: repo Settings -> Actions -> General -> Workflow permissions must enable "${actionsPullRequestSetting}".`),
    "the workflow records the repository-level pull request prerequisite",
  );
  const guardedCreateIndex = workflow.indexOf("if ! gh pr create");
  const createErrorIndex = workflow.indexOf("::error::", guardedCreateIndex);
  const settingIndex = workflow.indexOf(actionsPullRequestSetting, createErrorIndex);
  const createExitIndex = workflow.indexOf("exit 1", settingIndex);
  const createGuardEndIndex = workflow.indexOf("\n            fi", createExitIndex);
  assert.notEqual(guardedCreateIndex, -1, "pull request creation failures are caught");
  assert.ok(createErrorIndex > guardedCreateIndex, "a rejected pull request emits an annotation");
  assert.ok(settingIndex > createErrorIndex, "the annotation names the required setting");
  assert.ok(createExitIndex > settingIndex, "the rejected pull request still fails the job");
  assert.ok(createGuardEndIndex > createExitIndex, "the failure handling stays in the create guard");
});

test("runbook documents analytics refresh prerequisites and token rotation", async () => {
  const runbook = await readFile(new URL("../docs/runbook.md", import.meta.url), "utf8");

  assert.ok(runbook.includes(actionsPullRequestSetting));
  assert.match(runbook, /CF_ANALYTICS_TOKEN.*repository Actions secret/is);
  assert.ok(runbook.includes("`Account > Account Analytics > Read` as its only permission"));
  assert.match(runbook, /It needs no\s+zone or edit permissions/);
  assert.ok(runbook.includes("https://api.cloudflare.com/client/v4/graphql"));
  assert.ok(runbook.includes("rumPageloadEventsAdaptiveGroups"));
  assert.ok(runbook.includes("set -o pipefail"));
  assert.ok(runbook.includes(".errors == null and (.data.viewer.accounts | length == 1)"));
  assert.ok(runbook.includes("gh secret set CF_ANALYTICS_TOKEN --repo Leiruz/zurielst.com"));

  const replacementIndex = runbook.indexOf("replacement token");
  const verificationIndex = runbook.indexOf("run the verification query", replacementIndex);
  const updateIndex = runbook.indexOf("update the repository secret", verificationIndex);
  const dispatchIndex = runbook.indexOf("manually dispatch `analytics-snapshot.yml`", updateIndex);
  const confirmationIndex = runbook.indexOf("confirm success", dispatchIndex);
  const revocationIndex = runbook.indexOf("revoke the old token", confirmationIndex);
  assert.ok(replacementIndex > -1, "rotation starts with a replacement token");
  assert.ok(verificationIndex > replacementIndex, "the replacement is verified first");
  assert.ok(updateIndex > verificationIndex, "only a verified token replaces the secret");
  assert.ok(dispatchIndex > updateIndex, "the workflow is dispatched with the replacement");
  assert.ok(confirmationIndex > dispatchIndex, "the replacement workflow must succeed");
  assert.ok(revocationIndex > confirmationIndex, "the old token is revoked last");
});

test("runbook records implemented consent-gated Web Analytics operations", async () => {
  const runbook = await readFile(new URL("../docs/runbook.md", import.meta.url), "utf8");
  const runbookText = runbook.replace(/\s+/g, " ");

  assert.ok(!runbook.includes(
    "disable Web Analytics automatic setup and ship the manual snippet behind the consent measurement category, with the snippet token referenced from the dashboard",
  ));
  assert.ok(runbook.includes("Manual Cloudflare Web Analytics setup has been active since 2026-09-01."));
  assert.ok(runbook.includes("c15t `measurement` consent category"));
  assert.ok(runbook.includes("default decline and an ignored banner make no analytics request"));
  assert.ok(runbook.includes("`components/registry/cloudflare-web-analytics.tsx`"));
  assert.ok(runbook.includes("`CLOUDFLARE_ANALYTICS_TOKEN`"));
  assert.match(runbook, /working hypothesis for the site tag,\s*not a verified beacon token/);

  const readAccessIndex = runbookText.indexOf("only proves that the token can read analytics data");
  const consentedVisitIndex = runbookText.indexOf("make a consented visit");
  const pageviewIndex = runbookText.indexOf("confirm the pageview appears in `rumPageloadEventsAdaptiveGroups`");
  const replacementIndex = runbookText.indexOf("replace the one `CLOUDFLARE_ANALYTICS_TOKEN` constant and redeploy");
  assert.ok(readAccessIndex > -1, "the token query is limited to read-access verification");
  assert.ok(consentedVisitIndex > readAccessIndex, "a consented visit follows token read verification");
  assert.ok(pageviewIndex > consentedVisitIndex, "the query confirms the consented pageview");
  assert.ok(replacementIndex > pageviewIndex, "a missing pageview triggers token replacement and redeploy");
});

test("runbook provides an executable consented beacon-ingestion verification loop", async () => {
  const runbook = await readFile(new URL("../docs/runbook.md", import.meta.url), "utf8");
  const procedure = runbook.match(
    /### Beacon ingestion verification[\s\S]*?```bash\n([\s\S]*?)\n```/,
  )?.[1];

  assert.ok(procedure, "the ingestion check is a separate Bash procedure");
  assert.match(procedure, /set -euo pipefail/);
  assert.match(procedure, /analytics_day="\$\(date -u \+%F\)"/);
  assert.match(procedure, /rumPageloadEventsAdaptiveGroups/);
  assert.ok(procedure.includes(String.raw`\$accountTag`), "GraphQL variables are protected from Bash expansion");
  assert.ok(!procedure.includes(String.raw`\\$accountTag`), "GraphQL variables use one Bash escape");
  assert.match(procedure, /curl --fail-with-body --silent --show-error/);
  assert.match(procedure, /GraphQL errors/);
  assert.match(procedure, /account envelope/);
  assert.match(procedure, /count is not numeric/);
  assert.match(procedure, /baseline_count="\$\(analytics_count\)"/);
  assert.match(procedure, /Baseline count.*\$\{baseline_count\}/);
  assert.match(procedure, /Make a consented visit/);
  assert.match(procedure, /while true; do/);
  assert.match(procedure, /read -r/);
  assert.match(procedure, /after_count="\$\(analytics_count\)"/);
  assert.match(procedure, /After count.*\$\{after_count\}/);
  assert.match(procedure, /\(\( after_count > baseline_count \)\)/);
  assert.match(procedure, /\[\[ "\$answer" == "stop" \]\]/);
  assert.match(procedure, /replace the one CLOUDFLARE_ANALYTICS_TOKEN constant and redeploy/i);
});

test("retirement checklist records repository consolidation safeguards", async () => {
  const cutover = await readFile(new URL("../docs/cutover-2026-08-30.md", import.meta.url), "utf8");

  assert.ok(cutover.includes("### Repository consolidation"));
  assert.match(cutover, /back up local clones of `Leiruz\/resume` and `Leiruz\/Zuriel`/i);
  assert.match(cutover, /selectively import still-wanted files into `zurielst\.com`/i);
  assert.match(cutover, /Never merge full history because the old resume history contains the\s+unsanitized resume PDF/);
  assert.match(cutover, /Archive both repositories on GitHub only after GitHub Pages retirement/);
  assert.match(cutover, /resume repository remains the rollback origin until then/i);
  assert.match(cutover, /Delete the repositories later only after a stable period passes/);
  assert.match(cutover, /open `resume#2` pull request on the old repository becomes moot when\s+it is archived/i);
  assert.ok(!cutover.includes("Execute the old-repo history decision."));
});
