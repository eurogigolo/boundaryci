import type { BoundaryConfig } from "./config.js";
import type {
  BaseRelationDefinition,
  Finding,
  PolicyDefinition,
  RelationPrivilege,
  SqlInventory,
} from "./types.js";

function isUnconditional(expression: string | undefined): boolean {
  if (!expression) return false;
  return expression.replace(/[\s()]/g, "").toLowerCase() === "true";
}

function isIgnored(object: BaseRelationDefinition, config: BoundaryConfig): boolean {
  const ignored = new Set(config.ignoreTables.map((value) => value.toLowerCase()));
  return ignored.has(object.key) || ignored.has(object.name.toLowerCase());
}

function clientRolesWithPrivileges(
  relation: BaseRelationDefinition,
  requested?: RelationPrivilege[],
): Array<"anon" | "authenticated"> {
  const publicPrivileges = new Set(
    relation.apiPrivileges.find((entry) => entry.role === "public")?.privileges ?? [],
  );
  return (["anon", "authenticated"] as const).filter((role) => {
    const direct = relation.apiPrivileges.find((entry) => entry.role === role)?.privileges ?? [];
    const effective = new Set([...publicPrivileges, ...direct]);
    return requested
      ? requested.some((privilege) => effective.has(privilege))
      : effective.size > 0;
  });
}

function relationPrivilegeEvidence(
  relation: BaseRelationDefinition,
  clientRoles: Array<"anon" | "authenticated">,
  privileges: RelationPrivilege[],
): { file: string; line: number; statement: string } {
  const publicPrivileges = new Set(
    relation.apiPrivileges.find((entry) => entry.role === "public")?.privileges ?? [],
  );
  const sources: Array<{ file: string; line: number; statement: string }> = [];
  for (const clientRole of clientRoles) {
    const directPrivileges = new Set(
      relation.apiPrivileges.find((entry) => entry.role === clientRole)?.privileges ?? [],
    );
    for (const privilege of privileges) {
      if (publicPrivileges.has(privilege)) {
        const source = relation.apiPrivilegeSources.public?.[privilege];
        if (!source) return relation;
        sources.push(source);
      } else if (directPrivileges.has(privilege)) {
        const source = relation.apiPrivilegeSources[clientRole]?.[privilege];
        if (!source) return relation;
        sources.push(source);
      }
    }
  }
  return sources[0] ?? relation;
}

function referencesUserEditableMetadata(expression: string | undefined): boolean {
  if (!expression) return false;
  if (/\braw_user_meta_data\b/i.test(expression)) return true;

  const readsJwt = /\bauth\s*\.\s*jwt\s*\(\s*\)/i.test(expression)
    || /request\.jwt\.claims/i.test(expression);
  return readsJwt && /\b(?:raw_)?user_metadata\b/i.test(expression);
}

function userMetadataFinding(policy: PolicyDefinition): Finding | undefined {
  const clientAccessible = policy.roles.length === 0
    || policy.roles.some((role) => ["public", "anon", "authenticated"].includes(role));
  if (!clientAccessible) return undefined;

  const usingMetadata = referencesUserEditableMetadata(policy.usingExpression);
  const checkMetadata = referencesUserEditableMetadata(policy.checkExpression);
  if (!usingMetadata && !checkMetadata) return undefined;

  const clauses = [
    usingMetadata ? "USING" : undefined,
    checkMetadata ? "WITH CHECK" : undefined,
  ].filter(Boolean).join(" and ");

  return {
    ruleId: "BND008",
    title: "RLS policy trusts user-editable authentication metadata",
    description: `Policy ${policy.name} uses user-editable metadata in its ${clauses} authorization expression.`,
    severity: "high",
    confidence: "high",
    source: "deterministic",
    location: { file: policy.file, line: policy.line },
    evidence: `${clauses}: ${policy.statement}`,
    recommendation: "Move authorization claims to server-controlled app_metadata or a tenant-membership table, then correlate the trusted value to the protected row.",
    tags: ["supabase", "rls", "jwt", "user-metadata", "authorization"],
  };
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
      const metadataFinding = userMetadataFinding(policy);
      if (metadataFinding) findings.push(metadataFinding);
    }
  }

  for (const view of inventory.views) {
    if (!exposedSchemas.has(view.schema.toLowerCase()) || isIgnored(view, config)) continue;
    const clientRoles = clientRolesWithPrivileges(view, ["select"]);
    if (!view.securityInvoker && clientRoles.length > 0) {
      const accessibleRoles = clientRoles.join(" and ");
      const evidence = relationPrivilegeEvidence(view, clientRoles, ["select"]);
      findings.push({
        ruleId: "BND007",
        title: "Exposed view may bypass underlying row-level security",
        description: `${view.key} is reachable by ${accessibleRoles} but does not enable security_invoker, so callers can use the view creator's privileges instead of their own.`,
        severity: "high",
        confidence: "high",
        source: "deterministic",
        location: { file: evidence.file, line: evidence.line },
        evidence: evidence.statement,
        recommendation: `Create or alter ${view.key} with security_invoker = true, or revoke access from PUBLIC, anon, and authenticated and move the view to an unexposed schema.`,
        tags: ["supabase", "postgres", "view", "rls", "tenant-isolation"],
      });
    }
  }

  for (const materializedView of inventory.materializedViews) {
    if (
      !exposedSchemas.has(materializedView.schema.toLowerCase()) ||
      isIgnored(materializedView, config)
    ) continue;
    const clientRoles = clientRolesWithPrivileges(materializedView, ["select"]);
    if (clientRoles.length === 0) continue;
    const evidence = relationPrivilegeEvidence(materializedView, clientRoles, ["select"]);
    findings.push({
      ruleId: "BND009",
      title: "Materialized view is exposed to API roles",
      description: `${materializedView.key} stores query results in an exposed schema and remains selectable by ${clientRoles.join(" and ")}.`,
      severity: "high",
      confidence: "high",
      source: "deterministic",
      location: { file: evidence.file, line: evidence.line },
      evidence: evidence.statement,
      recommendation: `Revoke access to ${materializedView.key} from PUBLIC, anon, and authenticated or move it to an unexposed schema, then expose only a policy-aware view or RPC.`,
      tags: ["supabase", "materialized-view", "data-api", "tenant-isolation"],
    });
  }

  for (const foreignTable of inventory.foreignTables) {
    if (!exposedSchemas.has(foreignTable.schema.toLowerCase()) || isIgnored(foreignTable, config)) {
      continue;
    }
    const dataPrivileges: RelationPrivilege[] = ["select", "insert", "update", "delete"];
    const clientRoles = clientRolesWithPrivileges(foreignTable, dataPrivileges);
    if (clientRoles.length === 0) continue;
    const evidence = relationPrivilegeEvidence(foreignTable, clientRoles, dataPrivileges);
    findings.push({
      ruleId: "BND010",
      title: "Foreign table is exposed to API roles",
      description: `${foreignTable.key} exposes an external data source through an API schema to ${clientRoles.join(" and ")}.`,
      severity: "high",
      confidence: "high",
      source: "deterministic",
      location: { file: evidence.file, line: evidence.line },
      evidence: evidence.statement,
      recommendation: `Revoke privileges on ${foreignTable.key} from PUBLIC, anon, and authenticated and move it to an unexposed schema; expose narrowly validated access through a controlled RPC when required.`,
      tags: ["supabase", "foreign-table", "data-api", "tenant-isolation"],
    });
  }

  for (const defaultPrivilege of inventory.defaultPrivileges) {
    const appliesToExposedSchema = defaultPrivilege.schema
      ? exposedSchemas.has(defaultPrivilege.schema.toLowerCase())
      : exposedSchemas.size > 0;
    if (!appliesToExposedSchema) continue;
    findings.push({
      ruleId: "BND011",
      title: "Default privileges automatically expose future objects",
      description: `${defaultPrivilege.objectType.toUpperCase()} created${defaultPrivilege.owner ? ` by ${defaultPrivilege.owner}` : " by the migration role"}${defaultPrivilege.schema ? ` in ${defaultPrivilege.schema}` : " in any schema"} inherit ${defaultPrivilege.privileges.join(", ").toUpperCase()} for ${defaultPrivilege.role}.`,
      severity: "medium",
      confidence: "high",
      source: "deterministic",
      location: { file: defaultPrivilege.file, line: defaultPrivilege.line },
      evidence: defaultPrivilege.statement,
      recommendation: `Revoke the client-facing default privileges, then grant access explicitly on reviewed ${defaultPrivilege.objectType} that belong in the API.`,
      tags: ["supabase", "default-privileges", "data-api", "least-privilege"],
    });
  }

  for (const fn of inventory.functions) {
    if (!fn.hasPinnedSearchPath) {
      findings.push({
        ruleId: "BND005",
        title: "SECURITY DEFINER function has an unpinned search path",
        description: `${fn.key}${fn.signature} executes with its owner's privileges but does not pin search_path to a trusted value.`,
        severity: "high",
        confidence: "high",
        source: "deterministic",
        location: { file: fn.file, line: fn.line },
        evidence: fn.statement,
        recommendation: "Add SET search_path = '' (and schema-qualify referenced objects) to prevent object-shadowing attacks.",
        tags: ["postgres", "security-definer", "privilege-escalation"],
      });
    }

    if (fn.executeRoles.includes("public")) {
      const evidence = fn.executePrivilegeSources.public ?? fn;
      findings.push({
        ruleId: "BND006",
        title: "SECURITY DEFINER function remains executable by PUBLIC",
        description: `PostgreSQL grants function execution to PUBLIC by default, and no explicit revoke was found for ${fn.key}${fn.signature}.`,
        severity: "high",
        confidence: "medium",
        source: "deterministic",
        location: { file: evidence.file, line: evidence.line },
        evidence: evidence.statement,
        recommendation: `Run REVOKE EXECUTE ON FUNCTION ${fn.key}${fn.signature} FROM PUBLIC, then grant execution only to the roles that need it.`,
        tags: ["postgres", "security-definer", "least-privilege"],
      });
    }

    const clientExecuteRoles = fn.executeRoles.filter(
      (role): role is "anon" | "authenticated" => role === "anon" || role === "authenticated",
    );
    if (
      exposedSchemas.has(fn.schema.toLowerCase()) &&
      !fn.executeRoles.includes("public") &&
      clientExecuteRoles.length > 0
    ) {
      const evidence = clientExecuteRoles
        .map((role) => fn.executePrivilegeSources[role])
        .find((source) => source !== undefined) ?? fn;
      findings.push({
        ruleId: "BND012",
        title: "SECURITY DEFINER function is executable by API roles",
        description: `${fn.key}${fn.signature} runs with its owner's privileges and remains executable by ${clientExecuteRoles.join(" and ")}.`,
        severity: "high",
        confidence: "medium",
        source: "deterministic",
        location: { file: evidence.file, line: evidence.line },
        evidence: evidence.statement,
        recommendation: `Revoke EXECUTE on ${fn.key}${fn.signature} from anon and authenticated, then grant it only to trusted roles or expose a narrowly validated wrapper.`,
        tags: ["supabase", "security-definer", "rpc", "least-privilege"],
      });
    }
  }

  return findings;
}
