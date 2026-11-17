import assert from 'node:assert/strict';
import test from 'node:test';
import { RouterAdapterFactory } from './RouterAdapterFactory';
import {
  getVendorIntegration,
  validateRouterEndpointModel,
  VENDOR_INTEGRATIONS,
} from './integrationRegistry';

test('MikroTik and TP-Link Omada are registered as live adapters while other planned brands stay disabled', () => {
  assert.equal(RouterAdapterFactory.hasAdapter('MIKROTIK'), true);
  assert.equal(RouterAdapterFactory.hasAdapter('TPLINK_OMADA'), true);
  assert.equal(RouterAdapterFactory.hasAdapter('RUIJIE'), false);
  assert.equal(RouterAdapterFactory.hasAdapter('CUDY'), false);
});

test('vendor registry does not confuse planned brands with implemented drivers', () => {
  assert.equal(getVendorIntegration('mikrotik')?.status, 'IMPLEMENTED');
  assert.equal(getVendorIntegration('TPLINK_OMADA')?.status, 'IMPLEMENTED');
  assert.equal(getVendorIntegration('RUIJIE')?.status, 'PLANNED');
  assert.deepEqual(getVendorIntegration('RUIJIE')?.capabilities, []);
  assert.equal(VENDOR_INTEGRATIONS.length >= 6, true);
});

test('TP-Link Omada accepts only a TP-Link model on a controller-compatible endpoint category', () => {
  assert.deepEqual(
    validateRouterEndpointModel('TPLINK_OMADA', { brand: 'TP-Link', category: 'CONTROLLER' }),
    { valid: true },
  );
  assert.equal(
    validateRouterEndpointModel('TPLINK_OMADA', { brand: 'MikroTik', category: 'ROUTER' }).valid,
    false,
  );
  assert.equal(
    validateRouterEndpointModel('TPLINK_OMADA', { brand: 'TP-Link', category: 'ACCESS_POINT' }).valid,
    false,
  );
});

test('Ruijie and Reyee are recognized as one vendor family', () => {
  assert.deepEqual(
    validateRouterEndpointModel('RUIJIE', { brand: 'Reyee', category: 'GATEWAY' }),
    { valid: true },
  );
});
