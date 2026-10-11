import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const root = process.cwd();

export function readRequired(rel) {
  const file = path.join(root, rel);
  assert.ok(fs.existsSync(file), `Fichier attendu absent: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}
