import type {
  FunctionDefinition,
  PolicyDefinition,
  SqlFile,
  SqlInventory,
  SqlStatement,
  TableDefinition,
} from "../types.js";

const identifierPart = String.raw`(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const qualifiedIdentifier = String.raw`${identifierPart}(?:\s*\.\s*${identifierPart})?`;

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

function ensureTable(
  tables: Map<string, TableDefinition>,
  rawName: string,
  file: string,
  line: number,
  statement: string,
  declared = false,
): TableDefinition {
  const parsed = parseQualifiedName(rawName);
  const existing = tables.get(parsed.key);
  if (existing) {
    if (declared) existing.declared = true;
    return existing;
  }

  const table: TableDefinition = {
    ...parsed,
    declared,
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

function parseFunction(statement: SqlStatement, file: string): FunctionDefinition | undefined {
  const match = statement.text.match(
    new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?function\s+(${qualifiedIdentifier})\s*\(`, "i"),
  );
  if (!match?.[1]) return undefined;
  const parsed = parseQualifiedName(match[1]);
  const securityDefiner = /\bsecurity\s+definer\b/i.test(statement.text);
  if (!securityDefiner) return undefined;

  return {
    ...parsed,
    securityDefiner,
    hasPinnedSearchPath: /\bset\s+(?:local\s+)?search_path\s*(?:=|to)\s*(?:''|pg_catalog\b)/i.test(
      statement.text,
    ),
    publicExecuteRevoked: false,
    file,
    line: statement.line,
    statement: summarizeStatement(statement.text),
  };
}

export function buildSqlInventory(files: SqlFile[]): SqlInventory {
  const tables = new Map<string, TableDefinition>();
  const functions = new Map<string, FunctionDefinition>();
  const functionPublicExecute = new Map<string, boolean>();

  for (const file of files) {
    const statements = splitSqlStatements(file.content);
    for (const statement of statements) {
      const createTable = statement.text.match(
        new RegExp(
          String.raw`^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (createTable?.[1]) {
        ensureTable(tables, createTable[1], file.relativePath, statement.line, statement.text, true);
      }

      const dropTable = statement.text.match(
        new RegExp(
          String.raw`^drop\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (dropTable?.[1]) tables.delete(parseQualifiedName(dropTable[1]).key);

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
        if (action === "enable") table.rlsEnabled = true;
        if (action === "disable") table.rlsEnabled = false;
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
        if (table) table.policies = table.policies.filter((item) => item.name !== policyName);
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
        fn.publicExecuteRevoked = functionPublicExecute.get(fn.key) ?? false;
        functions.set(fn.key, fn);
      }

      const dropFunction = statement.text.match(
        new RegExp(
          String.raw`^drop\s+function\s+(?:if\s+exists\s+)?(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (dropFunction?.[1]) {
        const key = parseQualifiedName(dropFunction[1]).key;
        functions.delete(key);
        functionPublicExecute.delete(key);
      }

      const revoke = statement.text.match(
        new RegExp(
          String.raw`^revoke\s+(?:execute|all(?:\s+privileges)?)\s+on\s+function\s+(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (revoke?.[1] && /\bfrom\s+public\b/i.test(statement.text)) {
        const key = parseQualifiedName(revoke[1]).key;
        functionPublicExecute.set(key, true);
        const existing = functions.get(key);
        if (existing) existing.publicExecuteRevoked = true;
      }

      const grant = statement.text.match(
        new RegExp(
          String.raw`^grant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+function\s+(${qualifiedIdentifier})`,
          "i",
        ),
      );
      if (grant?.[1] && /\bto\s+public\b/i.test(statement.text)) {
        const key = parseQualifiedName(grant[1]).key;
        functionPublicExecute.set(key, false);
        const existing = functions.get(key);
        if (existing) existing.publicExecuteRevoked = false;
      }

      const revokeSchemaFunctions = statement.text.match(
        new RegExp(
          String.raw`^revoke\s+(?:execute|all(?:\s+privileges)?)\s+on\s+all\s+functions\s+in\s+schema\s+(${identifierPart})`,
          "i",
        ),
      );
      if (revokeSchemaFunctions?.[1] && /\bfrom\s+public\b/i.test(statement.text)) {
        const schema = unquote(revokeSchemaFunctions[1]);
        for (const existing of functions.values()) {
          if (existing.schema === schema) {
            functionPublicExecute.set(existing.key, true);
            existing.publicExecuteRevoked = true;
          }
        }
      }

      const grantSchemaFunctions = statement.text.match(
        new RegExp(
          String.raw`^grant\s+(?:execute|all(?:\s+privileges)?)\s+on\s+all\s+functions\s+in\s+schema\s+(${identifierPart})`,
          "i",
        ),
      );
      if (grantSchemaFunctions?.[1] && /\bto\s+public\b/i.test(statement.text)) {
        const schema = unquote(grantSchemaFunctions[1]);
        for (const existing of functions.values()) {
          if (existing.schema === schema) {
            functionPublicExecute.set(existing.key, false);
            existing.publicExecuteRevoked = false;
          }
        }
      }
    }
  }

  return { tables, functions: [...functions.values()] };
}
