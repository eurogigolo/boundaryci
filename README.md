# BoundaryCI

[![CI](https://github.com/sir-gig/boundaryci/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-gig/boundaryci/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/boundaryci.svg)](https://www.npmjs.com/package/boundaryci)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-BoundaryCI-blue?logo=github)](https://github.com/marketplace/actions/boundaryci-tenant-isolation-scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[BoundaryCI website and Cloud dashboard](https://boundaryci.com/)

Catch cross-tenant authorization mistakes before a SaaS migration reaches production.

BoundaryCI is a local-first CLI for Supabase and PostgreSQL projects. It reconstructs the final security state from SQL migrations, applies deterministic tenant-isolation rules, and can optionally ask a Fireworks model to review policy interactions that static rules cannot reliably understand.

> **Current scope:** v0.2 is a migration scanner with optional Cloud history, not a penetration-testing guarantee. It does not connect to a live database or create synthetic tenants yet. The active two-tenant attack runner is the next product milestone.

## Quick start

```bash
npx boundaryci scan /path/to/your/supabase-project
```

In Windows PowerShell, use `npx.cmd boundaryci scan .` when script execution policy blocks the `npx.ps1` wrapper.

BoundaryCI exits with code `1` when a **new, non-waived** deterministic finding meets the configured threshold, `0` when the scan passes, and `2` for configuration or runtime errors.

The default `auto` profile enables exposed-schema RLS rules when it sees a Supabase directory or Supabase authorization SQL such as `auth.uid()` and `TO authenticated`. Plain server-side PostgreSQL projects do not receive misleading “public schema” RLS findings. Override detection with `--profile supabase` or `--profile postgres`.

Try the intentionally vulnerable example:

```bash
npm run scan:example
```

The example includes two deterministic failures and a subtler membership policy that checks whether the user belongs to *any* organization without correlating that membership to the contract's `organization_id`. The latter exists to exercise the optional Fireworks review.

## What it catches

| Rule | Default severity | Finding |
| --- | --- | --- |
| `BND001` | High | Exposed table does not enable RLS |
| `BND002` | Medium | RLS is enabled but no policies exist |
| `BND003` | Critical | `anon` or `PUBLIC` receives unconditional row access |
| `BND004` | High | Every authenticated user receives unconditional row access |
| `BND005` | High | `SECURITY DEFINER` function does not pin `search_path` |
| `BND006` | High | `SECURITY DEFINER` function remains executable by `PUBLIC` |

The parser follows migration order and accounts for later RLS changes, policy changes and drops, table drops, function replacement, and `PUBLIC` execute grants/revokes.

## Adopt an existing repository

Create a baseline after reviewing the current deterministic findings:

```bash
npx boundaryci baseline .
git add .boundaryci/baseline.json
```

The normal scan now reports those findings as `BASELINE` and exits successfully. A changed or newly introduced finding receives a stable fingerprint, is marked `NEW`, and can fail CI:

```bash
npx boundaryci scan .
```

Fingerprints ignore line-number and whitespace-only changes. A meaningful change to the vulnerable SQL produces a new fingerprint. Use `--ignore-baseline` to audit everything as new.

When a risk must be accepted temporarily, create an owned waiver using the fingerprint printed by the scan:

```bash
npx boundaryci waive 785692dd876680a9e329bba8 . \
  --owner security-team \
  --reason "Legacy shared table; replacement is tracked in SEC-142." \
  --expires 2026-12-31

git add .boundaryci/waivers.json
```

Waivers require an owner, a reason of at least ten characters, and a valid `YYYY-MM-DD` expiry. They are valid through the expiry date. On the next day, BoundaryCI marks the finding `NEW` again and prints an expiry warning. Commit both adoption files so every developer and CI run uses the same decisions.

Use `--baseline-file` and `--waivers-file` to override their paths. An explicitly supplied path must exist, preventing a typo from silently disabling controls.

## Fireworks semantic review

Deterministic checks should decide whether CI passes. The optional Fireworks review looks for higher-order mistakes such as:

- an update policy that authorizes the old row but allows `tenant_id` reassignment;
- membership checks joined to the wrong tenant field;
- authorization based on user-editable metadata;
- policy and `SECURITY DEFINER` interactions that create a bypass.

In PowerShell:

```powershell
$env:FIREWORKS_API_KEY = "your-key"
npx.cmd boundaryci scan . --fireworks
```

Fireworks findings are advisory by default. To include them in the CI exit decision:

```bash
npx boundaryci scan . --fireworks --include-ai-in-exit-code
```

If Fireworks is unavailable, the deterministic scan still completes and prints a warning. Use `--require-fireworks` when an unavailable semantic review must instead produce exit code `2`:

```bash
npx boundaryci scan . --require-fireworks
```

The integration requests schema-constrained JSON, validates every returned file and field, and redacts common token, JWT, password, secret, and API-key patterns before sending SQL. Redaction is defense-in-depth, not a guarantee: do not store production credentials in migrations. Enabling this option sends migration text to Fireworks under your Fireworks account and data settings.

The default model is `accounts/fireworks/models/deepseek-v4-flash`. Override it with `--fireworks-model` or configuration if that model is unavailable to your account.

## Configuration

Create a starter file:

```bash
npx boundaryci init
```

`boundaryci.config.json`:

```json
{
  "databaseProfile": "auto",
  "migrationDirectories": ["supabase/migrations"],
  "exposedSchemas": ["public"],
  "ignoreTables": ["public.schema_migrations", "public.spatial_ref_sys"],
  "failOn": "high",
  "adoption": {
    "baselineFile": ".boundaryci/baseline.json",
    "waiversFile": ".boundaryci/waivers.json"
  },
  "fireworks": {
    "enabled": false,
    "required": false,
    "model": "accounts/fireworks/models/deepseek-v4-flash",
    "includeInExitCode": false,
    "maxInputCharacters": 80000
  }
}
```

`ignoreTables` accepts fully qualified names and unqualified table names. Use it only for tables that are intentionally shared or inaccessible through the exposed API.

## Output and CI

Supported formats are terminal output, JSON, SARIF, and native GitHub workflow annotations:

```bash
npx boundaryci scan . --format json --output boundaryci.json
npx boundaryci scan . --format sarif --output boundaryci.sarif
npx boundaryci scan . --format github
npx boundaryci scan . --fail-on critical
```

SARIF and GitHub output contain only `NEW` findings. Pretty and JSON output retain baseline and waived findings for auditability.

This repository includes a published composite [`action.yml`](action.yml). Pin an exact release tag or commit SHA in production. `FIREWORKS_API_KEY` is only required when the `fireworks` input is `true`.

```yaml
name: Tenant isolation
on: [pull_request]

jobs:
  boundaryci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: sir-gig/boundaryci@v0.2.0
        with:
          target: .
          fail-on: high
```

The action uses GitHub workflow commands to annotate the exact migration lines. Existing baseline findings and active waivers do not create annotations.

## BoundaryCI Cloud public beta

The paid-product foundation is an opt-in scan-history service. Scanning still happens inside the customer's local environment or GitHub runner. With `--upload`, BoundaryCI sends a minimized result to a repository-bound Cloud endpoint after the local report has been produced:

```powershell
$env:BOUNDARYCI_CLOUD_URL = "https://your-project.supabase.co/functions/v1/ingest-scan"
$env:BOUNDARYCI_CLOUD_TOKEN = "bci_repository_token"
npx.cmd boundaryci scan . --upload --repository owner/repository
```

In GitHub Actions, repository, commit, branch, and pull-request metadata are detected automatically:

```yaml
- uses: sir-gig/boundaryci@v0.2.0
  with:
    target: .
    fail-on: high
    upload: "true"
    cloud-url: ${{ secrets.BOUNDARYCI_CLOUD_URL }}
    cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}
```

Cloud upload is disabled by default. The payload contains repository identity, commit context, summary counts, finding metadata, and short evidence/remediation snippets. BoundaryCI removes the absolute scan target and migration-file list, excludes local warnings, normalizes finding paths, and applies its common-secret redaction before upload. It does not upload complete migration files. Redaction is defense-in-depth, so teams must still decide whether findings may leave their environment.

The deployable Supabase schema and ingestion Edge Function live in [`cloud/supabase`](cloud/supabase). The control plane binds every ingestion token to one repository, stores only SHA-256 token hashes, makes retries idempotent, enforces subscription status and monthly scan limits, and applies row-level security to every tenant-owned table. See [`cloud/README.md`](cloud/README.md) for its security model and deployment path.

BoundaryCI Cloud now uses custom SMTP, branded authentication, Turnstile abuse protection,
and validated Stripe live checkout and webhook configuration. Before accepting real customers,
complete the remaining [production launch checklist](PRODUCTION.md), including the intentionally
deferred live-payment and refund smoke test.

## Product architecture

```text
SQL migrations
    │
    ├── deterministic parser and rules ──┐
    │                                    ├── fingerprints ── baseline / waivers
    └── optional Fireworks review ───────┘
                 advisory by default
                                           │
                                           └── pretty / JSON / SARIF / GitHub ── CI
```

The CLI remains local-first: it does not need database credentials, and deterministic scans make no network requests. Fireworks review and Cloud upload are separate, explicit network features. The Cloud control plane can add organization-wide policy management, historical reporting, and active tenant-boundary tests without moving customer database credentials into a dashboard.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The test suite includes deliberately vulnerable and secure migration sets, parser state-transition tests, baseline and waiver expiry behavior, GitHub/SARIF output checks, and a mocked Fireworks structured response.

## Why this exists

Object-level authorization remains the first category in the [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/). RLS is powerful, but a single permissive policy or privileged helper can turn a tenant ID into a data breach. BoundaryCI makes that boundary a repeatable pull-request check rather than a one-time review.

Fireworks integration uses its OpenAI-compatible chat-completions API and [structured response formatting](https://docs.fireworks.ai/structured-responses/structured-response-formatting).

## Terms, privacy, and support

- Use of BoundaryCI is governed by the [End User License Agreement](EULA.md).
- BoundaryCI's data handling is described in the [Privacy Notice](PRIVACY.md).
- Bug reports, AI-output feedback, and security-reporting routes are documented in [Support](SUPPORT.md).
- First-party customer copies are published at [boundaryci.com/terms](https://boundaryci.com/terms/), [boundaryci.com/privacy](https://boundaryci.com/privacy/), and [boundaryci.com/support](https://boundaryci.com/support/).

## License

[MIT](LICENSE)
