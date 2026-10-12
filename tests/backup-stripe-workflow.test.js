import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source() {
  return readFileSync('.github/workflows/backup-stripe.yml', 'utf8');
}

test('Stripe backup workflow is independent, scheduled at 03:17 UTC and manually supports manual/baseline', () => {
  const src = source();
  assert.match(src, /name:\s*Backup Stripe to pCloud/);
  assert.match(src, /cron:\s*['"]17 3 \* \* \*['"]/);
  assert.match(src, /workflow_dispatch:/);
  assert.match(src, /backup_kind:/);
  assert.match(src, /options:\s*\n\s*- manual\s*\n\s*- baseline/);
  assert.match(src, /group:\s*lmv-stripe-backup/);
  assert.match(src, /cancel-in-progress:\s*false/);
});

test('Stripe workflow uses minimal permissions and only dedicated read-only backup credential contract', () => {
  const src = source();
  assert.match(src, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(src, /contents:\s*write/);
  assert.match(src, /STRIPE_BACKUP_KEY:\s*\$\{\{\s*secrets\.STRIPE_BACKUP_KEY\s*\}\}/);
  assert.match(src, /STRIPE_EXPECTED_ACCOUNT_ID:\s*\$\{\{\s*vars\.STRIPE_EXPECTED_ACCOUNT_ID\s*\}\}/);
  assert.doesNotMatch(src, /STRIPE_SECRET_KEY/);
  assert.match(src, /STRIPE_BACKUP_KEY.*rk_live_|rk_live_\*/);
  for (const secret of ['PCLOUD_TOKEN', 'RCLONE_CRYPT_PASSWORD', 'RCLONE_CRYPT_PASSWORD2']) {
    assert.match(src, new RegExp(`${secret}:\\s*\\$\\{\\{\\s*secrets\\.${secret}\\s*\\}\\}`));
  }
});

test('Stripe workflow assembles once and uploads only to isolated Stripe pCloud roots', () => {
  const src = source();
  assert.match(src, /node-version:\s*['"]22['"]/);
  assert.match(src, /npm ci --ignore-scripts/);
  assert.match(src, /apt-get install[^\n]*rclone/);
  assert.match(src, /assemble-stripe-backup\.sh/);
  assert.match(src, /upload-pcloud\.sh/);
  assert.match(src, /PCLOUD_BASE_PATH:\s*02_Stripe/);
  assert.match(src, /PCLOUD_LATEST_ROOT:\s*La Maison Verte\/backup-download\/stripe/);
  assert.doesNotMatch(src, /01_Supabase/);
  assert.doesNotMatch(src, /supabase\/setup-cli|SUPABASE_|netlify\/functions/);
});

test('scheduled Stripe workflow applies the same tiering and rotates only after successful scheduled upload', () => {
  const src = source();
  for (const tier of ['daily', 'weekly', 'monthly', 'yearly']) assert.match(src, new RegExp(tier));
  assert.match(src, /date -u \+%u/);
  assert.match(src, /date -u \+%d/);
  assert.match(src, /date -u \+%m-%d/);
  assert.match(src, /if:\s*\$\{\{\s*success\(\)\s*&&\s*github\.event_name\s*==\s*['"]schedule['"]\s*\}\}/);
  assert.match(src, /rotate-pcloud\.sh/);
});

test('Stripe workflow diagnostic is short-lived metadata and never uploads raw backup as artifact', () => {
  const src = source();
  assert.match(src, /actions\/upload-artifact@v4/);
  assert.match(src, /retention-days:\s*14/);
  assert.match(src, /stripe-backup-diagnostic-/);
  assert.match(src, /backup-diagnostic\.txt/);
  assert.doesNotMatch(src, /path:\s*\$\{\{\s*runner\.temp\s*\}\}\/lmv-stripe-backup/);
});
