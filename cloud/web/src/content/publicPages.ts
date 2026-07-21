export const SITE_ORIGIN = "https://boundaryci.com";
export const CONTENT_DATE = "2026-07-18";
export const BILLING_READINESS_DATE = "2026-07-19";
const FINDING_VISIBILITY_DATE = "2026-07-20";
export const AI_MARKETING_DATE = "2026-07-20";

export type PublicPageKind =
  | "product"
  | "guide"
  | "documentation"
  | "rule-index"
  | "rule"
  | "security"
  | "legal";

export interface CodeSample {
  label: string;
  language: "bash" | "powershell" | "sql" | "yaml" | "json" | "text";
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

export interface PublicFaq {
  question: string;
  answer: string;
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
  faqs?: PublicFaq[];
  ctaHeading?: string;
  ctaDescription?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
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
  faqs?: PublicFaq[];
}

export interface RuleSummary {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  summary: string;
  path: string;
}

export const HOME_FAQS: PublicFaq[] = [
  {
    question: "How do I connect a GitHub repository?",
    answer: "Create the repository in BoundaryCI Cloud, store its one-time token as the GitHub Actions secret BOUNDARYCI_CLOUD_TOKEN, and commit the generated workflow YAML. The token never goes in the file, and the repository dashboard keeps the safe YAML available under Setup guide.",
  },
  {
    question: "Can one workspace monitor multiple repositories?",
    answer: "Yes. An organization owner or administrator can select Add repository in the dashboard. Each repository receives its own bound token, setup guide, and scan history, while usage is counted against the organization's shared monthly allowance.",
  },
  {
    question: "Does BoundaryCI connect to my production database?",
    answer: "No. The current scanner analyzes migration files and does not require database credentials. Active testing against disposable environments is a future, separately configured capability.",
  },
  {
    question: "What does BoundaryCI Cloud receive?",
    answer: "Cloud history receives repository and commit context, summary counts, finding metadata, and short redacted evidence and remediation snippets. Complete migration files are excluded from history. If a paid organization separately enables managed AI, up to 80,000 characters of locally redacted migration text pass transiently through BoundaryCI to Fireworks and are not stored by BoundaryCI.",
  },
  {
    question: "Is Fireworks AI required?",
    answer: "No. BoundaryCI's deterministic checks work without AI and remain the source of truth for merge decisions. Team, Growth, and Enterprise organizations can authorize BoundaryCI's managed Fireworks review without creating their own Fireworks account, then disable it by organization, repository, or workflow.",
  },
  {
    question: "Does this replace a penetration test?",
    answer: "No. BoundaryCI is a focused continuous control for tenant-isolation regressions. It complements threat modeling, code review, testing, and independent security assessments.",
  },
  {
    question: "Can I adopt it with existing findings?",
    answer: "Yes. Commit a reviewed baseline, then fail CI only when a new regression appears. Owned, expiring waivers keep temporary exceptions visible.",
  },
];

export const HOME_ROUTE: PublicRouteMetadata = {
  path: "/",
  kind: "home",
  title: "BoundaryCI — AI-Assisted Tenant-Isolation Security for SaaS",
  description:
    "Catch Supabase and PostgreSQL tenant-isolation flaws with deterministic CI checks and optional managed AI review before they reach production.",
  heading: "Stop one customer from seeing another customer's data.",
  publishedAt: CONTENT_DATE,
  modifiedAt: AI_MARKETING_DATE,
  faqs: HOME_FAQS,
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
  {
    id: "BND007",
    severity: "high",
    title: "Exposed view may bypass underlying row-level security",
    summary: "Finds views in exposed schemas that do not use security_invoker and may apply the view creator's privileges instead of the caller's.",
    path: "/rules/bnd007/",
  },
  {
    id: "BND008",
    severity: "high",
    title: "RLS policy trusts user-editable authentication metadata",
    summary: "Finds authorization expressions that trust user_metadata or raw_user_meta_data, which users can modify through authentication APIs.",
    path: "/rules/bnd008/",
  },
  {
    id: "BND009",
    severity: "high",
    title: "Materialized view is exposed to API roles",
    summary: "Finds materialized views that store query results in exposed schemas and remain selectable by anonymous or authenticated API callers.",
    path: "/rules/bnd009/",
  },
  {
    id: "BND010",
    severity: "high",
    title: "Foreign table is exposed to API roles",
    summary: "Finds foreign tables that make external data sources reachable through an exposed Supabase Data API schema.",
    path: "/rules/bnd010/",
  },
  {
    id: "BND011",
    severity: "medium",
    title: "Default privileges automatically expose future objects",
    summary: "Finds ALTER DEFAULT PRIVILEGES grants that give API roles automatic access to future relations or functions.",
    path: "/rules/bnd011/",
  },
  {
    id: "BND012",
    severity: "high",
    title: "SECURITY DEFINER function is executable by API roles",
    summary: "Finds privileged functions in exposed schemas that remain directly executable by anon or authenticated after PUBLIC execution is revoked.",
    path: "/rules/bnd012/",
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
    description: "Review the deterministic checks that can gate a merge.",
  },
  security: {
    href: "/security/",
    label: "Security and data handling",
    description: "See what stays local and what optional Cloud upload contains.",
  },
  managedAi: {
    href: "/docs/managed-ai/",
    label: "Managed AI review",
    description: "Review consent, data flow, advisory defaults, and opt-out controls.",
  },
};

const pages: PublicPage[] = [
  {
    path: "/supabase-rls-scanner/",
    kind: "product",
    title: "Supabase RLS Scanner for CI | BoundaryCI",
    description:
      "Scan ordered Supabase SQL migrations for missing RLS, unsafe views, user-editable auth metadata, and privileged-function flaws before merge.",
    eyebrow: "Supabase RLS scanner",
    heading: "Catch tenant-isolation regressions before a Supabase migration ships.",
    introduction:
      "BoundaryCI reconstructs the final authorization state produced by ordered SQL migrations, then applies deterministic checks to the tables, policies, views, and privileged functions that remain.",
    publishedAt: CONTENT_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      {
        id: "what-it-checks",
        heading: "What the scanner checks",
        paragraphs: [
          "A text search can report SQL that was later replaced or dropped. BoundaryCI follows migration order so its findings describe the final state a deployment would create.",
          "The current rules focus on exposed tables and views, unsafe policy conditions and metadata, and SECURITY DEFINER functions—the small authorization changes most likely to weaken a shared-database tenant boundary.",
        ],
        bullets: [
          "Tables in exposed schemas without row-level security enabled",
          "RLS-enabled tables with no remaining policies",
          "Unrestricted anon, PUBLIC, or authenticated policies",
          "Exposed views that do not apply the caller's permissions",
          "RLS policies that trust user-editable authentication metadata",
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
    modifiedAt: BILLING_READINESS_DATE,
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
          value: "name: Tenant isolation\non: [pull_request]\n\njobs:\n  boundaryci:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - uses: sir-gig/boundaryci@v0.4.0\n        with:\n          target: .\n          fail-on: high",
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
        heading: "Store the token as a GitHub secret",
        paragraphs: [
          "BoundaryCI Cloud shows a repository-bound token once. In the GitHub repository, open Settings, then Secrets and variables, then Actions. Create a repository secret named BOUNDARYCI_CLOUD_TOKEN and paste the token as its value. The token never belongs in the workflow file.",
        ],
      },
      {
        id: "cloud-workflow",
        heading: "Reference the secret from the workflow",
        paragraphs: [
          "The repository dashboard keeps a copyable setup guide after onboarding. Its YAML enables minimized Cloud history and contains only a GitHub secret reference, so it is safe to commit. If the token is replaced later, update the GitHub secret value without changing the workflow.",
        ],
        code: {
          label: "Cloud inputs inside the BoundaryCI Action step",
          language: "yaml",
          value: "          managed-fireworks: \"true\"\n          upload: \"true\"\n          cloud-url: YOUR_BOUNDARYCI_INGEST_URL\n          cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}",
        },
      },
      {
        id: "managed-ai",
        heading: "Authorize managed AI without another GitHub secret",
        paragraphs: [
          "Team, Growth, and Enterprise organization managers can accept the managed-AI disclosure in the BoundaryCI dashboard. After consent, the existing repository token requests Fireworks semantic review automatically; the Fireworks API key remains inside BoundaryCI's server environment and never enters GitHub.",
          "Each repository starts enabled after organization consent. Disable it from the repository setting or set managed-fireworks to false in the workflow to keep that repository deterministic-only.",
        ],
        note: "The runner checks organization eligibility before transmitting migration text. If consent is absent, the subscription is ineligible, or the repository is disabled, no migration text is sent for managed review.",
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
    modifiedAt: BILLING_READINESS_DATE,
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
      {
        id: "cloud-repository",
        heading: "Connect a repository to BoundaryCI Cloud",
        paragraphs: [
          "Create the organization and repository in BoundaryCI Cloud. Copy the one-time repository token, then save it in GitHub under Settings, Secrets and variables, Actions as a repository secret named BOUNDARYCI_CLOUD_TOKEN.",
          "The token is the private credential. The workflow YAML is not private: it contains only the secret name and BoundaryCI ingestion URL. Every repository dashboard keeps the exact file path and YAML available under Setup guide, even after the token screen is closed.",
          "Organization owners and administrators can use Add repository to repeat this flow for additional GitHub repositories. Each connection receives a separate bound token and history; scans share the organization’s monthly allowance.",
        ],
        code: {
          label: "GitHub Actions secret name",
          language: "text",
          value: "BOUNDARYCI_CLOUD_TOKEN",
        },
        note: "If the token is lost, create a new token from the repository card and replace the GitHub secret value. Do not paste a token into a committed file or support request.",
      },
      {
        id: "first-cloud-run",
        heading: "Verify the first pull request",
        paragraphs: [
          "Commit the generated workflow to the default branch, then open a pull request that contains an SQL migration. BoundaryCI scans inside GitHub, annotates unsafe lines, uploads the minimized result, and preserves corrected reruns in Cloud history.",
          "A failed BoundaryCI check can be the expected result: it means a new finding met the configured failure threshold. Correct the migration on the same branch and push again; the Action reruns automatically.",
        ],
      },
      {
        id: "managed-ai",
        heading: "Choose whether to enable managed AI review",
        paragraphs: [
          "On Team, Growth, and Enterprise, an owner or administrator can review the dashboard disclosure and authorize managed Fireworks AI once for the organization. New repositories then request semantic review automatically with the same BoundaryCI repository token; customers do not need a Fireworks account or key.",
          "BoundaryCI checks consent before the runner transmits migration content. When authorized, common secret patterns are redacted locally and up to 80,000 characters pass through BoundaryCI to Fireworks without being stored as migration text. Only normalized findings enter Cloud history.",
        ],
        code: {
          label: "Per-workflow opt-out",
          language: "yaml",
          value: "          managed-fireworks: \"false\"",
        },
        note: "Managed AI findings are advisory unless includeInExitCode is explicitly enabled in boundaryci.config.json. Deterministic checks continue when the AI provider is unavailable.",
      },
    ],
    related: [
      { href: "/github-action/", label: "GitHub Action setup", description: "Move the same scan into pull requests." },
      { href: "/supabase-rls-scanner/", label: "Supabase RLS scanner", description: "Review the Supabase-specific product scope." },
      { href: "/docs/managed-ai/", label: "Managed AI review", description: "Review consent, data flow, defaults, and opt-out controls." },
    ],
    ctaLabel: "Start scanning locally",
  },
  {
    path: "/docs/managed-ai/",
    kind: "documentation",
    title: "Managed Fireworks AI Review | BoundaryCI Documentation",
    description:
      "Enable BoundaryCI managed Fireworks review, understand its consent and data flow, control repositories, and keep AI findings advisory.",
    eyebrow: "Managed AI documentation",
    heading: "Add semantic tenant review without managing another API key.",
    introduction:
      "Managed Fireworks review is an optional paid Cloud capability. BoundaryCI keeps its provider credential server-side, checks customer authorization before migration text leaves the runner, and returns schema-constrained findings to the existing report.",
    publishedAt: BILLING_READINESS_DATE,
    modifiedAt: BILLING_READINESS_DATE,
    sections: [
      {
        id: "eligibility",
        heading: "Start with an eligible Cloud organization",
        paragraphs: [
          "Managed review is included with Team, Growth, and Enterprise. Free organizations continue using the deterministic checks and can still upload minimized findings to Cloud history.",
          "Only an organization owner or administrator can authorize managed review. Existing organizations remain off until a manager accepts the disclosure.",
        ],
      },
      {
        id: "enable",
        heading: "Authorize once in the dashboard",
        paragraphs: [
          "Open the BoundaryCI dashboard, locate Managed Fireworks AI, review the data-handling disclosure, select the authorization checkbox, and choose Enable managed AI review. The authorization time is recorded for the organization.",
          "After organization consent, each active repository starts enabled. Repository switches let managers keep selected projects deterministic-only without disabling the organization-wide capability.",
        ],
      },
      {
        id: "workflow",
        heading: "Use the generated workflow",
        paragraphs: [
          "The permanent Setup guide includes managed-fireworks set to true. No FIREWORKS_API_KEY secret is required: the runner uses its repository-bound BOUNDARYCI_CLOUD_TOKEN to check eligibility and request the fixed semantic review.",
        ],
        code: {
          label: "BoundaryCI Action inputs",
          language: "yaml",
          value: "          managed-fireworks: \"true\"\n          upload: \"true\"\n          cloud-url: YOUR_BOUNDARYCI_INGEST_URL\n          cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}",
        },
      },
      {
        id: "data-flow",
        heading: "Understand exactly what is transmitted",
        paragraphs: [
          "The runner first sends only repository identity to check the paid plan, subscription, organization consent, and repository setting. Migration text is not included in that eligibility request.",
          "Only after an enabled response does the runner redact common token, JWT, password, secret, and API-key patterns and send up to 80,000 characters of migration text. BoundaryCI forwards that text to Fireworks and does not store the migration input. It stores the normalized review result, model, status, input hash, and bounded operational metadata; completed scan uploads also include the result in Cloud history.",
        ],
        note: "Secret redaction is defense in depth, not a guarantee. Do not put production credentials or unnecessary personal data in migration files.",
      },
      {
        id: "decision",
        heading: "Keep deterministic checks in control",
        paragraphs: [
          "Managed AI findings are advisory by default. Fireworks unavailability, rate limiting, or an invalid model response produces a warning while deterministic scanning and Cloud upload continue.",
          "Teams can explicitly include AI findings in the exit decision through boundaryci.config.json, but should do so only after measuring the finding quality on their own repositories.",
        ],
      },
      {
        id: "disable",
        heading: "Opt out at any layer",
        paragraphs: [
          "An owner or administrator can disable managed review for the organization or a single repository in the dashboard. A repository can also bypass it in workflow YAML. Local scans without Cloud upload never request managed review.",
        ],
        code: {
          label: "Workflow opt-out",
          language: "yaml",
          value: "          managed-fireworks: \"false\"",
        },
      },
      {
        id: "byok",
        heading: "Bring-your-own-key remains available",
        paragraphs: [
          "Advanced users can continue running boundaryci scan --fireworks with their own FIREWORKS_API_KEY. When that direct mode is selected, the request goes from the customer environment to Fireworks and BoundaryCI does not also request the managed review.",
        ],
      },
    ],
    related: [sharedRelated.quickstart, { href: "/github-action/", label: "GitHub Action setup", description: "Install the repository workflow and bound Cloud token." }, sharedRelated.security],
    ctaLabel: "Enable managed AI review",
  },
  {
    path: "/ai-supabase-rls-review/",
    kind: "product",
    title: "AI Supabase RLS Review for SaaS | BoundaryCI",
    description:
      "Review Supabase RLS migrations with deterministic security checks and optional managed AI analysis for tenant-policy interactions and missing row correlation.",
    eyebrow: "AI-assisted Supabase review",
    heading: "Review Supabase RLS with deterministic checks and a second semantic layer.",
    introduction:
      "BoundaryCI checks the final state of ordered Supabase migrations in CI. High-confidence deterministic rules catch known unsafe shapes, while optional managed Fireworks AI reviews how policies, memberships, tenant keys, and privileged functions work together.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      {
        id: "two-layers",
        heading: "Use deterministic and AI review for different jobs",
        paragraphs: [
          "Deterministic rules are repeatable, explainable, and suitable for blocking a pull request. They find known final-state conditions such as a public USING (true) policy or a SECURITY DEFINER function left executable by PUBLIC.",
          "Managed AI is the advisory second layer. It looks for relationships that are difficult to reduce to one syntax rule, then returns bounded findings with evidence, risk, and remediation through the same BoundaryCI report.",
        ],
        bullets: [
          "Deterministic findings remain the default merge decision",
          "AI findings are advisory unless a team explicitly changes that setting",
          "Provider failure never stops deterministic scanning",
          "Both layers appear in pull-request and Cloud evidence",
        ],
      },
      {
        id: "semantic-example",
        heading: "Catch membership checks that never correlate to the row",
        paragraphs: [
          "A policy can call auth.uid() and prove that a user belongs to an organization while still failing to compare that organization with the protected row's organization_id. The SQL looks security-aware, but a member of tenant A may still reach tenant B.",
          "BoundaryCI's managed review is designed to flag that policy interaction for human review. You still validate the finding against application behavior and two-tenant tests before treating it as proven exposure.",
        ],
        code: {
          label: "The relationship semantic review looks for",
          language: "sql",
          value: "where membership.user_id = auth.uid()\n  and membership.organization_id = projects.organization_id",
        },
      },
      {
        id: "pull-request",
        heading: "Run the review inside the existing GitHub workflow",
        paragraphs: [
          "Connect a repository to BoundaryCI Cloud, add its bound token as BOUNDARYCI_CLOUD_TOKEN, and commit the generated Action workflow. Eligible paid organizations can authorize managed review in the dashboard without creating a Fireworks account or adding a provider key to GitHub.",
        ],
        code: {
          label: "Managed review Action input",
          language: "yaml",
          value: "          managed-fireworks: \"true\"\n          cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}",
        },
      },
      {
        id: "data-controls",
        heading: "Keep consent and repository controls explicit",
        paragraphs: [
          "An organization owner or administrator must accept the managed-AI disclosure. BoundaryCI checks plan eligibility, consent, and the repository setting before the runner sends any migration text.",
          "When authorized, the runner redacts common secret patterns locally and sends at most 80,000 characters transiently through BoundaryCI to Fireworks. BoundaryCI does not store the migration input; normalized findings and bounded operational metadata can enter Cloud history.",
        ],
        note: "Redaction is defense in depth, not a guarantee. Migration files should never contain production credentials or unnecessary personal data.",
      },
      {
        id: "scope",
        heading: "Know what AI review does not prove",
        paragraphs: [
          "A static AI review does not execute JWT claims, application queries, storage policies, generated SQL, or service-role code. It is another review signal—not a penetration test, formal proof, or replacement for active two-tenant authorization tests.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does AI replace BoundaryCI's deterministic RLS checks?",
        answer: "No. The deterministic rules remain the reliable source of truth for merge decisions. Managed AI adds advisory analysis for policy relationships and context that fixed syntax checks may not capture.",
      },
      {
        question: "Do customers need a Fireworks API key?",
        answer: "No. Team, Growth, and Enterprise organizations can use BoundaryCI's server-side Fireworks credential after an owner or administrator authorizes managed review. Bring-your-own-key mode remains available for advanced direct use.",
      },
      {
        question: "Are Supabase migration files stored by BoundaryCI?",
        answer: "Not as managed-AI input. Authorized, locally redacted migration text passes transiently through BoundaryCI to Fireworks, while normalized findings and bounded metadata can be preserved in Cloud history.",
      },
    ],
    related: [sharedRelated.managedAi, { href: "/guides/deterministic-vs-ai-rls-analysis/", label: "Deterministic vs. AI RLS analysis", description: "Choose the right review layer for each kind of tenant-isolation risk." }, { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "Validate policy behavior with two tenant identities." }],
    ctaLabel: "Review a Supabase repository",
    ctaHeading: "Add a second review layer without weakening the first.",
    ctaDescription: "Start with deterministic Supabase checks, then authorize managed AI when your team wants semantic review in the same pull request.",
    ctaSecondaryLabel: "Read managed AI docs",
    ctaSecondaryHref: "/docs/managed-ai/",
  },
  {
    path: "/ai-postgresql-security-review/",
    kind: "product",
    title: "AI PostgreSQL Security Review for Multi-Tenant SaaS | BoundaryCI",
    description:
      "Review PostgreSQL migrations for multi-tenant security flaws with deterministic RLS checks and optional AI analysis of policies and privileged functions.",
    eyebrow: "AI-assisted PostgreSQL review",
    heading: "Review the PostgreSQL boundary your multi-tenant SaaS depends on.",
    introduction:
      "BoundaryCI reconstructs the authorization state left by ordered PostgreSQL migrations. Deterministic rules identify known RLS and SECURITY DEFINER failures; optional managed AI adds contextual review of tenant keys, memberships, policies, and privilege paths.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      {
        id: "review-scope",
        heading: "Focus AI-assisted review on tenant-boundary changes",
        paragraphs: [
          "General-purpose code review can produce broad suggestions. BoundaryCI narrows the question to one security invariant: can a valid action by one customer reach data or privileged behavior owned by another customer?",
        ],
        bullets: [
          "RLS policy expressions and the row tenant key they constrain",
          "Membership joins that prove identity but not row ownership",
          "USING and WITH CHECK coverage across read and write operations",
          "SECURITY DEFINER functions and surrounding execution privileges",
        ],
      },
      {
        id: "deterministic-foundation",
        heading: "Keep known PostgreSQL failures deterministic",
        paragraphs: [
          "Missing RLS, unconditional policies, unsafe search_path, and default PUBLIC execution have narrow conditions that do not need probabilistic judgment. BoundaryCI reports those checks consistently and can block new high-severity regressions.",
          "Managed AI supplements that foundation when the risk depends on relationships across multiple definitions. It does not silently replace the deterministic result or change the default exit code.",
        ],
      },
      {
        id: "migration-state",
        heading: "Review final migration state instead of isolated snippets",
        paragraphs: [
          "A later migration may drop, replace, rename, or re-grant an object. BoundaryCI follows migration order before evaluating the remaining state, reducing noise from SQL that no longer defines the deployed boundary.",
          "The managed review receives locally redacted migration context only after an eligible organization explicitly authorizes it, giving the model enough surrounding information to reason about policy interactions.",
        ],
      },
      {
        id: "ci-evidence",
        heading: "Put findings beside the migration that introduced them",
        paragraphs: [
          "The GitHub Action returns file-aware annotations and preserves normalized results in BoundaryCI Cloud. Teams can compare corrected reruns, keep waivers owned and expiring, and separate deterministic findings from AI review signals.",
        ],
        code: {
          label: "Run the deterministic scanner locally",
          language: "bash",
          value: "npx boundaryci scan . --profile postgres --fail-on high",
        },
      },
      {
        id: "limits",
        heading: "Combine migration review with active authorization tests",
        paragraphs: [
          "Neither static rules nor AI can observe live roles, claims, application queries, dynamic SQL, or operational access paths from migration text alone. Exercise at least two tenants in a disposable environment and independently review privileged service code.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can BoundaryCI AI review any PostgreSQL schema?",
        answer: "BoundaryCI is intentionally focused on ordered SQL migrations for multi-tenant authorization. It reviews RLS policies, tenant relationships, and privileged functions; it is not a general database performance or correctness analyzer.",
      },
      {
        question: "Can an AI finding block a pull request?",
        answer: "AI findings are advisory by default. A team can explicitly include them in the exit decision after evaluating quality on its repositories, while deterministic checks continue to operate independently.",
      },
      {
        question: "Does the scanner need PostgreSQL credentials?",
        answer: "No. BoundaryCI reads ordered migration files and does not connect to a production database. Runtime authorization testing is a separate layer teams should perform in a disposable environment.",
      },
    ],
    related: [{ href: "/guides/postgresql-multi-tenant-security/", label: "PostgreSQL tenant security guide", description: "Design RLS, tenant keys, roles, and privileged functions together." }, { href: "/guides/deterministic-vs-ai-rls-analysis/", label: "Deterministic vs. AI analysis", description: "Understand which review layer should make each decision." }, sharedRelated.security],
    ctaLabel: "Review PostgreSQL migrations",
    ctaHeading: "Make PostgreSQL tenant review continuous.",
    ctaDescription: "Scan locally without database access, then add managed AI and Cloud evidence when the repository is ready.",
    ctaSecondaryLabel: "Read the PostgreSQL guide",
    ctaSecondaryHref: "/guides/postgresql-multi-tenant-security/",
  },
  {
    path: "/ai-code-review-github-actions/",
    kind: "product",
    title: "AI Security Review in GitHub Actions | BoundaryCI",
    description:
      "Add tenant-isolation review to GitHub Actions with deterministic merge checks, optional managed AI findings, native annotations, and Cloud evidence.",
    eyebrow: "AI review in GitHub Actions",
    heading: "Put deterministic and AI tenant review in every migration pull request.",
    introduction:
      "BoundaryCI runs inside GitHub Actions, annotates risky Supabase and PostgreSQL migration lines, and keeps deterministic failures separate from optional managed AI observations. Reviewers see one focused tenant-isolation report without managing an AI provider key.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      {
        id: "workflow",
        heading: "Install one repository-bound workflow",
        paragraphs: [
          "Create the repository in BoundaryCI Cloud, save the one-time token as BOUNDARYCI_CLOUD_TOKEN, and commit the generated workflow. The committed YAML contains only a secret reference; the credential remains in GitHub's encrypted Actions secret store.",
        ],
        code: {
          label: "BoundaryCI GitHub Action",
          language: "yaml",
          value: "- uses: sir-gig/boundaryci@v0.4.0\n  with:\n    target: .\n    fail-on: high\n    managed-fireworks: \"true\"\n    upload: \"true\"\n    cloud-token: ${{ secrets.BOUNDARYCI_CLOUD_TOKEN }}",
        },
      },
      {
        id: "review-output",
        heading: "Give reviewers evidence at the changed line",
        paragraphs: [
          "Deterministic findings include a rule ID, severity, location, evidence, and remediation. Managed AI returns schema-constrained findings through the same reporting path, labeled so reviewers can distinguish repeatable checks from contextual analysis.",
          "A baseline can acknowledge reviewed existing debt. New non-waived deterministic findings at the configured threshold still fail the job, which allows branch protection to block the regression.",
        ],
      },
      {
        id: "managed-provider",
        heading: "Use managed Fireworks without adding its key to GitHub",
        paragraphs: [
          "Team, Growth, and Enterprise organization managers can authorize managed review once in BoundaryCI. The Fireworks API credential stays server-side, and the existing repository token handles eligibility and review requests.",
          "A manager can disable managed review for the organization or a repository. A workflow can also set managed-fireworks to false, allowing the same scanner to remain deterministic-only.",
        ],
      },
      {
        id: "failure-boundary",
        heading: "Keep CI useful when the AI provider is unavailable",
        paragraphs: [
          "Timeouts, rate limits, or invalid model output produce a warning rather than erasing the deterministic result. Managed AI is advisory by default, so a third-party outage does not turn a security check into an unrelated release blocker.",
        ],
      },
      {
        id: "multiple-repositories",
        heading: "Repeat the setup across repositories",
        paragraphs: [
          "An organization can add multiple repositories from its dashboard. Each repository receives a separate bound token, enablement control, setup guide, and scan history while paid usage is counted at the organization level.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this a general AI code-review bot?",
        answer: "No. BoundaryCI is deliberately focused on tenant-isolation risks in ordered Supabase and PostgreSQL SQL migrations. That narrow scope keeps its evidence and recommendations relevant to the customer-data boundary.",
      },
      {
        question: "Which GitHub secret does the workflow need?",
        answer: "Cloud-connected workflows use BOUNDARYCI_CLOUD_TOKEN, a repository-bound credential shown once during setup. Managed mode does not require customers to add FIREWORKS_API_KEY to GitHub.",
      },
      {
        question: "What happens if Fireworks is unavailable?",
        answer: "BoundaryCI warns about the managed review failure and continues deterministic scanning and Cloud upload. Deterministic findings can still enforce the configured pull-request gate.",
      },
    ],
    related: [{ href: "/github-action/", label: "GitHub Action setup", description: "Follow the complete token, workflow, and branch-protection setup." }, sharedRelated.managedAi, { href: "/ai-supabase-rls-review/", label: "AI Supabase RLS review", description: "See the policy interactions the optional review targets." }],
    ctaLabel: "Connect a GitHub repository",
    ctaHeading: "Bring tenant-isolation review into the pull request.",
    ctaDescription: "Start with a repository-bound workflow and deterministic merge checks. Enable managed AI only when your organization authorizes it.",
    ctaSecondaryLabel: "Read the Action guide",
    ctaSecondaryHref: "/github-action/",
  },
  {
    path: "/guides/deterministic-vs-ai-rls-analysis/",
    kind: "guide",
    title: "Deterministic vs AI RLS Analysis | BoundaryCI Guide",
    description:
      "Compare deterministic RLS checks with AI-assisted policy review, including strengths, limitations, CI behavior, privacy controls, and when to use both.",
    eyebrow: "RLS analysis guide",
    heading: "Use deterministic rules and AI review where each is strongest.",
    introduction:
      "Reliable tenant-isolation CI does not require choosing between fixed rules and AI. Known unsafe policy states should stay deterministic; contextual relationships can benefit from an advisory semantic review that never hides or replaces the repeatable result.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      {
        id: "deterministic",
        heading: "Deterministic analysis answers narrow, repeatable questions",
        paragraphs: [
          "A deterministic rule has a reviewable condition and returns the same answer for the same final migration state. This makes it appropriate for required CI checks, baselines, waivers, and audit evidence.",
        ],
        bullets: [
          "Is RLS enabled on every exposed table?",
          "Does an anon, PUBLIC, or authenticated policy reduce to true?",
          "Is a SECURITY DEFINER search path pinned?",
          "Was default PUBLIC execution explicitly revoked?",
        ],
      },
      {
        id: "ai",
        heading: "AI review explores relationships that resist one syntax rule",
        paragraphs: [
          "A policy may contain auth.uid(), a membership lookup, and a tenant column yet connect them incorrectly. Contextual review can examine those definitions together and explain a plausible cross-tenant path for a human to validate.",
          "The tradeoff is probabilistic output: a model can miss a flaw or raise an unhelpful concern. BoundaryCI therefore labels managed findings and keeps them advisory by default.",
        ],
      },
      {
        id: "comparison",
        heading: "Let the risk determine the review layer",
        paragraphs: [
          "Use deterministic rules for known conditions that must be enforced consistently. Use AI to widen reviewer attention when meaning depends on several policies, functions, or membership relationships. Use runtime tests when the answer depends on actual roles, claims, requests, or application code.",
        ],
        bullets: [
          "Merge gate: deterministic findings by default",
          "Contextual hypothesis: AI-assisted finding with human validation",
          "Behavioral proof: active negative tests with two tenants",
          "Broad assurance: threat modeling, manual review, and independent testing",
        ],
      },
      {
        id: "safe-adoption",
        heading: "Adopt AI review without making CI fragile",
        paragraphs: [
          "Run both layers on representative repositories and measure whether AI findings identify useful policy interactions. Keep deterministic checks enabled, preserve AI findings separately, and leave them out of the exit code until the team has an evidence-based reason to change that default.",
          "Provider unavailability should degrade to a warning. Repository and organization opt-outs should remain available so an outage, sensitive project, or noisy review never requires removing the underlying security gate.",
        ],
      },
      {
        id: "privacy",
        heading: "Make transmission a consented decision",
        paragraphs: [
          "BoundaryCI requires eligible-plan status and manager authorization before managed review. The runner checks eligibility before sending migration content, redacts common secret patterns locally, and limits input size. BoundaryCI does not store the forwarded migration text.",
        ],
        note: "Static review of any kind is incomplete. Pair it with runtime authorization tests and never place production secrets in migration files.",
      },
    ],
    faqs: [
      {
        question: "Is AI more accurate than deterministic RLS analysis?",
        answer: "They answer different questions. Deterministic rules are more reliable for known syntax and final-state conditions. AI can surface contextual relationships those rules do not model, but its findings require human validation.",
      },
      {
        question: "Should AI findings fail CI?",
        answer: "Not initially. BoundaryCI keeps them advisory by default. Teams should measure quality on their own migrations before explicitly including AI findings in an exit decision.",
      },
      {
        question: "Do I need both AI review and runtime RLS tests?",
        answer: "Yes, when the boundary is important. Static review cannot execute live JWT claims, application queries, storage access, or service-role paths. Two-tenant negative tests provide a separate kind of evidence.",
      },
    ],
    related: [{ href: "/ai-supabase-rls-review/", label: "AI Supabase RLS review", description: "Apply the layered model to Supabase migrations." }, { href: "/ai-postgresql-security-review/", label: "AI PostgreSQL review", description: "Apply it to PostgreSQL tenant policies and privileged functions." }, sharedRelated.rules],
    ctaLabel: "Run deterministic checks first",
    ctaHeading: "Build the reliable layer first, then widen the review.",
    ctaDescription: "BoundaryCI starts with deterministic tenant-isolation checks and adds managed AI as a clearly labeled, consent-gated signal.",
    ctaSecondaryLabel: "Read managed AI docs",
    ctaSecondaryHref: "/docs/managed-ai/",
  },
  {
    path: "/rules/",
    kind: "rule-index",
    title: "BoundaryCI Tenant-Isolation Rules | BND001–BND012",
    description:
      "Reference twelve deterministic checks for Supabase RLS, exposed relations, default privileges, authentication metadata, and privileged functions.",
    eyebrow: "Rule reference",
    heading: "Twelve deterministic checks for migration-time tenant boundaries.",
    introduction:
      "Each BoundaryCI rule has a narrow, reviewable condition. Findings include the final-state evidence, migration location, severity, and a specific remediation.",
    publishedAt: CONTENT_DATE,
    modifiedAt: AI_MARKETING_DATE,
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
          "BoundaryCI accounts for later policy changes, relation drops, function replacements, object grants, revokes, and default privileges. This avoids reporting a dangerous statement that a later migration already removed while still catching a safe object that was later exposed.",
        ],
      },
    ],
    related: [sharedRelated.quickstart, { href: "/guides/test-supabase-rls/", label: "Supabase RLS testing", description: "Pair static rules with two-tenant runtime tests." }, sharedRelated.security],
    ctaLabel: "Run the deterministic checks",
  },
  {
    path: "/security/",
    kind: "security",
    title: "BoundaryCI Security and Data Handling",
    description:
      "Understand BoundaryCI's local scanner, managed Fireworks review, minimized Cloud history, repository tokens, and security limitations.",
    eyebrow: "Security model",
    heading: "Migration scanning stays local unless you explicitly enable a network feature.",
    introduction:
      "BoundaryCI separates deterministic scanning, managed or bring-your-own-key Fireworks review, and Cloud history so teams can control which data is allowed to leave their environment.",
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
        heading: "Managed Fireworks review requires authorization",
        paragraphs: [
          "Paid Cloud organizations remain deterministic-only until an owner or administrator accepts the managed-review disclosure. The runner checks plan, subscription, organization consent, and repository settings before it transmits migration text. No migration content is included in that eligibility check.",
          "After authorization, the runner redacts common secret patterns and sends at most 80,000 characters through BoundaryCI to Fireworks. BoundaryCI does not store the migration input; normalized AI findings can be stored with Cloud history. Each repository and workflow has an opt-out.",
          "Direct --fireworks mode remains available for customers who prefer their own Fireworks key and account. In either mode, deterministic scanning continues when the optional review is unavailable unless direct mode was explicitly marked required.",
        ],
        note: "Redaction cannot guarantee removal of every sensitive value. Customers must not place production credentials or unnecessary personal data in migrations.",
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
  {
    path: "/terms/",
    kind: "legal",
    title: "BoundaryCI Cloud Terms and Subscription Policy",
    description:
      "Review BoundaryCI Cloud subscription renewal, cancellation, refund, service-scope, payment-processing, and customer-responsibility terms.",
    eyebrow: "Terms and subscriptions",
    heading: "Clear terms for using BoundaryCI and BoundaryCI Cloud.",
    introduction:
      "These terms explain the service BoundaryCI provides, how paid Cloud subscriptions renew and end, and the limits customers should understand before purchasing.",
    publishedAt: "2026-07-17",
    modifiedAt: BILLING_READINESS_DATE,
    sections: [
      {
        id: "license-and-scope",
        heading: "License and service scope",
        paragraphs: [
          "The BoundaryCI scanner is distributed under the MIT License. BoundaryCI Cloud adds hosted scan history, organization access, usage allowances, and optional paid subscription capacity.",
          "Paid organizations can authorize a managed Fireworks semantic review. AI findings can be incomplete, incorrect, or misleading and remain advisory unless the customer explicitly includes them in the CI exit decision.",
          "BoundaryCI is an engineering aid for reviewing tenant-isolation controls. It is not a penetration test, security certification, legal or compliance opinion, managed security service, or guarantee that an application is secure.",
        ],
      },
      {
        id: "subscriptions",
        heading: "Prices, currency, and automatic renewal",
        paragraphs: [
          "Paid prices, billing interval, included usage, and any promotion are displayed before authorization in Stripe Checkout. Public BoundaryCI prices are stated in United States dollars unless Checkout explicitly shows otherwise.",
          "Monthly and annual subscriptions renew automatically using the saved payment method until canceled. Future pricing changes apply only with the notice and authorization required by Stripe and applicable law.",
        ],
      },
      {
        id: "cancellation-and-refunds",
        heading: "Cancellation and refunds",
        paragraphs: [
          "Customers can manage payment methods, invoices, plan changes, and cancellation through Stripe's hosted customer portal. Cancellation normally takes effect at the end of the current paid period, so access continues through that period unless Stripe indicates otherwise.",
          "Charges are non-refundable except where required by law or expressly agreed in writing. A payment refund and a subscription cancellation are separate actions; refunding a payment does not by itself cancel future renewal.",
        ],
      },
      {
        id: "payments-and-delivery",
        heading: "Payment processing and service delivery",
        paragraphs: [
          "Stripe processes payment methods, invoices, billing addresses, and tax identifiers. BoundaryCI does not receive or store complete card numbers. Card statements should identify the charge with the BoundaryCI statement descriptor configured in Stripe.",
          "Paid capacity is delivered to the BoundaryCI Cloud organization associated with Checkout after Stripe confirms the subscription. Access or ingestion can be limited when an allowance is exhausted or a subscription is incomplete, unpaid, past due, paused, or canceled.",
        ],
      },
      {
        id: "customer-responsibilities",
        heading: "Customer responsibilities",
        paragraphs: [
          "Customers must use BoundaryCI only on code and systems they are authorized to assess, protect credentials and confidential material, and review findings before making security or production decisions.",
          "A customer enabling managed AI represents that it is authorized to send the selected migration text for processing by BoundaryCI and Fireworks. Organization managers are responsible for communicating that choice to their repository teams and using the available organization, repository, or workflow opt-outs when appropriate.",
          "Do not submit production credentials, unnecessary personal data, or proprietary migrations through public support channels. Third-party services such as Supabase, Stripe, GitHub, npm, Cloudflare, and Fireworks operate under their own terms.",
        ],
      },
      {
        id: "support-and-changes",
        heading: "Support, changes, and complete agreement",
        paragraphs: [
          "Support is provided on a reasonable-effort basis without an uptime or response-time commitment unless a separate Enterprise agreement states otherwise. Material changes are published through the BoundaryCI repository and public site.",
          "The complete BoundaryCI End User License Agreement remains available in the public sir-gig/boundaryci GitHub repository. If this page and that agreement conflict, the complete agreement controls.",
        ],
      },
    ],
    related: [
      { href: "/privacy/", label: "Privacy notice", description: "See how account, scan, authentication, and billing information is handled." },
      { href: "/support/", label: "Customer support", description: "Find the right route for billing, product, and security questions." },
      sharedRelated.security,
    ],
    ctaLabel: "Start scanning free",
  },
  {
    path: "/privacy/",
    kind: "legal",
    title: "BoundaryCI Privacy Notice and Data Handling",
    description:
      "Learn what BoundaryCI processes during local scans, optional Cloud upload, authentication, bot protection, AI review, support, and Stripe billing.",
    eyebrow: "Privacy notice",
    heading: "Know what stays local and what optional services process.",
    introduction:
      "BoundaryCI is local-first. Network processing occurs only when a customer enables an optional integration, uses BoundaryCI Cloud, authenticates, requests support, or purchases a subscription.",
    publishedAt: "2026-07-17",
    modifiedAt: FINDING_VISIBILITY_DATE,
    sections: [
      {
        id: "local-scans",
        heading: "Local deterministic scans",
        paragraphs: [
          "Deterministic scans run on the customer machine or GitHub Actions runner and make no BoundaryCI network request. Merely running the scanner does not send repositories, migrations, findings, credentials, or workflow metadata to the Developer.",
          "BoundaryCI has no product analytics, behavioral advertising, or scanner telemetry. Information reaches BoundaryCI Cloud only when upload is explicitly enabled.",
        ],
      },
      {
        id: "cloud-upload",
        heading: "Optional Cloud upload",
        paragraphs: [
          "The Cloud history upload can include repository and commit context, scan timestamps, summary counts, finding classifications, relative paths, line numbers, short evidence, remediation, disposition, and waiver metadata.",
          "That history payload excludes complete migration files, database credentials, absolute scan targets, and migration inventories. Common secret patterns are redacted, but redaction cannot guarantee removal of every confidential value. Managed AI review, when separately authorized, has the transient processing described below.",
        ],
      },
      {
        id: "accounts-and-security",
        heading: "Accounts, authentication, and abuse protection",
        paragraphs: [
          "Supabase processes authentication records and hosts organization, repository, usage, finding, finding-visibility preferences, and subscription state. Repository ingestion tokens are stored as SHA-256 hashes rather than plaintext.",
          "Cloudflare Turnstile processes browser and request signals needed to challenge automated authentication attempts. Its public site key is browser-visible; its verification secret remains server-side in Supabase.",
        ],
      },
      {
        id: "billing",
        heading: "Billing",
        paragraphs: [
          "Stripe processes paid subscriptions, payment methods, invoices, tax identifiers, and billing addresses. BoundaryCI stores customer, subscription, price, status, event, and billing-period identifiers needed to synchronize plan access.",
          "The Developer does not receive or store complete payment-card numbers. Stripe retains payment and invoice information under its own policies.",
        ],
      },
      {
        id: "fireworks-and-support",
        heading: "Optional AI review and information customers submit",
        paragraphs: [
          "For managed review, an owner or administrator of an eligible paid organization must first accept the dashboard disclosure. The runner sends only repository identity to check eligibility. If enabled, it redacts common secret patterns locally and sends up to 80,000 characters of migration text through BoundaryCI to Fireworks under the Developer's managed account. BoundaryCI does not store that migration input; it can store the normalized findings, model, status, input hash, and operational metadata needed for history, limits, retries, and abuse prevention.",
          "Managed review can be disabled for an organization, repository, or workflow. Existing organizations remain off until authorization. Direct bring-your-own-key review remains available; in that mode, migration text is sent from the customer environment directly to Fireworks under the customer's account and BoundaryCI does not receive that direct request or response.",
          "Fireworks processes managed and direct inference under its own terms and privacy practices. Customers are responsible for ensuring they are authorized to submit the selected code. Secret redaction is defense in depth and cannot guarantee removal of every confidential value.",
          "Information voluntarily submitted through GitHub issues, pull requests, discussions, or vulnerability reports is processed to respond and maintain the product. Customers should remove credentials, personal data, and proprietary material before submission.",
        ],
      },
      {
        id: "retention-and-requests",
        heading: "Retention, sharing, and requests",
        paragraphs: [
          "The Developer does not sell personal information. Information is shared only as needed to provide the selected services, respond through support channels, comply with law, or protect rights and security.",
          "Cloud records may be deleted when an organization or repository is removed, while billing and event identifiers can be retained when reasonably needed for accounting, fraud prevention, disputes, and legal compliance. Use the support page for access, correction, export, or deletion requests without posting confidential information publicly.",
        ],
      },
    ],
    related: [
      { href: "/terms/", label: "Terms and subscriptions", description: "Review paid-plan renewal, cancellation, refund, and service-scope terms." },
      { href: "/support/", label: "Customer support", description: "Choose a public or private support route appropriate to the issue." },
      sharedRelated.security,
    ],
    ctaLabel: "Start scanning free",
  },
  {
    path: "/support/",
    kind: "legal",
    title: "BoundaryCI Customer Support and Security Reporting",
    description:
      "Get BoundaryCI product and billing help, report reproducible bugs, share AI-output feedback, or disclose a security vulnerability privately.",
    eyebrow: "Customer support",
    heading: "Use the support route that protects your information.",
    introduction:
      "BoundaryCI provides reasonable-effort support for the open-source scanner and Cloud subscriptions. Never include credentials, customer data, or proprietary migrations in a public report.",
    publishedAt: "2026-07-17",
    modifiedAt: BILLING_READINESS_DATE,
    sections: [
      {
        id: "product-help",
        heading: "Product help and reproducible bugs",
        paragraphs: [
          "Use GitHub Issues in the public sir-gig/boundaryci repository for installation problems, documentation questions, sanitized reproductions, feature requests, and feedback about an AI-generated finding.",
          "Include the BoundaryCI version, operating system, command, sanitized output, and smallest safe reproduction. The latest tagged release is the supported open-source version.",
        ],
      },
      {
        id: "billing-help",
        heading: "Billing and subscription help",
        paragraphs: [
          "Use the support contact displayed by Stripe Checkout or on the Stripe receipt for payment-specific questions. Use Manage billing inside BoundaryCI Cloud for invoices, payment methods, plan changes, and cancellation.",
          "A refund and subscription cancellation are separate actions. Include only the organization name and invoice date in an initial request; do not send complete card details, authentication codes, or Stripe credentials.",
        ],
      },
      {
        id: "security-reporting",
        heading: "Security vulnerabilities",
        paragraphs: [
          "Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability-reporting feature for the sir-gig/boundaryci repository and follow SECURITY.md.",
          "Include the affected version, reproduction conditions, impact, and a safe contact method. Do not include live credentials or unrelated customer information.",
        ],
      },
      {
        id: "service-level",
        heading: "Support scope",
        paragraphs: [
          "Paid plans provide the capacity displayed at Checkout but do not include a guaranteed response time, uptime commitment, incident-response service, or service-level agreement unless a separate Enterprise agreement states otherwise.",
          "Growth and Enterprise requests are prioritized when practical. Fireworks account access, availability, and billing remain the responsibility of Fireworks support.",
        ],
      },
    ],
    related: [
      { href: "/terms/", label: "Terms and subscriptions", description: "Review service scope and paid-plan policies before purchase." },
      { href: "/privacy/", label: "Privacy notice", description: "Understand information handling before submitting a report." },
      sharedRelated.security,
    ],
    ctaLabel: "Start scanning free",
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
  {
    path: "/rules/bnd007/",
    kind: "rule",
    ruleId: "BND007",
    severity: "high",
    title: "BND007: Exposed View Without SECURITY INVOKER | BoundaryCI",
    description: "BND007 finds views in exposed Supabase schemas that do not use security_invoker and may bypass row-level security on underlying tables.",
    eyebrow: "BND007 · High severity",
    heading: "Exposed view may bypass underlying row-level security.",
    introduction: "PostgreSQL views use the view creator's permissions by default. In an exposed schema, that can let an API caller bypass RLS that would apply when querying the table directly.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a view that remains in a configured exposed schema when final migration state does not set security_invoker to true. BoundaryCI follows CREATE OR REPLACE, ALTER VIEW, and DROP VIEW changes and ignores temporary views."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["Views normally check underlying permissions as the view owner. Table owners commonly bypass RLS, so an otherwise-correct policy may not protect rows reached through a definer-rights view exposed by the Data API."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["On PostgreSQL 15 or later, make the view a security-invoker view. Otherwise revoke access from anon and authenticated, or place the view in a schema that the API does not expose."], code: { label: "Use caller permissions", language: "sql", value: "create view public.project_directory\nwith (security_invoker = true)\nas\nselect id, organization_id, name\nfrom public.projects;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd001/", label: "BND001: missing RLS", description: "Protect the underlying exposed tables." }, { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "Verify direct and view-based access with two tenants." }],
    ctaLabel: "Find unsafe exposed views",
  },
  {
    path: "/rules/bnd008/",
    kind: "rule",
    ruleId: "BND008",
    severity: "high",
    title: "BND008: RLS Policy Trusts User Metadata | BoundaryCI",
    description: "BND008 finds RLS policies that authorize access with user-editable user_metadata instead of trusted claims or tenant membership data.",
    eyebrow: "BND008 · High severity",
    heading: "RLS policy trusts user-editable authentication metadata.",
    introduction: "A signed JWT is not enough when the authorization value inside it was supplied by the user. Attackers can modify user_metadata and manufacture a tenant claim a policy mistakenly trusts.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports client-accessible policies whose USING or WITH CHECK expressions read raw_user_meta_data, or user_metadata from auth.jwt() or request.jwt.claims. It does not report server-controlled app_metadata claims or policies limited to trusted server roles."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["Supabase users can update user_metadata through authentication APIs. A policy that treats a tenant ID, role, or authorization flag from that object as trusted can turn a profile edit into cross-tenant access."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Prefer a protected membership table correlated to both auth.uid() and the tenant column on the row. Server-controlled app_metadata can hold authorization claims, but remember that JWT values may remain stale until the token is refreshed."], code: { label: "Use protected membership data", language: "sql", value: "using (exists (\n  select 1\n  from public.organization_members memberships\n  where memberships.organization_id = projects.organization_id\n    and memberships.user_id = auth.uid()\n));" } },
    ],
    related: [sharedRelated.rules, { href: "/guides/test-supabase-rls/", label: "Test Supabase RLS", description: "Exercise trusted membership policies with two users." }, { href: "/ai-supabase-rls-review/", label: "AI-assisted RLS review", description: "Review higher-order policy interactions after deterministic checks." }],
    ctaLabel: "Find unsafe metadata policies",
  },
  {
    path: "/rules/bnd009/",
    kind: "rule",
    ruleId: "BND009",
    severity: "high",
    title: "BND009: Materialized View Exposed to API Roles | BoundaryCI",
    description: "BND009 finds selectable materialized views in exposed Supabase schemas, where stored query results can bypass base-table row-level security.",
    eyebrow: "BND009 · High severity",
    heading: "Materialized view is exposed to API roles.",
    introduction: "A materialized view stores query results as a separate relation. API callers query that stored relation directly rather than re-evaluating RLS on its source tables.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a materialized view in a configured exposed schema when final privilege state leaves SELECT available through PUBLIC, anon, or authenticated. BoundaryCI follows creation, drops, object grants and revokes, and earlier default-privilege changes."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["Materialized rows do not inherit the source tables' request-time policies. A refresh performed by a privileged owner can copy several tenants' rows into a relation that the Data API then serves to ordinary clients."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Keep materialized views in an unexposed reporting schema and revoke client access. If clients need derived data, expose a policy-aware security-invoker view or a narrowly validated RPC."], code: { label: "Remove API access", language: "sql", value: "revoke all on table public.account_rollup from public, anon, authenticated;\nalter materialized view public.account_rollup set schema analytics_private;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd007/", label: "BND007: exposed view", description: "Review caller permissions for regular views." }, sharedRelated.security],
    ctaLabel: "Find exposed materialized views",
  },
  {
    path: "/rules/bnd010/",
    kind: "rule",
    ruleId: "BND010",
    severity: "high",
    title: "BND010: Foreign Table Exposed to API Roles | BoundaryCI",
    description: "BND010 finds foreign tables that expose external data sources through a client-accessible Supabase Data API schema.",
    eyebrow: "BND010 · High severity",
    heading: "Foreign table is exposed to API roles.",
    introduction: "A foreign table places a remote data source behind a local PostgreSQL relation. Exposing that relation can unintentionally turn the Data API into a path to another system.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a foreign table in an exposed schema when PUBLIC, anon, or authenticated retains a read or write privilege. Ordered object and default grants, revokes, creation, and drops determine the final state."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["Local table policies do not automatically describe the remote system's tenant boundary. Client reads or writes may reach data governed by different identities, filters, or operational assumptions."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Place foreign tables in an unexposed integration schema and revoke API-role privileges. Publish only the required operation through a validated function or a policy-aware local projection."], code: { label: "Keep the foreign table private", language: "sql", value: "revoke all on table public.partner_accounts from public, anon, authenticated;\nalter foreign table public.partner_accounts set schema integrations_private;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd009/", label: "BND009: materialized view", description: "Review other non-table API relations." }, { href: "/guides/postgresql-multi-tenant-security/", label: "PostgreSQL tenant security", description: "Design a narrow integration boundary." }],
    ctaLabel: "Find exposed foreign tables",
  },
  {
    path: "/rules/bnd011/",
    kind: "rule",
    ruleId: "BND011",
    severity: "medium",
    title: "BND011: Unsafe Default Privileges for API Roles | BoundaryCI",
    description: "BND011 finds default table or function grants that automatically make future PostgreSQL objects reachable by Supabase API roles.",
    eyebrow: "BND011 · Medium severity",
    heading: "Default privileges automatically expose future objects.",
    introduction: "A secure object can become the exception while every future table or function is exposed automatically. The mistake may remain invisible until a later migration creates sensitive data or a privileged RPC.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports final ALTER DEFAULT PRIVILEGES grants on tables or functions for PUBLIC, anon, or authenticated when they apply globally or to a configured exposed schema. A later matching revoke removes the finding."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["Default grants silently widen the API surface of future migrations. RLS can still constrain tables, but accidental functions, views, materialized views, and foreign tables may become reachable before their privilege model is reviewed."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Revoke client-facing defaults and grant privileges explicitly on reviewed API objects. Keep internal relations and helper functions in schemas the Data API does not expose."], code: { label: "Require explicit grants", language: "sql", value: "alter default privileges in schema public\n  revoke all on tables from public, anon, authenticated;\nalter default privileges in schema public\n  revoke execute on functions from public, anon, authenticated;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd012/", label: "BND012: client-executable function", description: "Review privileged functions created under unsafe defaults." }, sharedRelated.security],
    ctaLabel: "Audit default privileges",
  },
  {
    path: "/rules/bnd012/",
    kind: "rule",
    ruleId: "BND012",
    severity: "high",
    title: "BND012: Privileged Function Executable by API Roles | BoundaryCI",
    description: "BND012 finds exposed SECURITY DEFINER functions directly executable by anon or authenticated after PUBLIC execution has been revoked.",
    eyebrow: "BND012 · High severity",
    heading: "SECURITY DEFINER function is executable by API roles.",
    introduction: "Revoking PUBLIC is only the first privilege boundary. A later direct grant to anon or authenticated still places an owner-privileged function on the client-facing RPC surface.",
    publishedAt: AI_MARKETING_DATE,
    modifiedAt: AI_MARKETING_DATE,
    sections: [
      { id: "condition", heading: "Detection condition", paragraphs: ["The rule reports a SECURITY DEFINER overload in a configured exposed schema when final execution privileges exclude PUBLIC but still include anon or authenticated. Function signatures, replacements, object grants and revokes, schema-wide grants, and default privileges are evaluated in order."] },
      { id: "risk", heading: "Why it matters", paragraphs: ["The caller enters code running with the function owner's privileges. Missing tenant correlation, overly broad parameters, or unsafe dynamic SQL can turn the RPC into a cross-tenant read or write path."] },
      { id: "fix", heading: "Typical remediation", paragraphs: ["Revoke direct API-role execution and grant the exact overload only to a trusted server role. If clients need the operation, expose a narrow wrapper that validates identity, membership, tenant correlation, and every writable field."], code: { label: "Restrict the exact overload", language: "sql", value: "revoke execute on function public.client_admin_lookup(uuid)\n  from anon, authenticated;\ngrant execute on function public.client_admin_lookup(uuid)\n  to service_role;" } },
    ],
    related: [sharedRelated.rules, { href: "/rules/bnd005/", label: "BND005: search_path", description: "Harden name resolution inside the function." }, { href: "/rules/bnd006/", label: "BND006: PUBLIC execute", description: "Remove PostgreSQL's broad default execution privilege." }],
    ctaLabel: "Find client-executable privileged RPCs",
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
    faqs: page.faqs,
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
