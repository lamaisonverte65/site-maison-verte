import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTestMessages, TEST_INBOX, testDeliveryEnv, approvedPayload, makePreviewHtml, selectMessagesForSending,
} from '../scripts/v415-r13-3f-test-resend.mjs';
import { evaluateEmailDelivery } from '../netlify/functions/_lib/email-delivery-policy.js';

const messages = buildTestMessages();
test('R13.3f : exactement neuf messages, dont un véritable modèle FR historique',()=>{
  assert.equal(messages.length,9);
  assert.deepEqual(messages.map(v=>v.lang), ['fr','en','es','en','es','en','es','en','es']);
  assert.match(messages[0].html,/Merci pour votre demande de réservation/);
});
test('R13.3f : données de voyage fictives et marquage test partout',()=>{
  for(const msg of messages) {
    assert.match(msg.subject,/^\[TEST V4\.15 [1-9]\/9 (FR|EN|ES)\]/);
    assert.match(msg.html,/TEST V4\.15 — aucune réservation/);
    assert.match(msg.html,/Camille/);
    assert.doesNotMatch(msg.html,/checkout\.stripe\.com|buy\.stripe\.com/);
  }
});
test('R13.3f : verrou de destination strict sur chaque message',()=>{
  for(const m of messages) {
    const p = approvedPayload(m);
    assert.deepEqual(p.to,[TEST_INBOX]);
    assert.equal(evaluateEmailDelivery(p,testDeliveryEnv()).allowed,true);
    assert.equal(evaluateEmailDelivery({...p,to:['voyageur@example.com']},testDeliveryEnv()).allowed,false);
    assert.equal(evaluateEmailDelivery({...p,cc:['voyageur@example.com']},testDeliveryEnv()).allowed,false);
    assert.equal(evaluateEmailDelivery({...p,bcc:['voyageur@example.com']},testDeliveryEnv()).allowed,false);
  }
});
test('R13.3f : aperçu statique sans réseau ni envoi',()=>{
  const html = makePreviewHtml(messages);
  assert.equal((html.match(/<article>/g)||[]).length,9);
  assert.match(html,/AUCUN EMAIL ENVOYÉ/);
});
test('R13.3f : le mode production n’est jamais requis pour les essais',()=>{
  assert.equal(testDeliveryEnv().CONTEXT,'dev');
  assert.equal(testDeliveryEnv().LMV_EMAIL_DELIVERY_MODE,'allowlist');
  assert.equal(testDeliveryEnv().LMV_EMAIL_ALLOWED_RECIPIENTS,TEST_INBOX);
});

test('R13.3f correctif : adresse Gmail réelle vérifiée, ancien destinataire interdit', () => {
  assert.equal(TEST_INBOX, 'lamaisonverte65@gmail.com');
  assert.notEqual(TEST_INBOX, 'lamaisonvert65@gmail.com');
  for (const m of messages) {
    assert.deepEqual(approvedPayload(m).to, ['lamaisonverte65@gmail.com']);
  }
});
test('R13.3f correctif : premier envoi isolé des huit restants', () => {
  assert.deepEqual(selectMessagesForSending(messages, 'one').map(m => m.subject), [messages[0].subject]);
  assert.deepEqual(selectMessagesForSending(messages, 'remaining').map(m => m.subject), messages.slice(1).map(m => m.subject));
  assert.throws(() => selectMessagesForSending(messages, 'all'), /Mode d.envoi invalide/);
});
