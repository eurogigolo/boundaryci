# Contributing

BoundaryCI is intentionally narrow: it protects tenant isolation in Supabase and PostgreSQL-backed SaaS applications. New rules should be high-signal, reproducible, and tied to a concrete cross-tenant or privilege-boundary failure.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Every rule change must include a vulnerable fixture that fails and a secure fixture that remains clean. Parser changes should include migration-order regression tests. Fireworks findings must remain advisory by default; deterministic behavior owns the default CI decision.

Do not include customer migrations, database credentials, JWTs, or real API keys in issues, fixtures, or pull requests.
