// Date comptable des mouvements Stripe Direct : jour civil en France.
// Les dates SQL de type DATE (YYYY-MM-DD) sont déjà des dates civiles.
// Pour un horodatage, un fuseau explicite (Z ou +HH:MM) est obligatoire.
const PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function accountingParisDate(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text ? text : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)
    || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return null;
  const instant = new Date(text);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = PARIS.formatToParts(instant);
  const part = (name) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
