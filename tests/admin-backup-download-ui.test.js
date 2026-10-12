import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('frontend service requests the owner-only Netlify endpoint with the current bearer token', () => {
  const src = read('src/services/adminBackupDownloadService.js');
  assert.match(src, /supabase\.auth\.getSession\(\)/);
  assert.match(src, /\.netlify\/functions\/admin-download-latest-backup/);
  assert.match(src, /method:\s*["']POST["']/);
  assert.match(src, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(src, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(src, /[A-Z]:\\|H:\\|C:\\/);
});

test('AdminTopBar shows the backup download action only to the owner', () => {
  const src = read('src/components/admin/AdminTopBar.jsx');
  assert.match(src, /permissions\?\.isOwner/);
  assert.match(src, /Télécharger la dernière sauvegarde/);
  assert.match(src, /requestLatestBackupDownload/);
  assert.match(src, /useState\(false\)/);
  assert.match(src, /disabled=\{backupDownloadLoading\}/);
  assert.match(src, /Préparation du téléchargement…/);
});

test('AdminTopBar triggers a browser download without encoding a local filesystem path', () => {
  const src = read('src/components/admin/AdminTopBar.jsx');
  assert.match(src, /document\.createElement\(["']a["']\)/);
  assert.match(src, /link\.href\s*=\s*downloadUrl/);
  assert.match(src, /link\.download\s*=\s*filename/);
  assert.match(src, /link\.click\(\)/);
  assert.doesNotMatch(src, /showDirectoryPicker|FileSystemHandle|H:\\|C:\\/);
});
