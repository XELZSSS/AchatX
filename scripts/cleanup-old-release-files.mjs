/* global console */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const releaseDir = path.join(repoRoot, 'release');

const STALE_RELEASE_PATTERNS = [
  /^Orlinx Setup (?<version>.+)\.exe$/,
  /^Orlinx Setup (?<version>.+)\.exe\.blockmap$/,
  /^Orlinx\.(?<version>.+)\.portable\.exe$/,
];

const VERSION_LIKE_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export const collectStaleReleaseFiles = (entryNames, currentVersion) =>
  entryNames.filter((entryName) =>
    STALE_RELEASE_PATTERNS.some((pattern) => {
      const match = pattern.exec(entryName);
      return Boolean(
        match?.groups?.version &&
        VERSION_LIKE_PATTERN.test(match.groups.version) &&
        match.groups.version !== currentVersion
      );
    })
  );

const readCurrentVersion = async () => {
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  return JSON.parse(raw).version;
};

const listReleaseEntries = async () => {
  try {
    const entries = await fs.readdir(releaseDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const removeFiles = async (fileNames) => {
  await Promise.all(
    fileNames.map((fileName) => fs.rm(path.join(releaseDir, fileName), { force: true }))
  );
};

const main = async () => {
  const currentVersion = await readCurrentVersion();
  const releaseEntries = await listReleaseEntries();
  const staleFiles = collectStaleReleaseFiles(releaseEntries, currentVersion);

  if (staleFiles.length === 0) {
    console.log(`[cleanup-release] No stale installer artifacts found for v${currentVersion}`);
    return;
  }

  await removeFiles(staleFiles);
  console.log(
    `[cleanup-release] Removed ${staleFiles.length} stale installer artifact(s) for v${currentVersion}`
  );
};

if (process.argv[1] === __filename) {
  await main();
}

