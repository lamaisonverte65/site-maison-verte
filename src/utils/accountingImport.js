import { parseCsvRows, repairBookingText } from "./bookingStatementImport.js";
import { isBookingOverviewHeaders } from "./bookingOverviewImport.js";

const clean = (v) => String(v ?? "").replace(/^\uFEFF/, "").trim();
const norm = (v) => repairBookingText(clean(v)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const amount = (v) => { const n=Number(clean(v).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n*100)/100 : 0; };
const iso = (v) => { const s=clean(v); if (!s) return null; const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const d=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); return d ? `${d[3]}-${d[2].padStart(2,"0")}-${d[1].padStart(2,"0")}` : null; };
function mapRow(headers,row){ const o={}; headers.forEach((h,i)=>o[h]=clean(row[i])); return o; }

export function detectAccountingImportFormat(text) {
  const rows=parseCsvRows(text); if (!rows.length) throw new Error("Fichier CSV vide.");
  const h=rows[0].map(norm);
  if (h.includes("numero de reservation") && h.includes("identifiant du paiement")) return "booking";
  if (isBookingOverviewHeaders(rows[0])) return "booking_overview";
  if (h.includes("type") && h.includes("code de confirmation") && h.includes("taxes reversees par airbnb")) return "airbnb";
  throw new Error("Format non reconnu. Formats automatiques disponibles : Booking Statement, Booking Overview et Airbnb.");
}

export function parseAirbnbStatement(text) {
  const rows=parseCsvRows(text); if (rows.length<2) throw new Error("Le relevé Airbnb est vide.");
  const headers=rows[0].map(norm); const data=rows.slice(1).map(r=>mapRow(headers,r));
  const reservations=data.filter(r=>norm(r.type)==="reservation");
  const payouts=data.filter(r=>norm(r.type)==="payout");
  const items=reservations.map((r,i)=>({
    line:i+2, type:"Réservation", reservationNumber:r["code de confirmation"], paymentId:r["code de reference"] || null, confirmationCode:r["code de confirmation"], guestName:r.voyageur,
    arrivalDate:iso(r["date de debut"]), checkoutDate:iso(r["date de fin"]), paymentDate:iso(r.date),
    gross:amount(r["revenus bruts"]), serviceFee:amount(r["frais de service"]), net:amount(r.montant),
    taxRemitted:amount(r["taxes reversees par airbnb"]), commission:amount(r["frais de service"]), paymentFee:0, netDifference:0, matchStatus:"not_applicable", currency:r.devise,
    sourceRecordKeys:[`airbnb:reservation:${r["code de confirmation"]}:gross`,`airbnb:reservation:${r["code de confirmation"]}:service_fee`],
  }));
  const totals=items.reduce((a,x)=>({gross:a.gross+x.gross,serviceFee:a.serviceFee+x.serviceFee,net:a.net+x.net,taxRemitted:a.taxRemitted+x.taxRemitted}),{gross:0,serviceFee:0,net:0,taxRemitted:0});
  Object.keys(totals).forEach(k=>totals[k]=Math.round(totals[k]*100)/100);
  return { source:"airbnb", items, payments:payouts.map(r=>({paymentDate:iso(r.date),reference:r["code de reference"],amount:amount(r.verse)})), payouts:payouts.map(r=>({paymentDate:iso(r.date),reference:r["code de reference"],amount:amount(r.verse)})), totals };
}

export function airbnbStatementToEntries(statement,categories){
  const byCode=new Map((categories||[]).map(c=>[c.code,c.id])); const out=[];
  for(const x of statement.items){
    const common={entry_date:x.paymentDate,source:"airbnb",operation_group_key:`airbnb:payout:${x.paymentDate}`,external_reference:x.confirmationCode||null,counterparty:"Airbnb",payment_method:"Virement Airbnb",treatment:"current",metadata:{confirmation_code:x.confirmationCode,arrival_date:x.arrivalDate,checkout_date:x.checkoutDate,guest_name:x.guestName,tax_remitted_by_airbnb:x.taxRemitted,currency:x.currency}};
    if(x.gross) out.push({...common,entry_kind:"income",category_id:byCode.get("rental_airbnb")||null,label:`Location Airbnb ${x.confirmationCode}`,amount_ttc:Math.abs(x.gross),source_record_key:`airbnb:reservation:${x.confirmationCode}:gross`});
    if(x.serviceFee) out.push({...common,entry_kind:"expense",category_id:byCode.get("platform_fees")||null,label:`Frais de service Airbnb ${x.confirmationCode}`,amount_ttc:Math.abs(x.serviceFee),source_record_key:`airbnb:reservation:${x.confirmationCode}:service_fee`});
  }
  return out;
}

export function importExerciseYear(entries){ const years=[...new Set(entries.map(e=>Number(String(e.entry_date).slice(0,4))))]; if(years.length!==1 || !years[0]) throw new Error("Le fichier doit contenir un seul exercice d'encaissement."); return years[0]; }
