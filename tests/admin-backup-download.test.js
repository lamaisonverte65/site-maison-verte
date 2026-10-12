import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = new URL('../netlify/functions/_lib/pcloud-backup-download.js', import.meta.url);
const endpointPath = new URL('../netlify/functions/admin-download-latest-backup.js', import.meta.url);

async function loadHelper() {
  return import(`${helperPath.href}?t=${Date.now()}-${Math.random()}`);
}

test('endpoint is POST-only and owner-only', () => {
  const src = fs.readFileSync(endpointPath, 'utf8');
  assert.match(src, /event\.httpMethod\s*!==\s*["']POST["']/);
  assert.match(src, /authorizeAdminRequest\(event,\s*supabase,\s*\{\s*ownerOnly:\s*true\s*\}\)/);
  assert.match(src, /process\.env\.PCLOUD_TOKEN/);
  assert.match(src, /Cache-Control/);
});

test('validateLatestPointer accepts only the expected latest backup shape', async () => {
  const { validateLatestPointer } = await loadHelper();
  const pointer = validateLatestPointer({
    backup_id: '2026-10-11_093325Z',
    tier: 'daily',
    completed_at_utc: '2026-10-11T09:36:32Z',
    folder_id: '123456789',
  });
  assert.equal(pointer.backupId, '2026-10-11_093325Z');
  assert.equal(pointer.folderId, '123456789');

  assert.throws(() => validateLatestPointer({ ...pointer, backup_id: '../bad' }), /pointeur/i);
  assert.throws(() => validateLatestPointer({
    backup_id: '2026-10-11_093325Z', tier: 'bad', completed_at_utc: '2026-10-11T09:36:32Z', folder_id: '123',
  }), /pointeur/i);
  assert.throws(() => validateLatestPointer({
    backup_id: '2026-10-11_093325Z', tier: 'daily', completed_at_utc: '2026-10-11T09:36:32Z', folder_id: '12/3',
  }), /pointeur/i);
});

test('pCloud API extracts the access_token from the rclone OAuth JSON secret', async () => {
  const { extractPcloudAuthToken } = await loadHelper();
  assert.equal(extractPcloudAuthToken('{"access_token":"oauth-access-token","token_type":"bearer"}'), 'oauth-access-token');
  assert.equal(extractPcloudAuthToken('legacy-raw-token'), 'legacy-raw-token');
  assert.throws(() => extractPcloudAuthToken('{"token_type":"bearer"}'), /pCloud/i);
});

test('buildPcloudDownloadUrl accepts only https pCloud content hosts and absolute paths', async () => {
  const { buildPcloudDownloadUrl } = await loadHelper();
  assert.equal(
    buildPcloudDownloadUrl({ hosts: ['c63.pcloud.com'], path: '/abc/file.zip' }),
    'https://c63.pcloud.com/abc/file.zip',
  );
  assert.throws(() => buildPcloudDownloadUrl({ hosts: ['evil.example'], path: '/x' }), /pCloud/i);
  assert.throws(() => buildPcloudDownloadUrl({ hosts: ['c1.pcloud.com'], path: 'https://evil.example/x' }), /pCloud/i);
});

test('pCloud timeouts reserve most of the Netlify 60s window for zip generation', async () => {
  const helper = await loadHelper();
  assert.equal(helper.PCLOUD_QUICK_TIMEOUT_MS, 5_000);
  assert.equal(helper.PCLOUD_ZIP_TIMEOUT_MS, 45_000);
  const src = fs.readFileSync(helperPath, 'utf8');
  assert.match(src, /getziplink[^]*PCLOUD_ZIP_TIMEOUT_MS/);
});

test('createLatestBackupDownload reads latest pointer then requests a zip link without exposing the token', async () => {
  const { createLatestBackupDownload } = await loadHelper();
  const calls = [];
  const pointer = {
    backup_id: '2026-10-11_093325Z',
    tier: 'daily',
    completed_at_utc: '2026-10-11T09:36:32Z',
    folder_id: '123456789',
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ result: 0, hosts: ['c1.pcloud.com'], path: '/latest-pointer' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (calls.length === 2) {
      return new Response(JSON.stringify(pointer), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ result: 0, hosts: ['c2.pcloud.com'], path: '/generated/archive', expires: 'soon' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };

  const result = await createLatestBackupDownload({ token: '{\"access_token\":\"super-secret-token\",\"token_type\":\"bearer\"}', fetchImpl });
  assert.deepEqual(result, {
    downloadUrl: 'https://c2.pcloud.com/generated/archive',
    filename: 'La-Maison-Verte-Supabase-2026-10-11_093325Z-encrypted.zip',
    backupId: '2026-10-11_093325Z',
    completedAt: '2026-10-11T09:36:32Z',
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://eapi.pcloud.com/getfilelink');
  assert.equal(calls[2].url, 'https://eapi.pcloud.com/getziplink');
  assert.match(String(calls[2].options.body), /folderid=123456789/);
  assert.ok(!calls.some((call) => call.url.includes('super-secret-token')), 'token must never be in a URL');
  assert.match(String(calls[0].options.body), /auth=super-secret-token/);
  assert.doesNotMatch(String(calls[0].options.body), /access_token/);
  assert.ok(!JSON.stringify(result).includes('super-secret-token'));
});

test('pCloud API errors and malformed zip responses are rejected generically', async () => {
  const { createLatestBackupDownload } = await loadHelper();
  const fetchImpl = async () => new Response(JSON.stringify({ result: 2009, error: 'File not found' }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(
    createLatestBackupDownload({ token: 'secret', fetchImpl }),
    /pCloud/i,
  );
});

test('endpoint source never returns rclone secrets to the browser', () => {
  const src = fs.readFileSync(endpointPath, 'utf8');
  assert.doesNotMatch(src, /RCLONE_CRYPT_PASSWORD/);
  assert.doesNotMatch(src, /RCLONE_CRYPT_PASSWORD2/);
  assert.doesNotMatch(src, /body:\s*JSON\.stringify\([^)]*PCLOUD_TOKEN/s);
});
