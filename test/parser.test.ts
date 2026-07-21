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

  it("tracks RLS, policies, view security, and function hardening", () => {
    const inventory = buildSqlInventory([
      {
        path: "migration.sql",
        relativePath: "migration.sql",
        content: `
          create table public.notes (id uuid);
          alter table public.notes enable row level security;
          create policy scoped on public.notes to authenticated using (auth.uid() = id);
          create view public.note_list with (security_invoker)
            as select id from public.notes;
          create view public.unsafe_note_list
            as(select id, security_invoker = true from public.notes);
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
    expect(inventory.views[0]).toMatchObject({
      key: "public.note_list",
      declared: true,
      securityInvoker: true,
    });
    expect(inventory.views[1]).toMatchObject({
      key: "public.unsafe_note_list",
      securityInvoker: false,
      apiPrivileges: [
        { role: "anon", privileges: ["select", "insert", "update", "delete"] },
        { role: "authenticated", privileges: ["select", "insert", "update", "delete"] },
      ],
    });
    expect(inventory.functions[0]).toMatchObject({
      key: "public.lookup",
      hasPinnedSearchPath: true,
      executeRoles: [],
    });
  });

  it("uses the final state after drops, policy changes, view changes, and grants", () => {
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

          create view public.old_notes as select id from public.notes;
          drop view public.old_notes;
          create view public.note_list as select id from public.notes;
          alter view public.note_list set (security_invoker = true);

          create temporary view scratch_notes as select id from public.notes;

          create function public.lookup() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.lookup() from public;
          grant execute on function public.lookup() to public;
        `,
      },
    ]);

    expect(inventory.tables.has("public.old_table")).toBe(false);
    expect(inventory.tables.get("public.notes")?.policies[0]?.usingExpression).toBe("auth.uid() = id");
    expect(inventory.views).toEqual([
      expect.objectContaining({ key: "public.note_list", securityInvoker: true }),
    ]);
    expect(inventory.functions[0]?.executeRoles).toEqual(["public"]);
  });

  it("ignores security-definer text inside function bodies and clears replaced definer state", () => {
    const inventory = buildSqlInventory([
      {
        path: "migration.sql",
        relativePath: "migration.sql",
        content: `
          create function public.body_text() returns text language sql
            as $$ select 'security definer'::text; $$;

          create function public.lookup() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          create or replace function public.lookup() returns uuid language sql security invoker
            as $$ select null::uuid; $$;
        `,
      },
    ]);

    expect(inventory.functions).toEqual([]);
  });

  it("tracks explicit API-role revokes and later grants on views", () => {
    const revoked = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: "create view public.note_list as select 1 as id;",
      },
      {
        path: "002.sql",
        relativePath: "002.sql",
        content: "revoke all privileges on table public.note_list from anon, authenticated;",
      },
    ]);
    expect(revoked.views[0]).toMatchObject({
      apiPrivileges: [],
      file: "001.sql",
      line: 1,
    });

    const regranted = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: "create view public.note_list as select 1 as id;",
      },
      {
        path: "002.sql",
        relativePath: "002.sql",
        content: "revoke all on public.note_list from anon, authenticated;",
      },
      {
        path: "003.sql",
        relativePath: "003.sql",
        content: "grant select on public.note_list to authenticated;",
      },
    ]);
    expect(regranted.views[0]).toMatchObject({
      apiPrivileges: [{ role: "authenticated", privileges: ["select"] }],
      apiPrivilegeSources: {
        authenticated: {
          select: { file: "003.sql", line: 1 },
        },
      },
      file: "001.sql",
      line: 1,
    });
  });

  it("preserves and changes view security through replacement and reset transitions", () => {
    const inventory = buildSqlInventory([
      {
        path: "migration.sql",
        relativePath: "migration.sql",
        content: `
          create view public.preserved with (security_invoker = true) as select 1 as id;
          create or replace view public.preserved as select 2 as id;

          create view public.changed with (security_invoker = true) as select 1 as id;
          create or replace view public.changed with (security_invoker = false) as select 2 as id;

          create view public.reset_view as select 1 as id;
          alter view public.reset_view set (security_invoker = true);
          alter view public.reset_view reset (security_invoker);
        `,
      },
    ]);

    expect(inventory.views.find((view) => view.key === "public.preserved")?.securityInvoker)
      .toBe(true);
    expect(inventory.views.find((view) => view.key === "public.changed")?.securityInvoker)
      .toBe(false);
    expect(inventory.views.find((view) => view.key === "public.reset_view")?.securityInvoker)
      .toBe(false);
  });

  it("tracks materialized views, foreign tables, and ordered relation privileges", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          alter default privileges in schema public
            revoke all on tables from anon, authenticated;
          create materialized view public.private_rollup as select 1 as id;
          create foreign table public.private_remote (id uuid) server app_remote;

          alter default privileges in schema public
            grant select on tables to authenticated;
          create materialized view public.client_rollup as select 1 as id;
          create foreign table public.client_remote (id uuid) server app_remote;
          revoke select on table public.client_rollup from authenticated;
          drop foreign table public.private_remote;
        `,
      },
    ]);

    expect(inventory.materializedViews).toEqual([
      expect.objectContaining({ key: "public.private_rollup", apiPrivileges: [] }),
      expect.objectContaining({ key: "public.client_rollup", apiPrivileges: [] }),
    ]);
    expect(inventory.foreignTables).toEqual([
      expect.objectContaining({
        key: "public.client_remote",
        apiPrivileges: [{ role: "authenticated", privileges: ["select"] }],
      }),
    ]);
    expect(inventory.relations.map((relation) => relation.kind)).toEqual([
      "materialized-view",
      "materialized-view",
      "foreign-table",
    ]);
    expect(inventory.defaultPrivileges).toEqual([
      expect.objectContaining({
        schema: "public",
        objectType: "tables",
        role: "authenticated",
        privileges: ["select"],
      }),
    ]);
  });

  it("handles schema-wide, multi-relation, and column-level privilege changes", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          create materialized view public.first_rollup as select 1 as id;
          create materialized view public.second_rollup as select 2 as id;
          create foreign table private.remote_rows (id uuid) server app_remote;
          revoke all on all tables in schema public, private from anon, authenticated;
          grant select (id) on table public.first_rollup, private.remote_rows to authenticated;
        `,
      },
    ]);

    expect(inventory.materializedViews).toEqual([
      expect.objectContaining({
        key: "public.first_rollup",
        apiPrivileges: [{ role: "authenticated", privileges: ["select"] }],
      }),
      expect.objectContaining({ key: "public.second_rollup", apiPrivileges: [] }),
    ]);
    expect(inventory.foreignTables).toEqual([
      expect.objectContaining({
        key: "private.remote_rows",
        apiPrivileges: [{ role: "authenticated", privileges: ["select"] }],
      }),
    ]);
  });

  it("does not apply another owner's default privileges to current-role objects", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          alter default privileges for role reporting_owner in schema public
            revoke all on tables from anon, authenticated;
          create materialized view public.current_role_rollup as select 1 as id;
        `,
      },
    ]);

    expect(inventory.materializedViews[0]?.apiPrivileges).toEqual([
      { role: "anon", privileges: ["select", "insert", "update", "delete"] },
      { role: "authenticated", privileges: ["select", "insert", "update", "delete"] },
    ]);
  });

  it("keeps exact default-grant provenance after a partial revoke", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: "alter default privileges in schema public grant select on tables to authenticated;",
      },
      {
        path: "002.sql",
        relativePath: "002.sql",
        content: "alter default privileges in schema public grant insert on tables to authenticated;",
      },
      {
        path: "003.sql",
        relativePath: "003.sql",
        content: `
          alter default privileges in schema public
            revoke grant option for insert on tables from authenticated;
          alter default privileges in schema public revoke select on tables from authenticated;
        `,
      },
    ]);

    expect(inventory.defaultPrivileges).toEqual([
      expect.objectContaining({
        privileges: ["insert"],
        file: "002.sql",
        line: 1,
        privilegeSources: {
          insert: expect.objectContaining({ file: "002.sql", line: 1 }),
        },
      }),
    ]);
  });

  it("tracks default and direct API execution privileges on privileged functions", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          alter default privileges in schema public revoke execute on functions from public;
          alter default privileges in schema public grant execute on functions to authenticated;
          create function public.client_rpc() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.client_rpc() from authenticated;
          grant execute on function public.client_rpc() to anon;
        `,
      },
    ]);

    expect(inventory.functions[0]).toMatchObject({
      key: "public.client_rpc",
      executeRoles: ["anon"],
      executePrivilegeSources: {
        anon: { file: "001.sql" },
      },
    });
    expect(inventory.defaultPrivileges).toEqual([
      expect.objectContaining({
        schema: "public",
        objectType: "functions",
        role: "authenticated",
        privileges: ["execute"],
      }),
    ]);
  });

  it("keeps overloaded function identities and execution grants separate", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          create function public.lookup(target uuid) returns uuid language sql security definer
            set search_path = '' as $$ select target; $$;
          create function public.lookup(target text) returns text language sql security definer
            set search_path = '' as $$ select target; $$;
          revoke execute on function public.lookup(uuid) from public;
          grant execute on function public.lookup(uuid) to authenticated;
          revoke execute on function public.lookup(text) from public;
        `,
      },
    ]);

    expect(inventory.functions).toEqual([
      expect.objectContaining({
        identityKey: "public.lookup(uuid)",
        signature: "(uuid)",
        executeRoles: ["authenticated"],
      }),
      expect.objectContaining({
        identityKey: "public.lookup(text)",
        signature: "(text)",
        executeRoles: [],
      }),
    ]);
  });

  it("tracks multi-function grants and preserves provenance through replacement", () => {
    const inventory = buildSqlInventory([
      {
        path: "001.sql",
        relativePath: "001.sql",
        content: `
          create function public.first_rpc(target uuid) returns uuid language sql
            as $$ select target; $$;
          create function public.second_rpc(target text) returns text language sql security definer
            set search_path = '' as $$ select target; $$;
          revoke execute on all functions in schema public from public;
        `,
      },
      {
        path: "002.sql",
        relativePath: "002.sql",
        content: `
          grant execute on function public.first_rpc(uuid), public.second_rpc(text)
            to authenticated;
        `,
      },
      {
        path: "003.sql",
        relativePath: "003.sql",
        content: `
          create or replace function public.first_rpc(target uuid) returns uuid language sql
            security definer set search_path = '' as $$ select target; $$;
        `,
      },
    ]);

    expect(inventory.functions).toEqual([
      expect.objectContaining({
        identityKey: "public.second_rpc(text)",
        executeRoles: ["authenticated"],
        executePrivilegeSources: {
          authenticated: expect.objectContaining({ file: "002.sql" }),
        },
      }),
      expect.objectContaining({
        identityKey: "public.first_rpc(uuid)",
        executeRoles: ["authenticated"],
        executePrivilegeSources: {
          authenticated: expect.objectContaining({ file: "002.sql" }),
        },
      }),
    ]);
  });
});
