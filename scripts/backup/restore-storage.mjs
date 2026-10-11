import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function relativeName(name) {
  if (typeof name !== 'string' || !name || /[\\:\x00-\x1f]/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Unsafe backup path or Storage name');
  }
  return name;
}
async function checkedFile(root, name) {
  const file = path.join(root, relativeName(name));
  const real = await fs.realpath(file);
  if (!real.startsWith(root + path.sep) || !(await fs.stat(real)).isFile()) throw new Error('Backup file escapes root or is not a file');
  return fs.readFile(real);
}

export async function restoreStorage(backupDir, { env = process.env, apply = false, fetchImpl = fetch } = {}) {
  const root = await fs.realpath(backupDir);
  const hashes = new Map();
  const sums = await fs.readFile(path.join(root, 'SHA256SUMS'), 'utf8');
  for (const line of sums.split(/\r?\n/).filter(Boolean)) {
    const match = /^([a-f0-9]{64}) [ *](?:\.\/)?(.+)$/.exec(line);
    if (!match) throw new Error('Unsupported SHA256SUMS entry');
    const [, digest, name] = match;
    if (hashes.has(name)) throw new Error('Duplicate checksum path');
    if (hash(await checkedFile(root, name)) !== digest) throw new Error(`Checksum mismatch: ${name}`);
    hashes.set(name, digest);
  }
  async function verified(name) {
    if (!hashes.has(name)) throw new Error(`File absent from SHA256SUMS: ${name}`);
    const bytes = await checkedFile(root, name);
    if (hash(bytes) !== hashes.get(name)) throw new Error(`File changed since verification: ${name}`);
    return bytes;
  }
  const buckets = JSON.parse(await verified('inventory/storage_buckets.json'));
  const objects = JSON.parse(await verified('inventory/storage_objects.json'));
  if (!Array.isArray(buckets) || !Array.isArray(objects)) throw new Error('Storage inventories must be arrays');
  const bucketIds = new Set();
  for (const b of buckets) {
    relativeName(b.id);
    if (b.id.includes('/') || b.name !== b.id || bucketIds.has(b.id)) throw new Error('Unsupported or duplicate bucket');
    if ((b.type && b.type !== 'STANDARD') || (b.versioning_status && b.versioning_status !== 'DISABLED') || b.lifecycle_configuration != null || b.avif_autodetection === true) throw new Error('Advanced bucket settings require a dedicated restore procedure');
    if (typeof b.public !== 'boolean' || (b.file_size_limit != null && (!Number.isSafeInteger(b.file_size_limit) || b.file_size_limit < 0)) || (b.allowed_mime_types != null && (!Array.isArray(b.allowed_mime_types) || b.allowed_mime_types.some(x=>typeof x !== 'string')))) throw new Error('Invalid bucket settings');
    bucketIds.add(b.id);
  }
  const names = new Set();
  for (const o of objects) {
    relativeName(o.name);
    if (!bucketIds.has(o.bucket_id)) throw new Error('Object references an unknown bucket');
    const name = `storage/${o.bucket_id}/${o.name}`;
    if (names.has(name)) throw new Error('Duplicate Storage object');
    names.add(name);
    const bytes = await verified(name);
    if (!Number.isSafeInteger(o.metadata?.size) || o.metadata.size < 0 || bytes.length !== o.metadata.size) throw new Error('Storage size mismatch');
    if (typeof o.metadata?.mimetype !== 'string' || /[\r\n]/.test(o.metadata.mimetype)) throw new Error('Missing or invalid MIME type');
    if (o.metadata.cacheControl != null && !/^max-age=\d+$/.test(o.metadata.cacheControl)) throw new Error('Unsupported cache-control');
  }
  if (!apply) return { dryRun: true, buckets: buckets.length, objects: objects.length };
  const source = env.SOURCE_PROJECT_REF;
  const target = env.RESTORE_PROJECT_REF;
  if (!/^[a-z0-9]+$/.test(source || '') || !/^[a-z0-9]+$/.test(target || '') || source === target || env.CONFIRM_TEST_RESTORE !== 'YES') throw new Error('A distinct, confirmed disposable target is required');
  const base = `https://${target}.supabase.co`;
  if (env.RESTORE_SUPABASE_URL !== base || !env.RESTORE_SECRET_KEY) throw new Error('Explicit matching target URL and server key are required');
  const key = env.RESTORE_SECRET_KEY;
  const headers = { apikey: key };
  // Modern secret keys use apikey; legacy service_role JWTs also use Bearer.
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  async function request(endpoint, method, extra = {}) {
    const response = await fetchImpl(`${base}/storage/v1${endpoint}`, { ...extra, method, headers: { ...headers, ...extra.headers }, redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Storage ${method} failed (HTTP ${response.status}); stop and inspect the test target`);
    return response;
  }
  const existing = await (await request('/bucket', 'GET')).json();
  if (!Array.isArray(existing) || existing.length) throw new Error('Target Storage must contain no buckets; do not resume a partial restore');
  for (const b of buckets) {
    await request('/bucket', 'POST', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null }) });
  }
  for (const o of objects) {
    const name = `storage/${o.bucket_id}/${o.name}`;
    const bytes = await verified(name);
    const objectPath = [o.bucket_id, ...o.name.split('/')].map(encodeURIComponent).join('/');
    await request(`/object/${objectPath}`, 'POST', { headers: { 'content-type': o.metadata.mimetype, 'cache-control': o.metadata.cacheControl || 'max-age=3600', 'x-upsert': 'false' }, body: bytes });
    const downloaded = await (await request(`/object/authenticated/${objectPath}`, 'GET')).arrayBuffer();
    if (hash(Buffer.from(downloaded)) !== hashes.get(name)) throw new Error('Restored Storage content hash mismatch');
  }
  return { dryRun: false, buckets: buckets.length, objects: objects.length, verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || process.argv.slice(3).some(arg => arg !== '--apply')) throw new Error('Usage: node restore-storage.mjs BACKUP_DIR [--apply]');
    console.log(JSON.stringify(await restoreStorage(process.argv[2], { apply: process.argv.includes('--apply') })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
