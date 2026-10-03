import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const endpointPath='netlify/functions/update-customer-credit-note-draft.js';
const service=fs.readFileSync('src/services/invoiceService.js','utf8');
const endpoint=fs.existsSync(endpointPath)?fs.readFileSync(endpointPath,'utf8'):'';
test('draft update endpoint is owner-only and rereads authoritative note',()=>{
  assert.match(endpoint,/ownerOnly:\s*true/);
  assert.match(endpoint,/from\(['"]customer_credit_notes['"]\).*select\(['"]\*['"]\)/s);
  assert.match(endpoint,/status !== ['"]draft['"]/);
  assert.match(endpoint,/refund_snapshot/);
});
test('browser only submits accommodation and cleaning split',()=>{
  assert.match(service,/updateCreditNoteDraft/);
  assert.match(service,/accommodationRefund/);
  assert.match(service,/cleaningRefund/);
  assert.doesNotMatch(service,/updateCreditNoteDraft[\s\S]{0,900}(total_amount|tourist_tax_refund|refund_snapshot|invoice_id)/i);
});
test('endpoint validates cents and fixes manual_required false without changing authoritative total or tax',()=>{
  assert.match(endpoint,/refunded_amount_cents/);
  assert.match(endpoint,/tourist_tax_refund_cents/);
  assert.match(endpoint,/Math\.round/);
  assert.match(endpoint,/manual_required:\s*false/);
  assert.doesNotMatch(endpoint,/total_amount\s*:/);
});
