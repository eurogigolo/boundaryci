import type {
  ApiPrivilegeDefinition,
  ApiRelationDefinition,
  ApiRole,
  DefaultPrivilegeDefinition,
  FunctionDefinition,
  PolicyDefinition,
  RelationDefinition,
  RelationPrivilege,
  SqlFile,
  SqlInventory,
  SqlStatement,
  TableDefinition,
  ViewDefinition,
} from "../types.js";

const identifierPart = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const qualifiedIdentifier = String.raw`${identifierPart}(?:\s*\.\s*${identifierPart})?`;
const apiRoles = ["public", "anon", "authenticated"] as const;
const clientApiRoles = ["anon", "authenticated"] as const;
const allRelationPrivileges: RelationPrivilege[] = [
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
];
const defaultSupabaseRelationPrivileges: RelationPrivilege[] = [
  "select",
  "insert",
  "update",
  "delete",
];

interface DefaultPrivilegeChange {
  owner?: string;
  schema?: string;
  objectType: "tables" | "functions";
  action: "grant" | "revoke";
  roles: ApiRole[];
  privileges: string[];
  file: string;
  line: number;
  statement: string;
}

function stripCommentsPreservingLines(sql: string): string {
  let result = "";
  let index = 0;
  let state: "normal" | "single" | "double" | "line-comment" | "block-comment" = "normal";

  while (index < sql.length) {
    const current = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (state === "line-comment") {
      if (current === "\n") {
        result += current;
        state = "normal";
      } else {
        result += " ";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        result += "  ";
        index += 2;
        state = "normal";
      } else {
        result += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "single") {
      result += current;
      if (current === "'" && next === "'") {
        result += next;
        index += 2;
      } else {
        if (current === "'") state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "double") {
      result += current;
      if (current === '"' && next === '"') {
        result += next;
        index += 2;
      } else {
        if (current === '"') state = "normal";
        index += 1;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      result += "  ";
      index += 2;
      state = "line-comment";
    } else if (current === "/" && next === "*") {
      result += "  ";
      index += 2;
      state = "block-comment";
    } else {
      result += current;
      if (current === "'") state = "single";
      if (current === '"') state = "double";
      index += 1;
    }
  }

  return result;
}

function maskSqlLiterals(statement: string): string {
  let result = "";
  let index = 0;
  let quote: "single" | "double" | undefined;
  let dollarTag: string | undefined;

  while (index < statement.length) {
    const current = statement[index] ?? "";
    const next = statement[index + 1] ?? "";

    if (dollarTag) {
      if (statement.startsWith(dollarTag, index)) {
        result += dollarTag;
        index += dollarTag.length;
        dollarTag = undefined;
      } else {
        result += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (quote === "single") {
      if (current === "'" && next === "'") {
        result += "  ";
        index += 2;
      } else if (current === "'") {
        result += current;
        quote = undefined;
        index += 1;
      } else {
        result += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (quote === "double") {
      if (current === '"' && next === '"') {
        result += "  ";
        index += 2;
      } else if (current === '"') {
        result += current;
        quote = undefined;
        index += 1;
      } else {
        result += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    const possibleDollarTag = statement.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
    if (possibleDollarTag) {
      dollarTag = possibleDollarTag;
      result += possibleDollarTag;
      index += possibleDollarTag.length;
      continue;
    }

    result += current;
    if (current === "'") quote = "single";
    if (current === '"') quote = "double";
    index += 1;
  }

  return result;
}

export function splitSqlStatements(sql: string): SqlStatement[] {
  const cleaned = stripCommentsPreservingLines(sql);
  const statements: SqlStatement[] = [];
  let buffer = "";
  let line = 1;
  let statementStartLine = 1;
  let quote: "single" | "double" | undefined;
  let dollarTag: string | undefined;
  let index = 0;

  const pushStatement = (): void => {
    const leading = buffer.match(/^\s*/)?.[0] ?? "";
    const leadingLines = (leading.match(/\n/g) ?? []).length;
    const text = buffer.trim();
    if (text) {
      statements.push({ text, line: statementStartLine + leadingLines });
    }
    buffer = "";
    statementStartLine = line;
  };

  while (index < cleaned.length) {
    const current = cleaned[index] ?? "";
    const next = cleaned[index + 1] ?? "";

    if (current === "\n") line += 1;

    if (dollarTag) {
      if (cleaned.startsWith(dollarTag, index)) {
        buffer += dollarTag;
        index += dollarTag.length;
        dollarTag = undefined;
      } else {
        buffer += current;
        index += 1;
      }
      continue;
    }

    if (quote === "single") {
      buffer += current;
      if (current === "'" && next === "'") {
        buffer += next;
        index += 2;
      } else {
        if (current === "'") quote = undefined;
        index += 1;
      }
      continue;
    }

    if (quote === "double") {
      buffer += current;
      if (current === '"' && next === '"') {
        buffer += next;
        index += 2;
      } else {
        if (current === '"') quote = undefined;
        index += 1;
      }
      continue;
    }

    const possibleDollarTag = cleaned.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
    if (possibleDollarTag) {
      dollarTag = possibleDollarTag;
      buffer += possibleDollarTag;
      index += possibleDollarTag.length;
      continue;
    }

    if (current === "'") quote = "single";
    if (current === '"') quote = "double";

    if (current === ";") {
      pushStatement();
      index += 1;
      statementStartLine = line;
    } else {
      buffer += current;
      index += 1;
    }
  }

  pushStatement();
  return statements;
}

function unquote(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replaceAll('""', '"')
    : trimmed.toLowerCase();
}

export function parseQualifiedName(raw: string): { schema: string; name: string; key: string } {
  const parts = raw.split(".").map(unquote);
  const schema = parts.length > 1 ? (parts[0] ?? "public") : "public";
  const name = parts.length > 1 ? (parts[1] ?? "") : (parts[0] ?? "");
  return { schema, name, key: `${schema}.${name}`.toLowerCase() };
}

function extractParenthesizedClause(statement: string, clausePattern: RegExp): string | undefined {
  const match = clausePattern.exec(statement);
  if (!match || match.index === undefined) return undefined;

  let index = match.index + match[0].length;
  while (/\s/.test(statement[index] ?? "")) index += 1;
  if (statement[index] !== "(") return undefined;

  const start = index + 1;
  let depth = 1;
  let quote: "single" | "double" | undefined;
  index += 1;
  while (index < statement.length) {
    const current = statement[index] ?? "";
    const next = statement[index + 1] ?? "";
    if (quote === "single") {
      if (current === "'" && next === "'") index += 1;
      else if (current === "'") quote = undefined;
    } else if (quote === "double") {
      if (current === '"' && next === '"') index += 1;
      else if (current === '"') quote = undefined;
    } else if (current === "'") quote = "single";
    else if (current === '"') quote = "double";
    else if (current === "(") depth += 1;
    else if (current === ")") {
      depth -= 1;
      if (depth === 0) return statement.slice(start, index).trim();
    }
    index += 1;
  }
  return undefined;
}

function summarizeStatement(statement: string): string {
  const collapsed = statement.replace(/\s+/g, " ").trim();
  return collapsed.length > 360 ? `${collapsed.slice(0, 357)}...` : collapsed;
}

function updateLocation(
  definition: { file: string; line: number; statement: string },
  file: string,
  line: number,
  statement: string,
): void {
  definition.file = file;
  definition.line = line;
  definition.statement = summarizeStatement(statement);
}

function defaultRelationApiPrivileges(): ApiPrivilegeDefinition[] {
  return clientApiRoles.map((role) => ({
    role,
    privileges: [...defaultSupabaseRelationPrivileges],
  }));
}

function cloneApiPrivileges(privileges: ApiPrivilegeDefinition[]): ApiPrivilegeDefinition[] {
  return privileges.map((entry) => ({ role: entry.role, privileges: [...entry.privileges] }));
}

function normalizeApiRoles(rawRoles: string): ApiRole[] {
  const roles = rawRoles.split(",")
    .map((role) => unquote(role.trim()))
    .filter((role): role is ApiRole => apiRoles.includes(role as ApiRole));
  return [...new Set(roles)];
}

function normalizePrivileges(
  rawPrivileges: string,
  objectType: "tables" | "functions",
): string[] {
  const normalized = rawPrivileges.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "all" || normalized === "all privileges") {
    return objectType === "tables" ? [...allRelationPrivileges] : ["execute"];
  }
  const privileges = splitFunctionParameters(normalized).map((privilege) => {
    const columnPrivilege = privilege.match(/^(select|insert|update|references)\s*\([\s\S]*\)$/i);
    return (columnPrivilege?.[1] ?? privilege).trim().toLowerCase();
  });
  return objectType === "tables"
    ? privileges.filter((privilege): privilege is RelationPrivilege =>
      allRelationPrivileges.includes(privilege as RelationPrivilege)
    )
    : privileges.filter((privilege) => privilege === "execute");
}

function defaultPrivilegeAppliesToCurrentCreator(change: DefaultPrivilegeChange): boolean {
  return !change.owner || ["current_role", "current_user", "session_user"].includes(change.owner);
}

function changeApiPrivileges(
  current: ApiPrivilegeDefinition[],
  roles: ApiRole[],
  privileges: string[],
  action: "grant" | "revoke",
): ApiPrivilegeDefinition[] {
  const privilegeMap = new Map<ApiRole, Set<RelationPrivilege>>(
    current.map((entry) => [entry.role, new Set(entry.privileges)]),
  );
  for (const role of roles) {
    const rolePrivileges = privilegeMap.get(role) ?? new Set<RelationPrivilege>();
    for (const privilege of privileges) {
      if (!allRelationPrivileges.includes(privilege as RelationPrivilege)) continue;
      if (action === "grant") rolePrivileges.add(privilege as RelationPrivilege);
      else rolePrivileges.delete(privilege as RelationPrivilege);
    }
    if (rolePrivileges.size > 0) privilegeMap.set(role, rolePrivileges);
    else privilegeMap.delete(role);
  }
  return apiRoles.flatMap((role) => {
    const rolePrivileges = privilegeMap.get(role);
    if (!rolePrivileges) return [];
    return [{
      role,
      privileges: allRelationPrivileges.filter((privilege) => rolePrivileges.has(privilege)),
    }];
  });
}

function relationPrivilegesForSchema(
  schema: string,
  changes: DefaultPrivilegeChange[],
): ApiPrivilegeDefinition[] {
  let privileges = defaultRelationApiPrivileges();
  for (const change of changes) {
    if (
      change.objectType !== "tables" ||
      !defaultPrivilegeAppliesToCurrentCreator(change) ||
      (change.schema && change.schema !== schema)
    ) continue;
    privileges = changeApiPrivileges(privileges, change.roles, change.privileges, change.action);
  }
  return privileges;
}

function functionExecuteRolesForSchema(
  schema: string,
  changes: DefaultPrivilegeChange[],
): ApiRole[] {
  const roles = new Set<ApiRole>(["public"]);
  for (const change of changes) {
    if (
      change.objectType !== "functions" ||
      !defaultPrivilegeAppliesToCurrentCreator(change) ||
      (change.schema && change.schema !== schema) ||
      !change.privileges.includes("execute")
    ) continue;
    for (const role of change.roles) {
      if (change.action === "grant") roles.add(role);
      else roles.delete(role);
    }
  }
  return apiRoles.filter((role) => roles.has(role));
}

function parseDefaultPrivilegeChanges(
  statement: SqlStatement,
  file: string,
): DefaultPrivilegeChange[] {
  if (/^alter\s+default\s+privileges[\s\S]*?\s+revoke\s+grant\s+option\s+for\b/i.test(statement.text)) {
    return [];
  }
  const match = statement.text.match(
    new RegExp(
      String.raw`^alter\s+default\s+privileges([\s\S]*?)\s+(grant|revoke)\s+(?:grant\s+option\s+for\s+)?([\s\S]+?)\s+on\s+(tables|functions|routines)\s+(to|from)\s+([\s\S]+?)(?:\s+(?:with\s+grant\s+option|cascade|restrict))?$`,
      "i",
    ),
  );
  if (!match || match[1] === undefined || !match[2] || !match[3] || !match[4] || !match[5] || !match[6]) {
    return [];
  }
  const action = match[2].toLowerCase() as "grant" | "revoke";
  const direction = match[5].toLowerCase();
  if ((action === "grant" && direction !== "to") || (action === "revoke" && direction !== "from")) {
    return [];
  }

  const prefix = match[1];
  const ownerMatch = prefix.match(/\bfor\s+(?:role|user)\s+([\s\S]+?)(?=\s+in\s+schema|$)/i);
  const owners = ownerMatch?.[1]
    ? parseQualifiedNameList(ownerMatch[1]).map(unquote)
    : [undefined];
  const schemaMatch = prefix.match(/\bin\s+schema\s+([\s\S]+)$/i);
  const schemas = schemaMatch?.[1]
    ? schemaMatch[1].split(",").map((schema) => unquote(schema.trim())).filter(Boolean)
    : [undefined];
  const objectType = match[4].toLowerCase() === "tables" ? "tables" : "functions";
  const roles = normalizeApiRoles(match[6]);
  const privileges = normalizePrivileges(match[3], objectType);
  if (roles.length === 0 || privileges.length === 0) return [];

  return owners.flatMap((owner) => schemas.map((schema) => ({
    ...(owner ? { owner } : {}),
    ...(schema ? { schema } : {}),
    objectType,
    action,
    roles,
    privileges,
    file,
    line: statement.line,
    statement: summarizeStatement(statement.text),
  })));
}

function updateDefaultPrivilegeInventory(
  inventory: Map<string, DefaultPrivilegeDefinition>,
  change: DefaultPrivilegeChange,
): void {
  for (const role of change.roles) {
    const key = `${change.owner ?? "current"}|${change.schema ?? "*"}|${change.objectType}|${role}`;
    const existing = inventory.get(key);
    const privileges = new Set(existing?.privileges ?? []);
    const privilegeSources = { ...(existing?.privilegeSources ?? {}) };
    const source = { file: change.file, line: change.line, statement: change.statement };
    for (const privilege of change.privileges) {
      if (change.action === "grant") {
        if (!privileges.has(privilege)) privilegeSources[privilege] = source;
        privileges.add(privilege);
      } else {
        privileges.delete(privilege);
        delete privilegeSources[privilege];
      }
    }
    if (privileges.size === 0) {
      inventory.delete(key);
      continue;
    }
    const sortedPrivileges = [...privileges].sort();
    const evidence = privilegeSources[sortedPrivileges[0] ?? ""] ?? source;
    inventory.set(key, {
      ...(change.owner ? { owner: change.owner } : {}),
      ...(change.schema ? { schema: change.schema } : {}),
      objectType: change.objectType,
      role,
      privileges: sortedPrivileges,
      privilegeSources,
      file: evidence.file,
      line: evidence.line,
      statement: evidence.statement,
    });
  }
}

function ensureTable(
  tables: Map<string, TableDefinition>,
  rawName: string,
  file: string,
  line: number,
  statement: string,
  declared = false,
  initialApiPrivileges = defaultRelationApiPrivileges(),
): TableDefinition {
  const parsed = parseQualifiedName(rawName);
  const existing = tables.get(parsed.key);
  if (existing) {
    if (declared) existing.declared = true;
    return existing;
  }

  const table: TableDefinition = {
    ...parsed,
    kind: "table",
    declared,
    apiPrivileges: cloneApiPrivileges(initialApiPrivileges),
    apiPrivilegeSources: {},
    rlsEnabled: false,
    rlsForced: false,
    file,
    line,
    statement: summarizeStatement(statement),
    policies: [],
  };
  tables.set(parsed.key, table);
  return table;
}

function viewSecurityInvokerSetting(statement: string): boolean | undefined {
  const relevantSql = /^\s*create\b/i.test(statement)
    ? (statement.match(/^([\s\S]*?)\s+as\b/i)?.[1] ?? statement)
    : statement;
  const match = relevantSql.match(
    /\bsecurity_invoker\b(?:\s*=\s*('?)(true|false|on|off|yes|no|1|0)\1)?/i,
  );
  if (!match) return undefined;
  if (!match[2]) {
    const followingSql = relevantSql.slice((match.index ?? 0) + match[0].length);
    return /^\s*=/.test(followingSql) ? undefined : true;
  }
  return ["true", "on", "yes", "1"].includes(match[2].toLowerCase());
}

function ensureView(
  views: Map<string, ViewDefinition>,
  rawName: string,
  file: string,
  line: number,
  statement: string,
  declared = false,
  initialApiPrivileges = defaultRelationApiPrivileges(),
): ViewDefinition {
  const parsed = parseQualifiedName(rawName);
  const existing = views.get(parsed.key);
  if (existing) {
    if (declared) existing.declared = true;
    return existing;
  }

  const view: ViewDefinition = {
    ...parsed,
    kind: "view",
    declared,
    securityInvoker: false,
    apiPrivileges: cloneApiPrivileges(initialApiPrivileges),
    apiPrivilegeSources: {},
    file,
    line,
    statement: summarizeStatement(statement),
  };
  views.set(parsed.key, view);
  return view;
}

function ensureApiRelation(
  relations: Map<string, ApiRelationDefinition>,
  kind: ApiRelationDefinition["kind"],
  rawName: string,
  file: string,
  line: number,
  statement: string,
  initialApiPrivileges: ApiPrivilegeDefinition[],
): ApiRelationDefinition {
  const parsed = parseQualifiedName(rawName);
  const existing = relations.get(parsed.key);
  if (existing) return existing;
  const relation: ApiRelationDefinition = {
    ...parsed,
    kind,
    declared: true,
    apiPrivileges: cloneApiPrivileges(initialApiPrivileges),
    apiPrivilegeSources: {},
    file,
    line,
    statement: summarizeStatement(statement),
  };
  relations.set(parsed.key, relation);
  return relation;
}

function findRelation(
  key: string,
  tables: Map<string, TableDefinition>,
  views: Map<string, ViewDefinition>,
  materializedViews: Map<string, ApiRelationDefinition>,
  foreignTables: Map<string, ApiRelationDefinition>,
): RelationDefinition | undefined {
  return tables.get(key) ?? views.get(key) ?? materializedViews.get(key) ?? foreignTables.get(key);
}

function parseQualifiedNameList(rawNames: string): string[] {
  const exactIdentifier = new RegExp(String.raw`^${qualifiedIdentifier}$`, "i");
  return splitFunctionParameters(rawNames)
    .map((name) => name.trim())
    .filter((name) => exactIdentifier.test(name));
}

function parseDropRelationNameList(rawNames: string): string[] {
  return parseQualifiedNameList(
    splitFunctionParameters(rawNames)
      .map((name) => name.replace(/^only\s+/i, "").replace(/\s*\*\s*$/, "").trim())
      .join(","),
  );
}

function changeRelationAccess(
  relation: RelationDefinition,
  roles: ApiRole[],
  privileges: string[],
  action: "grant" | "revoke",
  source: { file: string; line: number; statement: string },
): void {
  const beforeByGrantRole = new Map<ApiRole, Set<RelationPrivilege>>(
    roles.map((role) => [
      role,
      new Set(relation.apiPrivileges.find((entry) => entry.role === role)?.privileges ?? []),
    ]),
  );
  relation.apiPrivileges = changeApiPrivileges(relation.apiPrivileges, roles, privileges, action);
  for (const role of roles) {
    const roleSources = relation.apiPrivilegeSources[role] ?? {};
    for (const privilege of privileges) {
      if (!allRelationPrivileges.includes(privilege as RelationPrivilege)) continue;
      if (action === "grant" && !beforeByGrantRole.get(role)?.has(privilege as RelationPrivilege)) {
        roleSources[privilege as RelationPrivilege] = source;
      }
      if (action === "revoke") delete roleSources[privilege as RelationPrivilege];
    }
    if (Object.keys(roleSources).length > 0) relation.apiPrivilegeSources[role] = roleSources;
    else delete relation.apiPrivilegeSources[role];
  }
}

function updateRelationClientAccess(
  tables: Map<string, TableDefinition>,
  views: Map<string, ViewDefinition>,
  materializedViews: Map<string, ApiRelationDefinition>,
  foreignTables: Map<string, ApiRelationDefinition>,
  statement: SqlStatement,
  file: string,
): void {
  const schemaAccessChange = statement.text.match(
    new RegExp(
      String.raw`^(grant|revoke)\s+([\s\S]+?)\s+on\s+all\s+tables\s+in\s+schema\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+?)(?:\s+(?:with\s+grant\s+option|cascade|restrict))?$`,
      "i",
    ),
  );
  const accessChange = statement.text.match(
    new RegExp(
      String.raw`^(grant|revoke)\s+([\s\S]+?)\s+on\s+(?:table\s+)?([\s\S]+?)\s+(to|from)\s+([\s\S]+?)(?:\s+(?:with\s+grant\s+option|cascade|restrict))?$`,
      "i",
    ),
  );
  const matched = schemaAccessChange ?? accessChange;
  if (!matched?.[1] || !matched[2] || !matched[3] || !matched[4] || !matched[5]) {
    return;
  }

  const action = matched[1].toLowerCase() as "grant" | "revoke";
  const direction = matched[4].toLowerCase();
  if ((action === "grant" && direction !== "to") || (action === "revoke" && direction !== "from")) {
    return;
  }
  const roles = normalizeApiRoles(matched[5]);
  const privileges = normalizePrivileges(matched[2], "tables");
  if (roles.length === 0 || privileges.length === 0) return;
  const source = { file, line: statement.line, statement: summarizeStatement(statement.text) };

  if (schemaAccessChange) {
    const schemas = new Set(parseQualifiedNameList(schemaAccessChange[3] ?? "").map(unquote));
    for (const relation of [
      ...tables.values(),
      ...views.values(),
      ...materializedViews.values(),
      ...foreignTables.values(),
    ]) {
      if (schemas.has(relation.schema)) {
        changeRelationAccess(relation, roles, privileges, action, source);
      }
    }
    return;
  }

  for (const rawName of parseQualifiedNameList(accessChange?.[3] ?? "")) {
    const relation = findRelation(
      parseQualifiedName(rawName).key,
      tables,
      views,
      materializedViews,
      foreignTables,
    );
    if (relation) changeRelationAccess(relation, roles, privileges, action, source);
  }
}

function parsePolicy(statement: SqlStatement, file: string): PolicyDefinition | undefined {
  const match = statement.text.match(
    new RegExp(String.raw`^create\s+policy\s+(${identifierPart})\s+on\s+(${qualifiedIdentifier})`, "i"),
  );
  if (!match?.[1] || !match[2]) return undefined;

  const table = parseQualifiedName(match[2]);
  const commandMatch = statement.text.match(/\bfor\s+(all|select|insert|update|delete)\b/i);
  const rolesMatch = statement.text.match(/\bto\s+([\s\S]*?)(?=\busing\b|\bwith\s+check\b|$)/i);
  const roles = rolesMatch?.[1]
    ? rolesMatch[1].split(",").map((role) => unquote(role.trim())).filter(Boolean)
    : ["public"];

  const usingExpression = extractParenthesizedClause(statement.text, /\busing\s*/i);
  const checkExpression = extractParenthesizedClause(statement.text, /\bwith\s+check\s*/i);

  return {
    name: unquote(match[1]),
    tableKey: table.key,
    command: (commandMatch?.[1]?.toLowerCase() ?? "all") as PolicyDefinition["command"],
    roles,
    ...(usingExpression ? { usingExpression } : {}),
    ...(checkExpression ? { checkExpression } : {}),
    file,
    line: statement.line,
    statement: summarizeStatement(statement.text),
  };
}

function splitFunctionParameters(parameters: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "single" | "double" | undefined;
  for (let index = 0; index < parameters.length; index += 1) {
    const current = parameters[index] ?? "";
    const next = parameters[index + 1] ?? "";
    if (quote === "single") {
      if (current === "'" && next === "'") index += 1;
      else if (current === "'") quote = undefined;
      continue;
    }
    if (quote === "double") {
      if (current === '"' && next === '"') index += 1;
      else if (current === '"') quote = undefined;
      continue;
    }
    if (current === "'") quote = "single";
    else if (current === '"') quote = "double";
    else if (current === "(") depth += 1;
    else if (current === ")") depth = Math.max(0, depth - 1);
    else if (current === "," && depth === 0) {
      parts.push(parameters.slice(start, index).trim());
      start = index + 1;
    }
  }
  const finalPart = parameters.slice(start).trim();
  if (finalPart) parts.push(finalPart);
  return parts;
}

function normalizeFunctionSignature(parameters: string, declaration: boolean): string {
  const types: string[] = [];
  for (const rawParameter of splitFunctionParameters(parameters)) {
    const withoutDefault = rawParameter.replace(/\s+(?:default\s+|=\s*)[\s\S]*$/i, "").trim();
    const modeMatch = withoutDefault.match(/^(inout|in|out|variadic)\s+([\s\S]+)$/i);
    const mode = modeMatch?.[1]?.toLowerCase();
    if (mode === "out") continue;
    let typeExpression = modeMatch?.[2] ?? withoutDefault;
    if (declaration) {
      const tokens = typeExpression.trim().split(/\s+/);
      const candidate = tokens.join(" ").toLowerCase();
      const beginsWithMultiwordType = /^(?:double\s+precision|character\s+varying|char\s+varying|bit\s+varying|national\s+(?:character|char)|interval\b|time(?:stamp)?(?:\([^)]*\))?\s+(?:with|without)\s+time\s+zone)\b/.test(candidate);
      const firstTokenLooksParameterized = tokens[0]?.includes("(") === true;
      if (tokens.length > 1 && !beginsWithMultiwordType && !firstTokenLooksParameterized) {
        typeExpression = tokens.slice(1).join(" ");
      }
    }
    const normalized = typeExpression
      .trim()
      .replace(/\s*\.\s*/g, ".")
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (normalized) types.push(normalized);
  }
  return `(${types.join(",")})`;
}

function parseFunction(statement: SqlStatement, file: string): FunctionDefinition | undefined {
  const prefix = new RegExp(
    String.raw`^create\s+(?:or\s+replace\s+)?function\s+(${qualifiedIdentifier})\s*`,
    "i",
  );
  const match = statement.text.match(prefix);
  if (!match?.[1]) return undefined;
  const parsed = parseQualifiedName(match[1]);
  const parameters = extractParenthesizedClause(statement.text, prefix);
  if (parameters === undefined) return undefined;
  const signature = normalizeFunctionSignature(parameters, true);
  const functionOptions = maskSqlLiterals(statement.text);
  const securityDefiner = /\bsecurity\s+definer\b/i.test(functionOptions);

  return {
    ...parsed,
    signature,
    identityKey: `${parsed.key}${signature}`,
    securityDefiner,
    hasPinnedSearchPath: /\bset\s+(?:local\s+)?search_path\s*(?:=|to)\s*(?:''|pg_catalog\b)/i.test(
      functionOptions,
    ),
    executeRoles: ["public"],
    executePrivilegeSources: {},
    file,
    line: statement.line,
    statement: summarizeStatement(statement.text),
  };
}

function updateFunctionExecuteAccess(
  functions: Map<string, FunctionDefinition>,
  functionExecuteRoles: Map<string, ApiRole[]>,
  functionExecutePrivilegeSources: Map<
    string,
    Partial<Record<ApiRole, { file: string; line: number; statement: string }>>
  >,
  statement: SqlStatement,
  file: string,
): void {
  const schemaChange = statement.text.match(
    new RegExp(
      String.raw`^(grant|revoke)\s+(?:execute|all(?:\s+privileges)?)\s+on\s+all\s+(?:functions|routines)\s+in\s+schema\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+?)(?:\s+(?:with\s+grant\s+option|cascade|restrict))?$`,
      "i",
    ),
  );
  const functionChange = statement.text.match(
    new RegExp(
      String.raw`^(grant|revoke)\s+(?:execute|all(?:\s+privileges)?)\s+on\s+(?:function|routine)\s+([\s\S]+?)\s+(to|from)\s+([\s\S]+?)(?:\s+(?:with\s+grant\s+option|cascade|restrict))?$`,
      "i",
    ),
  );
  if (!schemaChange && !functionChange) return;
  const actionText = schemaChange?.[1] ?? functionChange?.[1];
  const directionText = schemaChange?.[3] ?? functionChange?.[3];
  const rolesText = schemaChange?.[4] ?? functionChange?.[4];
  if (!actionText || !directionText || !rolesText) return;
  const action = actionText.toLowerCase() as "grant" | "revoke";
  const direction = directionText.toLowerCase();
  if ((action === "grant" && direction !== "to") || (action === "revoke" && direction !== "from")) {
    return;
  }
  const roles = normalizeApiRoles(rolesText);
  if (roles.length === 0) return;
  const keys: string[] = [];
  if (schemaChange?.[2]) {
    const schemas = new Set(parseQualifiedNameList(schemaChange[2]).map(unquote));
    keys.push(
      ...[...functionExecuteRoles.keys()].filter((candidate) =>
        [...schemas].some((schema) => candidate.startsWith(`${schema}.`))
      ),
    );
  } else if (functionChange?.[2]) {
    const exactFunction = new RegExp(
      String.raw`^(${qualifiedIdentifier})\s*(\([\s\S]*\))?$`,
      "i",
    );
    for (const target of splitFunctionParameters(functionChange[2])) {
      const targetMatch = target.match(exactFunction);
      if (!targetMatch?.[1]) continue;
      const nameKey = parseQualifiedName(targetMatch[1]).key;
      if (targetMatch[2]) {
        keys.push(
          `${nameKey}${normalizeFunctionSignature(targetMatch[2].slice(1, -1), false)}`,
        );
      } else {
        keys.push(
          ...[...functionExecuteRoles.keys()].filter((candidate) =>
            candidate.startsWith(`${nameKey}(`)
          ),
        );
      }
    }
  }
  const source = { file, line: statement.line, statement: summarizeStatement(statement.text) };

  for (const candidate of new Set(keys)) {
    const currentRoles = new Set<ApiRole>(functionExecuteRoles.get(candidate) ?? ["public"]);
    const previousRoles = new Set(currentRoles);
    for (const role of roles) {
      if (action === "grant") currentRoles.add(role);
      else currentRoles.delete(role);
    }
    const nextRoles = apiRoles.filter((role) => currentRoles.has(role));
    functionExecuteRoles.set(candidate, nextRoles);
    const privilegeSources = functionExecutePrivilegeSources.get(candidate) ?? {};
    for (const role of roles) {
      if (action === "grant" && !previousRoles.has(role)) privilegeSources[role] = source;
      if (action === "revoke") delete privilegeSources[role];
    }
    functionExecutePrivilegeSources.set(candidate, privilegeSources);
    const fn = functions.get(candidate);
    if (!fn) continue;
    fn.executeRoles = [...nextRoles];
    fn.executePrivilegeSources = { ...privilegeSources };
  }
}

export function buildSqlInventory(files: SqlFile[]): SqlInventory {
  const tables = new Map<string, TableDefinition>();
  const views = new Map<string, ViewDefinition>();
  const materializedViews = new Map<string, ApiRelationDefinition>();
  const foreignTables = new Map<string, ApiRelationDefinition>();
  const functions = new Map<string, FunctionDefinition>();
  const functionExecuteRoles = new Map<string, ApiRole[]>();
  const functionExecutePrivilegeSources = new Map<
    string,
    Partial<Record<ApiRole, { file: string; line: number; statement: string }>>
  >();
  const defaultPrivilegeChanges: DefaultPrivilegeChange[] = [];
  const defaultPrivileges = new Map<string, DefaultPrivilegeDefinition>();

  for (const file of files) {
    const statements = splitSqlStatements(file.content);
    for (const statement of statements) {
      const parsedDefaultPrivilegeChanges = parseDefaultPrivilegeChanges(statement, file.relativePath);
      for (const change of parsedDefaultPrivilegeChanges) {
        defaultPrivilegeChanges.push(change);
        updateDefaultPrivilegeInventory(defaultPrivileges, change);
      }

      const createTable = statement.text.match(
        new RegExp(
          String.raw`^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (createTable?.[1]) {
        const parsed = parseQualifiedName(createTable[1]);
        ensureTable(
          tables,
          createTable[1],
          file.relativePath,
          statement.line,
          statement.text,
          true,
          relationPrivilegesForSchema(parsed.schema, defaultPrivilegeChanges),
        );
      }

      const dropTable = statement.text.match(
        new RegExp(
          String.raw`^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`,
          "i",
        ),
      );
      if (dropTable?.[1]) {
        for (const rawName of parseDropRelationNameList(dropTable[1])) {
          tables.delete(parseQualifiedName(rawName).key);
        }
      }

      const createMaterializedView = statement.text.match(
        new RegExp(
          String.raw`^create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (createMaterializedView?.[1]) {
        const parsed = parseQualifiedName(createMaterializedView[1]);
        ensureApiRelation(
          materializedViews,
          "materialized-view",
          createMaterializedView[1],
          file.relativePath,
          statement.line,
          statement.text,
          relationPrivilegesForSchema(parsed.schema, defaultPrivilegeChanges),
        );
      }

      const dropMaterializedView = statement.text.match(
        new RegExp(
          String.raw`^drop\s+materialized\s+view\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`,
          "i",
        ),
      );
      if (dropMaterializedView?.[1]) {
        for (const rawName of parseDropRelationNameList(dropMaterializedView[1])) {
          materializedViews.delete(parseQualifiedName(rawName).key);
        }
      }

      const createForeignTable = statement.text.match(
        new RegExp(
          String.raw`^create\s+foreign\s+table\s+(?:if\s+not\s+exists\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (createForeignTable?.[1]) {
        const parsed = parseQualifiedName(createForeignTable[1]);
        ensureApiRelation(
          foreignTables,
          "foreign-table",
          createForeignTable[1],
          file.relativePath,
          statement.line,
          statement.text,
          relationPrivilegesForSchema(parsed.schema, defaultPrivilegeChanges),
        );
      }

      const dropForeignTable = statement.text.match(
        new RegExp(
          String.raw`^drop\s+foreign\s+table\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`,
          "i",
        ),
      );
      if (dropForeignTable?.[1]) {
        for (const rawName of parseDropRelationNameList(dropForeignTable[1])) {
          foreignTables.delete(parseQualifiedName(rawName).key);
        }
      }

      const createView = statement.text.match(
        new RegExp(
          String.raw`^create\s+(or\s+replace\s+)?(temp(?:orary)?\s+)?(?:recursive\s+)?view\s+(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (createView?.[3] && !createView[2]) {
        const parsed = parseQualifiedName(createView[3]);
        const existing = views.get(parsed.key);
        const securityInvoker = viewSecurityInvokerSetting(statement.text);
        if (existing && createView[1]) {
          existing.declared = true;
          if (securityInvoker !== undefined) existing.securityInvoker = securityInvoker;
          existing.file = file.relativePath;
          existing.line = statement.line;
          existing.statement = summarizeStatement(statement.text);
        } else {
          const view = ensureView(
            views,
            createView[3],
            file.relativePath,
            statement.line,
            statement.text,
            true,
            relationPrivilegesForSchema(parsed.schema, defaultPrivilegeChanges),
          );
          view.securityInvoker = securityInvoker ?? false;
        }
      }

      const alterView = statement.text.match(
        new RegExp(
          String.raw`^alter\s+view\s+(?:if\s+exists\s+)?(${qualifiedIdentifier})\s+(set|reset)\s*\(`,
          "i",
        ),
      );
      if (alterView?.[1] && alterView[2] && /\bsecurity_invoker\b/i.test(statement.text)) {
        const view = ensureView(
          views,
          alterView[1],
          file.relativePath,
          statement.line,
          statement.text,
        );
        const action = alterView[2].toLowerCase();
        view.securityInvoker = action === "set"
          ? (viewSecurityInvokerSetting(statement.text) ?? false)
          : false;
        view.file = file.relativePath;
        view.line = statement.line;
        view.statement = summarizeStatement(statement.text);
      }

      const dropView = statement.text.match(
        new RegExp(
          String.raw`^drop\s+view\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`,
          "i",
        ),
      );
      if (dropView?.[1]) {
        for (const rawName of parseDropRelationNameList(dropView[1])) {
          views.delete(parseQualifiedName(rawName).key);
        }
      }

      updateRelationClientAccess(
        tables,
        views,
        materializedViews,
        foreignTables,
        statement,
        file.relativePath,
      );

      const rlsChange = statement.text.match(
        new RegExp(
          String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${qualifiedIdentifier})\s+(enable|disable|force|no\s+force)\s+row\s+level\s+security`,
          "i",
        ),
      );
      if (rlsChange?.[1] && rlsChange[2]) {
        const table = ensureTable(
          tables,
          rlsChange[1],
          file.relativePath,
          statement.line,
          statement.text,
        );
        const action = rlsChange[2].toLowerCase().replace(/\s+/g, " ");
        if (action === "enable") {
          table.rlsEnabled = true;
          updateLocation(table, file.relativePath, statement.line, statement.text);
        }
        if (action === "disable") {
          table.rlsEnabled = false;
          updateLocation(table, file.relativePath, statement.line, statement.text);
        }
        if (action === "force") table.rlsForced = true;
        if (action === "no force") table.rlsForced = false;
      }

      const policy = parsePolicy(statement, file.relativePath);
      if (policy) {
        const table = ensureTable(
          tables,
          policy.tableKey,
          file.relativePath,
          statement.line,
          statement.text,
        );
        table.policies.push(policy);
      }

      const dropPolicy = statement.text.match(
        new RegExp(
          String.raw`^drop\s+policy\s+(?:if\s+exists\s+)?(${identifierPart})\s+on\s+(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (dropPolicy?.[1] && dropPolicy[2]) {
        const table = tables.get(parseQualifiedName(dropPolicy[2]).key);
        const policyName = unquote(dropPolicy[1]);
        if (table) {
          const previousCount = table.policies.length;
          table.policies = table.policies.filter((item) => item.name !== policyName);
          if (table.rlsEnabled && previousCount > 0 && table.policies.length === 0) {
            updateLocation(table, file.relativePath, statement.line, statement.text);
          }
        }
      }

      const alterPolicy = statement.text.match(
        new RegExp(String.raw`^alter\s+policy\s+(${identifierPart})\s+on\s+(${qualifiedIdentifier})`, "i"),
      );
      if (alterPolicy?.[1] && alterPolicy[2]) {
        const table = tables.get(parseQualifiedName(alterPolicy[2]).key);
        const existing = table?.policies.find((item) => item.name === unquote(alterPolicy[1] ?? ""));
        if (existing) {
          const rolesMatch = statement.text.match(/\bto\s+([\s\S]*?)(?=\busing\b|\bwith\s+check\b|$)/i);
          const usingExpression = extractParenthesizedClause(statement.text, /\busing\s*/i);
          const checkExpression = extractParenthesizedClause(statement.text, /\bwith\s+check\s*/i);
          if (rolesMatch?.[1]) {
            existing.roles = rolesMatch[1].split(",").map((role) => unquote(role.trim())).filter(Boolean);
          }
          if (usingExpression) existing.usingExpression = usingExpression;
          if (checkExpression) existing.checkExpression = checkExpression;
          existing.file = file.relativePath;
          existing.line = statement.line;
          existing.statement = summarizeStatement(statement.text);
        }
      }

      const fn = parseFunction(statement, file.relativePath);
      if (fn) {
        const existing = functions.get(fn.identityKey);
        const executeRoles = functionExecuteRoles.get(fn.identityKey)
          ?? functionExecuteRolesForSchema(fn.schema, defaultPrivilegeChanges);
        functionExecuteRoles.set(fn.identityKey, executeRoles);
        fn.executeRoles = [...executeRoles];
        const executePrivilegeSources = functionExecutePrivilegeSources.get(fn.identityKey)
          ?? existing?.executePrivilegeSources
          ?? {};
        functionExecutePrivilegeSources.set(fn.identityKey, executePrivilegeSources);
        fn.executePrivilegeSources = { ...executePrivilegeSources };
        if (fn.securityDefiner) {
          functions.set(fn.identityKey, fn);
        } else {
          functions.delete(fn.identityKey);
        }
      }

      const dropFunction = statement.text.match(
        new RegExp(
          String.raw`^drop\s+(?:function|routine)\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$`,
          "i",
        ),
      );
      if (dropFunction?.[1]) {
        const exactFunction = new RegExp(
          String.raw`^(${qualifiedIdentifier})\s*(\([\s\S]*\))?$`,
          "i",
        );
        for (const target of splitFunctionParameters(dropFunction[1])) {
          const targetMatch = target.match(exactFunction);
          if (!targetMatch?.[1]) continue;
          const nameKey = parseQualifiedName(targetMatch[1]).key;
          const identityKey = targetMatch[2]
            ? `${nameKey}${normalizeFunctionSignature(targetMatch[2].slice(1, -1), false)}`
            : undefined;
          const matchingKeys = identityKey
            ? [identityKey]
            : [...functionExecuteRoles.keys()].filter((key) => key.startsWith(`${nameKey}(`));
          for (const key of matchingKeys) {
            functions.delete(key);
            functionExecuteRoles.delete(key);
            functionExecutePrivilegeSources.delete(key);
          }
        }
      }

      updateFunctionExecuteAccess(
        functions,
        functionExecuteRoles,
        functionExecutePrivilegeSources,
        statement,
        file.relativePath,
      );
    }
  }

  const viewList = [...views.values()];
  const materializedViewList = [...materializedViews.values()];
  const foreignTableList = [...foreignTables.values()];
  return {
    tables,
    views: viewList,
    materializedViews: materializedViewList,
    foreignTables: foreignTableList,
    relations: [...tables.values(), ...viewList, ...materializedViewList, ...foreignTableList],
    functions: [...functions.values()],
    defaultPrivileges: [...defaultPrivileges.values()],
  };
}
