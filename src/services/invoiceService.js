import { supabase } from "../supabaseClient";

async function authHeaders(json = false) {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail || "Erreur facturation.");
  return payload;
}

export async function createDirectInvoiceDraft(bookingRequestId) {
  const response = await fetch("/.netlify/functions/create-direct-invoice-draft", {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({ bookingRequestId }),
  });
  return readJson(response);
}

export async function createBookingInvoiceDraft(bookingRequestId) {
  const response = await fetch("/.netlify/functions/create-booking-invoice-draft", {
    method: "POST", headers: await authHeaders(true),
    body: JSON.stringify({ bookingRequestId }),
  });
  return readJson(response);
}

export async function updateInvoiceCustomerSnapshot(invoiceId, customerSnapshot) {
  const { data, error } = await supabase
    .from("customer_invoices")
    .update({ customer_snapshot: customerSnapshot, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function issueInvoice(invoiceId) {
  const { data, error } = await supabase.rpc("admin_issue_customer_invoice", { p_invoice_id: invoiceId });
  if (error) throw error;
  return data;
}

export async function archiveInvoicePdf(invoiceId) {
  const response = await fetch("/.netlify/functions/archive-customer-invoice-pdf", {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({ invoiceId }),
  });
  return readJson(response);
}

export async function openInvoicePreviewPdf(invoiceId) {
  const response = await fetch(`/.netlify/functions/preview-customer-invoice-pdf?invoiceId=${encodeURIComponent(invoiceId)}`, {
    headers: await authHeaders(false),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Aperçu PDF indisponible.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openInvoicePdf(invoiceId) {
  const response = await fetch(`/.netlify/functions/get-customer-invoice-pdf?invoiceId=${encodeURIComponent(invoiceId)}`, {
    headers: await authHeaders(false),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "PDF indisponible.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function updateLegacyInvoiceFinancialSnapshot(invoice, values) {
  if (invoice?.status !== "draft" || invoice?.financial_snapshot?.draft_origin !== "legacy_direct_manual") throw new Error("Brouillon historique requis.");
  const n = (v) => v === "" || v == null ? null : Number(v);
  const accommodationNet = n(values.accommodation_net), cleaningFee = n(values.cleaning_fee), touristTax = n(values.tourist_tax_amount);
  if (![accommodationNet, cleaningFee, touristTax].every((v) => Number.isFinite(v) && v >= 0)) throw new Error("Renseigne hébergement net, ménage et taxe de séjour (0 si aucun montant).");
  const referenceTotal = Number(invoice.financial_snapshot.legacy_reference_total);
  const computed = Math.round((accommodationNet + cleaningFee + touristTax) * 100) / 100;
  if (Math.abs(computed - referenceTotal) > 0.009) throw new Error(`Le détail doit totaliser ${referenceTotal.toFixed(2)} € (actuellement ${computed.toFixed(2)} €).`);
  const financial = { ...invoice.financial_snapshot, accommodation_gross: n(values.accommodation_gross), promotion_discount_amount: n(values.promotion_discount_amount) || 0, accommodation_net: accommodationNet, cleaning_fee: cleaningFee, tourist_tax_amount: touristTax, contract_total: referenceTotal, invoice_ready: true };
  const { data, error } = await supabase.from("customer_invoices").update({ financial_snapshot: financial, total_amount: referenceTotal, updated_at: new Date().toISOString() }).eq("id", invoice.id).eq("status", "draft").select("*").single();
  if (error) throw error;
  return data;
}
