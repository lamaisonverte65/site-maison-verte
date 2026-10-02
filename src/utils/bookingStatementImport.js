const MONTHS = {
  janv: 1, fevr: 2, mars: 3, avr: 4, mai: 5, juin: 6,
  juil: 7, aout: 8, sept: 9, oct: 10, nov: 11, dec: 12,
};

function stripAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function repairBookingText(value) {
  const input = String(value ?? "");
  if (!/[ÃÂ]/.test(input)) return input.replace(/\u00a0/g, " ").trim();
  try {
    const bytes = Uint8Array.from([...input].map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes).replace(/\u00a0/g, " ").trim();
  } catch {
    return input.replace(/\u00a0/g, " ").trim();
  }
}

export function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

function normalizeHeader(value) {
  return stripAccents(repairBookingText(value)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseAmount(value) {
  const normalized = repairBookingText(value).replace(/\s/g, "").replace(",", ".");
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new Error(`Montant Booking invalide : ${value}`);
  return Math.round(amount * 100) / 100;
}

export function parseFrenchBookingDate(value) {
  const cleaned = stripAccents(repairBookingText(value)).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (!match) throw new Error(`Date Booking non reconnue : ${repairBookingText(value)}`);
  const month = MONTHS[match[2]];
  if (!month) throw new Error(`Mois Booking non reconnu : ${repairBookingText(value)}`);
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

function field(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? repairBookingText(row[index]) : "";
}

function rowKeys(item) {
  if (item.kind === "reservation") {
    const root = `statement:reservation:${item.reservationNumber}:${item.paymentId || item.paymentDate}`;
    return [`${root}:gross`, `${root}:commission`, `${root}:payment_fee`].filter((key, index) => [item.gross, item.commission, item.paymentFee][index] !== 0);
  }
  return [`statement:adjustment:${item.reservationNumber || "none"}:${item.paymentId || item.paymentDate}:${item.net}`];
}

export function parseBookingStatement(text) {
  const csv = parseCsvRows(text);
  if (csv.length < 2) throw new Error("Le relevé Booking est vide.");
  const headers = csv[0].map(normalizeHeader);
  const required = ["type", "numero de reservation", "montant", "commission", "frais de service de paiement", "net", "date du paiement", "identifiant du paiement"];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Colonnes Booking manquantes : ${missing.join(", ")}.`);

  const items = csv.slice(1).map((row, index) => {
    const type = field(row, headers, "type");
    const normalizedType = normalizeHeader(type);
    const reservationNumber = field(row, headers, "numero de reservation");
    const paymentDate = parseFrenchBookingDate(field(row, headers, "date du paiement"));
    const paymentId = field(row, headers, "identifiant du paiement");
    const gross = parseAmount(field(row, headers, "montant"));
    const commission = parseAmount(field(row, headers, "commission"));
    const paymentFee = parseAmount(field(row, headers, "frais de service de paiement"));
    const net = parseAmount(field(row, headers, "net"));
    const item = {
      line: index + 2,
      kind: normalizedType === "reservation" ? "reservation" : "adjustment",
      type,
      reservationNumber,
      arrivalDate: parseFrenchBookingDate(field(row, headers, "arrivee")),
      checkoutDate: parseFrenchBookingDate(field(row, headers, "checkout")),
      guestName: field(row, headers, "nom du client"),
      paymentProvider: field(row, headers, "prestataire de paiement"),
      bookingStatus: field(row, headers, "statut de la reservation"),
      currency: field(row, headers, "devise"),
      paymentStatus: field(row, headers, "statut du paiement"),
      gross, commission, paymentFee, net, paymentDate, paymentId,
    };
    item.expectedNet = Math.round((gross + commission + paymentFee) * 100) / 100;
    item.netDifference = Math.round((net - item.expectedNet) * 100) / 100;
    item.sourceRecordKeys = rowKeys(item);
    return item;
  });

  const totals = items.reduce((sum, item) => ({
    gross: sum.gross + item.gross,
    commission: sum.commission + item.commission,
    paymentFee: sum.paymentFee + item.paymentFee,
    net: sum.net + item.net,
  }), { gross: 0, commission: 0, paymentFee: 0, net: 0 });
  Object.keys(totals).forEach((key) => { totals[key] = Math.round(totals[key] * 100) / 100; });
  const payments = new Map();
  for (const item of items) {
    const key = item.paymentId || `date:${item.paymentDate}`;
    const current = payments.get(key) || { paymentId: item.paymentId, paymentDate: item.paymentDate, rows: 0, net: 0 };
    current.rows += 1; current.net = Math.round((current.net + item.net) * 100) / 100;
    payments.set(key, current);
  }
  return { items, totals, payments: [...payments.values()] };
}

export function markBookingDuplicates(statement, existingEntries = []) {
  const existing = new Set((existingEntries || []).filter((entry) => entry.source === "booking" && entry.source_record_key).map((entry) => entry.source_record_key));
  return {
    ...statement,
    items: statement.items.map((item) => ({ ...item, duplicate: item.sourceRecordKeys.some((key) => existing.has(key)) })),
  };
}

export function matchBookingStatementReservations(statement, externalReservations = [], bookingRequests = []) {
  const booking = (externalReservations || []).filter((reservation) => reservation.source === "booking");
  const persistedBooking = (bookingRequests || []).filter((reservation) => {
    const source = String(reservation.source || "").toLowerCase();
    return source === "booking_import" || source.startsWith("booking_");
  });
  const normalizeName = (value) => repairBookingText(String(value || ""))
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const requestGuestName = (reservation) =>
    normalizeName(`${reservation.guest_first_name || ""} ${reservation.guest_last_name || ""}`);

  return {
    ...statement,
    items: statement.items.map((item) => {
      if (item.kind !== "reservation" || !item.arrivalDate || !item.checkoutDate) {
        return { ...item, matchStatus: "not_applicable", matchedExternalUid: null, matchedBookingRequestId: null };
      }

      // Source de vérité prioritaire : les réservations Booking déjà enregistrées
      // durablement dans booking_requests. L'iCal courant n'est qu'un fallback.
      const dateMatches = persistedBooking.filter((reservation) =>
        String(reservation.start_date || "").slice(0, 10) === item.arrivalDate
        && String(reservation.end_date || "").slice(0, 10) === item.checkoutDate
      );
      const guest = normalizeName(item.guestName);
      const namedMatches = guest && dateMatches.length > 1
        ? dateMatches.filter((reservation) => requestGuestName(reservation) === guest)
        : dateMatches;
      const requestMatches = namedMatches.length ? namedMatches : dateMatches;

      if (requestMatches.length === 1) {
        return {
          ...item,
          matchStatus: "matched_persisted",
          matchedExternalUid: null,
          matchedBookingRequestId: requestMatches[0].id || null,
        };
      }
      if (requestMatches.length > 1) {
        return { ...item, matchStatus: "ambiguous", matchedExternalUid: null, matchedBookingRequestId: null };
      }

      const calendarMatches = booking.filter((reservation) =>
        String(reservation.start_date || "").slice(0, 10) === item.arrivalDate
        && String(reservation.end_date || "").slice(0, 10) === item.checkoutDate
      );
      return {
        ...item,
        matchStatus: calendarMatches.length === 1 ? "matched_calendar" : calendarMatches.length > 1 ? "ambiguous" : "not_found",
        matchedExternalUid: calendarMatches.length === 1 ? (calendarMatches[0].uid || calendarMatches[0].external_uid || null) : null,
        matchedBookingRequestId: null,
      };
    }),
  };
}
export function bookingStatementToEntries(statement, categories) {
  const categoryByCode = new Map((categories || []).map((category) => [category.code, category.id]));
  const entries = [];
  for (const item of statement.items.filter((row) => !row.duplicate)) {
    const group = `booking:payout:${item.paymentId || item.paymentDate}`;
    const common = {
      entry_date: item.paymentDate,
      source: "booking",
      operation_group_key: group,
      external_reference: item.reservationNumber || item.paymentId || null,
      booking_request_id: item.matchedBookingRequestId || null,
      counterparty: "Booking.com B.V.",
      payment_method: "Virement Booking",
      treatment: "current",
      metadata: {
        booking_type: item.type,
        reservation_number: item.reservationNumber || null,
        arrival_date: item.arrivalDate,
        checkout_date: item.checkoutDate,
        guest_name: item.guestName || null,
        payment_id: item.paymentId || null,
        payment_date: item.paymentDate,
        statement_net: item.net,
        external_calendar_uid: item.matchedExternalUid || null,
        booking_request_id: item.matchedBookingRequestId || null,
        reservation_match_status: item.matchStatus || null,
      },
    };
    if (item.kind === "reservation") {
      const root = `statement:reservation:${item.reservationNumber}:${item.paymentId || item.paymentDate}`;
      if (item.gross) entries.push({ ...common, entry_kind: "income", category_id: categoryByCode.get("rental_booking") || null, label: `Location Booking ${item.reservationNumber}`, amount_ttc: Math.abs(item.gross), source_record_key: `${root}:gross` });
      if (item.commission) entries.push({ ...common, entry_kind: "expense", category_id: categoryByCode.get("platform_fees") || null, label: `Commission Booking ${item.reservationNumber}`, amount_ttc: Math.abs(item.commission), source_record_key: `${root}:commission` });
      if (item.paymentFee) entries.push({ ...common, entry_kind: "expense", category_id: categoryByCode.get("payment_fees") || null, label: `Frais de paiement Booking ${item.reservationNumber}`, amount_ttc: Math.abs(item.paymentFee), source_record_key: `${root}:payment_fee` });
    } else if (item.net) {
      const key = item.sourceRecordKeys[0];
      entries.push({ ...common, entry_kind: item.net > 0 ? "income" : "expense", category_id: categoryByCode.get(item.net > 0 ? "other_income" : "platform_fees") || null, label: `${item.type || "Ajustement Booking"}${item.reservationNumber ? ` ${item.reservationNumber}` : ""}`, amount_ttc: Math.abs(item.net), source_record_key: key, metadata: { ...common.metadata, adjustment: true } });
    }
  }
  return entries;
}
