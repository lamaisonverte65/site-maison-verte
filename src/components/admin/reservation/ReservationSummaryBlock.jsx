import { normalizeGuestLanguage } from "../../../../shared/guestLocale.js";
import { formatDate, formatMoney, normalizeSource } from "../../../utils/adminFormatters";
import { toPaymentView } from "../../../utils/paymentViewAdapter";

const LANGUAGE_LABELS = { fr: "Français", en: "English", es: "Español" };

function bookingSourceLabel(reservation) {
  const source = String(reservation?.source || "").toLowerCase();
  if (source === "admin_personal") return "Personnelle";
  if (source === "admin_client") return "Directe · admin";
  return normalizeSource(reservation?.source || "site");
}

export default function ReservationSummaryBlock({ reservation, amounts }) {
  const payment = toPaymentView(reservation, amounts);
  // Snapshot postal de la réservation : ne pas le remplacer par l'adresse CRM actuelle.
  const postalAddress = [
    reservation.guest_address,
    reservation.guest_postal_code,
    reservation.guest_city,
    reservation.guest_country,
  ].map((value) => String(value ?? "").trim()).filter(Boolean).join(", ") || "–";
  const items = [
    ["Origine", bookingSourceLabel(reservation)],
    ["Arrivée", formatDate(reservation.start_date)],
    ["Départ", formatDate(reservation.end_date)],
    ["Nuits", reservation.nights ?? "–"],
    ["Adresse", postalAddress],
    ["Total séjour", formatMoney(payment.total)],
    ["Payé", formatMoney(payment.paid)],
    ["Reste à encaisser", formatMoney(payment.remaining)],
    ["Langue des emails", LANGUAGE_LABELS[normalizeGuestLanguage(reservation.communication_language)]],
  ];

  return (
    <section className="reservation-sheet-summary" aria-label="Synthèse de la réservation">
      <div className="reservation-summary-grid">
        {items.map(([label, value]) => (
          <div className="reservation-summary-item" key={label}>
            <span>{label}</span>
            <strong>{value ?? "–"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
