import test from 'node:test';
import assert from 'node:assert/strict';
import { getNonContractStripeFinancials } from '../src/utils/nonContractStripeFinancials.js';

test('includes paid cleaning and additional-charge payments kept outside booking aggregates', () => {
  const result = getNonContractStripeFinancials({
    payments: [
      { id:'p1', booking_request_id:null, manual_reason:'cleaning', status:'paid', amount:50 },
      { id:'p2', booking_request_id:null, manual_reason:'additional_charge', status:'paid', amount:37.5 },
      { id:'p3', booking_request_id:'b1', manual_reason:'manual', status:'paid', amount:99 },
      { id:'p4', booking_request_id:null, manual_reason:'additional_charge', status:'pending', amount:20 },
    ],
    stripeBalanceTransactions: [
      { payment_id:'p1', fee:1.1, net:48.9 },
      { payment_id:'p2', fee:0.9, net:36.6 },
      { payment_id:'p3', fee:2, net:97 },
    ],
  });
  assert.equal(result.gross, 87.5);
  assert.equal(result.fee, 2);
  assert.equal(result.net, 85.5);
});

test('does not double count unrelated or unpaid rows', () => {
  const result = getNonContractStripeFinancials({ payments: [], stripeBalanceTransactions: [{ payment_id:'x', fee:2, net:8 }] });
  assert.deepEqual(result, { gross:0, fee:0, net:0, paymentIds:[] });
});
