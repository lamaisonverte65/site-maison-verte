import { emailAutomationAllowed, emailAutomationSkippedResponse } from './_lib/email-delivery-policy.js';
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { resendEmail } from './_lib/resend-email.js';
import { runFailedEmailRetryBatch } from './_lib/email-retry-core.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function runFailedEmailRetry() {
  return runFailedEmailRetryBatch({ supabase, sendEmail: resendEmail });
}

export const handler = schedule('*/15 * * * *', async () => {
  if (!emailAutomationAllowed()) return emailAutomationSkippedResponse();
  try {
    const result = await runFailedEmailRetry();
    console.log('Retry emails échoués :', result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Erreur retry emails :', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
});
