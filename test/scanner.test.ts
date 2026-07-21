import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { discoverSqlFiles } from "../src/discover.js";
import { shouldFail, toSarif } from "../src/report.js";
import { scanSqlFiles } from "../src/scanner.js";

function config() {
  return structuredClone(defaultConfig);
}

describe("BoundaryCI scanner", () => {
  it("falls back to other migrations when a configured directory is empty", async () => {
    const target = path.resolve("test/fixtures/discovery/fallback");
    const files = await discoverSqlFiles(target, config());

    expect(files.map((file) => file.relativePath)).toEqual(["drizzle/001_init.sql"]);
  });

  it("finds the baseline tenant-isolation hazards", async () => {
    const target = path.resolve("test/fixtures/vulnerable");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());
    const ruleIds = report.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual([
      "BND001",
      "BND007",
      "BND003",
      "BND008",
      "BND004",
      "BND002",
      "BND005",
      "BND006",
      "BND009",
      "BND010",
      "BND011",
      "BND012",
    ]);
    expect(report.summary).toMatchObject({ critical: 1, high: 9, medium: 2, deterministic: 12 });
    expect(report.databaseProfile.effective).toBe("supabase");
    expect(shouldFail(report, "high", false)).toBe(true);
  });

  it("does not treat a server-side PostgreSQL public schema as a Supabase API", () => {
    const files = [
      {
        path: "C:/server-app/drizzle/001.sql",
        relativePath: "drizzle/001.sql",
        content: `
          create table public.users (id uuid primary key);
          create view public.user_list as select id from public.users;
        `,
      },
    ];
    const report = scanSqlFiles("C:/server-app", files, config());

    expect(report.databaseProfile).toMatchObject({
      configured: "auto",
      effective: "postgres",
    });
    expect(report.findings).toEqual([]);
  });

  it("allows Supabase exposure checks to be forced", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/server-app/drizzle/001.sql",
        relativePath: "drizzle/001.sql",
        content: "create table public.users (id uuid primary key);",
      },
    ];
    const report = scanSqlFiles("C:/server-app", files, forcedConfig);

    expect(report.databaseProfile).toMatchObject({
      configured: "supabase",
      effective: "supabase",
    });
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["BND001"]);
  });

  it("keeps the secure fixture clean", async () => {
    const target = path.resolve("test/fixtures/secure");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());

    expect(report.findings).toEqual([]);
    expect(report.semanticReview.status).toBe("not-requested");
    expect(shouldFail(report, "low", false)).toBe(false);
  });

  it("distinguishes trusted app metadata from user-editable metadata", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          create table public.projects (id uuid, tenant_id uuid);
          alter table public.projects enable row level security;
          create policy trusted_claim on public.projects to authenticated
            using ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id);
          create policy trusted_service on public.projects to service_role
            using ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id);
        `,
      },
    ];
    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings).toEqual([]);
  });

  it("finds direct raw user metadata authorization in client policies", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          create table public.projects (id uuid, tenant_id uuid);
          alter table public.projects enable row level security;
          create policy editable_claim on public.projects to authenticated using (exists (
            select 1 from auth.users
            where auth.users.id = auth.uid()
              and (auth.users.raw_user_meta_data ->> 'tenant_id')::uuid = projects.tenant_id
          ));
        `,
      },
    ];
    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["BND008"]);
  });

  it("does not report an unsafe view after access is revoked from API roles", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          create view public.project_export as select 1 as id;
          revoke all on table public.project_export from anon, authenticated;
        `,
      },
    ];

    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings).toEqual([]);
  });

  it("uses the final policy state after unsafe metadata is altered or dropped", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          create table public.projects (id uuid, tenant_id uuid);
          alter table public.projects enable row level security;
          create policy repaired on public.projects to authenticated
            using ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id);
          create policy removed on public.projects to authenticated
            using ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id);
        `,
      },
      {
        path: "C:/supabase/migrations/002.sql",
        relativePath: "supabase/migrations/002.sql",
        content: `
          alter policy repaired on public.projects using (auth.uid() = id);
          drop policy removed on public.projects;
        `,
      },
    ];

    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings).toEqual([]);
  });

  it("attributes materialized-view and foreign-table exposure to later grants", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          alter default privileges in schema public
            revoke all on tables from anon, authenticated;
          create materialized view public.rollup as select 1 as id;
          create foreign table public.remote_rows (id uuid) server remote_db;
        `,
      },
      {
        path: "C:/supabase/migrations/002.sql",
        relativePath: "supabase/migrations/002.sql",
        content: "grant select on table public.rollup to anon;",
      },
      {
        path: "C:/supabase/migrations/003.sql",
        relativePath: "supabase/migrations/003.sql",
        content: "grant update on table public.remote_rows to authenticated;",
      },
    ];

    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["BND009", "BND010"]);
    expect(report.findings[0]?.location).toEqual({ file: "supabase/migrations/002.sql", line: 1 });
    expect(report.findings[1]?.location).toEqual({ file: "supabase/migrations/003.sql", line: 1 });
  });

  it("uses final default and function execution privileges", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          alter default privileges in schema public grant select on tables to authenticated;
          alter default privileges in schema public revoke select on tables from authenticated;
          create function public.client_rpc() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.client_rpc() from public;
          grant execute on function public.client_rpc() to authenticated;
        `,
      },
    ];

    const exposed = scanSqlFiles("C:/supabase", files, forcedConfig);
    expect(exposed.findings.map((finding) => finding.ruleId)).toEqual(["BND012"]);
    expect(exposed.findings[0]?.evidence).toContain("grant execute");

    files.push({
      path: "C:/supabase/migrations/002.sql",
      relativePath: "supabase/migrations/002.sql",
      content: "revoke execute on function public.client_rpc() from authenticated;",
    });
    const revoked = scanSqlFiles("C:/supabase", files, forcedConfig);
    expect(revoked.findings).toEqual([]);
  });

  it("does not duplicate direct client execution while PUBLIC execution remains", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const report = scanSqlFiles("C:/supabase", [{
      path: "C:/supabase/migrations/001.sql",
      relativePath: "supabase/migrations/001.sql",
      content: `
        create function public.client_rpc() returns uuid language sql security definer
          set search_path = '' as $$ select null::uuid; $$;
        grant execute on function public.client_rpc() to authenticated;
      `,
    }], forcedConfig);

    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["BND006"]);
  });

  it("does not treat a privileged function in an unexposed schema as a client RPC", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const report = scanSqlFiles("C:/supabase", [{
      path: "C:/supabase/migrations/001.sql",
      relativePath: "supabase/migrations/001.sql",
      content: `
        create function private.client_rpc() returns uuid language sql security definer
          set search_path = '' as $$ select null::uuid; $$;
        revoke execute on function private.client_rpc() from public;
        grant execute on function private.client_rpc() to authenticated;
      `,
    }], forcedConfig);

    expect(report.findings).toEqual([]);
  });

  it("points final-state regressions at the migration that caused them", () => {
    const forcedConfig = config();
    forcedConfig.databaseProfile = "supabase";
    const files = [
      {
        path: "C:/supabase/migrations/001.sql",
        relativePath: "supabase/migrations/001.sql",
        content: `
          create table public.disabled_notes (id uuid);
          alter table public.disabled_notes enable row level security;
          create policy scoped_disabled on public.disabled_notes to authenticated using (auth.uid() = id);

          create table public.empty_notes (id uuid);
          alter table public.empty_notes enable row level security;
          create policy scoped_empty on public.empty_notes to authenticated using (auth.uid() = id);

          create function public.lookup_note() returns uuid language sql security definer
            set search_path = '' as $$ select null::uuid; $$;
          revoke execute on function public.lookup_note() from public;
        `,
      },
      {
        path: "C:/supabase/migrations/002.sql",
        relativePath: "supabase/migrations/002.sql",
        content: "alter table public.disabled_notes disable row level security;",
      },
      {
        path: "C:/supabase/migrations/003.sql",
        relativePath: "supabase/migrations/003.sql",
        content: "drop policy scoped_empty on public.empty_notes;",
      },
      {
        path: "C:/supabase/migrations/004.sql",
        relativePath: "supabase/migrations/004.sql",
        content: "grant execute on function public.lookup_note() to public;",
      },
    ];

    const report = scanSqlFiles("C:/supabase", files, forcedConfig);

    expect(report.findings.find((finding) => finding.ruleId === "BND001")?.location)
      .toEqual({ file: "supabase/migrations/002.sql", line: 1 });
    expect(report.findings.find((finding) => finding.ruleId === "BND002")?.location)
      .toEqual({ file: "supabase/migrations/003.sql", line: 1 });
    expect(report.findings.find((finding) => finding.ruleId === "BND006")?.location)
      .toEqual({ file: "supabase/migrations/004.sql", line: 1 });
  });

  it("produces SARIF for code scanning", async () => {
    const target = path.resolve("test/fixtures/vulnerable");
    const files = await discoverSqlFiles(target, config());
    const report = scanSqlFiles(target, files, config());
    const sarif = toSarif(report) as { version: string; runs: Array<{ results: unknown[] }> };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0]?.results).toHaveLength(12);
  });
});
