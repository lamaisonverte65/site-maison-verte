import { parseCsvRows, repairBookingText } from "./bookingStatementImport.js";
import { isBookingOverviewHeaders } from "./bookingOverviewImport.js";

const clean = (v) => String(v ?? "").replace(/^\uFEFF/, "").trim();
const norm = (v) => repairBookingText(clean(v)).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const optionalAmount = (v) => {
  let s = clean(v).replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const amount = (v) => optionalAmount(v) ?? 0;
const integer = (v) => {
  const n = optionalAmount(v);
  return n != null && Number.isInteger(n) ? n : null;
};
const isoFromParts = (year, month, day) => {
  const y = Number(year); const m = Number(month); const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== m || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
};
const isoYmd = (v) => { const s=clean(v); const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? isoFromParts(m[1],m[2],m[3]) : null; };
const isoDmy = (v) => { const s=clean(v); if (!s) return null; const ymd=isoYmd(s); if (ymd) return ymd; const d=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); return d ? isoFromParts(d[3],d[2],d[1]) : null; };
const isoMdy = (v) => { const s=clean(v); if (!s) return null; const ymd=isoYmd(s); if (ymd) return ymd; const d=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); return d ? isoFromParts(d[3],d[1],d[2]) : null; };
function mapRow(headers,row){ const o={}; headers.forEach((h,i)=>o[h]=clean(row[i])); return o; }

export function detectAccountingImportFormat(text) {
  const rows=parseCsvRows(text); if (!rows.length) throw new Error("Fichier CSV vide.");
  const h=rows[0].map(norm);
  if (h.includes("numero de reservation") && h.includes("identifiant du paiement")) return "booking";
  if (isBookingOverviewHeaders(rows[0])) return "booking_overview";
  if (h.includes("type") && h.includes("code de confirmation") && h.includes("taxes reversees par airbnb")) return "airbnb";
  if (h.includes("code de confirmation") && h.includes("# des adultes") && h.includes("# des nuits") && h.includes("revenus")) return "airbnb_reservations";
  throw new Error("Format non reconnu. Formats automatiques disponibles : Booking Statement, Booking Overview, relevé Airbnb et réservations Airbnb.");
}

export function parseAirbnbStatement(text) {
  const rows=parseCsvRows(text); if (rows.length<2) throw new Error("Le relevé Airbnb est vide.");
  const headers=rows[0].map(norm); const data=rows.slice(1).map(r=>mapRow(headers,r));
  const reservations=data.filter(r=>norm(r.type)==="reservation");
  const payouts=data.filter(r=>norm(r.type)==="payout");
  const items=reservations.map((r,i)=>{
    const paymentFee = optionalAmount(r["frais de versement sur carte bancaire"]);
    return {
      line:i+2, type:"Réservation", reservationNumber:r["code de confirmation"], paymentId:r["code de reference"] || null, confirmationCode:r["code de confirmation"], guestName:r.voyageur,
      bookedOn:isoMdy(r["date de reservation"]), arrivalDate:isoMdy(r["date de debut"]), checkoutDate:isoMdy(r["date de fin"]), nights:integer(r.nuits), paymentDate:isoMdy(r.date),
      gross:amount(r["revenus bruts"]), serviceFee:amount(r["frais de service"]), net:amount(r.montant),
      cleaningFee:optionalAmount(r["frais de menage"]), taxRemitted:optionalAmount(r["taxes reversees par airbnb"]),
      commission:amount(r["frais de service"]), paymentFee, netDifference:0, matchStatus:"not_applicable", currency:r.devise,
      sourceRecordKeys:[
        `airbnb:reservation:${r["code de confirmation"]}:gross`,
        `airbnb:reservation:${r["code de confirmation"]}:service_fee`,
        ...(paymentFee ? [`airbnb:reservation:${r["code de confirmation"]}:payment_fee`] : []),
      ],
    };
  });
  const totals=items.reduce((a,x)=>({
    gross:a.gross+x.gross,
    serviceFee:a.serviceFee+x.serviceFee,
    paymentFee:a.paymentFee+Number(x.paymentFee||0),
    net:a.net+x.net,
    taxRemitted:a.taxRemitted+Number(x.taxRemitted||0),
  }),{gross:0,serviceFee:0,paymentFee:0,net:0,taxRemitted:0});
  Object.keys(totals).forEach(k=>totals[k]=Math.round(totals[k]*100)/100);
  return { source:"airbnb", items, payments:payouts.map(r=>({paymentDate:isoMdy(r.date),reference:r["code de reference"],amount:amount(r.verse)})), payouts:payouts.map(r=>({paymentDate:isoMdy(r.date),reference:r["code de reference"],amount:amount(r.verse)})), totals };
}

export function parseAirbnbReservations(text) {
  const rows=parseCsvRows(text); if (rows.length<2) throw new Error("L'export Réservations Airbnb est vide.");
  const headers=rows[0].map(norm); const data=rows.slice(1).map(r=>mapRow(headers,r));
  const items=data
    .filter((r)=>r["code de confirmation"])
    .map((r,i)=>{
      const adults=integer(r["# des adultes"]);
      const children=integer(r["# des enfants"]);
      const babies=integer(r["# des bebes"]);
      const persons=[adults,children,babies].some((value)=>value != null)
        ? Number(adults||0)+Number(children||0)+Number(babies||0)
        : null;
      return {
        line:i+2,
        type:"Réservation",
        reservationNumber:r["code de confirmation"],
        confirmationCode:r["code de confirmation"],
        status:r.statut || null,
        guestName:r["nom du voyageur"] || null,
        adults,
        children,
        babies,
        persons,
        arrivalDate:isoDmy(r["date de debut"]),
        checkoutDate:isoDmy(r["date de fin"]),
        nights:integer(r["# des nuits"]),
        bookedOn:isoDmy(r.reservee),
        revenue:optionalAmount(r.revenus),
        currency:clean(r.revenus).includes("€") ? "EUR" : null,
        listing:r.annonce || null,
        matchStatus:"not_applicable",
      };
    });
  return { source:"airbnb", format:"airbnb_reservations", items, payments:[], payouts:[], totals:{gross:0,serviceFee:0,paymentFee:0,net:0,taxRemitted:0} };
}

export function airbnbStatementToEntries(statement,categories){
  const byCode=new Map((categories||[]).map(c=>[c.code,c.id])); const out=[];
  for(const x of statement.items){
    const common={entry_date:x.paymentDate,source:"airbnb",operation_group_key:`airbnb:payout:${x.paymentDate}`,external_reference:x.confirmationCode||null,counterparty:"Airbnb",payment_method:"Virement Airbnb",treatment:"current",metadata:{confirmation_code:x.confirmationCode,arrival_date:x.arrivalDate,checkout_date:x.checkoutDate,guest_name:x.guestName,cleaning_fee:x.cleaningFee,tax_remitted_by_airbnb:x.taxRemitted,payment_fee:x.paymentFee,currency:x.currency}};
    if(x.gross) out.push({...common,entry_kind:"income",category_id:byCode.get("rental_airbnb")||null,label:`Location Airbnb ${x.confirmationCode}`,amount_ttc:Math.abs(x.gross),source_record_key:`airbnb:reservation:${x.confirmationCode}:gross`});
    if(x.serviceFee) out.push({...common,entry_kind:"expense",category_id:byCode.get("platform_fees")||null,label:`Frais de service Airbnb ${x.confirmationCode}`,amount_ttc:Math.abs(x.serviceFee),source_record_key:`airbnb:reservation:${x.confirmationCode}:service_fee`});
    if(x.paymentFee) out.push({...common,entry_kind:"expense",category_id:byCode.get("payment_fees")||null,label:`Frais de versement Airbnb ${x.confirmationCode}`,amount_ttc:Math.abs(x.paymentFee),source_record_key:`airbnb:reservation:${x.confirmationCode}:payment_fee`});
  }
  return out;
}

export function importExerciseYear(entries){
  const years = [...new Set(entries.map(e => Number(String(e.entry_date || '').slice(0, 4))))].sort((a,b) => a-b);
  if (years.length !== 1 || !Number.isInteger(years[0]) || years[0] < 2000 || years[0] > 2100) {
    const detected = years.filter(y => Number.isInteger(y) && y >= 2000 && y <= 2100);
    throw new Error(detected.length > 1
      ? `Transactions sur plusieurs exercices (${detected.join(', ')}). Aucun import effectué. Exporte les transactions en un CSV par année de paiement ; les fichiers de réservations peuvent couvrir plusieurs années.`
      : "Impossible de déterminer un exercice d'encaissement unique ; vérifie les dates de paiement du CSV. Aucun import effectué.");
  }
  return years[0];
}
