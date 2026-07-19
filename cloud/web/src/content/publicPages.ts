export const SITE_ORIGIN = "https://boundaryci.com";
export const CONTENT_DATE = "2026-07-18";

export type PublicPageKind =
  | "product"
  | "guide"
  | "documentation"
  | "rule-index"
  | "rule"
  | "security";

export interface CodeSample {
  label: string;
  language: "bash" | "powershell" | "sql" | "yaml" | "json";
  value: string;
}

export interface PageSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  code?: CodeSample;
  note?: string;
}

export interface RelatedPage {
  href: string;
  label: string;
  description: string;
}

export interface PublicPage {
  path: string;
  kind: PublicPageKind;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  introduction: string;
  publishedAt: string;
  modifiedAt: string;
  sections: PageSection[];
  related: RelatedPage[];
  ctaLabel: string;
  ruleId?: string;
  severity?: "critical" | "high" | "medium";
}

export interface PublicRouteMetadata {
  path: string;
  title: string;
  description: string;
  kind: "home" | PublicPageKind;
  heading: string;
  publishedAt: string;
  modifiedAt: string;
}

export interface RuleSummary {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  summary: string;
  path: string;
}

export const HOME_ROUTE: PublicRouteMetadata = {
  path: "/",
  kind: "home",
  title: "BoundaryCI — Tenant-isolation security for SaaS",
  description:
    "Catch Supabase and PostgreSQL tenant-isolation mistakes before one SaaS customer can access another customer's data. Free local scanner and paid Cloud history.",
  heading: "Stop one customer from seeing another customer's data.",
  publishedAt: CONTENT_DATE,
  modifiedAt: CONTENT_DATE,
};

export const RULE_SUMMARIES: RuleSummary[] = [
  {
    id: "BND001",
    severity: "high",
    title: "Exposed table does not enable row-level security",
    summary: "Finds tables in an exposed schema when no ENABLE ROW LEVEL SECURITY statement remains in the final migration state.",
    path: "/rules/bnd001/",
  },
  {
    id: "BND002",
    severity: "medium",
    title: "RLS-enabled table has no policies",
    summary: "Finds RLS-protected tables with no remaining policy, which normally denies client access and often signals an incomplete migration.",
    path: "/rules/bnd002/",
  },
  {
    id: "BND003",
    severity: "critical",
    title: "Public policy grants unrestricted row access",
    summary: "Finds unconditional USING (true) or WITH CHECK (true) policies granted to anon or PUBLIC callers.",
    path: "/rules/bnd003/",
  },
  {
    id: "BND004",
    severity: "high",
    title: "Authenticated policy is not tenant-scoped",
    summary: "Finds unconditional policies that authorize every signed-in user without proving membership in the active tenant.",
    path: "/rules/bnd004/",
  },
  {
    id: "BND005",
    severity: "high",
    title: "SECURITY DEFINER function has an unpinned search path",
    summary: "Finds privileged PostgreSQL functions that do not pin search_path to trusted schemas and schema-qualify referenced objects.",
    path: "/rules/bnd005/",
  },
  {
    id: "BND006",
    severity: "high",
    title: "SECURITY DEFINER function remains executable by PUBLIC",
    summary: "Finds privileged functions where migration history never revokes PostgreSQL's default PUBLIC execute privilege.",
    path: "/rules/bnd006/",
  },
];

const sharedRelated = {
  quickstart: {
    href: "/docs/quickstart/",
    label: "BoundaryCI quickstart",
    description: "Run the local scanner and add it to a pull request.",
  },
  rules: {
    href: "/rules/",
    label: "Deterministic rule reference",
    description: "Review the six checks that can gate a merge.",
  },
  security: {
    href: "/security/",
    label: "Security and data handling",
    description: "See what stays local and what optional Cloud upload contains.",
  },
};

const pages: PublicPage[] = [
  {
    path: "/supabase-rls-scanner/",
    kind: "product",
    title: "Supabase RLS Scanner for CI | BoundaryCI",
    description:
      "Scan ordered Supabase SQL migrations for missing RLS, unscoped policies, and unsafe SECURITY DEFINER functions before merge.",
    eyebrow: "Supabase RLS scanner",
    heading: "Catch tenant-isolation regressions before a Supabase migration ships.",
    introduction:
      "BoundaryCI reconstructs the final authorization state produced by ordered SQL migrations, then applies deterministic checks to the tables, policies, and privileged functions that remain.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "what-it-checks",
        heading: "What the scanner checks",
        paragraphs: [
          "A text search can report SQL that was later replaced or dropped. BoundaryCI follows migration order so its findings describe the final state a deployment would create.",
          "The current rules focus on exposed tables, unconditional policies, and SECURITY DEFINER functions—the small authorization changes most likely to weaken a shared-database tenant boundary.",
        ],
        bullets: [
          "Tables in exposed schemas without row-level security enabled",
          "RLS-enabled tables with no remaining policies",
          "Unrestricted anon, PUBLIC, or authenticated policies",
          "SECURITY DEFINER functions with unsafe search_path or PUBLIC execution",
        ],
      },
      {
        id: "run-locally",
        heading: "Run locally without database credentials",
        paragraphs: [
          "The deterministic scan reads migration files. It does not connect to a Supabase project, request a service-role key, or need production access.",
        ],
        code: {
          label: "Scan a Supabase project",
          language: "bash",
          value: "npx boundaryci scan . --profile supabase",
        },
        note: "BoundaryCI is a focused migration control, not a penetration test or proof that every application authorization path is secure.",
      },
      {
        id: "pull-request-gate",
        heading: "Turn the result into a pull-request gate",
        paragraphs: [
          "BoundaryCI emits terminal, JSON, SARIF, and native GitHub annotations. A reviewed baseline lets an existing project adopt the scanner without allowing new findings to hide inside old debt.",
        ],
        code: {
          label: "Create a reviewed baseline",
          language: "bash",
          value: "npx boundaryci baseline .\nnpx boundaryci scan . --fail-on high",
        },
      },
    ],
    related: [sharedRelated.quickstart, sharedRelated.rules, sharedRelated.security],
    ctaLabel: "Scan a Supabase repository",
  },
  {
    path: "/guides/tenant-isolation-testing/",
    kind: "guide",
    title: "Tenant-Isolation Testing for Multi-Tenant SaaS | BoundaryCI",
    description:
      "A practical model for testing whether tenant A can access tenant B's data across database policies, application paths, and privileged functions.",
    eyebrow: "Tenant-isolation guide",
    heading: "How to test the boundary between SaaS customers.",
    introduction:
      "Tenant isolation is the property that a valid action by one customer cannot read, create, change, or delete data owned by another customer unless an explicit sharing rule permits it.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "threat-model",
        heading: "Start with the authorization invariant",
        paragraphs: [
          "Authentication proves who a user is. Tenant isolation proves which customer resources that identity may reach. A test should therefore use two real tenant identities and ask what happens when tenant A supplies tenant B's identifiers.",
        ],
        bullets: [
          "SELECT must not reveal another tenant's rows",
          "INSERT must not assign ownership to an unauthorized tenant",
          "UPDATE must check both the existing row and the proposed tenant key",
          "DELETE, RPC, storage, and background jobs must enforce the same boundary",
        ],
      },
      {
        id: "three-layers",
        heading: "Use three complementary test layers",
        paragraphs: [
          "Migration analysis catches risky policy state before deployment. Disposable-environment tests exercise real JWTs and database behavior. Application tests verify that API and user-interface paths do not bypass the intended database controls.",
          "No single layer proves the entire system. The useful goal is repeatable evidence at every place the tenant boundary can change.",
        ],
      },
      {
        id: "ci-checklist",
        heading: "A minimum CI checklist",
        paragraphs: [
          "Run deterministic checks on every migration pull request, fail only on new non-waived findings, and make temporary exceptions owned and expiring.",
        ],
        bullets: [
          "Reconstruct final migration state rather than scanning isolated files",
          "Keep authorization fixtures for at least two tenants",
          "Test read and write paths independently",
          "Treat SECURITY DEFINER and service-role code as privileged boundaries",
          "Preserve the commit, evidence, disposition, owner, and expiry for each result",
        ],
      },
      {
        id: "limits",
        heading: "Know what a migration scanner cannot prove",
        paragraphs: [
          "Static migration analysis cannot exercise runtime claims, application joins, storage policies, generated SQL, or service code that bypasses RLS. BoundaryCI reports this scope explicitly and keeps active two-tenant execution as a separate capability.",
        ],
      },
    ],
    related: [
      { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "Apply the model to Supabase policies and JWTs." },
      { href: "/guides/postgresql-multi-tenant-security/", label: "PostgreSQL tenant security", description: "Review shared-database controls and privileged functions." },
      sharedRelated.rules,
    ],
    ctaLabel: "Add tenant-isolation checks",
  },
  {
    path: "/guides/test-supabase-rls/",
    kind: "guide",
    title: "How to Test Supabase Row-Level Security | BoundaryCI",
    description:
      "Test Supabase RLS with two tenant identities, negative authorization cases, migration-state checks, and pull-request enforcement.",
    eyebrow: "Supabase RLS testing",
    heading: "Test what a signed-in user must not be allowed to do.",
    introduction:
      "A Supabase policy is tenant-safe only when it relates the current identity to the tenant that owns the target row. Checking auth.uid() somewhere in a query is not enough if that relationship is missing.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "fixture",
        heading: "Create two tenants and two users",
        paragraphs: [
          "Give user A membership only in tenant A and user B membership only in tenant B. Seed one protected row per tenant, then run every operation as both users.",
        ],
        bullets: [
          "Confirm each user can perform the intended operation inside their own tenant",
          "Replace the row or tenant identifier with the other tenant's value",
          "Expect zero rows, a policy violation, or an application-safe not-found response",
          "Repeat with changed JWT metadata and direct API requests",
        ],
      },
      {
        id: "policy-shape",
        heading: "Correlate membership to the row being accessed",
        paragraphs: [
          "The membership check must compare against the protected row's tenant key. A policy that merely proves the user belongs to any organization can authorize every row.",
        ],
        code: {
          label: "Tenant-correlated SELECT policy",
          language: "sql",
          value: "create policy \"members read projects\"\non public.projects for select\nto authenticated\nusing (\n  exists (\n    select 1\n    from public.organization_memberships m\n    where m.organization_id = projects.organization_id\n      and m.user_id = auth.uid()\n  )\n);",
        },
      },
      {
        id: "writes",
        heading: "Test USING and WITH CHECK separately",
        paragraphs: [
          "USING controls which existing rows an UPDATE or DELETE can target. WITH CHECK controls whether the proposed INSERT or updated row is allowed. Testing only reads leaves tenant-key reassignment and cross-tenant inserts uncovered.",
        ],
      },
      {
        id: "migration-gate",
        heading: "Check the migration before runtime testing",
        paragraphs: [
          "BoundaryCI catches deterministic final-state mistakes before a disposable Supabase environment is created. Runtime tests remain valuable for claims, joins, RPC, storage, and application behavior that static analysis cannot prove.",
        ],
        code: {
          label: "Scan migrations in CI",
          language: "bash",
          value: "npx boundaryci scan supabase --profile supabase --fail-on high",
        },
      },
    ],
    related: [
      { href: "/supabase-rls-scanner/", label: "Supabase RLS scanner", description: "See the migration checks designed for this workflow." },
      { href: "/guides/tenant-isolation-testing/", label: "Tenant-isolation testing", description: "Use the broader two-tenant threat model." },
      sharedRelated.rules,
    ],
    ctaLabel: "Scan Supabase migrations",
  },
  {
    path: "/guides/postgresql-multi-tenant-security/",
    kind: "guide",
    title: "PostgreSQL Multi-Tenant Security Guide | BoundaryCI",
    description:
      "Protect shared-schema PostgreSQL SaaS data with tenant keys, least-privilege roles, row-level security, and constrained SECURITY DEFINER functions.",
    eyebrow: "PostgreSQL security guide",
    heading: "Build a database boundary that remains correct as SaaS migrations accumulate.",
    introduction:
      "Shared-schema PostgreSQL places many customers in the same tables. The design can be safe, but every query path and privileged helper must preserve the same tenant invariant.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "tenant-key",
        heading: "Make tenant ownership explicit",
        paragraphs: [
          "Protected rows need an immutable or tightly controlled tenant key. Foreign keys and uniqueness constraints should include that key where necessary so cross-tenant relationships cannot be created accidentally.",
        ],
      },
      {
        id: "rls",
        heading: "Use RLS as defense in depth",
        paragraphs: [
          "Application filters are useful but easy to omit. PostgreSQL row-level security places an additional authorization decision at the database boundary. Policies should relate the current database identity or trusted claim to the row's tenant key.",
        ],
        code: {
          label: "Enable RLS explicitly",
          language: "sql",
          value: "alter table public.projects enable row level security;\nalter table public.projects force row level security;",
        },
      },
      {
        id: "roles",
        heading: "Keep privileged roles out of request paths",
        paragraphs: [
          "Table owners, superusers, and roles with BYPASSRLS can bypass ordinary policies. Service-role credentials and maintenance jobs therefore need narrower operational boundaries, logging, and tests of their own.",
        ],
      },
      {
        id: "security-definer",
        heading: "Constrain SECURITY DEFINER functions",
        paragraphs: [
          "A SECURITY DEFINER function executes with its owner's privileges. Pin search_path, schema-qualify referenced objects, revoke PUBLIC execution, and grant only the intended roles.",
        ],
        code: {
          label: "Constrain a privileged function",
          language: "sql",
          value: "alter function public.rotate_project_key(uuid) set search_path = '';\nrevoke execute on function public.rotate_project_key(uuid) from public;\ngrant execute on function public.rotate_project_key(uuid) to service_role;",
        },
      },
    ],
    related: [
      { href: "/guides/tenant-isolation-testing/", label: "Tenant-isolation testing", description: "Turn the database model into repeatable negative tests." },
      { href: "/rules/bnd005/", label: "BND005: unpinned search_path", description: "Review the deterministic privileged-function check." },
      sharedRelated.quickstart,
    ],
    ctaLabel: "Scan PostgreSQL migrations",
  },
  {
    path: "/github-action/",
    kind: "product",
    title: "Tenant-Isolation GitHub Action | BoundaryCI",
    description:
      "Run BoundaryCI on every pull request, annotate vulnerable SQL migration lines, and block new high-severity tenant-isolation findings.",
    eyebrow: "GitHub Action",
    heading: "Put tenant-isolation evidence directly in the pull request.",
    introduction:
      "The BoundaryCI composite Action installs the published CLI, scans the repository, and emits native GitHub annotations at the migration lines that introduced new findings.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "workflow",
        heading: "Add one pull-request job",
        paragraphs: [
          "Pin a released BoundaryCI version or exact commit in production. The scanner requires no database secret for deterministic migration analysis.",
        ],
        code: {
          label: ".github/workflows/tenant-isolation.yml",
          language: "yaml",
          value: "name: Tenant isolation\non: [pull_request]\n\njobs:\n  boundaryci:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - uses: sir-gig/boundaryci@v0.2.0\n        with:\n          target: .\n          fail-on: high",
        },
      },
      {
        id: "annotations",
        heading: "Annotate the vulnerable migration",
        paragraphs: [
          "New deterministic findings appear as workflow annotations with rule ID, severity, evidence, and remediation. Baseline and actively waived findings remain visible in reports without creating new merge noise.",
        ],
      },
      {
        id: "required-check",
        heading: "Make the job a required check",
        paragraphs: [
          "After the workflow has completed successfully once, require its job in the repository's main-branch rules. A pull request that introduces a new finding at or above the configured threshold will then be unable to merge.",
        ],
      },
      {
        id: "cloud",
        heading: "Upload minimized history only when needed",
        paragraphs: [
          "Cloud upload is optional and separate from scanning. When enabled, a repository-bound token sends commit context, counts, and redacted finding snippets after the local report is produced—not complete migration files.",
        ],
      },
    ],
    related: [sharedRelated.quickstart, sharedRelated.rules, sharedRelated.security],
    ctaLabel: "Add BoundaryCI to GitHub",
  },
  {
    path: "/docs/quickstart/",
    kind: "documentation",
    title: "BoundaryCI Quickstart | Scan Tenant Isolation Locally and in CI",
    description:
      "Install BoundaryCI, scan Supabase or PostgreSQL migrations, review findings, create a baseline, and enforce new-regression-only CI.",
    eyebrow: "Documentation",
    heading: "Run your first tenant-isolation scan.",
    introduction:
      "BoundaryCI is a local-first Node.js CLI. Start with a migration directory, review the deterministic findings, then decide which severity should block a pull request.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "requirements",
        heading: "Requirements",
        paragraphs: [
          "Use Node.js 20 or newer and run the command from a repository containing ordered SQL migrations. BoundaryCI automatically detects common Supabase layouts, or you can select a profile explicitly.",
        ],
      },
      {
        id: "scan",
        heading: "Scan the repository",
        paragraphs: [
          "The default terminal report includes each finding's rule, severity, source location, evidence, and recommended remediation.",
        ],
        code: {
          label: "Local scan",
          language: "bash",
          value: "npx boundaryci scan .\n# Windows PowerShell when npx.ps1 is blocked:\nnpx.cmd boundaryci scan .",
        },
      },
      {
        id: "baseline",
        heading: "Adopt an existing repository",
        paragraphs: [
          "Review the current findings before creating a baseline. Commit the baseline so CI can distinguish existing debt from a new regression.",
        ],
        code: {
          label: "Create and commit a baseline",
          language: "bash",
          value: "npx boundaryci baseline .\ngit add .boundaryci/baseline.json",
        },
      },
      {
        id: "configuration",
        heading: "Generate explicit configuration",
        paragraphs: [
          "A configuration file records migration directories, exposed schemas, ignored shared tables, failure threshold, and optional Fireworks review settings.",
        ],
        code: {
          label: "Create boundaryci.config.json",
          language: "bash",
          value: "npx boundaryci init",
        },
      },
      {
        id: "exit-codes",
        heading: "Understand exit codes",
        paragraphs: [
          "Exit code 0 means the scan completed without a new non-waived finding at the selected threshold. Exit code 1 means the threshold was met. Exit code 2 means configuration or execution failed.",
        ],
      },
    ],
    related: [
      { href: "/github-action/", label: "GitHub Action setup", description: "Move the same scan into pull requests." },
      { href: "/supabase-rls-scanner/", label: "Supabase RLS scanner", description: "Review the Supabase-specific product scope." },
      sharedRelated.rules,
    ],
    ctaLabel: "Start scanning locally",
  },
  {
    path: "/rules/",
    kind: "rule-index",
    title: "BoundaryCI Tenant-Isolation Rules | BND001–BND006",
    description:
      "Reference the six deterministic BoundaryCI checks for Supabase RLS, unrestricted policies, and PostgreSQL SECURITY DEFINER functions.",
    eyebrow: "Rule reference",
    heading: "Six deterministic checks for migration-time tenant boundaries.",
    introduction:
      "Each BoundaryCI rule has a narrow, reviewable condition. Findings include the final-state evidence, migration location, severity, and a specific remediation.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "scope",
        heading: "What deterministic means",
        paragraphs: [
          "These rules do not ask a model to decide whether a pull request passes. The same ordered migrations and configuration produce the same finding set. Optional semantic review remains advisory unless a team explicitly changes that behavior.",
        ],
      },
      {
        id: "final-state",
        heading: "Rules evaluate final migration state",
        paragraphs: [
          "BoundaryCI accounts for later policy changes, drops, function replacements, grants, and revokes. This avoids reporting a dangerous statement that a later migration already removed while still catching a safe policy that was later weakened.",
        ],
      },
    ],
    related: [sharedRelated.quickstart, { href: "/guides/test-supabase-rls/", label: "Supabase RLS testing", description: "Pair static rules with two-tenant runtime tests." }, sharedRelated.security],
    ctaLabel: "Run all six checks",
  },
  {
    path: "/security/",
    kind: "security",
    title: "BoundaryCI Security and Data Handling",
    description:
      "Understand BoundaryCI's local-first scanner, optional Fireworks review, minimized Cloud uploads, repository-bound tokens, and security limitations.",
    eyebrow: "Security model",
    heading: "Migration scanning stays local unless you explicitly enable a network feature.",
    introduction:
      "BoundaryCI separates deterministic scanning, optional Fireworks review, and optional Cloud history so teams can choose which data is allowed to leave their environment.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      {
        id: "local",
        heading: "Deterministic scans are local-first",
        paragraphs: [
          "The CLI reads migration files on the developer machine or CI runner. It does not require database credentials and deterministic scans make no BoundaryCI network request.",
        ],
      },
      {
        id: "cloud",
        heading: "Cloud upload is explicit and minimized",
        paragraphs: [
          "With --upload, the CLI sends repository and commit context, summary counts, finding metadata, and short redacted evidence and remediation snippets after producing the local report.",
        ],
        bullets: [
          "Complete migration files are not uploaded",
          "Absolute scan targets and migration-file inventories are removed",
          "Common secret patterns are redacted before transport",
          "Repository-bound ingestion tokens are stored only as SHA-256 hashes",
          "Tenant-owned Cloud tables use row-level security",
        ],
        note: "Redaction is defense in depth, not a guarantee. Production credentials should never be stored in migration files.",
      },
      {
        id: "fireworks",
        heading: "Fireworks semantic review is separate",
        paragraphs: [
          "When --fireworks is enabled, migration text is sent under the customer's Fireworks account and data settings for schema-constrained review. The deterministic scan still completes if the optional review is unavailable unless --require-fireworks is selected.",
        ],
      },
      {
        id: "limits",
        heading: "Security claims remain bounded",
        paragraphs: [
          "BoundaryCI detects a focused set of tenant-isolation regressions. It does not replace threat modeling, code review, runtime authorization tests, penetration testing, or an independent security assessment.",
        ],
      },
      {
        id: "reporting",
        heading: "Report vulnerabilities privately",
        paragraphs: [
          "Security reports should follow the repository security policy rather than a public issue. Include the affected version, reproduction conditions, impact, and a safe contact method.",
        ],
      },
    ],
    related: [sharedRelated.rules, sharedRelated.quickstart, { href: "/guides/tenant-isolation-testing/", label: "Tenant-isolation testing", description: "See the broader testing model and its limits." }],
    ctaLabel: "Review the open-source scanner",
  },
];

const rulePages: PublicPage[] = [
  {
    path: "/rules/bnd001/",
    kind: "rule",
    ruleId: "BND001",
    severity: "high",
    title: "BND001: Exposed Table Without RLS | BoundaryCI",
    description: "BND001 finds Supabase or PostgreSQL tables in exposed schemas when row-level security is not enabled in final migration state.",
    eyebrow: "BND001 · High severity",
    heading: "Exposed table does not enable row-level security.",
    introduction: "Without RLS, grants and API exposure can allow callers to reach rows without a per-tenant database policy.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a declared table in a configured exposed schema when ordered migration state contains no remaining ENABLE ROW LEVEL SECURITY statement. Ignored shared tables are excluded explicitly through configuration."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["A shared-schema SaaS table can contain rows for many customers. If the table is reachable through an exposed API or application role, missing RLS removes the database's tenant-aware authorization layer."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Enable RLS and add least-privilege policies for every operation the application needs. Enabling RLS alone is not a complete authorization design."], code: { label: "Enable RLS", language: "sql", value: "alter table public.projects enable row level security;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd002/", label: "BND002: no policies", description: "Check the next incomplete-RLS state." }, { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "Exercise the resulting policy with two tenants." }],
    ctaLabel: "Scan for missing RLS",
  },
  {
    path: "/rules/bnd002/",
    kind: "rule",
    ruleId: "BND002",
    severity: "medium",
    title: "BND002: RLS Table Without Policies | BoundaryCI",
    description: "BND002 finds RLS-enabled tables with no remaining policies, an often accidental deny-all state in Supabase and PostgreSQL migrations.",
    eyebrow: "BND002 · Medium severity",
    heading: "RLS-enabled table has no policies.",
    introduction: "RLS with no policy normally denies client access. That can be intentional for server-only data, but often signals an incomplete migration or outage risk.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports an exposed table when final migration state enables RLS but contains no remaining CREATE POLICY definition for that table."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["A deny-all table may break legitimate application paths. Teams sometimes respond under pressure by adding an overly broad policy, turning an availability incident into an authorization weakness."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Add explicit least-privilege policies, or document and ignore a table that is intentionally accessible only through a trusted server role."], code: { label: "Add a tenant-correlated policy", language: "sql", value: "create policy \"members read projects\"\non public.projects for select\nto authenticated\nusing (organization_id = public.active_organization_id());" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd001/", label: "BND001: missing RLS", description: "Review the prerequisite table control." }, { href: "/rules/bnd004/", label: "BND004: unscoped users", description: "Avoid fixing deny-all with an unconditional policy." }],
    ctaLabel: "Review incomplete RLS",
  },
  {
    path: "/rules/bnd003/",
    kind: "rule",
    ruleId: "BND003",
    severity: "critical",
    title: "BND003: Unrestricted Public RLS Policy | BoundaryCI",
    description: "BND003 detects USING (true) or WITH CHECK (true) policies granted to anon or PUBLIC callers in exposed schemas.",
    eyebrow: "BND003 · Critical severity",
    heading: "Public policy grants unrestricted row access.",
    introduction: "An unconditional policy for anon or PUBLIC can expose every matching row or permit untrusted writes without establishing a tenant relationship.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a policy granted to anon, PUBLIC, or an implicit public role when USING or WITH CHECK reduces to the unconditional expression true."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["RLS is enabled, but the policy authorizes callers without identity or ownership. For a multi-tenant table, this can become direct cross-customer disclosure or modification."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Replace the unconditional expression with an ownership or tenant-membership check, and grant the policy only to roles that actually need the operation."], code: { label: "Unsafe policy", language: "sql", value: "create policy \"public projects\"\non public.projects for select\nto anon\nusing (true);" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd004/", label: "BND004: authenticated but unscoped", description: "Review the signed-in version of the same mistake." }, sharedRelated.security],
    ctaLabel: "Block public row access",
  },
  {
    path: "/rules/bnd004/",
    kind: "rule",
    ruleId: "BND004",
    severity: "high",
    title: "BND004: Authenticated Policy Not Tenant-Scoped | BoundaryCI",
    description: "BND004 detects unconditional Supabase RLS policies that grant every authenticated user access without checking the active tenant.",
    eyebrow: "BND004 · High severity",
    heading: "Authenticated policy is not tenant-scoped.",
    introduction: "Signing in proves identity, not tenant membership. An unconditional authenticated policy can let every customer account reach every row.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a policy granted to authenticated when USING or WITH CHECK reduces to true. It intentionally does not guess whether a shared table is safe; intentional shared data can be ignored explicitly after review."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["This is a common category error: the policy verifies that a user exists but never relates that user to the organization_id or tenant_id of the protected row."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Correlate the active identity to the row's tenant through a trusted membership relation. For UPDATE, constrain both the existing row with USING and the proposed row with WITH CHECK."], code: { label: "Unsafe authenticated policy", language: "sql", value: "create policy \"users read projects\"\non public.projects for select\nto authenticated\nusing (true);" } },
    ],
    related: [sharedRelated.rules, { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "See a tenant-correlated membership policy." }, { href: "/rules/bnd003/", label: "BND003: public policy", description: "Review the critical anonymous variant." }],
    ctaLabel: "Find unscoped policies",
  },
  {
    path: "/rules/bnd005/",
    kind: "rule",
    ruleId: "BND005",
    severity: "high",
    title: "BND005: SECURITY DEFINER Search Path | BoundaryCI",
    description: "BND005 finds PostgreSQL SECURITY DEFINER functions that do not pin search_path to trusted values in migration state.",
    eyebrow: "BND005 · High severity",
    heading: "SECURITY DEFINER function has an unpinned search path.",
    introduction: "A privileged function can resolve an attacker-controlled object before the intended object when its search path is not constrained.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports each SECURITY DEFINER function where the final definition does not include a pinned search_path setting."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["SECURITY DEFINER runs with its owner's privileges. Unqualified names resolved through a mutable schema can turn object shadowing into privilege escalation or a tenant-boundary bypass."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Set search_path to an empty or tightly trusted value and schema-qualify every referenced relation and function."], code: { label: "Pin the search path", language: "sql", value: "create function public.rotate_key(project_id uuid)\nreturns void\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $$\nbegin\n  update public.projects set key_version = key_version + 1\n  where id = project_id;\nend;\n$$;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd006/", label: "BND006: PUBLIC execute", description: "Constrain who may call the privileged function." }, { href: "/guides/postgresql-multi-tenant-security/", label: "PostgreSQL tenant security", description: "Review the surrounding privilege model." }],
    ctaLabel: "Audit privileged functions",
  },
  {
    path: "/rules/bnd006/",
    kind: "rule",
    ruleId: "BND006",
    severity: "high",
    title: "BND006: SECURITY DEFINER Executable by PUBLIC | BoundaryCI",
    description: "BND006 finds PostgreSQL SECURITY DEFINER functions where migration history never revokes default PUBLIC execution.",
    eyebrow: "BND006 · High severity",
    heading: "SECURITY DEFINER function remains executable by PUBLIC.",
    introduction: "A safe function body is not enough when every database role may invoke a privileged operation by default.",
    publishedAt: CONTENT_DATE,
    modifiedAt: CONTENT_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports each SECURITY DEFINER function where final migration state contains no explicit REVOKE EXECUTE ... FROM PUBLIC for that function signature."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["PostgreSQL grants function execution to PUBLIC by default. A privileged helper intended for one service role can therefore become reachable by application or anonymous roles unless execution is revoked and re-granted deliberately."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Revoke PUBLIC execution for the exact function signature, then grant execution only to the narrow roles that require it."], code: { label: "Restrict execution", language: "sql", value: "revoke execute on function public.rotate_key(uuid) from public;\ngrant execute on function public.rotate_key(uuid) to service_role;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd005/", label: "BND005: search_path", description: "Constrain name resolution inside the function." }, sharedRelated.security],
    ctaLabel: "Find public privileged functions",
  },
];

export const PUBLIC_PAGES: PublicPage[] = [...pages, ...rulePages];

export const PUBLIC_ROUTES: PublicRouteMetadata[] = [
  HOME_ROUTE,
  ...PUBLIC_PAGES.map((page) => ({
    path: page.path,
    title: page.title,
    description: page.description,
    kind: page.kind,
    heading: page.heading,
    publishedAt: page.publishedAt,
    modifiedAt: page.modifiedAt,
  })),
];

export function normalizePublicPath(pathname: string): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0] || "/";
  if (cleanPath === "/") return cleanPath;
  return cleanPath.endsWith("/") ? cleanPath : `${cleanPath}/`;
}

export function getPublicPage(pathname: string): PublicPage | undefined {
  const normalized = normalizePublicPath(pathname);
  return PUBLIC_PAGES.find((page) => page.path === normalized);
}

export function getPublicRoute(pathname: string): PublicRouteMetadata | undefined {
  const normalized = normalizePublicPath(pathname);
  return PUBLIC_ROUTES.find((route) => route.path === normalized);
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}
