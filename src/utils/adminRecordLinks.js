// Use exact foreign keys first, then a UNIQUE contact match. Never infer an
// identity using names alone: requester, travellers and payers can differ.
const email = (v) => String(v || "").trim().toLowerCase();
const phone = (v) => String(v || "").replace(/\D/g, "");

export function resolveCustomerForBooking(customers = [], booking) {
  if (!booking) return null;
  if (booking.customer_id) {
    return customers.find((customer) => String(customer.id) === String(booking.customer_id)) || null;
  }
  const requestedEmail = email(booking.guest_email);
  if (requestedEmail) {
    const matches = customers.filter((customer) => email(customer.email) === requestedEmail);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  const requestedPhone = phone(booking.guest_phone);
  if (requestedPhone) {
    const matches = customers.filter((customer) => phone(customer.phone) === requestedPhone);
    if (matches.length === 1) return matches[0];
  }
  return null;
}
