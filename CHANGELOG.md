# Changelog

All notable changes to BoundaryCI are documented here.

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
