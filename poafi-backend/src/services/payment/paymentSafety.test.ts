import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaymentSimulationAllowed } from './paymentSafety';
import { AzamPayGateway } from './AzamPayGateway';

test('simulation is disabled by default', () => {
  assert.equal(isPaymentSimulationAllowed('development', false, false), false);
});

test('simulation can be enabled explicitly in development', () => {
  assert.equal(isPaymentSimulationAllowed('development', true, false), true);
});

test('simulation is never allowed in production', () => {
  assert.equal(isPaymentSimulationAllowed('production', true, false), false);
});

test('simulation is never allowed when live payments are selected', () => {
  assert.equal(isPaymentSimulationAllowed('development', true, true), false);
});

test('unverified callback payloads are rejected', () => {
  const gateway = new AzamPayGateway();
  assert.throws(() => gateway.verifyWebhook({ status: 'success', amount: 100 }), /verification is not configured/);
});
