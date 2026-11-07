import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { adminBookingPaymentMode, adminBookingPaymentState } from '../netlify/functions/_lib/admin-booking-modes.js';
import { nightsBetween } from '../src/components/admin/calendar/calendarHelpers.js';

const read=(name)=>fs.readFileSync(new URL(`../${name}`, import.meta.url),'utf8');

test('R30: 17 -> 19 November is two nights (departure excluded)',()=>{
  assert.deepEqual(nightsBetween('2026-11-17','2026-11-19'),['2026-11-17','2026-11-18']);
});
test('R30: cash is a confirmed but UNPAID site booking, without checkout or deposit reminder',()=>{
  const plan=adminBookingPaymentState({bookingKind:'site',paymentMethod:'cash',total:204.60,sendPaymentLink:true});
  assert.equal(plan.method,'cash');
  assert.equal(plan.checkout,false);
  assert.equal(plan.status,'confirmed');
  assert.equal(plan.paymentStatus,'cash_pending');
  assert.equal(plan.depositStatus,'non applicable');
  assert.equal(plan.balanceStatus,'non applicable');
});
test('R30: personal and platform actions never generate a Stripe link',()=>{
  for (const kind of ['personal','booking','airbnb']) {
    assert.equal(adminBookingPaymentState({bookingKind:kind,total:999,sendPaymentLink:true}).checkout,false);
  }
  assert.equal(adminBookingPaymentMode('personal'),'none');
});
test('R30: Stripe still allows online checkout',()=>{
  const plan=adminBookingPaymentState({bookingKind:'site',paymentMethod:'stripe',total:123,sendPaymentLink:true});
  assert.equal(plan.checkout,true);
  assert.equal(plan.status,'accepted');
});
test('R30: UI leaves special accommodation price blank, always recomputes server quote',()=>{
  const selection=read('src/components/admin/calendar/SelectionPanel.jsx');
  const admin=read('src/components/CalendarAdmin.jsx');
  const helper=read('src/components/admin/calendar/calendarHelpers.js');
  assert.match(selection,/admin-booking-quote/);
  assert.match(selection,/Tarif spécial hébergement/);
  assert.match(helper,/total: ""/);
  assert.match(admin,/String\(selectionForm\.total \|\| ""\)\.trim\(\) !== ""/);
  assert.match(admin,/selectionForm\.startDate \|\| selectedPeriod\.startStr/);
  assert.match(selection,/quote\.touristTax/);
  assert.match(selection,/quote\.cleaning/);
});
test('R30: five actions with a help icon, price action removed',()=>{
  const selection=read('src/components/admin/calendar/SelectionPanel.jsx');
  assert.doesNotMatch(selection,/option value="price"/);
  assert.match(selection,/aria-label="Explication des actions"/);
});
test('R30: personal booking can have contacts with optional email notices',()=>{
  const selection=read('src/components/admin/calendar/SelectionPanel.jsx');
  const create=read('netlify/functions/create-personal-booking.js');
  assert.match(selection,/Réservation personnelle/);
  assert.match(selection,/sendInfoEmail/);
  assert.match(create,/admin_email_notifications_enabled: notificationsEnabled/);
  assert.match(create,/guestEmail = cleanText\(body.email\)/);
  assert.match(create,/sendAdminBookingInformationEmail/);
});
test('R30: scheduled arrival and review emails respect the admin opt-out',()=>{
  for(const file of ['netlify/functions/send-arrival-reminder.js','netlify/functions/send-stay-review-request.js']) {
    assert.match(read(file),/\.neq\("admin_email_notifications_enabled", false\)/);
  }
});
test('R30: atomic and guarded cash receipt, one booking only, no fake Stripe payment',()=>{
  const sql=read('supabase/migrations/202611070001_admin_cash_and_optional_emails.sql');
  const fn=read('netlify/functions/admin-record-cash-payment.js');
  assert.match(sql,/FOR UPDATE/i);
  assert.match(sql,/v_booking\.payment_status IS DISTINCT FROM 'cash_pending'/);
  assert.match(sql,/IF EXISTS \(SELECT 1 FROM public\.payments/);
  assert.match(sql,/source_record_key/);
  assert.match(sql,/INSERT INTO public\.accounting_entries/i);
  assert.match(sql,/payment_status = 'manual_paid'/);
  assert.match(fn,/ownerOnly: true/);
});
test('R30: cash stays in direct tourist tax but personal is excluded',()=>{
  const declaration=read('netlify/functions/admin-tourist-tax-declaration.js');
  assert.match(declaration,/source === "admin_client"/);
  assert.doesNotMatch(declaration,/source === "admin_personal"/);
});
test('R30: past blocks filtered for active calendar, not deleted',()=>{
  const calendar=read('src/components/CalendarAdmin.jsx');
  assert.match(calendar,/const activeBlocks =/);
  assert.match(calendar,/\.filter\(\(block\) => String\(block\.end_date/);
  assert.match(calendar,/setBlocks\(activeBlocks\)/);
});
