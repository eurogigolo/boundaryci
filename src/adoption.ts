import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeFindings } from "./report.js";
import type { FindingWaiver, ScanReport } from "./types.js";

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  source: "deterministic" | "fireworks";
  file: string;
  title: string;
}

export interface BaselineFile {
  schemaVersion: "1.0";
  createdAt: string;
  findings: BaselineEntry[];
}

export interface WaiverEntry extends FindingWaiver {
  fingerprint: string;
  createdAt: string;
}

export interface WaiversFile {
  schemaVersion: "1.0";
  waivers: WaiverEntry[];
}

interface AdoptionOptions {
  baselinePath?: string;
  baselineRequired?: boolean;
  waiversPath?: string;
  waiversRequired?: boolean;
  now?: Date;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }
}

export function validateBaseline(payload: unknown, filePath = "baseline file"): BaselineFile {
  if (!payload || typeof payload !== "object") throw new Error(`${filePath} must contain an object.`);
  const candidate = payload as { schemaVersion?: unknown; createdAt?: unknown; findings?: unknown };
  if (candidate.schemaVersion !== "1.0" || !Array.isArray(candidate.findings)) {
    throw new Error(`${filePath} must use baseline schemaVersion 1.0 and contain findings.`);
  }

  const findings = candidate.findings.map((raw, index): BaselineEntry => {
    if (!raw || typeof raw !== "object") throw new Error(`${filePath} finding ${index + 1} is invalid.`);
    const entry = raw as Record<string, unknown>;
    if (
      !isFingerprint(entry.fingerprint) ||
      typeof entry.ruleId !== "string" ||
      !["deterministic", "fireworks"].includes(String(entry.source)) ||
      typeof entry.file !== "string" ||
      typeof entry.title !== "string"
    ) {
      throw new Error(`${filePath} finding ${index + 1} is invalid.`);
    }
    return {
      fingerprint: entry.fingerprint,
      ruleId: entry.ruleId,
      source: entry.source as BaselineEntry["source"],
      file: entry.file,
      title: entry.title,
    };
  });

  return {
    schemaVersion: "1.0",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "unknown",
    findings,
  };
}

export function validateWaivers(payload: unknown, filePath = "waivers file"): WaiversFile {
  if (!payload || typeof payload !== "object") throw new Error(`${filePath} must contain an object.`);
  const candidate = payload as { schemaVersion?: unknown; waivers?: unknown };
  if (candidate.schemaVersion !== "1.0" || !Array.isArray(candidate.waivers)) {
    throw new Error(`${filePath} must use waiver schemaVersion 1.0 and contain waivers.`);
  }

  const seen = new Set<string>();
  const waivers = candidate.waivers.map((raw, index): WaiverEntry => {
    if (!raw || typeof raw !== "object") throw new Error(`${filePath} waiver ${index + 1} is invalid.`);
    const entry = raw as Record<string, unknown>;
    if (
      !isFingerprint(entry.fingerprint) ||
      typeof entry.owner !== "string" ||
      entry.owner.trim() === "" ||
      typeof entry.reason !== "string" ||
      entry.reason.trim().length < 10 ||
      !isDateOnly(entry.expiresOn) ||
      typeof entry.createdAt !== "string"
    ) {
      throw new Error(
        `${filePath} waiver ${index + 1} requires a valid fingerprint, owner, reason (10+ characters), expiresOn (YYYY-MM-DD), and createdAt.`,
      );
    }
    if (seen.has(entry.fingerprint)) {
      throw new Error(`${filePath} contains duplicate waiver ${entry.fingerprint}.`);
    }
    seen.add(entry.fingerprint);
    return {
      fingerprint: entry.fingerprint,
      owner: entry.owner.trim(),
      reason: entry.reason.trim(),
      expiresOn: entry.expiresOn,
      createdAt: entry.createdAt,
    };
  });

  return { schemaVersion: "1.0", waivers };
}

export function createBaseline(report: ScanReport, now = new Date()): BaselineFile {
  return {
    schemaVersion: "1.0",
    createdAt: now.toISOString(),
    findings: report.findings.map((finding) => ({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      source: finding.source,
      file: finding.location.file,
      title: finding.title,
    })),
  };
}

export function applyAdoptionDocuments(
  report: ScanReport,
  baseline: BaselineFile | undefined,
  waivers: WaiversFile | undefined,
  now = new Date(),
): void {
  const baselineFingerprints = new Set(baseline?.findings.map((entry) => entry.fingerprint) ?? []);
  const today = now.toISOString().slice(0, 10);
  const activeWaivers = new Map<string, WaiverEntry>();
  const expiredWaivers = new Map<string, WaiverEntry>();

  for (const waiver of waivers?.waivers ?? []) {
    if (waiver.expiresOn < today) expiredWaivers.set(waiver.fingerprint, waiver);
    else activeWaivers.set(waiver.fingerprint, waiver);
  }

  for (const finding of report.findings) {
    const waiver = activeWaivers.get(finding.fingerprint);
    if (waiver) {
      finding.disposition = "waived";
      finding.waiver = {
        owner: waiver.owner,
        reason: waiver.reason,
        expiresOn: waiver.expiresOn,
      };
    } else if (baselineFingerprints.has(finding.fingerprint)) {
      finding.disposition = "baseline";
      finding.waiver = null;
    } else {
      finding.disposition = "new";
      finding.waiver = null;
    }

    const expired = expiredWaivers.get(finding.fingerprint);
    if (expired) {
      report.warnings.push(
        `Waiver ${finding.fingerprint} owned by ${expired.owner} expired on ${expired.expiresOn}; the finding is new again.`,
      );
    }
  }

  report.summary = summarizeFindings(report.findings);
}

export async function applyAdoptionControls(
  report: ScanReport,
  options: AdoptionOptions,
): Promise<void> {
  let baseline: BaselineFile | undefined;
  let waivers: WaiversFile | undefined;

  if (options.baselinePath && (await exists(options.baselinePath))) {
    baseline = validateBaseline(await readJson(options.baselinePath), options.baselinePath);
  } else if (options.baselinePath && options.baselineRequired) {
    throw new Error(`Baseline file not found at ${options.baselinePath}.`);
  }

  if (options.waiversPath && (await exists(options.waiversPath))) {
    waivers = validateWaivers(await readJson(options.waiversPath), options.waiversPath);
  } else if (options.waiversPath && options.waiversRequired) {
    throw new Error(`Waivers file not found at ${options.waiversPath}.`);
  }

  applyAdoptionDocuments(report, baseline, waivers, options.now);
}

export function resolveAdoptionPath(
  target: string,
  configPath: string | undefined,
  configuredPath: string,
): string {
  if (path.isAbsolute(configuredPath)) return configuredPath;
  const targetDirectory = path.extname(target) ? path.dirname(path.resolve(target)) : path.resolve(target);
  const baseDirectory = configPath ? path.dirname(configPath) : targetDirectory;
  return path.resolve(baseDirectory, configuredPath);
}

export async function writeBaseline(
  filePath: string,
  baseline: BaselineFile,
  force = false,
): Promise<void> {
  if (!force && (await exists(filePath))) {
    throw new Error(`Baseline already exists at ${filePath}. Use --force to replace it.`);
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

export async function addWaiver(
  filePath: string,
  input: Omit<WaiverEntry, "createdAt">,
  force = false,
  now = new Date(),
): Promise<void> {
  if (!isFingerprint(input.fingerprint)) {
    throw new Error("Finding fingerprint must contain 24 lowercase hexadecimal characters.");
  }
  if (!input.owner.trim()) throw new Error("Waiver owner is required.");
  if (input.reason.trim().length < 10) throw new Error("Waiver reason must contain at least 10 characters.");
  if (!isDateOnly(input.expiresOn)) throw new Error("Waiver expiry must use YYYY-MM-DD.");
  const today = now.toISOString().slice(0, 10);
  if (input.expiresOn < today) throw new Error("Waiver expiry cannot be in the past.");

  let document: WaiversFile = { schemaVersion: "1.0", waivers: [] };
  if (await exists(filePath)) document = validateWaivers(await readJson(filePath), filePath);
  const existingIndex = document.waivers.findIndex((entry) => entry.fingerprint === input.fingerprint);
  if (existingIndex >= 0 && !force) {
    throw new Error(`Waiver ${input.fingerprint} already exists. Use --force to replace it.`);
  }

  const entry: WaiverEntry = {
    fingerprint: input.fingerprint,
    owner: input.owner.trim(),
    reason: input.reason.trim(),
    expiresOn: input.expiresOn,
    createdAt: now.toISOString(),
  };
  if (existingIndex >= 0) document.waivers[existingIndex] = entry;
  else document.waivers.push(entry);
  document.waivers.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}
