import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const backupDir = process.env.BACKUP_DIR;
const supabaseUrl = process.env.SUPABASE_URL;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!backupDir) throw new Error('BACKUP_DIR is required');
if (!supabaseUrl) throw new Error('SUPABASE_URL is required');
if (!serverKey) throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required');

const inventoryPath = path.join(backupDir, 'inventory', 'storage_objects.json');
const storageRoot = path.resolve(backupDir, 'storage');
const objects = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
if (!Array.isArray(objects)) throw new Error('storage_objects.json must contain an array');

const supabase = createClient(supabaseUrl, serverKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function safeDestination(bucket, objectName) {
  if (typeof bucket !== 'string' || !bucket || bucket.includes('/') || bucket === '.' || bucket === '..') {
    throw new Error(`Unsafe Storage bucket name: ${JSON.stringify(bucket)}`);
  }
  if (typeof objectName !== 'string' || !objectName || path.isAbsolute(objectName)) {
    throw new Error(`Unsafe Storage object name: ${JSON.stringify(objectName)}`);
  }
  const bucketRoot = path.resolve(storageRoot, bucket);
  const target = path.resolve(bucketRoot, ...objectName.split('/'));
  if (!target.startsWith(`${bucketRoot}${path.sep}`)) {
    throw new Error(`Storage object escapes backup root: ${bucket}/${objectName}`);
  }
  return target;
}

await fs.mkdir(storageRoot, { recursive: true });

for (const object of objects) {
  const bucket = object.bucket_id;
  const objectName = object.name;
  const destination = safeDestination(bucket, objectName);
  const { data, error } = await supabase.storage.from(bucket).download(objectName);
  if (error) throw new Error(`Storage download failed for ${bucket}/${objectName}: ${error.message}`);
  if (!data) throw new Error(`Storage download returned no data for ${bucket}/${objectName}`);

  const bytes = Buffer.from(await data.arrayBuffer());
  const expectedSize = Number(object?.metadata?.size);
  if (Number.isFinite(expectedSize) && expectedSize >= 0 && bytes.length !== expectedSize) {
    throw new Error(`Storage size mismatch for ${bucket}/${objectName}: expected ${expectedSize}, got ${bytes.length}`);
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
}

console.log(`Storage backup complete: ${objects.length} object(s)`);
