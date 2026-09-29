import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findDeploymentAnchor } from "./deployment-anchor.mjs";
import { verifyDataOnlyDeploy } from "./verify-data-only-deploy.mjs";

const repository = "example/repository";
const endpoint = `repos/${repository}/actions/workflows/deploy.yml/runs?status=success&branch=main&per_page=50`;
const missingEvidence = "No successful deployment evidence exists in deploy or deploy-auto; run a reviewer-approved deploy first.";

function workflowRun(id, sha, overrides = {}) {
  return {
    id,
    path: ".github/workflows/deploy.yml",
    head_sha: sha,
    head_branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    created_at: new Date(Date.UTC(2026, 8, 1, 0, id)).toISOString(),
    ...overrides,
  };
}

function apiFixture(...pages) {
  const requests = [];
  return {
    requests,
    requestJson(requestedEndpoint, paginate = false) {
      requests.push({ endpoint: requestedEndpoint, paginate });
      assert.equal(requestedEndpoint, endpoint, "only deploy.yml Actions runs are release evidence");
      assert.equal(paginate, true, "workflow run history must be paginated");
      return pages.map((workflow_runs) => ({
        total_count: pages.reduce((count, page) => count + page.length, 0),
        workflow_runs,
      }));
    },
  };
}

async function gitRepository(t) {
  const cwd = await mkdtemp(join(tmpdir(), "deployment-anchor-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "Deployment test");
  git("config", "user.email", "deployment-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  await mkdir(join(cwd, "content"));
  await writeFile(join(cwd, "content/analytics-snapshot.json"), "{}\n");
  await writeFile(join(cwd, "app.js"), "// original\n");
  async function commit(message, file, content) {
    if (file) await writeFile(join(cwd, file), content);
    git("add", ".");
    git("commit", "--allow-empty", "-m", message);
    return git("rev-parse", "HEAD");
  }
  const initial = await commit("initial production release");
  return { cwd, git, commit, initial };
}

test("ignores a newer successful preview at an undeployed code SHA and chooses the production run", async (t) => {
  const repo = await gitRepository(t);
  const undeployed = await repo.commit("undeployed code", "app.js", "// changed\n");
  await repo.commit("snapshot", "content/analytics-snapshot.json", '{"updated":true}\n');
  const fixture = apiFixture([
    workflowRun(2, undeployed, { path: ".github/workflows/preview-deploy.yml", event: "workflow_run" }),
    workflowRun(1, repo.initial),
  ]);
  const anchor = findDeploymentAnchor(repository, fixture.requestJson, repo.cwd);
  assert.equal(anchor, repo.initial);
  assert.throws(() => verifyDataOnlyDeploy(anchor, repo.cwd), /exactly content\/analytics-snapshot.json to change since the deployed anchor/);
  assert.deepEqual(fixture.requests, [{ endpoint, paginate: true }]);
});

test("requires the exact production workflow path", async (t) => {
  const repo = await gitRepository(t);
  const newer = await repo.commit("newer commit");
  for (const path of ["deploy.yml", ".github/workflows/deploy.yml@main", ".github/workflows/preview-deploy.yml", undefined]) {
    const fixture = apiFixture([workflowRun(2, newer, { path }), workflowRun(1, repo.initial)]);
    assert.equal(findDeploymentAnchor(repository, fixture.requestJson, repo.cwd), repo.initial);
  }
});

test("ignores failed and cancelled deploy.yml runs with newer heads", async (t) => {
  const repo = await gitRepository(t);
  const newer = await repo.commit("undeployed code", "app.js", "// changed\n");
  for (const conclusion of ["failure", "cancelled", "skipped", null]) {
    const fixture = apiFixture([workflowRun(2, newer, { conclusion }), workflowRun(1, repo.initial)]);
    assert.equal(findDeploymentAnchor(repository, fixture.requestJson, repo.cwd), repo.initial);
  }
});

test("skips a successful deploy.yml run outside HEAD ancestry for an older ancestor success", async (t) => {
  const repo = await gitRepository(t);
  repo.git("checkout", "-b", "divergent");
  const divergent = await repo.commit("divergent production release", "app.js", "// divergent\n");
  repo.git("checkout", "main");
  await repo.commit("snapshot", "content/analytics-snapshot.json", '{"updated":true}\n');
  const fixture = apiFixture([workflowRun(2, divergent), workflowRun(1, repo.initial)]);
  const anchor = findDeploymentAnchor(repository, fixture.requestJson, repo.cwd);
  assert.equal(anchor, repo.initial);
  assert.doesNotThrow(() => verifyDataOnlyDeploy(anchor, repo.cwd));
});

test("fails closed with the existing missing-evidence error when no deploy.yml success qualifies", async (t) => {
  const repo = await gitRepository(t);
  for (const history of [
    [],
    [workflowRun(1, repo.initial, { path: ".github/workflows/preview-deploy.yml" })],
    [workflowRun(1, repo.initial, { conclusion: "failure" }), workflowRun(2, repo.initial, { conclusion: "cancelled" })],
    [workflowRun(1, "f".repeat(40))],
  ]) {
    const fixture = apiFixture(history);
    assert.throws(() => findDeploymentAnchor(repository, fixture.requestJson, repo.cwd), { message: missingEvidence });
  }
});

test("accepts a successful workflow_dispatch data-only deploy.yml run as the newest anchor", async (t) => {
  const repo = await gitRepository(t);
  const publishedSnapshot = await repo.commit("published snapshot", "content/analytics-snapshot.json", '{"update":1}\n');
  await repo.commit("next snapshot", "content/analytics-snapshot.json", '{"update":2}\n');
  const fixture = apiFixture([
    workflowRun(1, repo.initial),
    workflowRun(2, publishedSnapshot, { event: "workflow_dispatch" }),
  ]);
  const anchor = findDeploymentAnchor(repository, fixture.requestJson, repo.cwd);
  assert.equal(anchor, publishedSnapshot);
  assert.doesNotThrow(() => verifyDataOnlyDeploy(anchor, repo.cwd));
});

test("orders successful runs by creation time with an ID tie-breaker", async (t) => {
  const repo = await gitRepository(t);
  const newer = await repo.commit("newer release");
  const newest = await repo.commit("newest release");
  const fixture = apiFixture([
    workflowRun(3, repo.initial, { created_at: "2026-09-01T00:00:00Z" }),
    workflowRun(1, newer, { created_at: "2026-09-02T00:00:00Z" }),
    workflowRun(2, newest, { created_at: "2026-09-02T00:00:00Z" }),
  ]);
  assert.equal(findDeploymentAnchor(repository, fixture.requestJson, repo.cwd), newest);
});

test("uses an ancestor success beyond the first fifty workflow runs", async (t) => {
  const repo = await gitRepository(t);
  const firstPage = Array.from({ length: 50 }, (_, index) => workflowRun(index + 2, "f".repeat(40)));
  const fixture = apiFixture(firstPage, [workflowRun(1, repo.initial)]);
  assert.equal(findDeploymentAnchor(repository, fixture.requestJson, repo.cwd), repo.initial);
});

test("fails closed when the Actions API cannot be read", () => {
  for (const status of [403, 500]) {
    assert.throws(() => findDeploymentAnchor(repository, () => { throw new Error(`HTTP ${status}`); }), new RegExp(`HTTP ${status}`));
  }
});

test("fails closed on malformed workflow-run evidence", () => {
  for (const change of [
    { head_sha: "main" }, { head_sha: "" }, { id: "../../other" }, { created_at: "invalid" },
  ]) {
    const fixture = apiFixture([workflowRun(1, "a".repeat(40), change)]);
    assert.throws(() => findDeploymentAnchor(repository, fixture.requestJson), /Invalid deployment evidence/);
  }
  for (const response of [{}, [null], [{ workflow_runs: {} }], [{ workflow_runs: [null] }]]) {
    assert.throws(() => findDeploymentAnchor(repository, () => response), /Invalid deployment/);
  }
});
