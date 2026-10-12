import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('documentation décrit le téléchargement owner-only et la copie locale chiffrée', () => {
  const src = readRequired('docs/operations/DOWNLOAD_BACKUP_FROM_ADMIN.md');
  for (const term of [
    'Télécharger la dernière sauvegarde',
    'owner',
    'PCLOUD_TOKEN',
    'encrypted',
    'rclone crypt',
    '_SUCCESS',
  ]) {
    assert.match(src, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(src, /RCLONE_CRYPT_PASSWORD/);
  assert.match(src, /ne (?:doit|doivent).*pas.*Netlify|pas.*dans Netlify/i);
  assert.match(src, /navigateur.*(?:choisit|gère).*destination|aucun chemin local/i);
  assert.match(src, /extraire.*ZIP|ZIP.*extraire/i);
  assert.match(src, /LMVCRYPT|crypt remote|remote.*crypt/i);
});
