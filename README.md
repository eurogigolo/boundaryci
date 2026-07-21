# BoundaryCI

[![CI](https://github.com/sir-gig/boundaryci/actions/workflows/ci.yml/badge.svg)](https://github.com/sir-gig/boundaryci/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/boundaryci.svg)](https://www.npmjs.com/package/boundaryci)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-BoundaryCI-blue?logo=github)](https://github.com/marketplace/actions/boundaryci-tenant-isolation-scan)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[BoundaryCI website and Cloud dashboard](https://boundaryci.com/)

Catch cross-tenant authorization mistakes before a SaaS migration reaches production.

BoundaryCI is a local-first CLI for Supabase and PostgreSQL projects. It reconstructs the final security state from SQL migrations, applies deterministic tenant-isolation rules, and can optionally add managed or bring-your-own-key Fireworks review for policy interactions that static rules cannot reliably understand.

> **Current scope:** v0.4.0 is a migration scanner with optional Cloud history and consent-gated managed AI review, not a penetration-testing guarantee. It does not connect to a live database or create synthetic tenants yet. The active two-tenant attack runner is the next product milestone.

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
| `BND007` | High | Exposed view does not use `security_invoker` |
| `BND008` | High | RLS policy trusts user-editable authentication metadata |
| `BND009` | High | Materialized view is selectable through an exposed API schema |
| `BND010` | High | Foreign table is reachable through an exposed API schema |
| `BND011` | Medium | Default privileges automatically expose future relations or functions |
| `BND012` | High | Exposed `SECURITY DEFINER` function remains executable by `anon` or `authenticated` |

The parser follows migration order and accounts for later RLS changes, policy changes and drops, regular/materialized view and foreign-table changes, relation grants and revokes, default privileges, overloaded function replacement, and execution privileges for `PUBLIC`, `anon`, and `authenticated`. In the Supabase profile, newly created relations begin with the conventional client-role privileges unless a matching earlier `ALTER DEFAULT PRIVILEGES` statement for the migration role removes them; explicit object-level grants and revokes then determine the final reachable state. BND007 follows [Supabase's view-security guidance](https://supabase.com/docs/guides/database/tables#view-security), while BND008 follows [Supabase's warning against authorization based on user-editable metadata](https://supabase.com/docs/guides/database/postgres/row-level-security#authjwt).

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

## AI-assisted semantic review

Deterministic checks remain BoundaryCI's default source of truth for CI. Optional Fireworks review adds a separately labeled, advisory layer for higher-order mistakes such as:

- an update policy whose proposed-row predicate is broader than its existing-row tenant check, allowing `tenant_id` reassignment;
- membership checks joined to the wrong tenant field;
- multiple individually plausible policies whose combined effect opens a bypass;
- policy and `SECURITY DEFINER` interactions that create a bypass.

AI findings can be incomplete, incorrect, or misleading. Validate them against application behavior and active two-tenant tests before treating them as proven exposure.

### Managed Fireworks review for BoundaryCI Cloud

Managed review is the recommended path for Team, Growth, and Enterprise Cloud organizations. Customers do not need a Fireworks account or `FIREWORKS_API_KEY`; BoundaryCI keeps its provider credential in the managed server environment.

An organization owner or administrator must first accept the managed-review disclosure in the BoundaryCI dashboard. After authorization, active repositories request managed review by default. Managers can disable the capability for the entire organization or an individual repository, and any workflow can opt out independently.

The dashboard-generated GitHub Action workflow contains the public ingestion endpoint and references only the repository-bound BoundaryCI token:

```yaml
- uses: sir-gig/boundaryci@v0.3.0
  with:
    target: .
    fail-on: high
    managed-fireworks: "true"
    upload: "true"
    cloud-url: https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-scan
    cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}
```

Store `BOUNDARYCI_CLOUD_TOKEN` in GitHub under **Settings → Secrets and variables → Actions**. The generated workflow displays the exact `cloud-url`; it is a public endpoint, not a credential. Never paste the repository token or a Fireworks key into the committed YAML.

When Cloud upload runs, the CLI first sends a metadata-only eligibility request authenticated by `BOUNDARYCI_CLOUD_TOKEN`. No migration text is included. Only after BoundaryCI confirms the paid plan, active subscription, organization authorization, and repository setting does the runner send locally redacted migration text to the managed endpoint.

BoundaryCI forwards at most 80,000 characters to Fireworks and does not store the migration input. When the limit is reached, it prioritizes the newest migrations and reports the partially included and omitted files. It returns schema-validated findings to the local report; the subsequent minimized Cloud upload can preserve normalized findings, review status, model, and bounded operational metadata in repository history.

Managed findings remain advisory by default. Fireworks unavailability produces a warning while deterministic scanning and Cloud upload continue. To skip managed review for one workflow while keeping deterministic scanning and Cloud history enabled:

```yaml
          managed-fireworks: "false"
```

You can also run the underlying CLI with `--no-managed-fireworks`. The managed path is available only with Cloud upload and a valid repository-bound token.

### Bring your own Fireworks key (advanced)

Use direct mode when your team prefers its own Fireworks account, model access, billing, and data settings. BoundaryCI does not proxy the inference request: migration text travels directly from your machine or GitHub runner to Fireworks. If `--upload` is also enabled, normalized findings can enter the minimized Cloud history payload, but BoundaryCI does not receive the migration input or raw provider response.

In PowerShell:

```powershell
$env:FIREWORKS_API_KEY = "your-key"
npx.cmd boundaryci scan . --fireworks
```

Direct findings are advisory by default. To include them in the CI exit decision:

```bash
npx boundaryci scan . --fireworks --include-ai-in-exit-code
```

If direct Fireworks review is unavailable, the deterministic scan still completes and prints a warning. Use `--require-fireworks` when an unavailable direct review must instead produce exit code `2`:

```bash
npx boundaryci scan . --require-fireworks
```

Direct review requests schema-constrained JSON, validates returned file references and fields, and redacts common token, JWT, password, secret, and API-key patterns before sending SQL. Redaction is defense in depth, not a guarantee: never store production credentials or unnecessary personal data in migrations.

The default direct-review model is `accounts/fireworks/models/deepseek-v4-flash`. Override it with `--fireworks-model` or configuration if that model is unavailable to your account. Direct `--fireworks` mode takes precedence when selected, so BoundaryCI never requests both direct and managed review during one scan.

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

The `fireworks.enabled`, `fireworks.required`, and `fireworks.model` settings configure direct bring-your-own-key review. `fireworks.enabled: false` does not disable an authorized managed Cloud review. Use the dashboard controls, the repository setting, `--no-managed-fireworks`, or `managed-fireworks: "false"` for that purpose. `includeInExitCode` controls whether either kind of AI finding can affect the final scan exit decision; leave it `false` until your team has evaluated finding quality on its own repositories. `maxInputCharacters` caps prepared input locally, and managed review enforces an additional hard maximum of 80,000 characters.

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

This repository includes a published composite [`action.yml`](action.yml). Pin an exact release tag or commit SHA in production. `FIREWORKS_API_KEY` is required only for direct bring-your-own-key review when the `fireworks` input is `true`; managed review never exposes BoundaryCI's provider key to GitHub.

```yaml
name: Tenant isolation
on: [pull_request]

jobs:
  boundaryci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: sir-gig/boundaryci@v0.3.0
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
- uses: sir-gig/boundaryci@v0.3.0
  with:
    target: .
    fail-on: high
    managed-fireworks: "true"
    upload: "true"
    cloud-url: https://YOUR_PROJECT_REF.supabase.co/functions/v1/ingest-scan
    cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}
```

Use the exact public `cloud-url` from the repository's permanent Setup guide. Only `BOUNDARYCI_CLOUD_TOKEN` belongs in GitHub's encrypted Actions secrets.

Cloud upload is disabled by default. The history payload contains repository identity, commit context, summary counts, finding metadata, and short evidence/remediation snippets. BoundaryCI removes the absolute scan target and migration-file list, excludes local warnings, normalizes finding paths, and applies its common-secret redaction before history upload. It does not include complete migration files. Managed AI review has the separate, consent-gated transient migration processing described above. Redaction is defense-in-depth, so teams must still decide whether either data path is appropriate.

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
    ├── direct Fireworks review ─────────┤
    └── consent-gated managed review ────┘
                    advisory by default
                                           │
                                           └── pretty / JSON / SARIF / GitHub ── CI
```

The CLI remains local-first: it does not need database credentials, and deterministic scans make no network requests. Direct Fireworks, managed Fireworks, and Cloud history are separately controlled network features. The managed path performs a metadata-only authorization check before sending locally redacted migration text, and the control plane never needs customer database credentials.

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
