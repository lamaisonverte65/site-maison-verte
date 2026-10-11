import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const rawBackupDir = process.argv[2] || process.env.BACKUP_DIR;
if (!rawBackupDir) throw new Error('Backup directory argument is required');
const backupDir = path.resolve(rawBackupDir);
if (backupDir === path.parse(backupDir).root) throw new Error('Refusing to use filesystem root as backup directory');

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

async function sha256(file) {
  const data = await fs.readFile(file);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function toolVersion(command, args = ['--version']) {
  try { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

async function readJson(rel, fallback) {
  const file = path.join(backupDir, rel);
  if (!await exists(file)) return fallback;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function countNonEmptyLines(rel) {
  const file = path.join(backupDir, rel);
  if (!await exists(file)) return 0;
  return (await fs.readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).length;
}

const allFiles = (await walk(backupDir))
  .filter((p) => p !== 'manifest.json' && p !== 'SHA256SUMS')
  .sort();
const files = [];
for (const rel of allFiles) {
  const full = path.join(backupDir, rel);
  const stat = await fs.stat(full);
  files.push({ path: rel, size: stat.size, sha256: await sha256(full) });
}

const storageBuckets = await readJson('inventory/storage_buckets.json', []);
const storageObjects = await readJson('inventory/storage_objects.json', []);
const tableCounts = await countNonEmptyLines('inventory/public_table_counts.tsv');
const authSummaryFile = path.join(backupDir, 'inventory', 'auth_summary.tsv');
let authSummary = {};
if (await exists(authSummaryFile)) {
  for (const line of (await fs.readFile(authSummaryFile, 'utf8')).split(/\r?\n/).filter(Boolean)) {
    const [name, count] = line.split('\t');
    authSummary[name] = Number(count);
  }
}

const manifest = {
  format_version: 1,
  created_at_utc: new Date().toISOString(),
  backup_id: process.env.BACKUP_ID || path.basename(backupDir),
  backup_kind: process.env.BACKUP_KIND || null,
  git_commit: process.env.GITHUB_SHA || null,
  tool_versions: {
    node: process.version,
    supabase_cli: toolVersion('supabase'),
    psql: toolVersion('psql'),
    rclone: toolVersion('rclone'),
  },
  inventory: {
    public_tables: tableCounts,
    storage_buckets: Array.isArray(storageBuckets) ? storageBuckets.length : 0,
    storage_objects: Array.isArray(storageObjects) ? storageObjects.length : 0,
    auth: authSummary,
  },
  files,
};

await fs.writeFile(path.join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
