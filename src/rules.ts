import type { BoundaryConfig } from "./config.js";
import type { Finding, PolicyDefinition, SqlInventory, TableDefinition } from "./types.js";

function isUnconditional(expression: string | undefined): boolean {
  if (!expression) return false;
  return expression.replace(/[\s()]/g, "").toLowerCase() === "true";
}

function isIgnored(table: TableDefinition, config: BoundaryConfig): boolean {
  const ignored = new Set(config.ignoreTables.map((value) => value.toLowerCase()));
  return ignored.has(table.key) || ignored.has(table.name.toLowerCase());
}

function policyFinding(policy: PolicyDefinition): Finding | undefined {
  const unrestrictedUsing = isUnconditional(policy.usingExpression);
  const unrestrictedCheck = isUnconditional(policy.checkExpression);
  if (!unrestrictedUsing && !unrestrictedCheck) return undefined;

  const publicRoles = policy.roles.length === 0 || policy.roles.some((role) => role === "public" || role === "anon");
  const authenticatedRole = policy.roles.some((role) => role === "authenticated");
  if (!publicRoles && !authenticatedRole) return undefined;
  const expressionNames = [
    unrestrictedUsing ? "USING (true)" : undefined,
    unrestrictedCheck ? "WITH CHECK (true)" : undefined,
  ].filter(Boolean).join(" and ");

  return {
    ruleId: publicRoles ? "BND003" : "BND004",
    title: publicRoles ? "Public policy grants unrestricted row access" : "Authenticated policy is not tenant-scoped",
    description: publicRoles
      ? `Policy ${policy.name} grants anonymous or PUBLIC callers unrestricted ${policy.command.toUpperCase()} access.`
      : `Policy ${policy.name} grants every authenticated user unrestricted ${policy.command.toUpperCase()} access. This may be intentional for shared data, but it does not enforce tenant isolation.`,
    severity: publicRoles ? "critical" : "high",
    confidence: "high",
    source: "deterministic",
    location: { file: policy.file, line: policy.line },
    evidence: `${expressionNames}: ${policy.statement}`,
    recommendation: publicRoles
      ? "Replace the unconditional expression with an ownership or tenant-membership check, and avoid granting the policy to anon or PUBLIC."
      : "Scope the policy to the active tenant or organization membership, or explicitly ignore this finding if the table is intentionally shared by every authenticated user.",
    tags: ["supabase", "rls", "tenant-isolation", "authorization"],
  };
}

export function runDeterministicRules(inventory: SqlInventory, config: BoundaryConfig): Finding[] {
  const findings: Finding[] = [];
  const exposedSchemas = new Set(config.exposedSchemas.map((schema) => schema.toLowerCase()));

  for (const table of inventory.tables.values()) {
    if (!exposedSchemas.has(table.schema.toLowerCase()) || isIgnored(table, config)) continue;

    if (!table.rlsEnabled) {
      findings.push({
        ruleId: "BND001",
        title: "Exposed table does not enable row-level security",
        description: `${table.key} is in an exposed schema but no ENABLE ROW LEVEL SECURITY statement was found.`,
        severity: "high",
        confidence: "high",
        source: "deterministic",
        location: { file: table.file, line: table.line },
        evidence: table.statement,
        recommendation: `Run ALTER TABLE ${table.key} ENABLE ROW LEVEL SECURITY and add explicit policies for every allowed operation.`,
        tags: ["supabase", "rls", "tenant-isolation", "owasp-api1"],
      });
    } else if (table.policies.length === 0) {
      findings.push({
        ruleId: "BND002",
        title: "RLS-enabled table has no policies",
        description: `${table.key} enables row-level security but no policies were found. Client access will normally be denied.`,
        severity: "medium",
        confidence: "high",
        source: "deterministic",
        location: { file: table.file, line: table.line },
        evidence: table.statement,
        recommendation: "Add least-privilege policies for the operations the application requires, or document that the table is intentionally server-only.",
        tags: ["supabase", "rls", "availability"],
      });
    }

    for (const policy of table.policies) {
      const finding = policyFinding(policy);
      if (finding) findings.push(finding);
    }
  }

  for (const fn of inventory.functions) {
    if (!fn.hasPinnedSearchPath) {
      findings.push({
        ruleId: "BND005",
        title: "SECURITY DEFINER function has an unpinned search path",
        description: `${fn.key} executes with its owner's privileges but does not pin search_path to a trusted value.`,
        severity: "high",
        confidence: "high",
        source: "deterministic",
        location: { file: fn.file, line: fn.line },
        evidence: fn.statement,
        recommendation: "Add SET search_path = '' (and schema-qualify referenced objects) to prevent object-shadowing attacks.",
        tags: ["postgres", "security-definer", "privilege-escalation"],
      });
    }

    if (!fn.publicExecuteRevoked) {
      findings.push({
        ruleId: "BND006",
        title: "SECURITY DEFINER function remains executable by PUBLIC",
        description: `PostgreSQL grants function execution to PUBLIC by default, and no explicit revoke was found for ${fn.key}.`,
        severity: "high",
        confidence: "medium",
        source: "deterministic",
        location: { file: fn.file, line: fn.line },
        evidence: fn.statement,
        recommendation: `Run REVOKE EXECUTE ON FUNCTION ${fn.key} FROM PUBLIC, then grant execution only to the roles that need it.`,
        tags: ["postgres", "security-definer", "least-privilege"],
      });
    }
  }

  return findings;
}
