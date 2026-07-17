import path from "node:path";
import type { BoundaryConfig } from "./config.js";
import { prepareFindings, sortFindings } from "./findings.js";
import { buildSqlInventory } from "./sql/parser.js";
import { runDeterministicRules } from "./rules.js";
import { summarizeFindings } from "./report.js";
import type { ScanReport, SqlFile } from "./types.js";

export const version = "0.1.4";

function resolveDatabaseProfile(
  target: string,
  files: SqlFile[],
  config: BoundaryConfig,
): ScanReport["databaseProfile"] {
  if (config.databaseProfile !== "auto") {
    return {
      configured: config.databaseProfile,
      effective: config.databaseProfile,
      reason: "explicit configuration",
    };
  }

  const normalizedPaths = [target, ...files.map((file) => file.path)]
    .map((value) => path.resolve(value).replaceAll("\\", "/").toLowerCase());
  if (normalizedPaths.some((value) => /(?:^|\/)supabase(?:\/|$)/.test(value))) {
    return {
      configured: "auto",
      effective: "supabase",
      reason: "Supabase directory detected",
    };
  }

  const combinedSql = files.map((file) => file.content).join("\n");
  const supabaseSignals = [
    /\bauth\s*\.\s*(?:uid|jwt)\s*\(/i,
    /\bto\s+(?:anon|authenticated|service_role)\b/i,
    /\bstorage\s*\.\s*objects\b/i,
    /request\.jwt\.(?:claims|claim)/i,
  ];
  if (supabaseSignals.some((pattern) => pattern.test(combinedSql))) {
    return {
      configured: "auto",
      effective: "supabase",
      reason: "Supabase authorization SQL detected",
    };
  }

  return {
    configured: "auto",
    effective: "postgres",
    reason: "no Supabase/PostgREST exposure signal detected",
  };
}

export function scanSqlFiles(target: string, files: SqlFile[], config: BoundaryConfig): ScanReport {
  const inventory = buildSqlInventory(files);
  const databaseProfile = resolveDatabaseProfile(target, files, config);
  const effectiveConfig: BoundaryConfig = {
    ...config,
    exposedSchemas: databaseProfile.effective === "supabase" ? config.exposedSchemas : [],
  };
  const findings = sortFindings(prepareFindings(runDeterministicRules(inventory, effectiveConfig)));

  return {
    schemaVersion: "1.0",
    tool: { name: "BoundaryCI", version },
    scannedAt: new Date().toISOString(),
    target: path.resolve(target).replaceAll("\\", "/"),
    files: files.map((file) => file.relativePath),
    summary: summarizeFindings(findings),
    findings,
    warnings: [],
    databaseProfile,
    semanticReview: {
      provider: "fireworks",
      status: config.fireworks.enabled ? "pending" : "not-requested",
      model: config.fireworks.model,
      findings: 0,
    },
  };
}
