// Routage financier à partir de la nature du paiement confirmé.
import { syncAutoDirectStripeAccounting } from './auto-direct-stripe-accounting.js';
import { syncAutoSpecialStripeAccounting } from './auto-special-stripe-accounting.js';
export async function syncStripePaymentAccounting(supabase, options = {}) {
  const query = supabase.from('payments').select('id,payment_type');
  const result = options.paymentId ? await query.eq('id',options.paymentId).maybeSingle()
    : options.checkoutSessionId ? await query.eq('stripe_checkout_session_id',options.checkoutSessionId).maybeSingle()
    : {data:null,error:null};
  if (result.error) throw result.error;
  if (!result.data) return { outcome:'not_found' };
  const resolved = {paymentId:result.data.id};
  return result.data.payment_type === 'manual'
    ? syncAutoSpecialStripeAccounting(supabase,resolved)
    : syncAutoDirectStripeAccounting(supabase,resolved);
}
