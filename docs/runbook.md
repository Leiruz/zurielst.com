# Operations runbook: zurielst.com

Current as of 2026-09-01, after the 2026-08-30 cutover (full record and
retirement checklist: docs/cutover-2026-08-30.md).

## System overview

Two Cloudflare Workers on the zurielst.com zone:

- zurielst-site: Next.js static export served as Worker assets from `out/`.
  Configs: workers/site/wrangler.jsonc (routeless, what CI deploys) and
  workers/site/wrangler.cutover.jsonc (same plus routes).
- zurielst-chat-api: exact-route API worker for POST /api/chat. Workers AI
  binding, DailyBudget Durable Object, rate limiter binding. Configs:
  workers/chat-api/wrangler.jsonc (routeless) and
  workers/chat-api/wrangler.cutover.jsonc (same plus routes).

Route table (zone, most specific pattern wins):

| Pattern | Worker |
| --- | --- |
| zurielst.com/api/chat | zurielst-chat-api |
| staging.zurielst.com/api/chat | zurielst-chat-api |
| zurielst.com/* | zurielst-site |
| staging.zurielst.com/* | zurielst-site |
| zurielst.com/ai* | zuriel-ai-resume-assistant (legacy, pending deletion) |

www.zurielst.com is not worker-routed: it stays a GitHub Pages 301 to the
apex. The GitHub Pages origin for the apex remains intact underneath the
routes as the rollback origin until retirement.

## Deploy paths

There are exactly two ways anything reaches production.

### 1. CI deploy (code changes, no routes)

.github/workflows/deploy.yml runs on every push to main:

1. typecheck, test, build (Linux; this is the enforcing test gate),
2. verifies the `deploy` environment still has a required reviewer,
3. `npx wrangler deploy --config workers/site/wrangler.jsonc`,
4. records the built-artifact hash and `wrangler deployments list` output in
   the step summary as paired rollback evidence.

The `deploy` GitHub environment holds the only secrets
(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN) and requires one reviewer
approval per run. The CI token deliberately CANNOT edit routes, so a CI
deploy can never attach or detach a route. Because the config has no
`routes` key, existing routes stay attached across CI deploys.

Not yet wired: deploy.yml deploys the site worker only (header comment in
the file). Until the chat-api step is added, chat-api code deploys are
manual:

    npx wrangler deploy --config workers/chat-api/wrangler.jsonc

run by the operator under wrangler OAuth (below). This routeless deploy
also leaves the /api/chat routes attached.

PR previews: pr-ci.yml builds and uploads the artifact secretlessly;
preview-deploy.yml (same `deploy` environment, one approval per preview)
uploads a preview version of the site worker and comments the URL.

The weekly `.github/workflows/analytics-snapshot.yml` workflow has a
mandatory owner prerequisite. In repository Settings > Actions > General >
Workflow permissions, enable
`Allow GitHub Actions to create and approve pull requests`. Its
workflow-level `pull-requests: write` permission does not replace this
repository setting.

### 2. Manual route deploy (overlay configs, wrangler OAuth)

Route changes only ever happen through the overlay configs, deployed
locally by the operator:

    npx wrangler login
    npx wrangler deploy --config workers/site/wrangler.cutover.jsonc
    npx wrangler deploy --config workers/chat-api/wrangler.cutover.jsonc

Each overlay is its routeless twin plus a `routes` list. Deploy an overlay
once to attach routes; afterwards routeless CI deploys keep them attached.
To detach, either delete the route in the dashboard (Workers Routes) or
redeploy the overlay with the pattern removed from `routes`.

Chat config parity was resolved on 2026-08-31. Both configs use DAILY_CAP
"44" and RATE_LIMITER namespace_id "4169117853"; the overlay now differs
only by routes. Details are recorded in docs/cutover-2026-08-30.md.

## Rollback

- Site: delete the zurielst.com/* route (dashboard or overlay minus the
  pattern). The apex falls back to the GitHub Pages origin instantly.
- Chat: delete both /api/chat routes the same way. The site keeps serving;
  the chat UI will surface errors.
- Bad code, routes fine: redeploy a previous version instead of touching
  routes. `npx wrangler deployments list --config <config>` then
  `npx wrangler rollback --config <config>`, or rerun a good CI deploy.
- Full rollback to the old stack: also re-swap the zone rate-limiting rule
  back to /ai/ and re-attach zurielst.com/ai* to zuriel-ai-resume-assistant.
- Never delete DNS records or the TEMP SSL Full rule as part of a rollback.

## Zone objects (Cloudflare dashboard)

| Object | State | Rule |
| --- | --- | --- |
| WAF custom rule "Challenge non-read HTTP methods" | amended 2026-08-30 to exempt POST zurielst.com/api/chat | keep |
| Rate-limiting rule (the single free-plan rule) | exact path /api/chat, 8 requests per 10 seconds per IP and colo, action block, mitigation timeout 10 | keep; re-swap to /ai/ only on full rollback |
| ACME skip rule | permanent | never touch |
| TEMP configuration rule, SSL mode Full, apex plus www | ON PURPOSE, guards the GitHub Pages rollback origin | delete only at origin retirement |
| Response-header CSP transform rule | stale, predates the rebuild | remove at retirement (owner) |

## Web Analytics

Manual Cloudflare Web Analytics setup has been active since 2026-09-01. The
client-only beacon is gated behind the c15t `measurement` consent category, so
the default decline and an ignored banner make no analytics request. The loader
reads the single beacon-token constant, `CLOUDFLARE_ANALYTICS_TOKEN`, in
`components/registry/cloudflare-web-analytics.tsx`.

The beacon token is `a9179715ef1247b9a76ad1622a310854`, copied from the
dashboard snippet on 2026-09-02 and verified the same day: a consented browser
send with it surfaced in rumPageloadEventsAdaptiveGroups under the site tag
`132089a6cdb94c13b46d32c7f2061e18` (the tag remains the GraphQL filter value;
it is NOT the beacon token, an earlier hypothesis that proved wrong). Two
operational gotchas from that verification: the Web Analytics site must be in
"Enable with JS Snippet installation" mode (the Disable mode silently drops
RUM submissions), and ingestion can lag the GraphQL surface by around ten
minutes, so poll before concluding a token is wrong.

Keep the yesterday-dated GraphQL query in Secrets solely for token read-access
verification. After deploying the beacon, start the procedure below. Let it
record the numeric baseline count, then make the consented visit only when it
prompts. Its after-query confirms the pageview appears in
`rumPageloadEventsAdaptiveGroups`.

### Beacon ingestion verification

Run this Bash procedure during the deployment-verification window, with
`VALUE` set to the same read-only token. It selects the current UTC date before
the visit, records the numeric baseline count, and keeps that date for every
recheck. Wait and retry as appropriate for the window. Do not assume a fixed
ingestion time.

```bash
set -euo pipefail

analytics_day="$(date -u +%F)"

analytics_count() {
  local response

  if ! response="$(
    curl --fail-with-body --silent --show-error \
      --request POST \
      --url https://api.cloudflare.com/client/v4/graphql \
      --header "Authorization: Bearer $VALUE" \
      --header "Content-Type: application/json" \
      --data "{\"query\":\"query VerifyBeaconIngestion(\$accountTag: string, \$siteTag: string, \$date: Date) { viewer { accounts(filter: { accountTag: \$accountTag }) { rumPageloadEventsAdaptiveGroups(filter: { siteTag: \$siteTag, date_geq: \$date, date_leq: \$date }, limit: 1) { count } } } }\",\"variables\":{\"accountTag\":\"bfa514fe29643bf52b4999fa21e7b393\",\"siteTag\":\"132089a6cdb94c13b46d32c7f2061e18\",\"date\":\"$analytics_day\"}}"
  )"; then
    printf '%s\n' "Cloudflare GraphQL request failed." >&2
    return 1
  fi

  printf '%s' "$response" | jq -er '
    if .errors? != null then
      error("GraphQL errors: \(.errors | tojson)")
    elif (.data?.viewer?.accounts? | type) != "array" then
      error("GraphQL response has no account envelope")
    elif (.data.viewer.accounts | length) != 1 then
      error("GraphQL response has an unexpected account envelope")
    elif (.data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups | type) != "array" then
      error("GraphQL response has no rumPageloadEventsAdaptiveGroups envelope")
    else
      (.data.viewer.accounts[0].rumPageloadEventsAdaptiveGroups[0].count // 0) as $count
      | if ($count | type) == "number" then $count
        else error("rumPageloadEventsAdaptiveGroups count is not numeric")
        end
    end
  '
}

baseline_count="$(analytics_count)"
printf 'Baseline count for UTC date %s: %s\n' "$analytics_day" "${baseline_count}"
printf '%s\n' "Make a consented visit now, before this UTC date rolls over."

while true; do
  read -r -p "Wait as appropriate, then press Enter to requery; type stop when the deployment-verification window ends: " answer

  if [[ "$answer" == "stop" ]]; then
    printf 'Count did not increase during the verification window. Baseline: %s; latest: %s\n' \
      "${baseline_count}" "${after_count:-not checked}"
    printf '%s\n' "Replace the one CLOUDFLARE_ANALYTICS_TOKEN constant and redeploy."
    exit 1
  fi

  after_count="$(analytics_count)"
  printf 'After count for UTC date %s: %s\n' "$analytics_day" "${after_count}"

  if (( after_count > baseline_count )); then
    printf 'Count increased from %s to %s. Beacon ingestion is confirmed.\n' \
      "${baseline_count}" "${after_count}"
    break
  fi

  printf '%s\n' "Count has not increased. Wait and retry, or type stop when the verification window ends."
done
```

If repeated checks during the deployment-verification window do not increase,
stop the procedure explicitly. It will instruct the operator to replace the one
`CLOUDFLARE_ANALYTICS_TOKEN` constant and redeploy.

## Secrets

- CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN live only in the GitHub
  environment `deploy`. The token has deploy permissions but no route
  (zone) permissions, by design.
- CF_ANALYTICS_TOKEN is a repository Actions secret used only by the weekly
  analytics snapshot workflow. Create a dedicated Cloudflare API token
  restricted to account `bfa514fe29643bf52b4999fa21e7b393` with
  `Account > Account Analytics > Read` as its only permission. It needs no
  zone or edit permissions. Set it from bash:

      printf %s "$VALUE" | gh secret set CF_ANALYTICS_TOKEN --repo Leiruz/zurielst.com

  Before storing or rotating the token, verify its read access with this
  GraphQL query. A successful check prints `true`:

      set -o pipefail
      analytics_day="$(date -u -d yesterday +%F)"
      curl --fail-with-body --silent --show-error \
        --request POST \
        --url https://api.cloudflare.com/client/v4/graphql \
        --header "Authorization: Bearer $VALUE" \
        --header "Content-Type: application/json" \
        --data "{\"query\":\"query VerifyAnalyticsToken(\$accountTag: string, \$siteTag: string, \$date: Date) { viewer { accounts(filter: { accountTag: \$accountTag }) { rumPageloadEventsAdaptiveGroups(filter: { siteTag: \$siteTag, date_geq: \$date, date_leq: \$date }, limit: 1) { count } } } }\",\"variables\":{\"accountTag\":\"bfa514fe29643bf52b4999fa21e7b393\",\"siteTag\":\"132089a6cdb94c13b46d32c7f2061e18\",\"date\":\"$analytics_day\"}}" \
        | jq -e '.errors == null and (.data.viewer.accounts | length == 1)'

  To rotate it, create a replacement token with the same account and
  read-only scope, run the verification query, update the repository secret,
  manually dispatch `analytics-snapshot.yml`, confirm success, and then
  revoke the old token. If exposure is suspected, revoke the old token
  immediately before replacing it.
- Setting them from PowerShell via a pipeline appends CRLF and wrangler
  rejects the value. Set from bash:

      printf %s "$VALUE" | gh secret set CLOUDFLARE_API_TOKEN --env deploy --repo Leiruz/zurielst.com

- Rotation is on the retirement checklist; rotate earlier on any suspicion.

## Verification after any deploy

    curl -sI https://zurielst.com/ | head -5
    curl -sI https://staging.zurielst.com/ | head -5
    curl -sI https://www.zurielst.com/ | head -5        # expect 301 to apex
    curl -sN -X POST https://zurielst.com/api/chat \
      -H "content-type: application/json" \
      -H "origin: https://zurielst.com" \
      -d '{"message":"What does Zuriel work on?"}'      # expect an SSE stream

    npx wrangler deployments list --config workers/site/wrangler.jsonc
    npx wrangler deployments list --config workers/chat-api/wrangler.jsonc

The deploy.yml step summary of the run holds the artifact hash and
deployment id pair for the release being verified.

## Gotchas

- Pipelines eat exit codes: `$?` after `cmd | tee` is tee's. Check the
  command's own exit code directly.
- `concurrency: deploy-production` means one deploy at a time; a run
  waiting for environment approval blocks every run queued behind it.
- Rerunning a superseded Actions run deploys its OLD merge snapshot. Want
  current main deployed? Push or merge to trigger a fresh run.
- Local Windows vitest uses the pool's single-worker mode to keep concurrent
  workerd teardown races from changing the exit code. Linux CI keeps the
  default isolated runtimes and strict exit handling.
- Secrets via PowerShell pipelines gain a trailing CRLF (see Secrets).
