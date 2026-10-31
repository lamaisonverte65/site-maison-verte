import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openSpecialPaymentCheckout, SpecialPaymentCheckoutError, validSpecialPaymentSession } from "../netlify/functions/_lib/special-payment-checkout.js";
import { retryRelevance } from "../netlify/functions/_lib/email-retry-core.js";
import { getHomeSecondaryCopy } from "../src/components/home/homeSecondaryTranslations.js";

const NOW = Date.parse("2026-10-31T12:00:00.000Z");
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const copies = obj => JSON.parse(JSON.stringify(obj));
function setup(kind = "cleaning") {
  const table = kind === "cleaning" ? "booking_cleaning_issues" : "booking_additional_charges";
  const booking = { id: "booking-1", guest_email: "guest@example.test", guest_first_name: "Guest", guest_last_name: "Name", communication_language: "fr" };
  const record = { id: "issue-1", booking_request_id: booking.id, status: kind === "cleaning" ? "confirmed" : "draft", stripe_session_id: null, updated_at: "before", amount_due: 49, amount: 32.5, payment_link: null };
  const db = { [table]: copies(record), booking_requests: copies(booking) };
  const sessions = new Map();
  const sent = []; const expired = []; let created = 0; let failUpdate = false; let afterUpdate = () => {};
  const query = (name, patch = null) => {
    const predicates = [];
    const q = {
      eq(field, value) { predicates.push(row => row?.[field] === value); return q; },
      is(field, value) { predicates.push(row => row?.[field] === value); return q; },
      select() {
        if (patch !== null) {
          const row = db[name];
          if (failUpdate || !predicates.every(fn => fn(row))) return Promise.resolve({ data: [], error: null });
          db[name] = { ...row, ...patch };
          afterUpdate();
          return Promise.resolve({ data: [copies(db[name])], error: null });
        }
        q.maybeSingle = async () => ({ data: predicates.every(fn => fn(db[name])) ? copies(db[name]) : null, error: null });
        return q;
      },
    };
    return q;
  };
  const supabase = { from(name) { return { select: () => query(name).select(), update: patch => query(name, patch) }; } };
  const stripe = { checkout: { sessions: {
    async retrieve(id) { return sessions.get(id) || null; },
    async expire(id) { expired.push(id); const s=sessions.get(id); if(s) s.status="expired"; },
    async create(payload, options) {
      assert.match(options.idempotencyKey, /^special:/);
      const id = `cs_test_${++created}`;
      const s = { id, status: "open", payment_status: "unpaid", mode: "payment", currency: "eur", amount_total: payload.line_items[0].price_data.unit_amount, customer_email: booking.guest_email, url: `https://checkout.stripe.com/c/pay/${id}`, expires_at: (NOW + 30 * 60_000) / 1000, metadata: payload.metadata };
      sessions.set(id, s);
      return copies(s);
    },
  } } };
  const createParameters = () => ({
    customer_email: booking.guest_email,
    metadata: { booking_id: booking.id, payment_type: "manual", manual_reason: kind, [kind === "cleaning" ? "cleaning_issue_id" : "additional_charge_id"]: record.id, manual_amount: String(kind === "cleaning" ? record.amount_due : record.amount) },
    line_items: [{ price_data: { unit_amount: (kind === "cleaning" ? record.amount_due : record.amount) * 100 } }],
  });
  const sendEmail = async ({ record, booking, session }) => { assert.equal(record.stripe_session_id, session.id); assert.equal(booking.guest_email, "guest@example.test"); sent.push(session.id); return { sent: true }; };
  const open = (opts = {}) => openSpecialPaymentCheckout({ kind, record: copies(db[table]), booking: copies(db.booking_requests), stripe, supabase, createParameters, sendEmail, now: NOW, ...opts });
  return { open, db, stripe, sessions, sent, expired, get created() { return created; }, set failUpdate(x){failUpdate=x;}, set afterUpdate(fn){afterUpdate=fn;}, table, kind, record, booking };
}

for (const kind of ["cleaning", "additional_charge"]) {
  test(`R28 ${kind}: initial request persists the only current payable session, then sends mail`, async () => {
    const t = setup(kind);
    const result = await t.open();
    assert.equal(result.reused, false); assert.deepEqual(t.sent, [result.session.id]);
    assert.equal(t.db[t.table].stripe_session_id, result.session.id);
    assert.equal(t.db[t.table].status, "payment_requested");
    assert.equal(result.session.amount_total, kind === "cleaning" ? 4900 : 3250);
    assert.equal(result.emailResult.sent, true);
    assert.equal(result.session.id, result.record.stripe_session_id);
  });
  test(`R28 ${kind}: an open stored session is reused, without charging twice`, async () => {
    const t = setup(kind);
    const first = await t.open(); const second = await t.open();
    assert.equal(first.session.id, second.session.id); assert.equal(second.reused, true);
    assert.equal(t.created, 1); assert.deepEqual(t.sent, [first.session.id, first.session.id]);
  });
  test(`R28 ${kind}: a completed session blocks any new request while webhook is in flight`, async () => {
    const t = setup(kind);const first = await t.open();
    t.sessions.get(first.session.id).status = "complete";
    await assert.rejects(t.open(), /en cours de confirmation/);
    assert.equal(t.created, 1);
  });
  test(`R28 ${kind}: CAS conflict expires losing new Checkout before email`, async () => {
    const t=setup(kind);t.failUpdate=true;
    await assert.rejects(t.open(), /changé pendant la création/);
    assert.equal(t.created,1); assert.deepEqual(t.expired,["cs_test_1"]); assert.equal(t.sent.length,0);
  });
  test(`R28 ${kind}: stale DB state after CAS expires candidate without emailing it`, async () => {
    const t=setup(kind);
    t.afterUpdate=() => { t.db[t.table].status = "paid"; t.db[t.table].updated_at="webhook"; };
    await assert.rejects(t.open(), /modifié/);
    assert.equal(t.sent.length,0);assert.deepEqual(t.expired,["cs_test_1"]);
  });
  test(`R28 ${kind}: email failure preserves current payable session for verified resend`, async () => {
    const t = setup(kind);
    const first = await t.open({ sendEmail: () => { throw new Error("Resend outage"); } }).then(() => null, e => e);
    assert.equal(first.message,"Resend outage");
    assert.equal(t.created,1);assert.equal(t.expired.length,0);
    const retry=await t.open();assert.equal(retry.reused,true);assert.equal(t.sent.length,1);
  });
  test(`R28 ${kind}: tampered Stripe metadata/email or amount invalidates link`, async () => {
    const t=setup(kind);const result=await t.open();
    const session=t.sessions.get(result.session.id);
    assert.equal(validSpecialPaymentSession({...session, customer_email:"attacker@example.test"},{kind,record:result.record,booking:t.booking,now:NOW}),false);
    assert.equal(validSpecialPaymentSession({...session, amount_total:9900},{kind,record:result.record,booking:t.booking,now:NOW}),false);
    assert.equal(validSpecialPaymentSession({...session,metadata:{...session.metadata,manual_amount:"abc"}},{kind,record:result.record,booking:t.booking,now:NOW}),false);
  });
}

test("R28: no background replay of obsolete special Stripe checkout URLs", () => {
  for (const email_type of ["post_stay_cleaning_payment", "additional_charge_payment"]) {
    assert.equal(retryRelevance({booking_request_id:"booking-1",email_type,to_email:"guest@example.test"},{status:"confirmed",guest_email:"guest@example.test"}).allowed,false);
  }
});

test("R28: public quote rejects arbitrary financialContext and bounds stay before pricing", () => {
  const source=read("netlify/functions/booking-quote.js");
  assert.match(source,/Object\.keys\(input\)\.some\(key => !allowed\.has\(key\)\)/);
  assert.match(source,/durationMs > 60 \* 86400000/);
  assert.ok(source.indexOf("durationMs > 60 * 86400000") < source.indexOf("calculatePublicBookingQuote(supabase, input)"));
  assert.doesNotMatch(source,/"financialContext"\]/);
});

test("R28: same name alone no longer automatically links two external travelers", () => {
  const source=read("netlify/functions/update-external-reservation-client.js");
  assert.doesNotMatch(source,/\.ilike\("first_name", firstName\)/);
  assert.match(source,/\.eq\("email", email\)/);
  assert.match(source,/\.eq\("phone", phone\)/);
});

test("R28: site review button stays visible, and site/Google/Booking/Airbnb counts may evolve in FR, EN, ES", () => {
  const home = read("src/pages/MaisonVerte.jsx");
  assert.match(home, /Laisser un avis sur notre site/);
  const button = home.slice(home.indexOf("{/* AVIS DIRECTS SITE"), home.indexOf("{showReviewForm && ("));
  assert.match(button, /publishedReviews\.slice\(0, 3\)/);
  assert.ok(button.lastIndexOf("setShowReviewForm(true)") > button.indexOf("publishedReviews.slice(0, 3)"));

  // Les avis internes viennent de la base, pas d'un nombre recopié dans le test.
  assert.match(home, /siteReviewsCount\?\.\(publishedReviews\.length\)/);
  assert.match(home, /getPublishedReviewAverage\(\)/);
  for (const count of [1, 7, 53]) {
    for (const language of ["en", "es"]) {
      const label = getHomeSecondaryCopy(language).reviews.siteReviewsCount(count);
      assert.match(label, new RegExp(`\\b${count}\\b`));
    }
  }

  function assertNumericCount(value, pattern, label) {
    const match = String(value || "").match(pattern);
    assert.ok(match, `${label} : nombre d'avis absent ou invalide.`);
    assert.ok(Number.isSafeInteger(Number(match[1])) && Number(match[1]) >= 0, `${label} : nombre invalide.`);
  }

  // Les valeurs et les notes peuvent évoluer sans modifier les assertions.
  assertNumericCount(home, /\d+(?:[,.]\d+)?\/5\s*·\s*(\d+)\s+avis Google\b/, "Google FR");
  assertNumericCount(home, /Basé sur (\d+) expériences vécues/, "Booking FR");
  assertNumericCount(home, /Basé sur (\d+) évaluations voyageurs/, "Airbnb FR");
  assert.match(home, /<h3>Booking\.com<\/h3>[\s\S]*?\d+(?:[,.]\d+)?\/10/);
  assert.match(home, /<h3>Airbnb<\/h3>[\s\S]*?\d+(?:[,.]\d+)?\/5/);

  const translatedPatterns = {
    en: [/(\d+) Google reviews\b/, /(\d+) guest experiences\b/, /(\d+) guest ratings\b/],
    es: [/(\d+) opiniones de Google\b/, /(\d+) experiencias de viajeros\b/, /(\d+) valoraciones de viajeros\b/],
  };
  for (const language of ["en", "es"]) {
    const reviews = getHomeSecondaryCopy(language).reviews;
    for (const [index, key] of ["googleCount", "bookingCount", "airbnbCount"].entries()) {
      assertNumericCount(reviews[key], translatedPatterns[language][index], `${key} ${language}`);
    }
  }
});

test("R28: both new endpoints use the shared CAS guard and stable Resend idempotency", () => {
  const helper=read("netlify/functions/_lib/special-payment-checkout.js");
  assert.match(helper,/\.eq\("updated_at", record\.updated_at\)/);
  assert.match(helper,/\.eq\("stripe_session_id", record\.stripe_session_id\)/);
  for(const p of ["create-cleaning-payment-session.js","create-additional-charge-session.js"]){
    const source=read(`netlify/functions/${p}`);
    assert.match(source,/openSpecialPaymentCheckout/);
    assert.match(source,/idempotencyKey:/);
  }
});
