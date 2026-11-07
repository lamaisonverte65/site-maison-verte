import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sources = [
  ['Supabase', '.github/workflows/backup-supabase.yml'],
  ['Stripe', '.github/workflows/backup-stripe.yml'],
];

for (const [label, path] of sources) {
  test(`R31.2 ${label} rotation is scheduled-only and explicitly acknowledged`, () => {
    const src = readFileSync(path, 'utf8');
    const block = src.match(/- name: Apply verified pCloud retention\n([\s\S]*?)(?=\n      - name:|$)/);
    assert.ok(block, 'Retention step missing');
    assert.match(block[1], /github\.event_name == 'schedule'/);
    assert.match(block[1], /R31_ROTATION_APPLY_ACK: JE_CONFIRME_LA_ROTATION_R31/);
    assert.match(block[1], /set -euo pipefail/);
    assert.match(block[1], /rotate-pcloud\.sh --dry-run[\s\S]*rotate-pcloud\.sh --apply/);
    assert.equal((src.match(/rotate-pcloud\.sh --apply/g) || []).length, 1);
  });
}

test('R31.2 Stripe rotation stays scoped to Stripe and Supabase does not inherit Stripe root', () => {
  const stripe = readFileSync(sources[1][1], 'utf8');
  const supabase = readFileSync(sources[0][1], 'utf8');
  assert.match(stripe, /PCLOUD_BASE_PATH: 02_Stripe/);
  assert.match(stripe, /PCLOUD_LATEST_ROOT: La Maison Verte\/backup-download\/stripe/);
  assert.doesNotMatch(supabase, /PCLOUD_BASE_PATH: 02_Stripe/);
});

test('R31.2 deletion script still rejects unacknowledged or overly broad purge', () => {
  const src = readFileSync('scripts/backup/rotate-pcloud.sh', 'utf8');
  assert.match(src, /R31_ROTATION_APPLY_ACK/);
  assert.ok(src.includes('${#TO_DELETE[@]} > 25'));
  assert.match(src, /01_Supabase\|02_Stripe/);
  assert.match(src, /POINTER_TIER/);
  assert.match(src, /valid_backup/);
});
