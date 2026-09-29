import assert from "node:assert/strict";
import test from "node:test";
import { findDeploymentAnchor } from "./deployment-anchor.mjs";

const repository = "example/repository";
const base = `repos/${repository}/deployments`;

function deployment(id, environment, createdAt = `2026-09-${String(id).padStart(2, "0")}T00:00:00Z`) {
  return { id, environment, created_at: createdAt, sha: id.toString(16).padStart(40, "0") };
}

function apiFixture(deployments, statuses = {}) {
  const requests = [];
  return {
    requests,
    requestJson(endpoint, paginate = false) {
      requests.push({ endpoint, paginate });
      for (const environment of ["deploy", "deploy-auto"]) {
        if (endpoint === `${base}?environment=${environment}&per_page=100`) {
          assert.equal(paginate, true, "deployment history must be paginated");
          return deployments.filter((entry) => entry.environment === environment);
        }
      }
      const id = endpoint.match(/\/deployments\/(\d+)\/statuses\?per_page=1$/)?.[1];
      assert.ok(id, `unexpected API endpoint: ${endpoint}`);
      const states = statuses[id] ?? [];
      if (states instanceof Error) throw states;
      return states.map((state) => ({ state }));
    },
  };
}

test("selects the newest deployment with a successful latest status across both environments", () => {
  for (const latestEnvironment of ["deploy", "deploy-auto"]) {
    const older = deployment(1, latestEnvironment === "deploy" ? "deploy-auto" : "deploy");
    const latest = deployment(2, latestEnvironment);
    const fixture = apiFixture([older, latest], { 1: ["success"], 2: ["success"] });
    assert.equal(findDeploymentAnchor(repository, fixture.requestJson), latest.sha);
    assert.deepEqual(fixture.requests.slice(0, 2), [
      { endpoint: `${base}?environment=deploy&per_page=100`, paginate: true },
      { endpoint: `${base}?environment=deploy-auto&per_page=100`, paginate: true },
    ]);
  }
});

test("ignores pending, failed, inactive, and missing latest statuses, including an older success", () => {
  const fixture = apiFixture([
    deployment(1, "deploy"), deployment(2, "deploy-auto"), deployment(3, "deploy"),
    deployment(4, "deploy-auto"), deployment(5, "deploy"), deployment(6, "deploy-auto"),
  ], {
    1: ["success"], 2: ["failure", "success"], 3: ["inactive", "success"],
    4: ["pending"], 5: ["in_progress"], 6: [],
  });
  assert.equal(findDeploymentAnchor(repository, fixture.requestJson), deployment(1, "deploy").sha);
});

test("orders by deployment creation time with an ID tie-breaker", () => {
  const older = deployment(3, "deploy", "2026-09-01T00:00:00Z");
  const newer = deployment(1, "deploy-auto", "2026-09-02T00:00:00Z");
  const newest = deployment(2, "deploy", newer.created_at);
  const fixture = apiFixture([older, newer, newest], { 1: ["success"], 2: ["success"], 3: ["success"] });
  assert.equal(findDeploymentAnchor(repository, fixture.requestJson), newest.sha);
});

test("uses the paginated history beyond the first hundred deployments", () => {
  const history = Array.from({ length: 101 }, (_, index) => deployment(index + 1, "deploy", "2026-09-01T00:00:00Z"));
  const fixture = apiFixture(history, { 1: ["success"] });
  assert.equal(findDeploymentAnchor(repository, fixture.requestJson), history[0].sha);
  assert.equal(fixture.requests.length, 103);
});

test("fails closed without successful deployment evidence", () => {
  for (const history of [[], [deployment(1, "deploy")]]) {
    const fixture = apiFixture(history, { 1: ["failure", "success"] });
    assert.throws(() => findDeploymentAnchor(repository, fixture.requestJson), /No successful deployment evidence/);
  }
});

test("fails closed when either environment or a latest status cannot be read", () => {
  const fixture = apiFixture([deployment(1, "deploy")], { 1: new Error("HTTP 403") });
  assert.throws(() => findDeploymentAnchor(repository, fixture.requestJson), /HTTP 403/);
  for (const environment of ["deploy", "deploy-auto"]) {
    assert.throws(() => findDeploymentAnchor(repository, (endpoint) => {
      if (endpoint.includes(`environment=${environment}&`)) throw new Error("HTTP 500");
      return [];
    }), /HTTP 500/);
  }
});

test("fails closed on malformed deployment evidence", () => {
  for (const change of [
    { sha: "main" }, { sha: "" }, { id: "../../other" }, { created_at: "invalid" },
  ]) {
    const fixture = apiFixture([{ ...deployment(1, "deploy"), ...change }], { 1: ["success"] });
    assert.throws(() => findDeploymentAnchor(repository, fixture.requestJson), /Invalid deployment evidence/);
  }
  assert.throws(() => findDeploymentAnchor(repository, () => ({})), /Invalid deployment/);
});
