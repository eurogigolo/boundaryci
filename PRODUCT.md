# BoundaryCI product brief

## The wedge

BoundaryCI starts with one painful, measurable promise: **a pull request should not make tenant A's data accessible to tenant B**.

The initial customer is a small B2B SaaS team using Supabase or PostgreSQL that is beginning to sell into larger accounts. They usually feel this problem during an enterprise security review, after adding a second developer, or when AI-generated migrations begin shipping faster than anyone can manually audit them.

This is infrastructure, not another dashboard users must remember to visit. It lives in the pull request and can block a merge.

## What exists now

- Local CLI with deterministic final-state migration analysis.
- Six high-signal Supabase/PostgreSQL security checks.
- Pretty, JSON, and SARIF output.
- Optional schema-constrained Fireworks policy review.
- Automatic Supabase versus server-side PostgreSQL exposure profiles.
- Stable finding fingerprints and new-regression-only CI.
- Committable baselines and owned, expiring waivers.
- GitHub line annotations, composite action, JSON, and SARIF.
- Secure/vulnerable regression fixtures.

## What to build next

1. **Design-partner installs:** put the action into five real multi-tenant Supabase repositories and measure setup time, false-positive rate, and whether teams make it a required check.
2. **Hosted GitHub App:** centralize annotations, baseline changes, waiver approvals, and history across repositories.
3. **Ephemeral attack runner:** customer-provided setup/teardown hooks create tenant A and tenant B in a disposable Supabase branch. BoundaryCI attempts cross-tenant `SELECT`, `INSERT`, `UPDATE`, RPC, storage, and GraphQL operations using real user JWTs.
4. **Authorization manifest:** teams declare protected resources and invariants once; the runner generates a repeatable tenant-boundary test matrix.
5. **Evidence export:** signed run history and controls mapped to common security-review questions.

Do not start with a general-purpose security scanner. Own tenant isolation for Supabase first, earn trust with high-signal findings, then expand to Prisma, Neon, and other PostgreSQL stacks.

## Business model to validate

- Open-source/local CLI: free.
- Team: hosted PR history, annotations, baselines, and expiring waivers.
- Growth: active two-tenant tests, scheduled production-safe checks, evidence export, and SSO.
- Enterprise: self-hosted runner, custom policy packs, retention controls, and support.

Before building the hosted dashboard, recruit five design partners and install the CLI in their real repositories. The buying signal is not praise; it is a team allowing BoundaryCI to become a required merge check and asking for centralized history, waivers, or audit evidence.

## Defensibility

The model call is not the moat. The durable asset is the growing corpus of real tenant-boundary failure patterns, deterministic policy semantics, reproducible exploit fixtures, and trusted CI evidence. Fireworks accelerates semantic review and test generation, while deterministic execution remains the source of truth.
