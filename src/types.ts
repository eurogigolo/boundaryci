export const severities = ["critical", "high", "medium", "low", "info"] as const;

export type Severity = (typeof severities)[number];
export type FailThreshold = Exclude<Severity, "info"> | "none";
export type FindingSource = "deterministic" | "fireworks";
export type FindingDisposition = "new" | "baseline" | "waived";

export interface FindingLocation {
  file: string;
  line: number;
}

export interface Finding {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: "high" | "medium" | "low";
  source: FindingSource;
  location: FindingLocation;
  evidence: string;
  recommendation: string;
  tags: string[];
}

export interface FindingWaiver {
  owner: string;
  reason: string;
  expiresOn: string;
}

export interface ReportFinding extends Finding {
  fingerprint: string;
  disposition: FindingDisposition;
  waiver: FindingWaiver | null;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  deterministic: number;
  fireworks: number;
  newFindings: number;
  baseline: number;
  waived: number;
}

export interface ScanReport {
  schemaVersion: "1.0";
  tool: {
    name: "BoundaryCI";
    version: string;
  };
  scannedAt: string;
  target: string;
  files: string[];
  summary: ScanSummary;
  findings: ReportFinding[];
  warnings: string[];
  databaseProfile: {
    configured: "auto" | "supabase" | "postgres";
    effective: "supabase" | "postgres";
    reason: string;
  };
  semanticReview: {
    provider: "fireworks";
    status: "not-requested" | "pending" | "completed" | "unavailable";
    model: string;
    findings: number;
  };
}

export interface SqlFile {
  path: string;
  relativePath: string;
  content: string;
}

export interface SqlStatement {
  text: string;
  line: number;
}

export interface PolicyDefinition {
  name: string;
  tableKey: string;
  command: "all" | "select" | "insert" | "update" | "delete";
  roles: string[];
  usingExpression?: string;
  checkExpression?: string;
  file: string;
  line: number;
  statement: string;
}

export interface TableDefinition {
  key: string;
  schema: string;
  name: string;
  declared: boolean;
  rlsEnabled: boolean;
  rlsForced: boolean;
  file: string;
  line: number;
  statement: string;
  policies: PolicyDefinition[];
}

export interface FunctionDefinition {
  key: string;
  schema: string;
  name: string;
  securityDefiner: boolean;
  hasPinnedSearchPath: boolean;
  publicExecuteRevoked: boolean;
  file: string;
  line: number;
  statement: string;
}

export interface SqlInventory {
  tables: Map<string, TableDefinition>;
  functions: FunctionDefinition[];
}
