import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('gitignore exclut sorties et secrets temporaires de backup', () => {
  const src = readRequired('.gitignore');
  assert.match(src, /backup-output|\.backup-work/);
  assert.match(src, /rclone.*conf|pcloud.*token/i);
  assert.match(src, /supabase\/\.temp\//);
});
