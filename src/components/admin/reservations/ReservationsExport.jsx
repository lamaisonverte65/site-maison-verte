import {
  formatDate,
  formatMoney,
  getAmounts,
  getRequestName,
  normalizeSource,
  shortId,
} from "../../../utils/adminFormatters";

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(reservations) {
  const headers = [
    "N° réservation",
    "Client",
    "Source",
    "Début séjour",
    "Fin séjour",
    "Statut",
    "Total séjour",
    "Total payé",
    "Email",
    "Téléphone",
  ];

  const rows = reservations.map((reservation) => {
    const amounts = getAmounts(reservation);
    return [
      shortId(reservation.id),
      getRequestName(reservation),
      normalizeSource(reservation.source || "Direct"),
      formatDate(reservation.start_date),
      formatDate(reservation.end_date),
      reservation.status || "pending",
      formatMoney(amounts.total),
      formatMoney(amounts.paid),
      reservation.guest_email || "",
      reservation.guest_phone || "",
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
}

export function exportReservationsCsv(reservations, filename = "reservations.csv") {
  if (!reservations.length) {
    alert("Aucune réservation à exporter.");
    return;
  }

  const csv = buildCsv(reservations);
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReservationsExport({ reservations }) {
  return (
    <button type="button" onClick={() => exportReservationsCsv(reservations)}>
      Export CSV
    </button>
  );
}
