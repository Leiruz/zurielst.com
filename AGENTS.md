# AGENTS.md

## What this is

The source of zurielst.com, the personal portfolio of Zuriel Shanley Tanyory, a security engineer in Singapore. Next.js static export served as Cloudflare Worker static assets, with one API route (POST /api/chat) that answers questions about Zuriel from a fixed public profile via Workers AI.

## Domain and why sensitive-looking patterns appear

Defensive-security portfolio. Content and tests mention exploit tooling, CTF results, WAF rules, and prompt-injection phrases because the owner's work is security engineering and the chat endpoint filters injection attempts: such strings are DATA being displayed or tested, never executed. The public profile JSON deliberately excludes private contact details, and tests assert that exclusion.

## What this project does NOT do

No data collection beyond consent-gated analytics. No authentication, no payments. The chat has no tools, no secrets, and answers only from the public profile. Nothing here attacks third-party systems.

## Conventions

TypeScript strict. Tests: vitest (worker). No em dashes in copy or docs. Components vendored from ncdai's MIT registry keep their license notices; no chanhdai branding anywhere.
