import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { verifyBalanceToken } from "./_lib/balance-link.js";
import { normalizeGuestLanguage } from "../../shared/guestLocale.js";
import { balanceStatusPage } from "./_lib/balance-page.js";
import { contractualTotal, recordedPaidAmount } from "./_lib/booking-financial-authority.js";
import { openBalanceCheckout } from "./_lib/balance-checkout.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";
const STOP_STATUSES = ["cancelled", "refused", "expired"];
const PAID_STATUSES = ["fully_paid", "confirmed"];

function normalize(value) { return String(value || "").trim().toLowerCase(); }
function totalDue(b) { return contractualTotal(b); }
function totalPaid(b) { return recordedPaidAmount(b); }

export async function handler(event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  let language = normalizeGuestLanguage(event.queryStringParameters?.lang);
  try {
    const bookingId = event.queryStringParameters?.booking;
    const token = event.queryStringParameters?.token;
    if (!bookingId || !verifyBalanceToken(bookingId, token)) {
      return { statusCode: 403, headers: { "Content-Type": "text/html; charset=utf-8" }, body: balanceStatusPage("invalid", language, SITE_URL) };
    }
    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
    if (error || !booking) return { statusCode: 404, headers: { "Content-Type": "text/html; charset=utf-8" }, body: balanceStatusPage("notFound", language, SITE_URL) };
    language = normalizeGuestLanguage(booking.communication_language);
    if (STOP_STATUSES.includes(normalize(booking.status))) return { statusCode: 409, headers: { "Content-Type": "text/html; charset=utf-8" }, body: balanceStatusPage("unavailable", language, SITE_URL) };
    const total = totalDue(booking);
    const paid = totalPaid(booking);
    const balance = Math.max(total - paid, 0);
    if (PAID_STATUSES.includes(normalize(booking.status)) || normalize(booking.balance_status) === "paid" || balance <= 0) {
      return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: balanceStatusPage("paid", language, SITE_URL) };
    }
    const result = await openBalanceCheckout({
      stripe, supabase, booking, cents: Math.round(balance * 100), siteUrl: SITE_URL,
    });
    if (result.kind === "redirect") {
      return { statusCode: 303, headers: { Location: result.url, "Cache-Control": "no-store" }, body: "" };
    }
    if (result.kind === "verifying") {
      return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: balanceStatusPage("verifying", language, SITE_URL) };
    }
    return { statusCode: 409, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: balanceStatusPage("refresh", language, SITE_URL) };
  } catch (error) {
    console.error("Erreur pay-balance:", error);
    return { statusCode: 500, headers: { "Content-Type": "text/html; charset=utf-8" }, body: balanceStatusPage("error", language, SITE_URL) };
  }
}
