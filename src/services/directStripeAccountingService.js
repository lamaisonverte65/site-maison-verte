import { supabase } from '../supabaseClient';

async function callDirectStripeAccounting(year, paymentIds = null) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('Session propriétaire absente.');
  const isPost = paymentIds !== null;
  const response = await fetch(`/.netlify/functions/admin-direct-stripe-accounting${isPost ? '' : `?year=${Number(year)}`}`, {
    method: isPost ? 'POST' : 'GET',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(isPost ? { 'Content-Type': 'application/json' } : {}) },
    ...(isPost ? { body: JSON.stringify({ year: Number(year), paymentIds }) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Impossible de contrôler les paiements directs.');
  if (Number(payload.year) !== Number(year) || !Array.isArray(payload.rows)) throw new Error('Réponse Stripe incohérente.');
  return payload;
}
export const previewDirectStripeAccounting = (year) => callDirectStripeAccounting(year);
export const commitDirectStripeAccounting = (year, paymentIds) => callDirectStripeAccounting(year, paymentIds);
