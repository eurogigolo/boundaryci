#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Command, Option } from "commander";
import {
  addWaiver,
  applyAdoptionControls,
  createBaseline,
  resolveAdoptionPath,
  writeBaseline,
} from "./adoption.js";
import { loadConfig, writeDefaultConfig } from "./config.js";
import { discoverSqlFiles } from "./discover.js";
import { prepareFindings, sortFindings } from "./findings.js";
import { reviewWithFireworks } from "./fireworks.js";
import {
  renderGithubReport,
  renderPrettyReport,
  shouldFail,
  summarizeFindings,
  toSarif,
} from "./report.js";
import { scanSqlFiles, version } from "./scanner.js";
import type { DatabaseProfile } from "./config.js";
import type { FailThreshold } from "./types.js";

interface ScanCommandOptions {
  config?: string;
  profile?: DatabaseProfile;
  failOn?: FailThreshold;
  format: "pretty" | "json" | "sarif" | "github";
  output?: string;
  baselineFile?: string;
  waiversFile?: string;
  ignoreBaseline: boolean;
  fireworks: boolean;
  requireFireworks: boolean;
  fireworksModel?: string;
  includeAiInExitCode: boolean;
}

interface BaselineCommandOptions {
  config?: string;
  profile?: DatabaseProfile;
  output?: string;
  force: boolean;
}

interface WaiveCommandOptions {
  config?: string;
  file?: string;
  owner: string;
  reason: string;
  expires: string;
  force: boolean;
}

const program = new Command();
program
  .name("boundaryci")
  .description("Continuously prove that one SaaS tenant cannot access another tenant's data.")
  .version(version);

program
  .command("scan")
  .description("Scan Supabase SQL migrations for tenant-isolation vulnerabilities.")
  .argument("[target]", "Repository, migrations directory, or SQL file", ".")
  .option("-c, --config <path>", "Path to boundaryci.config.json")
  .addOption(
    new Option("--profile <profile>", "Database exposure profile")
      .choices(["auto", "supabase", "postgres"]),
  )
  .addOption(
    new Option("--fail-on <severity>", "Minimum deterministic severity that fails the command")
      .choices(["critical", "high", "medium", "low", "none"]),
  )
  .addOption(
    new Option("-f, --format <format>", "Output format")
      .choices(["pretty", "json", "sarif", "github"])
      .default("pretty"),
  )
  .option("-o, --output <path>", "Write the report to a file instead of stdout")
  .option("--baseline-file <path>", "Override the configured baseline file")
  .option("--waivers-file <path>", "Override the configured waivers file")
  .option("--ignore-baseline", "Treat baseline findings as new", false)
  .option("--fireworks", "Run the optional Fireworks semantic policy review", false)
  .option(
    "--require-fireworks",
    "Fail with a runtime error when the Fireworks review cannot complete",
    false,
  )
  .option("--fireworks-model <model>", "Override the configured Fireworks model")
  .option(
    "--include-ai-in-exit-code",
    "Allow Fireworks findings to fail CI (disabled by default)",
    false,
  )
  .action(async (target: string, options: ScanCommandOptions) => {
    try {
      const { config, configPath } = await loadConfig(target, options.config);
      if (options.profile) config.databaseProfile = options.profile;
      if (options.failOn) config.failOn = options.failOn;
      if (options.fireworks) config.fireworks.enabled = true;
      if (options.requireFireworks) {
        config.fireworks.enabled = true;
        config.fireworks.required = true;
      }
      if (options.fireworksModel) config.fireworks.model = options.fireworksModel;
      if (options.includeAiInExitCode) config.fireworks.includeInExitCode = true;

      const files = await discoverSqlFiles(target, config);
      if (files.length === 0) {
        throw new Error(
          "No SQL files found. Pass a migration directory or configure migrationDirectories in boundaryci.config.json.",
        );
      }

      const report = scanSqlFiles(target, files, config);
      if (config.fireworks.enabled) {
        try {
          const semanticReview = await reviewWithFireworks(files, config);
          report.findings.push(...prepareFindings(semanticReview.findings));
          sortFindings(report.findings);
          report.summary = summarizeFindings(report.findings);
          report.warnings.push(...semanticReview.warnings);
          report.semanticReview.status = "completed";
          report.semanticReview.findings = semanticReview.findings.length;
        } catch (error) {
          if (config.fireworks.required) throw error;
          const message = error instanceof Error ? error.message : String(error);
          report.semanticReview.status = "unavailable";
          report.warnings.push(`Fireworks semantic review did not run: ${message}`);
        }
      }

      const baselinePath = options.ignoreBaseline
        ? undefined
        : options.baselineFile
          ? path.resolve(options.baselineFile)
          : resolveAdoptionPath(target, configPath, config.adoption.baselineFile);
      const waiversPath = options.waiversFile
        ? path.resolve(options.waiversFile)
        : resolveAdoptionPath(target, configPath, config.adoption.waiversFile);
      await applyAdoptionControls(report, {
        ...(baselinePath ? { baselinePath } : {}),
        baselineRequired: Boolean(options.baselineFile),
        waiversPath,
        waiversRequired: Boolean(options.waiversFile),
      });

      const rendered =
        options.format === "json"
          ? `${JSON.stringify(report, null, 2)}\n`
          : options.format === "sarif"
            ? `${JSON.stringify(toSarif(report), null, 2)}\n`
            : options.format === "github"
              ? renderGithubReport(report)
              : renderPrettyReport(report);

      if (options.output) {
        await writeFile(path.resolve(options.output), rendered, "utf8");
        process.stdout.write(`BoundaryCI report written to ${path.resolve(options.output)}\n`);
      } else {
        process.stdout.write(rendered);
      }

      if (shouldFail(report, config.failOn, config.fireworks.includeInExitCode)) {
        process.exitCode = 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`BoundaryCI error: ${message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("baseline")
  .description("Accept current deterministic findings so CI fails only on new regressions.")
  .argument("[target]", "Repository, migrations directory, or SQL file", ".")
  .option("-c, --config <path>", "Path to boundaryci.config.json")
  .addOption(
    new Option("--profile <profile>", "Database exposure profile")
      .choices(["auto", "supabase", "postgres"]),
  )
  .option("-o, --output <path>", "Override the configured baseline path")
  .option("--force", "Replace an existing baseline", false)
  .action(async (target: string, options: BaselineCommandOptions) => {
    try {
      const { config, configPath } = await loadConfig(target, options.config);
      if (options.profile) config.databaseProfile = options.profile;
      config.fireworks.enabled = false;
      const files = await discoverSqlFiles(target, config);
      if (files.length === 0) {
        throw new Error(
          "No SQL files found. Pass a migration directory or configure migrationDirectories in boundaryci.config.json.",
        );
      }

      const report = scanSqlFiles(target, files, config);
      const baseline = createBaseline(report);
      const outputPath = options.output
        ? path.resolve(options.output)
        : resolveAdoptionPath(target, configPath, config.adoption.baselineFile);
      await writeBaseline(outputPath, baseline, options.force);
      process.stdout.write(
        `Created BoundaryCI baseline with ${baseline.findings.length} finding${baseline.findings.length === 1 ? "" : "s"} at ${outputPath}\n`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`BoundaryCI error: ${message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("waive")
  .description("Create an owned, expiring waiver for one finding fingerprint.")
  .argument("<fingerprint>", "24-character fingerprint printed by scan")
  .argument("[directory]", "Repository directory", ".")
  .option("-c, --config <path>", "Path to boundaryci.config.json")
  .option("--file <path>", "Override the configured waivers path")
  .requiredOption("--owner <owner>", "Person or team responsible for the waiver")
  .requiredOption("--reason <reason>", "Why the risk is temporarily accepted")
  .requiredOption("--expires <YYYY-MM-DD>", "Date when the waiver stops applying")
  .option("--force", "Replace an existing waiver for this fingerprint", false)
  .action(async (fingerprint: string, directory: string, options: WaiveCommandOptions) => {
    try {
      const { config, configPath } = await loadConfig(directory, options.config);
      const waiverPath = options.file
        ? path.resolve(options.file)
        : resolveAdoptionPath(directory, configPath, config.adoption.waiversFile);
      await addWaiver(
        waiverPath,
        {
          fingerprint,
          owner: options.owner,
          reason: options.reason,
          expiresOn: options.expires,
        },
        options.force,
      );
      process.stdout.write(`Waived ${fingerprint} until ${options.expires} in ${waiverPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`BoundaryCI error: ${message}\n`);
      process.exitCode = 2;
    }
  });

program
  .command("init")
  .description("Create a starter boundaryci.config.json file.")
  .argument("[directory]", "Repository directory", ".")
  .option("--force", "Replace an existing configuration", false)
  .action(async (directory: string, options: { force: boolean }) => {
    try {
      const configPath = await writeDefaultConfig(directory, options.force);
      process.stdout.write(`Created ${configPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`BoundaryCI error: ${message}\n`);
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);
