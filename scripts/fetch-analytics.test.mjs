import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const subject = await import("./fetch-analytics.mjs").catch(() => ({}));
const temporaryDirectories = new Set();

function requireSubjectFunction(name) {
  assert.equal(
    typeof subject[name],
    "function",
    `scripts/fetch-analytics.mjs must export ${name}`,
  );
  return subject[name];
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "analytics-snapshot-"));
  temporaryDirectories.add(directory);
  return directory;
}

test.after(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("buildDateRange returns 30 inclusive UTC calendar days", () => {
  const buildDateRange = requireSubjectFunction("buildDateRange");

  assert.deepEqual(
    buildDateRange(new Date("2026-08-31T19:20:21.000Z")),
    { from: "2026-08-02", to: "2026-08-31" },
  );
});

test("createAnalyticsSnapshot zero-fills dates and preserves adjusted counts", () => {
  const createAnalyticsSnapshot = requireSubjectFunction("createAnalyticsSnapshot");
  const snapshot = createAnalyticsSnapshot(
    [
      {
        avg: { sampleInterval: 1 },
        count: 12,
        dimensions: { date: "2026-08-02" },
        sum: { visits: 6 },
      },
      {
        avg: { sampleInterval: 2.5 },
        count: 20,
        dimensions: { date: "2026-08-31" },
        sum: { visits: 9 },
      },
    ],
    {
      generatedAt: "2026-08-31T19:20:21.000Z",
      range: { from: "2026-08-02", to: "2026-08-31" },
    },
  );

  assert.equal(snapshot.days.length, 30);
  assert.deepEqual(snapshot.days[0], {
    date: "2026-08-02",
    sampled: false,
    views: 12,
    visits: 6,
  });
  assert.deepEqual(snapshot.days[1], {
    date: "2026-08-03",
    sampled: false,
    views: 0,
    visits: 0,
  });
  assert.deepEqual(snapshot.days.at(-1), {
    date: "2026-08-31",
    sampled: true,
    views: 20,
    visits: 9,
  });
  assert.deepEqual(snapshot.range, { from: "2026-08-02", to: "2026-08-31" });
  assert.equal(snapshot.generated_at, "2026-08-31T19:20:21.000Z");
});

test("fetchAnalyticsSnapshot posts the required query and writes the snapshot", async () => {
  const fetchAnalyticsSnapshot = requireSubjectFunction("fetchAnalyticsSnapshot");
  const outputDirectory = await createTemporaryDirectory();
  const outputPath = path.join(outputDirectory, "analytics-snapshot.json");
  let request;
  const fetchImpl = async (url, init) => {
    request = { init, url };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return {
          data: {
            viewer: {
              accounts: [{
                rumPageloadEventsAdaptiveGroups: [{
                  avg: { sampleInterval: 1 },
                  count: 7,
                  dimensions: { date: "2026-08-31" },
                  sum: { visits: 3 },
                }],
              }],
            },
          },
          errors: null,
        };
      },
    };
  };

  const snapshot = await fetchAnalyticsSnapshot({
    fetchImpl,
    now: new Date("2026-08-31T19:20:21.000Z"),
    outputPath,
    token: "test-token",
  });

  assert.equal(request.url, "https://api.cloudflare.com/client/v4/graphql");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer test-token");
  assert.equal(request.init.headers["Content-Type"], "application/json");

  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.variables, {
    accountTag: "bfa514fe29643bf52b4999fa21e7b393",
    from: "2026-08-02",
    siteTag: "132089a6cdb94c13b46d32c7f2061e18",
    to: "2026-08-31",
  });
  assert.match(body.query, /rumPageloadEventsAdaptiveGroups/);
  assert.match(body.query, /orderBy:\s*\[date_ASC\]/);
  assert.match(body.query, /avg\s*\{\s*sampleInterval\s*\}/);
  assert.match(body.query, /sum\s*\{\s*visits\s*\}/);
  assert.match(body.query, /dimensions\s*\{\s*date\s*\}/);
  assert.match(body.query, /\bcount\b/);

  const written = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(written, snapshot);
  assert.equal(written.days.length, 30);
  assert.deepEqual(written.days.at(-1), {
    date: "2026-08-31",
    sampled: false,
    views: 7,
    visits: 3,
  });
});

test("fetchAnalyticsSnapshot rejects a missing token before making a request", async () => {
  const fetchAnalyticsSnapshot = requireSubjectFunction("fetchAnalyticsSnapshot");
  let requested = false;

  await assert.rejects(
    fetchAnalyticsSnapshot({
      fetchImpl: async () => {
        requested = true;
      },
      token: "  ",
    }),
    /CF_ANALYTICS_TOKEN.*required/i,
  );
  assert.equal(requested, false);
});

test("fetchAnalyticsSnapshot surfaces GraphQL errors and does not write output", async () => {
  const fetchAnalyticsSnapshot = requireSubjectFunction("fetchAnalyticsSnapshot");
  const outputDirectory = await createTemporaryDirectory();
  const outputPath = path.join(outputDirectory, "analytics-snapshot.json");

  await assert.rejects(
    fetchAnalyticsSnapshot({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return { data: null, errors: [{ message: "access denied" }] };
        },
      }),
      outputPath,
      token: "test-token",
    }),
    /Cloudflare GraphQL error: access denied/,
  );
  await assert.rejects(readFile(outputPath, "utf8"), /ENOENT/);
});

test("the command exits nonzero with a useful missing-token message", () => {
  const scriptPath = fileURLToPath(new URL("./fetch-analytics.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, CF_ANALYTICS_TOKEN: "" },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CF_ANALYTICS_TOKEN.*required/i);
});
