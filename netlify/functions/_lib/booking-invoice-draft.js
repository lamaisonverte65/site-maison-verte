const SELLER_SNAPSHOT = Object.freeze({
  legal_name: "Raphaël BENOIT", trade_name: "La Maison Verte", address: "4 Chemin du Calvaire",
  postal_code: "65240", city: "Arreau", country: "France", siret: "42228411700039",
  email: "lamaisonverte65@gmail.com", phone: "+33695938315",
  accommodation_name: "La Maison Verte", accommodation_address: "3 Impasse Trassens",
  accommodation_postal_code: "65240", accommodation_city: "Arreau", accommodation_country: "France",
  vat_treatment: "furnished_rental_exempt", vat_legal_basis: "CGI art. 261 D, 4°",
});
const n = (v) => v == null || v === "" ? null : Number(v);
const clean = (v) => String(v ?? "").trim() || null;
const cents = (v) => Math.round(Number(v) * 100) / 100;
function nightsBetween(a,b){ if(!a||!b)return null; const x=new Date(`${String(a).slice(0,10)}T12:00:00Z`),y=new Date(`${String(b).slice(0,10)}T12:00:00Z`); const d=Math.round((y-x)/86400000); return Number.isFinite(d)&&d>=0?d:null; }
export function buildBookingInvoiceDraft({ booking, financial }) {
  if (!financial || financial.source !== "booking" || !clean(financial.external_reference)) throw new Error("booking_financial_required");
  const accommodation=n(financial.accommodation_amount), cleaning=n(financial.cleaning_fee), tax=n(financial.tourist_tax_amount), total=n(financial.traveler_total);
  if (![accommodation,cleaning,tax,total].every((v)=>Number.isFinite(v)&&v>=0)) throw new Error("booking_financial_breakdown_incomplete");
  if (Math.abs(cents(accommodation+cleaning+tax)-cents(total)) > 0.009) throw new Error("booking_financial_breakdown_mismatch");
  const start=financial.start_date || booking?.start_date || null, end=financial.end_date || booking?.end_date || null;
  if (!start || !end) throw new Error("booking_stay_incomplete");
  const first=clean(booking?.guest_first_name), last=clean(booking?.guest_last_name);
  if (!first && !last) throw new Error("booking_customer_incomplete");
  const rawStatement=financial.raw_snapshot?.booking_statement || {};
  const collectedByBooking=String(rawStatement.payment_status || "").toLowerCase() === "by_booking";
  return {
    source:"booking", booking_request_id:booking?.id || financial.booking_request_id || null,
    external_reference:String(financial.external_reference), status:"draft",
    seller_snapshot:{...SELLER_SNAPSHOT},
    customer_snapshot:{ first_name:first,last_name:last,email:clean(booking?.guest_email),phone:clean(booking?.guest_phone),address:clean(booking?.guest_address),postal_code:clean(booking?.guest_postal_code),city:clean(booking?.guest_city),country:clean(booking?.guest_country) },
    stay_snapshot:{ start_date:start,end_date:end,nights:financial.nights ?? nightsBetween(start,end),adults_count:booking?.adults_count == null ? financial.adults_count ?? null : Number(booking.adults_count),children_count:booking?.children_count == null ? financial.children_count ?? null : Number(booking.children_count),children_ages:Array.isArray(booking?.children_ages)?booking.children_ages:[],accommodation_name:SELLER_SNAPSHOT.accommodation_name,accommodation_address:SELLER_SNAPSHOT.accommodation_address,accommodation_postal_code:SELLER_SNAPSHOT.accommodation_postal_code,accommodation_city:SELLER_SNAPSHOT.accommodation_city,accommodation_country:SELLER_SNAPSHOT.accommodation_country },
    financial_snapshot:{ draft_origin:"booking_financial_registry",invoice_ready:true,accommodation_gross:accommodation,promotion_discount_rate:null,promotion_discount_amount:0,accommodation_net:accommodation,cleaning_fee:cleaning,tourist_tax_amount:tax,contract_total:total,platform_commission:n(financial.commission_amount),platform_payment_fee:n(financial.payment_fee_amount),platform_net_payout:n(financial.net_payout),financial_provenance:financial.provenance || {} },
    payment_snapshot: collectedByBooking ? [{ payment_type:"booking_platform",amount:total,currency:String(financial.currency||"eur").toLowerCase(),status:"paid",paid_at:null,refunded_amount:0,platform_payout_date:financial.payment_date||null,platform_payment_reference:clean(financial.payment_reference) }] : [],
    currency:String(financial.currency||"eur").toLowerCase(), total_amount:total,
  };
}
