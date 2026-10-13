#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_CONTRACT_VERSION } from '../../netlify/functions/_lib/contract-version.js';

const VERSIONED_RE = /^contrat-location-(V(\d+(?:\.\d+)*))\.pdf$/;
const CURRENT_ALIAS = 'contrat-location.pdf';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeVersion(value) {
  const raw = String(value ?? '').trim();
  const version = raw.toLowerCase().startsWith('v') ? raw.slice(1) : raw;
  if (!/^\d+(?:\.\d+)*$/.test(version)) throw new Error(`Invalid current contract version: ${raw || '(empty)'}`);
  return version;
}

function compareVersions(a, b) {
  const left = a.versionNumber.split('.').map(Number);
  const right = b.versionNumber.split('.').map(Number);
  const width = Math.max(left.length, right.length);
  for (let i = 0; i < width; i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

async function ensureEmptyOutput(dir) {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  if (entries.length) throw new Error(`Archive output directory is not empty: ${dir}`);
}

export async function buildContractsArchive({ sourceDir, archiveDir, currentVersion = CURRENT_CONTRACT_VERSION }) {
  if (!sourceDir || !archiveDir) throw new Error('sourceDir and archiveDir are required');

  const normalizedCurrent = normalizeVersion(currentVersion);
  const names = await readdir(sourceDir);
  const versioned = names
    .map((filename) => {
      const match = VERSIONED_RE.exec(filename);
      if (!match) return null;
      return { filename, version: match[1], versionNumber: match[2] };
    })
    .filter(Boolean)
    .sort(compareVersions);

  if (!versioned.length) throw new Error(`No versioned contract PDF found in ${sourceDir}`);
  if (!names.includes(CURRENT_ALIAS)) throw new Error(`Current alias is missing: ${CURRENT_ALIAS}`);

  const highest = versioned.at(-1);
  if (highest.versionNumber !== normalizedCurrent) {
    throw new Error(`Highest contract version is ${highest.version}, but CURRENT_CONTRACT_VERSION is v${normalizedCurrent}`);
  }

  const currentFilename = `contrat-location-V${normalizedCurrent}.pdf`;
  const aliasBytes = await readFile(path.join(sourceDir, CURRENT_ALIAS));
  const currentBytes = await readFile(path.join(sourceDir, currentFilename));
  if (!aliasBytes.equals(currentBytes)) {
    throw new Error(`Current alias ${CURRENT_ALIAS} is not identical to ${currentFilename}`);
  }

  await ensureEmptyOutput(archiveDir);

  const contracts = [];
  for (const item of versioned) {
    const source = path.join(sourceDir, item.filename);
    const bytes = await readFile(source);
    const info = await stat(source);
    if (!info.isFile()) throw new Error(`Contract source is not a regular file: ${item.filename}`);
    await copyFile(source, path.join(archiveDir, item.filename));
    contracts.push({
      version: item.version,
      filename: item.filename,
      size_bytes: info.size,
      sha256: sha256(bytes),
      source: 'repository',
      effective_from: null,
      current: item.versionNumber === normalizedCurrent,
    });
  }

  const manifest = {
    format_version: 1,
    current_version: `V${normalizedCurrent}`,
    current_filename: currentFilename,
    current_alias: CURRENT_ALIAS,
    contract_count: contracts.length,
    contracts,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(archiveDir, 'manifest.json'), manifestText, 'utf8');

  const checksumLines = contracts.map((contract) => `${contract.sha256}  ${contract.filename}`);
  checksumLines.push(`${sha256(Buffer.from(manifestText, 'utf8'))}  manifest.json`);
  await writeFile(path.join(archiveDir, 'SHA256SUMS'), `${checksumLines.join('\n')}\n`, 'utf8');

  return { currentVersion: `V${normalizedCurrent}`, contracts, manifest };
}

async function main() {
  const sourceDir = process.argv[2] || 'public/documents';
  const archiveDir = process.argv[3] || process.env.CONTRACTS_ARCHIVE_DIR;
  if (!archiveDir) throw new Error('Usage: node scripts/backup/build-contracts-archive.mjs <sourceDir> <archiveDir>');
  const result = await buildContractsArchive({ sourceDir, archiveDir });
  console.log(`Prepared ${result.contracts.length} immutable contract(s); current=${result.currentVersion}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
