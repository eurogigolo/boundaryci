import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FailThreshold } from "./types.js";

export type DatabaseProfile = "auto" | "supabase" | "postgres";

export interface BoundaryConfig {
  databaseProfile: DatabaseProfile;
  migrationDirectories: string[];
  exposedSchemas: string[];
  ignoreTables: string[];
  failOn: FailThreshold;
  adoption: {
    baselineFile: string;
    waiversFile: string;
  };
  fireworks: {
    enabled: boolean;
    required: boolean;
    model: string;
    includeInExitCode: boolean;
    maxInputCharacters: number;
  };
}

export const defaultConfig: BoundaryConfig = {
  databaseProfile: "auto",
  migrationDirectories: ["supabase/migrations"],
  exposedSchemas: ["public"],
  ignoreTables: ["public.schema_migrations", "public.spatial_ref_sys"],
  failOn: "high",
  adoption: {
    baselineFile: ".boundaryci/baseline.json",
    waiversFile: ".boundaryci/waivers.json",
  },
  fireworks: {
    enabled: false,
    required: false,
    model: "accounts/fireworks/models/deepseek-v4-flash",
    includeInExitCode: false,
    maxInputCharacters: 80_000,
  },
};

type PartialBoundaryConfig = Partial<Omit<BoundaryConfig, "adoption" | "fireworks">> & {
  adoption?: Partial<BoundaryConfig["adoption"]>;
  fireworks?: Partial<BoundaryConfig["fireworks"]>;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${field} must be an array of non-empty strings.`);
  }
}

function validateConfig(config: BoundaryConfig): void {
  if (!["auto", "supabase", "postgres"].includes(config.databaseProfile)) {
    throw new Error("databaseProfile must be auto, supabase, or postgres.");
  }
  validateStringArray(config.migrationDirectories, "migrationDirectories");
  validateStringArray(config.exposedSchemas, "exposedSchemas");
  validateStringArray(config.ignoreTables, "ignoreTables");
  if (!["critical", "high", "medium", "low", "none"].includes(config.failOn)) {
    throw new Error("failOn must be critical, high, medium, low, or none.");
  }
  if (typeof config.adoption.baselineFile !== "string" || !config.adoption.baselineFile.trim()) {
    throw new Error("adoption.baselineFile must be a non-empty path.");
  }
  if (typeof config.adoption.waiversFile !== "string" || !config.adoption.waiversFile.trim()) {
    throw new Error("adoption.waiversFile must be a non-empty path.");
  }
  if (typeof config.fireworks.enabled !== "boolean") {
    throw new Error("fireworks.enabled must be a boolean.");
  }
  if (typeof config.fireworks.required !== "boolean") {
    throw new Error("fireworks.required must be a boolean.");
  }
  if (typeof config.fireworks.includeInExitCode !== "boolean") {
    throw new Error("fireworks.includeInExitCode must be a boolean.");
  }
  if (typeof config.fireworks.model !== "string" || config.fireworks.model.trim() === "") {
    throw new Error("fireworks.model must be a non-empty model identifier.");
  }
  if (
    !Number.isInteger(config.fireworks.maxInputCharacters) ||
    config.fireworks.maxInputCharacters < 1_000 ||
    config.fireworks.maxInputCharacters > 1_000_000
  ) {
    throw new Error("fireworks.maxInputCharacters must be an integer from 1,000 to 1,000,000.");
  }
}

export async function loadConfig(
  target: string,
  explicitConfigPath?: string,
): Promise<{ config: BoundaryConfig; configPath?: string }> {
  const targetDirectory = path.extname(target) ? path.dirname(target) : target;
  const candidate = explicitConfigPath
    ? path.resolve(explicitConfigPath)
    : path.join(path.resolve(targetDirectory), "boundaryci.config.json");

  if (!(await exists(candidate))) {
    if (explicitConfigPath) {
      throw new Error(`Configuration file not found at ${candidate}.`);
    }
    return { config: structuredClone(defaultConfig) };
  }

  const raw = await readFile(candidate, "utf8");
  let parsed: PartialBoundaryConfig;
  try {
    parsed = JSON.parse(raw) as PartialBoundaryConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${candidate}: ${message}`);
  }
  const config: BoundaryConfig = {
    ...structuredClone(defaultConfig),
    ...parsed,
    adoption: {
      ...defaultConfig.adoption,
      ...parsed.adoption,
    },
    fireworks: {
      ...defaultConfig.fireworks,
      ...parsed.fireworks,
    },
  };
  validateConfig(config);
  return {
    config,
    configPath: candidate,
  };
}

export async function writeDefaultConfig(directory: string, force = false): Promise<string> {
  const configPath = path.join(path.resolve(directory), "boundaryci.config.json");
  if (!force && (await exists(configPath))) {
    throw new Error(`Configuration already exists at ${configPath}. Use --force to replace it.`);
  }

  await writeFile(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf8");
  return configPath;
}
