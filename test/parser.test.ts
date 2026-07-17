import { describe, expect, it } from "vitest";
import { buildSqlInventory, splitSqlStatements } from "../src/sql/parser.js";

describe("SQL parser", () => {
  it("does not split function bodies at semicolons", () => {
    const sql = `
      create function public.example()
      returns text language plpgsql security definer as $$
      begin
        return 'semi;colon';
      end;
      $$;
      revoke execute on function public.example() from public;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]?.text).toContain("return 'semi;colon';");
  });

  it("tracks RLS, policies, and function hardening", () => {
    const inventory = buildSqlInventory([
      {
        path: "migration.sql",
        relativePath: "migration.sql",
        content: `
          create table public.notes (id uuid);
          alter table public.notes enable row level security;
          create policy scoped on public.notes to authenticated using (auth.uid() = id);
          create function public.lookup() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.lookup() from public;
        `,
      },
    ]);

    expect(inventory.tables.get("public.notes")).toMatchObject({
      declared: true,
      rlsEnabled: true,
    });
    expect(inventory.tables.get("public.notes")?.policies).toHaveLength(1);
    expect(inventory.functions[0]).toMatchObject({
      key: "public.lookup",
      hasPinnedSearchPath: true,
      publicExecuteRevoked: true,
    });
  });

  it("uses the final state after drops, policy changes, and grants", () => {
    const inventory = buildSqlInventory([
      {
        path: "migration.sql",
        relativePath: "migration.sql",
        content: `
          create table public.old_table (id uuid);
          drop table public.old_table;

          create table public.notes (id uuid);
          alter table public.notes enable row level security;
          create policy temporary on public.notes to authenticated using (true);
          alter policy temporary on public.notes using (auth.uid() = id);

          create function public.lookup() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.lookup() from public;
          grant execute on function public.lookup() to public;
        `,
      },
    ]);

    expect(inventory.tables.has("public.old_table")).toBe(false);
    expect(inventory.tables.get("public.notes")?.policies[0]?.usingExpression).toBe("auth.uid() = id");
    expect(inventory.functions[0]?.publicExecuteRevoked).toBe(false);
  });
});
