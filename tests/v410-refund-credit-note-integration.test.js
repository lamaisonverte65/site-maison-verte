import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/202610040002_v410_customer_credit_notes.sql','utf8');
const draft=fs.readFileSync('netlify/functions/update-customer-credit-note-draft.js','utf8');
const service=fs.readFileSync('src/services/invoiceService.js','utf8');
const creditService=service.slice(service.indexOf('export async function updateCreditNoteDraft'));
test('credit note draft is attached only to a future succeeded transition and is idempotent per refund operation',()=>{assert.match(sql,/after update of status on public\.refund_operations/i);assert.match(sql,/old\.status is distinct from 'succeeded'.*new\.status = 'succeeded'/is);assert.match(sql,/unique \(refund_operation_id\)/i);assert.match(sql,/on conflict \(refund_operation_id\) do nothing/i);assert.doesNotMatch(sql,/exception when others[\s\S]*credit note draft creation skipped/i);});
test('one issued invoice is required and later invoice issuance cannot backfill old refunds',()=>{assert.match(sql,/v_invoice_count <> 1 then return new/i);assert.match(sql,/ci\.status = 'issued'/i);assert.doesNotMatch(sql,/after insert.*customer_invoices|after update.*customer_invoices/is);});
test('different refund operations can create distinct notes linked to same invoice',()=>{assert.doesNotMatch(sql,/unique\s*\(invoice_id\)/i);assert.match(sql,/customer_credit_notes_invoice_idx/i);});
test('credit note code never mutates payments refunds refund_operations bookings or invoice original',()=>{for(const source of [draft,creditService]){assert.doesNotMatch(source,/from\(['"](?:payments|refunds|refund_operations|booking_requests|customer_invoices)['"]\)\s*\.update/i);}});
