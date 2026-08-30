# Capstone Fix Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate nested profile-field leakage from `dossier.md` and enforce the required build SHA precedence without changing the public site or adding dependencies.

**Architecture:** Rebuild the dossier export as a display-oriented DTO whose every nested record is freshly constructed from fields rendered by the main dossier components. Keep SHA discovery as the existing injected pure function, but consult trimmed environment values before Git.

**Tech Stack:** Node.js ESM, Node test runner, Next.js static export, Vitest, TypeScript

## Global Constraints

- Work on `tri/21-capstone` from `924fe69`.
- Preserve unrelated user changes and untracked files.
- Add no npm dependencies and do not push.
- Use test-first red-green cycles.
- Add no em dashes to copy or documentation.
- Make one final fix commit authored by `Zuriel Shanley Tanyory <zurielst@u.nus.edu>`.
- Include `Co-Authored-By: Codex <codex@openai.com>` in the commit body.
- Include three concrete leak fields proven absent in the commit body.

---

### Task 1: Field-level dossier DTO

**Files:**

- Modify: `scripts/generate-dossier.test.mjs`
- Modify: `scripts/generate-dossier.mjs`

**Interfaces:**

- Consumes: `projectPublicProfile(profile)` and `renderDossierMarkdown(profile)` from `scripts/generate-dossier.mjs`.
- Produces: a fresh nested object with root keys `identity`, `intro`, `capabilities`, `stack`, `work`, `timeline`, `education`, `proof_wall`, `products`, `stack_brands`, and `faq`.
- Guarantees: no projected key ends in `id`; no source record or array is passed through; `chat`, `easter_eggs`, `meta`, unavailable media plumbing, proof extras, and control-only fields are absent.

- [ ] **Step 1: Write failing field-level tests**

  Extend `scripts/generate-dossier.test.mjs` so it:

  - checks exact keys for the identity DTO and representative nested records;
  - recursively rejects projected keys matching `/id$/i`;
  - checks that projected arrays and records are not source references;
  - checks positive rendered values from every field family;
  - generates a temporary `dossier.md` and enumerates concrete excluded values from `identity.github`, IDs, absent media, `proof_wall.extras`, `chat`, `easter_eggs`, and `meta`;
  - rejects raw labels such as `**ID:**`, `**Data Policy:**`, `**Employer:**`, and `**Origin Story:** true`.

  Representative positive assertions must include these exact values:

  ```js
  const renderedValues = [
    profile.identity.bio_hook,
    `${profile.identity.location.city} ${profile.identity.location.timezone}`,
    `${education.title}, ${education.org}`,
    `${award.title}, ${award.year}`,
    profile.identity.metrics[0].value,
    profile.identity.metrics[0].label,
    profile.capabilities.acts[0].skills[0].detail,
    profile.work_cases[0].kicker,
    profile.work_cases[1].links[0].url,
    profile.work_cases[0].note,
    profile.proof_wall.ctf_results[0].result,
    profile.proof_wall.publications[0].link,
    "Origin story",
    profile.stack_brands.brands[0].context,
    profile.faq[0].answer,
  ];
  ```

  Representative negative sentinels must name their source paths:

  ```js
  const excludedValues = new Map([
    ["identity.github.data_policy", profile.identity.github.data_policy],
    ["capabilities.acts[1].id", profile.capabilities.acts[1].id],
    ["work_cases[0].id", profile.work_cases[0].id],
    ["work_cases[1].evidence[0].media", profile.work_cases[1].evidence[0].media],
    ["timeline[0].id", profile.timeline[0].id],
    ["proof_wall.certifications[0].id", profile.proof_wall.certifications[0].id],
    ["proof_wall.certifications[1].image", profile.proof_wall.certifications[1].image],
    ["products[0].id", profile.products[0].id],
    ["products[0].media[0].media", profile.products[0].media[0].media],
    ["faq[0].id", profile.faq[0].id],
    ["proof_wall.extras[0].caption", profile.proof_wall.extras[0].caption],
    ["chat.disclaimer", profile.chat.disclaimer],
    ["chat.intent_chips[1]", profile.chat.intent_chips[1]],
    ["easter_eggs.terminal.source", profile.easter_eggs.terminal.source],
    ["easter_eggs.terminal.note", profile.easter_eggs.terminal.note],
    ["easter_eggs.towerblock.repo", profile.easter_eggs.towerblock.repo],
    ["meta.description", profile.meta.description],
    ["meta.og.image", profile.meta.og.image],
  ]);
  ```

- [ ] **Step 2: Run the focused generator test and record RED**

  Run: `node --test scripts/generate-dossier.test.mjs`

  Expected: failure because nested source objects still contain IDs, GitHub internals, media fields, and raw control values.

- [ ] **Step 3: Implement the explicit projection**

  In `scripts/generate-dossier.mjs`, replace every whole-object assignment with explicit object construction:

  - Identity: name, copied roles, tagline, `one_liner`, derived role/founder/location/education/award lines, email, mapped social `{ label, url }`, mapped metric `{ value, label }`, and portrait alt.
  - Introduction: copied bullets.
  - Capabilities: mapped `{ act, title, narrative, skills }` with skill `{ name, since?, detail? }`.
  - Stack: mapped category `{ name, items }`.
  - Work: mapped `{ kicker, title, period, summary, stack, links, note? }`; links contain only `{ label, url, note? }`.
  - Timeline: noneducation `{ type, org, title, period, summary }`.
  - Education: sorted like the component and mapped `{ org, title, period, summary }`.
  - Proof wall: explicit certification, award, CTF, and publication fields; no images, IDs, or extras.
  - Products: explicit visible fields; turn `origin_story` into optional textual `kicker: "Origin story"`; omit raw media and boolean controls.
  - Stack brands: disclaimer and mapped `{ name, context }`.
  - FAQ: mapped `{ question, answer }`.

  Use conditional property assignment for optional fields so `renderObject()` never serializes `undefined`. Do not use object spread syntax or return a source object from any mapper.

- [ ] **Step 4: Run the focused generator test and record GREEN**

  Run: `node --test scripts/generate-dossier.test.mjs`

  Expected: all generator and vCard tests pass.

### Task 2: Build SHA precedence

**Files:**

- Modify: `scripts/verify-build.test.mjs`
- Modify: `next.config.mjs`

**Interfaces:**

- Consumes: `resolveBuildSha(execute = execFileSync, environment = process.env)`.
- Produces: the first trimmed nonempty value from `BUILD_SHA`, `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, Git, then `unknown`.

- [ ] **Step 1: Write failing precedence tests**

  Replace the single throwing-Git test with named tests that prove:

  ```js
  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " build-sha ",
    GITHUB_SHA: "github-sha",
    CF_PAGES_COMMIT_SHA: "cloudflare-sha",
  }), "build-sha");

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " ",
    GITHUB_SHA: " github-sha ",
    CF_PAGES_COMMIT_SHA: "cloudflare-sha",
  }), "github-sha");

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: "",
    GITHUB_SHA: "\t",
    CF_PAGES_COMMIT_SHA: " cloudflare-sha ",
  }), "cloudflare-sha");

  assert.equal(resolveBuildSha(successfulGit, {
    BUILD_SHA: " ",
    GITHUB_SHA: "",
    CF_PAGES_COMMIT_SHA: "\n",
  }), "git-sha");

  assert.equal(resolveBuildSha(throwingGit, {}), "unknown");
  ```

  For every environment-win case, assert the successful Git stub was not called.

- [ ] **Step 2: Run the focused verifier test and record RED**

  Run: `node --test scripts/verify-build.test.mjs`

  Expected: precedence cases fail because Git currently runs first and Cloudflare is not consulted.

- [ ] **Step 3: Reorder the resolver**

  Implement this behavior without changing the injected signature:

  ```js
  const environmentSha = environment.BUILD_SHA?.trim()
    || environment.GITHUB_SHA?.trim()
    || environment.CF_PAGES_COMMIT_SHA?.trim();
  if (environmentSha) return environmentSha;

  try {
    return execute("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
      || "unknown";
  } catch {
    return "unknown";
  }
  ```

- [ ] **Step 4: Run the focused verifier test and record GREEN**

  Run: `node --test scripts/verify-build.test.mjs`

  Expected: all verifier tests pass.

### Task 3: Integration verification and one fix commit

**Files:**

- Verify: `out/dossier.md`
- Commit only: `next.config.mjs`, `scripts/generate-dossier.mjs`, `scripts/generate-dossier.test.mjs`, `scripts/verify-build.test.mjs`, and this plan.

**Interfaces:**

- Consumes: the two completed fixes.
- Produces: verified static output and one local fix commit.

- [ ] **Step 1: Run focused Node tests together**

  Run: `node --test scripts/generate-dossier.test.mjs scripts/verify-build.test.mjs`

  Expected: all focused tests pass.

- [ ] **Step 2: Run the mandated verification commands with real exit codes**

  Run each separately and require exit code 0:

  ```text
  npm run typecheck
  npx vitest run
  npm run build
  npm run perf
  ```

- [ ] **Step 3: Re-run leak greps against the generated output**

  Run separate `rg -n -F` checks for at least:

  ```text
  The contribution heatmap renders from a committed build-time snapshot
  Ported from github.com/Leiruz/Zuriel
  /media/og-card.png
  **ID:**
  ```

  Expected for every check: exit code 1 with no matches.

- [ ] **Step 4: Review the final diff and staged scope**

  Confirm no dependency, unrelated generated-file, task-file, log, image, or registry change is staged. Confirm no em dash was added.

- [ ] **Step 5: Create one fix commit**

  Commit with the required author and a body containing:

  ```text
  fix(capstone): close final review findings (#25)

  Leak checks proved these fields absent from out/dossier.md:
  - identity.github.data_policy
  - easter_eggs.terminal.source
  - meta.og.image

  Co-Authored-By: Codex <codex@openai.com>
  ```

- [ ] **Step 6: Inspect the committed result**

  Verify `git status --short --branch`, `git show --stat --oneline HEAD`, and the full commit message. Leave all pre-existing unrelated changes untouched.
