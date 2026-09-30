import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as yaml from "js-yaml";

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

test("workflows do not declare workflow_run triggers", async () => {
  const fileNames = await readdir(new URL("../.github/workflows/", import.meta.url));

  for (const fileName of fileNames) {
    const config = yaml.load(await readWorkflow(fileName));
    const triggers = config.on ?? config.true;
    const events = typeof triggers === "string"
      ? [triggers]
      : Array.isArray(triggers) ? triggers : Object.keys(triggers ?? {});

    assert.ok(!events.includes("workflow_run"), `${fileName} must not trigger on workflow_run`);
  }
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
  assert.match(
    workflow,
    /check_status\s+"query"\s+"https:\/\/zurielst\.com\/\?utm_source=canary"\s+200/,
    "a query-string URL must keep returning 200 (the WAF once blocked every query string)",
  );
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

test("analytics snapshot refresh commits directly to main with pinned actions", async () => {
  const workflow = await readWorkflow("analytics-snapshot.yml");
  const config = yaml.load(workflow);
  const steps = config.jobs.refresh.steps;
  const fetchStep = steps.find((step) => step.name === "Fetch analytics snapshot");
  const commitStep = steps.find((step) => step.id === "snapshot");

  assert.match(workflow, /cron:\s*["']17 3 \* \* 1["']/);
  assert.ok(workflow.includes("workflow_dispatch:"), "operators may refresh manually");
  assert.deepEqual(config.permissions, { contents: "write", actions: "write" });
  assert.equal(steps[0].with.ref, "main");
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
  assert.deepEqual(fetchStep.env, { CF_ANALYTICS_TOKEN: "${{ secrets.CF_ANALYTICS_TOKEN }}" });
  assert.equal(fetchStep.run, "node scripts/fetch-analytics.mjs");
  assert.equal(config.env?.CF_ANALYTICS_TOKEN, undefined);
  assert.equal(config.jobs.refresh.env?.CF_ANALYTICS_TOKEN, undefined);
  assert.match(commitStep.run, /set -euo pipefail/);
  assert.ok(commitStep.run.includes("git add -- content/analytics-snapshot.json"));
  assert.match(commitStep.run, /if git diff --cached --quiet; then[\s\S]*changed=false[\s\S]*exit 0/);
  assert.match(commitStep.run, /range\.to/);
  assert.ok(commitStep.run.includes('git commit -m "chore(analytics): refresh snapshot through ${to_date}"'));
  assert.ok(commitStep.run.includes("git push origin HEAD:refs/heads/main"));
  assert.ok(commitStep.run.indexOf("git push") < commitStep.run.indexOf("changed=true"));
  assert.doesNotMatch(workflow, /analytics\/refresh|--force|gh pr |pull-requests:|create-pull-request/);
  assert.ok(!workflow.includes(actionsPullRequestSetting));
  assert.ok(workflow.includes("GH_TOKEN: ${{ github.token }}"));
});

test("analytics dispatch requires both a pushed snapshot and deploy-auto", async () => {
  const config = yaml.load(await readWorkflow("analytics-snapshot.yml"));
  const steps = config.jobs.refresh.steps;
  const dispatch = steps.find((step) => step.name === "Dispatch data-only deploy if configured");
  assert.ok(dispatch, "the optional deployment step exists");
  assert.ok(steps.indexOf(dispatch) > steps.findIndex((step) => step.id === "snapshot"));
  assert.equal(dispatch.if, "steps.snapshot.outputs.changed == 'true'");
  assert.equal(dispatch.env.GH_TOKEN, "${{ github.token }}");
  assert.match(dispatch.run, /set -euo pipefail/);
  assert.ok(dispatch.run.includes('gh api --method GET "repos/${{ github.repository }}/environments/deploy-auto"'));
  assert.match(dispatch.run, /if [^\n]*gh api[^\n]*; then\n\s+echo "::notice::[^\n]*deploy-auto[^\n]*\n\s+gh workflow run deploy.yml --ref main -f data_only=true/);
  assert.match(dispatch.run, /HTTP 404[\s\S]*::notice::[^\n]*next regular deploy[\s\S]*exit 0/);
  assert.match(dispatch.run, /::error::[^\n]*deploy-auto[\s\S]*exit 1/);
});

test("data-only deploy selects deploy-auto and replaces only the reviewer preflight", async () => {
  const config = yaml.load(await readWorkflow("deploy.yml"));
  assert.deepEqual(config.on.push.branches, ["main"]);
  assert.ok(config.on.workflow_dispatch?.inputs?.data_only, "manual deployment declares data_only");
  assert.equal(config.on.workflow_dispatch.inputs.data_only.type, "boolean");
  assert.equal(config.on.workflow_dispatch.inputs.data_only.default, false);
  assert.equal(config.permissions.actions, "read", "the workflow may read production workflow runs");
  assert.equal(config.permissions.deployments, undefined, "environment deployment records are not release evidence");
  const job = config.jobs.production;
  assert.equal(job.environment, "${{ inputs.data_only == true && 'deploy-auto' || 'deploy' }}");
  assert.equal(job.steps[0].with["fetch-depth"], 0, "checkout includes the full ancestry of the deployed anchor");
  const lookup = job.steps.find((step) => step.id === "deployed");
  const guard = job.steps.find((step) => step.name === "Verify data-only snapshot commit");
  const preflight = job.steps.find((step) => step.name === "Verify deploy environment protection");
  assert.ok(guard);
  assert.ok(lookup, "deployment evidence lookup is separate from the Git decision");
  assert.equal(lookup.if, "${{ inputs.data_only == true }}");
  assert.equal(lookup.env.GH_TOKEN, "${{ github.token }}");
  assert.equal(lookup.env.GITHUB_REPOSITORY, "${{ github.repository }}");
  assert.match(lookup.run, /set -euo pipefail/);
  assert.ok(lookup.run.includes('anchor="$(node scripts/deployment-anchor.mjs)"'));
  assert.ok(lookup.run.includes('echo "sha=$anchor" >> "$GITHUB_OUTPUT"'));
  const anchorScript = await readRepositoryFile("scripts/deployment-anchor.mjs");
  assert.ok(anchorScript.includes('repos/${repository}/actions/workflows/deploy.yml/runs?status=success&branch=main&per_page=50'));
  assert.ok(anchorScript.includes('"--paginate"'));
  assert.ok(anchorScript.includes('"--slurp"'));
  assert.doesNotMatch(anchorScript, /\/deployments|environment=|event=push/);
  assert.ok(job.steps.indexOf(lookup) < job.steps.indexOf(guard));
  assert.equal(guard.if, "${{ inputs.data_only == true }}");
  assert.equal(preflight.if, "${{ inputs.data_only != true }}");
  assert.equal(guard.env.DEPLOYED_SHA, "${{ steps.deployed.outputs.sha }}");
  assert.equal(guard.run, 'node scripts/verify-data-only-deploy.mjs "$DEPLOYED_SHA"');
  assert.ok(job.steps.indexOf(guard) < job.steps.findIndex((step) => step.run === "npm ci"));
  for (const step of job.steps.filter((step) => step !== guard && step !== preflight && step !== lookup)) {
    assert.equal(step.if, undefined, `${step.name ?? step.run ?? step.uses} runs on both paths`);
  }
});

test("analytics dispatch handles environment existence, absence, and API failures", async (t) => {
  const config = yaml.load(await readWorkflow("analytics-snapshot.yml"));
  const dispatch = config.jobs.refresh.steps.find((step) => step.name === "Dispatch data-only deploy if configured");
  for (const [scenario, apiStatus, dispatchStatus, expectedStatus] of [
    ["configured", 0, 0, 0],
    ["missing", 404, 0, 0],
    ["forbidden", 403, 0, 1],
    ["server error", 500, 0, 1],
    ["dispatch rejected", 0, 1, 1],
  ]) {
    await t.test(scenario, () => {
      // Stub only the network boundary; execute the workflow's actual Bash.
      const stub = `gh() {
        if [[ "$1" == "api" ]]; then
          if [[ "$API_STATUS" == "0" ]]; then
            printf '{"name":"deploy-auto"}\\n'
            return 0
          fi
          echo "gh: request failed (HTTP $API_STATUS)" >&2
          return 1
        fi
        printf 'DISPATCH: %s\\n' "$*"
        return "$DISPATCH_STATUS"
      }\n`;
      const result = spawnSync("bash", ["--noprofile", "--norc", "-s"], {
        input: stub + dispatch.run.replaceAll("${{ github.repository }}", "example/repository"),
        encoding: "utf8",
        env: { ...process.env, API_STATUS: String(apiStatus), DISPATCH_STATUS: String(dispatchStatus) },
      });
      assert.ifError(result.error);
      assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
      if (apiStatus === 0) {
        assert.match(result.stdout, /DISPATCH: workflow run deploy.yml --ref main -f data_only=true/);
      } else {
        assert.doesNotMatch(result.stdout, /DISPATCH:/);
        assert.match(result.stdout, apiStatus === 404 ? /::notice::.*next regular deploy/ : /::error::/);
      }
    });
  }
});

test("data-only guard requires one parent and only snapshot changes since the deployed anchor", async (t) => {
  const guardPath = fileURLToPath(new URL("./verify-data-only-deploy.mjs", import.meta.url));
  const cases = [
    "snapshot", "root", "empty", "code", "snapshot and code", "merge with code",
    "snapshot-only merge", "snapshot-only multi-parent merge", "undeployed code beneath snapshot",
    "missing deployment evidence",
    "older anchor snapshot", "non-ancestor snapshot", "unknown snapshot anchor", "invalid snapshot anchor",
    "shallow snapshot",
  ];
  for (const scenario of cases) {
    await t.test(scenario, async (t) => {
      const directory = await mkdtemp(join(tmpdir(), "workflow-guard-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe" });
      git("init", "--initial-branch=main");
      git("config", "user.name", "Workflow test");
      git("config", "user.email", "workflow-test@example.invalid");
      git("config", "commit.gpgsign", "false");
      await mkdir(join(directory, "content"));
      await writeFile(join(directory, "content/analytics-snapshot.json"), "{}\n");
      await writeFile(join(directory, "app.js"), "// original\n");
      git("add", ".");
      git("commit", "-m", "initial");
      let anchor = git("rev-parse", "HEAD").trim();
      let cwd = directory;
      if (scenario === "missing deployment evidence") anchor = "";
      if (scenario === "unknown snapshot anchor") anchor = "f".repeat(40);
      if (scenario === "invalid snapshot anchor") anchor = "HEAD^1";
      if (scenario === "non-ancestor snapshot") {
        git("checkout", "-b", "divergent");
        git("commit", "--allow-empty", "-m", "divergent anchor");
        anchor = git("rev-parse", "HEAD").trim();
        git("checkout", "main");
      }
      if (scenario === "older anchor snapshot") {
        for (let update = 1; update <= 3; update += 1) {
          await writeFile(join(directory, "content/analytics-snapshot.json"), JSON.stringify({ update }));
          git("commit", "-am", `snapshot ${update}`);
        }
      }
      if (scenario.startsWith("snapshot-only")) {
        git("checkout", "-b", "snapshot");
        await writeFile(join(directory, "content/analytics-snapshot.json"), '{"updated":true}\n');
        git("commit", "-am", "snapshot change");
        git("checkout", "main");
        if (scenario.includes("multi-parent")) {
          git("checkout", "-b", "other");
          git("commit", "--allow-empty", "-m", "other parent");
          git("checkout", "main");
          git("commit", "--allow-empty", "-m", "main parent");
          git("merge", "--no-ff", "snapshot", "other", "-m", "merge snapshots");
          assert.equal(git("rev-list", "--parents", "-n", "1", "HEAD").trim().split(/\s+/).length, 4);
        } else {
          git("merge", "--no-ff", "snapshot", "-m", "merge snapshot");
        }
      } else if (scenario === "undeployed code beneath snapshot") {
        await writeFile(join(directory, "app.js"), "// unapproved code\n");
        git("commit", "-am", "undeployed code");
        await writeFile(join(directory, "content/analytics-snapshot.json"), '{"updated":true}\n');
        git("commit", "-am", "snapshot change");
      } else if (scenario === "missing deployment evidence") {
        await writeFile(join(directory, "content/analytics-snapshot.json"), '{"updated":true}\n');
        git("commit", "-am", "snapshot change");
      } else if (scenario === "merge with code") {
        git("checkout", "-b", "feature");
        await writeFile(join(directory, "app.js"), "// changed\n");
        git("commit", "-am", "code change");
        git("checkout", "main");
        await writeFile(join(directory, "content/analytics-snapshot.json"), '{"updated":true}\n');
        git("commit", "-am", "snapshot change");
        git("merge", "--no-ff", "feature", "-m", "merge code");
      } else if (scenario !== "root") {
        if (scenario.includes("snapshot")) {
          await writeFile(join(directory, "content/analytics-snapshot.json"), '{"updated":true}\n');
        }
        if (scenario.includes("code")) {
          await writeFile(join(directory, "app.js"), "// changed\n");
        }
        git("commit", "-am", scenario, "--allow-empty");
      }
      if (scenario === "shallow snapshot") {
        cwd = join(directory, "shallow");
        git("clone", "--depth=1", pathToFileURL(directory).href, cwd);
      }
      const result = spawnSync(process.execPath, [guardPath, anchor], {
        cwd,
        encoding: "utf8",
      });
      assert.ifError(result.error);
      if (scenario === "snapshot" || scenario === "older anchor snapshot") {
        assert.equal(result.status, 0, result.stdout + result.stderr);
      } else {
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout + result.stderr, /::error::/);
        if (scenario.includes("merge") || scenario === "root") {
          assert.match(result.stderr, /exactly one parent/);
        }
        if (scenario === "undeployed code beneath snapshot") assert.match(result.stderr, /deployed anchor/);
        if (scenario === "missing deployment evidence") assert.match(result.stderr, /No successful deployment evidence/);
        if (scenario === "non-ancestor snapshot") assert.match(result.stderr, /not an ancestor/);
        if (scenario === "shallow snapshot") assert.match(result.stderr, /full Git history/);
      }
    });
  }
});

test("runbook documents analytics refresh prerequisites and token rotation", async () => {
  const runbook = await readFile(new URL("../docs/runbook.md", import.meta.url), "utf8");

  assert.ok(!runbook.includes(actionsPullRequestSetting));
  assert.match(runbook, /deploy-auto` is an unattended production path/);
  assert.match(runbook, /snapshot-only commits by the guard/);
  assert.match(runbook, /the last successful run of `deploy.yml`/);
  assert.match(runbook, /`actions: read`/);
  assert.doesNotMatch(runbook, /GitHub deployments API|`deployments: read`/);
  assert.match(runbook, /NO required reviewers/);
  assert.match(runbook, /next regular deploy/);
  for (const secret of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
    assert.ok(runbook.includes(`printf '%s' "$${secret}" | gh secret set ${secret}`));
  }
  assert.match(runbook, /--env deploy-auto/);
  assert.match(runbook, /CRLF/);
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
  const normalizedRunbook = runbook.replace(/\s+/g, " ").toLowerCase();

  assert.ok(!runbook.includes(
    "disable Web Analytics automatic setup and ship the manual snippet behind the consent measurement category, with the snippet token referenced from the dashboard",
  ));
  assert.ok(runbook.includes("Manual Cloudflare Web Analytics setup has been active since 2026-09-01."));
  assert.ok(runbook.includes("c15t `measurement` consent category"));
  assert.ok(runbook.includes("default decline and an ignored banner make no analytics request"));
  assert.ok(runbook.includes("`components/registry/cloudflare-web-analytics.tsx`"));
  assert.ok(runbook.includes("`CLOUDFLARE_ANALYTICS_TOKEN`"));
  assert.match(runbook, /a9179715ef1247b9a76ad1622a310854[\s\S]{0,200}verified the same day/);
  assert.match(runbook, /Enable with JS Snippet installation[\s\S]{0,80}silently drops/);

  const readAccessIndex = normalizedRunbook.indexOf("solely for token read-access verification");
  const consentedVisitIndex = normalizedRunbook.indexOf("make the consented visit");
  const pageviewIndex = normalizedRunbook.indexOf("after-query confirms the pageview appears in `rumpageloadeventsadaptivegroups`");
  const replacementIndex = normalizedRunbook.indexOf("replace the one `cloudflare_analytics_token` constant and redeploy");
  assert.ok(readAccessIndex > -1, "the token query is limited to read-access verification");
  assert.ok(consentedVisitIndex > readAccessIndex, "a consented visit follows token read verification");
  assert.ok(pageviewIndex > readAccessIndex, "the runbook states the pageview confirmation goal");
  assert.ok(replacementIndex > pageviewIndex, "a missing pageview triggers token replacement and redeploy");

  const procedureInstructionIndex = normalizedRunbook.indexOf("start the procedure");
  const baselineInstructionIndex = normalizedRunbook.indexOf("let it record the numeric baseline count");
  const promptedVisitIndex = normalizedRunbook.indexOf("make a consented visit now");
  assert.ok(procedureInstructionIndex > -1, "the runbook starts the procedure before the visit");
  assert.ok(baselineInstructionIndex > procedureInstructionIndex, "the procedure records its baseline next");
  assert.ok(promptedVisitIndex > baselineInstructionIndex, "the prompted consented visit follows the baseline");
  assert.doesNotMatch(
    runbook,
    /After deploying the beacon,\s*make a consented visit/i,
    "the runbook never sends an operator to visit before starting the procedure",
  );
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

  const baselineAssignmentIndex = procedure.indexOf('baseline_count="$(analytics_count)"');
  const promptedVisitIndex = procedure.indexOf("Make a consented visit now");
  const afterAssignmentIndex = procedure.indexOf('after_count="$(analytics_count)"');
  assert.ok(baselineAssignmentIndex > -1, "the procedure records a baseline count");
  assert.ok(promptedVisitIndex > -1, "the procedure prompts for the consented visit");
  assert.ok(afterAssignmentIndex > -1, "the procedure re-queries the count after the visit");
  assert.ok(promptedVisitIndex > baselineAssignmentIndex, "the consented visit follows the baseline assignment");
  assert.ok(afterAssignmentIndex > promptedVisitIndex, "the after-count query follows the consented visit prompt");
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
