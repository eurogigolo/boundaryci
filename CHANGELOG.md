# Changelog

All notable changes to BoundaryCI are documented here.

## 0.4.0 - 2026-07-20

### Added

- BND007 detects views in exposed schemas that do not use caller permissions through
  `security_invoker`.
- BND008 detects RLS policies that authorize access with user-editable authentication metadata.
- BND009 detects selectable materialized views in exposed API schemas.
- BND010 detects client-reachable foreign tables in exposed API schemas.
- BND011 detects explicit default privileges that automatically expose future relations or
  functions to API roles.
- BND012 detects `SECURITY DEFINER` functions that remain directly executable by `anon` or
  `authenticated` after `PUBLIC` execution is revoked.
- Relation inventory now tracks regular views, materialized views, foreign tables, ordered
  object/default privileges, and per-role privilege provenance.
- Function inventory distinguishes overload signatures and tracks execution privileges for
  `PUBLIC`, `anon`, and `authenticated` independently.

### Changed

- Public product messaging emphasizes final-state migration analysis instead of a fixed rule count.
- Rule reference, sitemap, LLM catalog, and managed-AI prompts cover the expanded deterministic
  rule set.
- Truncated AI review input prioritizes the newest migrations and reports partial or omitted files.

### Fixed

- Ignore `SECURITY DEFINER` text inside function bodies and remove stale privileged-function state
  when `CREATE OR REPLACE FUNCTION` returns a function to invoker security.
- Suppress BND007 after both Supabase API roles lose view access, while attributing a later access
  grant to the migration that reintroduced the exposure.
- Point RLS-disable, final-policy-drop, and `PUBLIC` function-grant findings to the migration that
  caused the unsafe final state.
- Describe update-policy risk in terms of the proposed-row predicate instead of treating an omitted
  `WITH CHECK` as unsafe by itself.

### Upgrade notes

- BND007, BND008, BND009, BND010, and BND012 are high-severity checks. Existing
  `fail-on=high` workflows may fail when v0.4.0 identifies previously unreported SQL. Review every
  new finding before changing a baseline; do not baseline a real exposure merely to restore CI.
- For BND007, use `security_invoker = true` on PostgreSQL 15+, or revoke `PUBLIC`, `anon`, and
  `authenticated` access and move the view to an unexposed schema. Baseline or waive only after
  confirming the view is unreachable through API roles.
- For BND008, prefer a protected tenant-membership table. Server-controlled `app_metadata` is safer
  than user metadata, but JWT claims can remain stale until the token is refreshed. Never authorize
  access with `user_metadata` or `raw_user_meta_data`.
- BND009, BND010, and BND012 expand the reviewed API surface to materialized views, foreign tables,
  and directly executable privileged functions. BND011 separately reports client-facing default
  grants at medium severity.

## 0.3.0 - 2026-07-19

### Added

- Consent-gated managed Fireworks review for Team, Growth, and Enterprise organizations.
- Metadata-only eligibility checks before any migration text leaves the GitHub runner.
- Server-side Fireworks credentials, fixed schema-constrained prompts, local and server-side
  secret redaction, idempotent review reservations, concurrency protection, and plan quotas.
- Organization consent controls plus per-repository and per-workflow opt-outs.
- Public managed-AI documentation and permanent dashboard setup guidance.

### Changed

- Cloud-enabled Action runs request managed semantic review by default while keeping findings
  advisory and deterministic scanning available during provider failures.
- Privacy, security, support, subscription, and customer-facing data-flow language now covers
  both managed and bring-your-own-key Fireworks modes.

## 0.2.0 - 2026-07-17

### Added

- Opt-in BoundaryCI Cloud upload for the CLI and GitHub Action.
- Secret-redacted, repository-scoped Cloud payloads that exclude absolute targets,
  migration inventories, complete SQL files, and local warnings.
- Supabase control-plane schema with organization isolation, repository-bound hashed
  tokens, idempotent scan ingestion, subscription enforcement, and monthly quotas.
- Deployable scan-ingestion Edge Function and private-beta operator documentation.
- Authenticated Cloud dashboard with organization/repository onboarding, one-time token
  setup, plan usage, repository health, scan history, and finding evidence pages.
- Independent Cloud web CI and a GitHub Pages deployment workflow.

## 0.1.7 - 2026-07-17

### Added

- Direct GitHub Marketplace badge and listing link.

### Changed

- Validate the corrected npm trusted-publisher relationship through an automated provenance release.

## 0.1.6 - 2026-07-17

### Added

- End-user terms, privacy notice, support policy, and an AI-output feedback template.

### Fixed

- Publish with npm 12 and explicit provenance so GitHub OIDC is used instead of unauthenticated registry fallback.

## 0.1.5 - 2026-07-17

### Added

- Tokenless npm trusted-publishing workflow with automatic provenance.
- npm version badge and Marketplace-ready release metadata.

## 0.1.4 - 2026-07-17

### Fixed

- Preserve the `boundaryci` executable mapping when npm normalizes package metadata.

## 0.1.3 - 2026-07-17

### Added

- Publishable npm package metadata and a prepack verification gate.
- npm and Windows PowerShell installation instructions.

## 0.1.2 - 2026-07-17

### Changed

- Update repository, Action, badge, ownership, and package links for the `sir-gig` GitHub namespace.

## 0.1.1 - 2026-07-17

### Fixed

- Include the optional WASM runtime dependency closure required by clean npm installs on Linux GitHub runners.
- Exercise the composite Action itself in CI.

## 0.1.0 - 2026-07-17

### Added

- Final-state parsing for Supabase and PostgreSQL migration history.
- Six deterministic RLS and `SECURITY DEFINER` checks.
- Optional structured Fireworks semantic review with secret redaction.
- Automatic Supabase versus server-side PostgreSQL exposure profiles.
- Stable finding fingerprints, deterministic baselines, and owned expiring waivers.
- Pretty, JSON, SARIF, and native GitHub annotation output.
- Composite GitHub Action and regression fixtures.
