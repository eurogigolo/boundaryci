import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { BoundaryConfig } from "./config.js";
import type { SqlFile } from "./types.js";

const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".next"]);

async function collectSqlFiles(directory: string, output: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".supabase") {
      continue;
    }
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSqlFiles(absolute, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".sql")) {
      output.push(absolute);
    }
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function discoverSqlFiles(target: string, config: BoundaryConfig): Promise<SqlFile[]> {
  const absoluteTarget = path.resolve(target);
  const targetStat = await stat(absoluteTarget);
  const discovered: string[] = [];
  let relativeRoot = absoluteTarget;

  if (targetStat.isFile()) {
    if (!absoluteTarget.toLowerCase().endsWith(".sql")) {
      throw new Error(`Expected a .sql file, received ${absoluteTarget}`);
    }
    discovered.push(absoluteTarget);
    relativeRoot = path.dirname(absoluteTarget);
  } else {
    const configuredDirectories = config.migrationDirectories.map((directory) =>
      path.resolve(absoluteTarget, directory),
    );
    const existingDirectories: string[] = [];
    for (const directory of configuredDirectories) {
      if (await pathExists(directory)) {
        existingDirectories.push(directory);
      }
    }

    if (existingDirectories.length > 0) {
      for (const directory of existingDirectories) {
        await collectSqlFiles(directory, discovered);
      }
      if (discovered.length === 0) {
        await collectSqlFiles(absoluteTarget, discovered);
      }
    } else {
      await collectSqlFiles(absoluteTarget, discovered);
    }
  }

  const uniqueFiles = [...new Set(discovered)].sort((left, right) => left.localeCompare(right));
  return Promise.all(
    uniqueFiles.map(async (filePath) => ({
      path: filePath,
      relativePath: path.relative(relativeRoot, filePath).replaceAll("\\", "/"),
      content: await readFile(filePath, "utf8"),
    })),
  );
}
