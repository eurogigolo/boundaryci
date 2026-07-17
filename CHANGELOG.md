# Changelog

All notable changes to BoundaryCI are documented here.

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
