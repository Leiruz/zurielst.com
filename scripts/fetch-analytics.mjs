import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const ACCOUNT_TAG = "bfa514fe29643bf52b4999fa21e7b393";
const SITE_TAG = "132089a6cdb94c13b46d32c7f2061e18";
const DAY_COUNT = 30;
const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL("../content/analytics-snapshot.json", import.meta.url),
);

const ANALYTICS_QUERY = `
  query VisitorAnalytics(
    $accountTag: string
    $siteTag: string
    $from: Date
    $to: Date
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        rumPageloadEventsAdaptiveGroups(
          filter: {
            siteTag: $siteTag
            date_geq: $from
            date_leq: $to
          }
          limit: 30
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          count
          sum { visits }
          avg { sampleInterval }
        }
      }
    }
  }
`;

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

function parseUtcDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid analytics date: ${date}`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || utcDateString(parsed) !== date) {
    throw new Error(`Invalid analytics date: ${date}`);
  }
  return parsed;
}

function enumerateDates(from, to) {
  const cursor = parseUtcDate(from);
  const end = parseUtcDate(to);
  const dates = [];

  while (cursor <= end) {
    dates.push(utcDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function requireNonnegativeNumber(value, field, date) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${field} value for ${date}`);
  }
  return value;
}

export function buildDateRange(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("buildDateRange requires a valid Date");
  }

  const toDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - (DAY_COUNT - 1));

  return {
    from: utcDateString(fromDate),
    to: utcDateString(toDate),
  };
}

export function createAnalyticsSnapshot(groups, { generatedAt, range }) {
  if (!Array.isArray(groups)) {
    throw new Error("Cloudflare analytics response is missing daily groups");
  }

  const expectedDates = enumerateDates(range.from, range.to);
  if (expectedDates.length !== DAY_COUNT) {
    throw new Error(`Analytics range must contain ${DAY_COUNT} days`);
  }
  const expectedDateSet = new Set(expectedDates);
  const daysByDate = new Map();

  for (const group of groups) {
    const date = group?.dimensions?.date;
    if (typeof date !== "string" || !expectedDateSet.has(date)) {
      throw new Error(`Analytics response contains an out-of-range date: ${date}`);
    }
    if (daysByDate.has(date)) {
      throw new Error(`Analytics response contains duplicate date: ${date}`);
    }

    const sampleInterval = requireNonnegativeNumber(
      group?.avg?.sampleInterval,
      "sampleInterval",
      date,
    );
    daysByDate.set(date, {
      date,
      views: requireNonnegativeNumber(group?.count, "views", date),
      visits: requireNonnegativeNumber(group?.sum?.visits, "visits", date),
      sampled: sampleInterval > 1,
    });
  }

  return {
    generated_at: generatedAt,
    range: { from: range.from, to: range.to },
    days: expectedDates.map((date) => daysByDate.get(date) ?? {
      date,
      views: 0,
      visits: 0,
      sampled: false,
    }),
  };
}

function graphqlErrorMessage(errors) {
  if (errors == null) return null;
  if (!Array.isArray(errors)) return "malformed GraphQL errors envelope";
  if (errors.length === 0) return null;
  return errors
    .map((error) => error?.message)
    .filter((message) => typeof message === "string" && message.trim() !== "")
    .join("; ") || "unknown GraphQL error";
}

export async function fetchAnalyticsSnapshot({
  fetchImpl = globalThis.fetch,
  now = new Date(),
  outputPath = DEFAULT_OUTPUT_PATH,
  token = process.env.CF_ANALYTICS_TOKEN,
} = {}) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("CF_ANALYTICS_TOKEN is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  const range = buildDateRange(now);
  const response = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: ANALYTICS_QUERY,
      variables: {
        accountTag: ACCOUNT_TAG,
        from: range.from,
        siteTag: SITE_TAG,
        to: range.to,
      },
    }),
  });

  if (!response?.ok) {
    throw new Error(
      `Cloudflare GraphQL request failed with HTTP ${response?.status ?? "unknown"} ${response?.statusText ?? ""}`.trim(),
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Cloudflare GraphQL response was not valid JSON", { cause: error });
  }

  const errorMessage = graphqlErrorMessage(payload?.errors);
  if (errorMessage) {
    throw new Error(`Cloudflare GraphQL error: ${errorMessage}`);
  }

  const accounts = payload?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Cloudflare GraphQL response did not include the analytics account");
  }

  const snapshot = createAnalyticsSnapshot(
    accounts[0]?.rumPageloadEventsAdaptiveGroups,
    { generatedAt: now.toISOString(), range },
  );
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";

if (import.meta.url === invokedPath) {
  fetchAnalyticsSnapshot()
    .then((snapshot) => {
      console.log(
        `Wrote ${snapshot.days.length} analytics days to ${path.relative(process.cwd(), DEFAULT_OUTPUT_PATH)}`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
