import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isPaymentSimulationAllowed } from './paymentSafety';
import {
  AzamPayGateway,
  UnauthorizedWebhookError,
  WebhookNotConfiguredError,
} from './AzamPayGateway';

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
  assert.throws(() => gateway.verifyWebhook({ status: 'success', amount: 100 }), WebhookNotConfiguredError);
});

test('verifyWebhook rejects missing or mismatched HMAC signature', () => {
  const gateway = new AzamPayGateway({ webhookSecret: 'super-secret-key-123' });
  const payload = { utilityref: 'POAF-1', transactionstatus: 'success', amount: 1000 };

  assert.throws(() => gateway.verifyWebhook(payload, undefined), UnauthorizedWebhookError);
  assert.throws(() => gateway.verifyWebhook(payload, 'deadbeef'), UnauthorizedWebhookError);
});

test('verifyWebhook accepts valid HMAC-SHA256 signature and parses status', () => {
  const secret = 'super-secret-key-123';
  const gateway = new AzamPayGateway({ webhookSecret: secret });
  const payload = { utilityref: 'POAF-99', transactionstatus: 'success', amount: 2500, transactionId: 'TX-9' };
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const res = gateway.verifyWebhook(payload, `sha256=${sig}`, { rawBody });
  assert.equal(res.reference, 'POAF-99');
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.amount, 2500);
  assert.equal(res.externalId, 'TX-9');
});
