export type Plan = "trial" | "team" | "growth" | "enterprise";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  subscription_status: SubscriptionStatus;
  monthly_scan_limit: number;
  billing_interval: "month" | "year" | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Repository {
  id: string;
  organization_id: string;
  full_name: string;
  default_branch: string | null;
  active: boolean;
  created_at: string;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  newFindings: number;
  baseline: number;
  waived: number;
}

export interface ScanRun {
  id: string;
  organization_id: string;
  repository_id: string;
  external_id: string;
  commit_sha: string | null;
  branch: string | null;
  pull_request: number | null;
  outcome: "passed" | "failed";
  tool_version: string;
  summary: ScanSummary;
  scanned_at: string;
  received_at: string;
}

export interface ScanFinding {
  id: number;
  scan_run_id: string;
  fingerprint: string;
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: "high" | "medium" | "low";
  source: "deterministic" | "fireworks";
  disposition: "new" | "baseline" | "waived";
  file_path: string;
  line: number;
  evidence: string;
  recommendation: string;
  tags: string[];
  waiver: { owner: string; reason: string; expiresOn: string } | null;
}

export interface IngestionKeyResult {
  key_id: string;
  token: string;
  key_prefix: string;
  created_at: string;
}
