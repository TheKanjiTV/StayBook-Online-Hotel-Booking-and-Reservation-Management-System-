import test from 'node:test';
import assert from 'node:assert/strict';
import { cardBrand, formatCardNumber, validCardNumber, formatExpiry, validExpiry, validSecurityCode } from '../public/card.js';
// Published test fixtures: https://docs.stripe.com/testing#cards
test('Card preview distinguishes Visa and both Mastercard ranges', () => {
  assert.equal(cardBrand('4'), 'VISA');
  for (const value of ['51', '55', '2221', '2720']) assert.equal(cardBrand(value), 'MASTERCARD');
  assert.equal(cardBrand('3782'), 'AMEX'); assert.equal(cardBrand('6011'), 'DISCOVER');
  for (const value of ['', '50', '56', '2220', '2721', '35']) assert.equal(cardBrand(value), null);
});
test('Card preview validates length/checksum and formats test input', () => {
  for (const value of ['4242424242424242', '5555555555554444', '2223003122003222', '378282246310005', '6011111111111117']) assert.equal(validCardNumber(value), true);
  for (const value of ['', '4242', '4242424242424241', '0000000000000000']) assert.equal(validCardNumber(value), false);
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
});
test('Expiration respects month boundaries and security-code length follows the card', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  assert.equal(formatExpiry('1234'), '12/34');
  for (const value of ['10/26', '11/26', '01/27']) assert.equal(validExpiry(value, now), true);
  for (const value of ['09/26', '13/27', '00/30', '1/30', '12/']) assert.equal(validExpiry(value, now), false);
  assert.equal(validSecurityCode('123', 'VISA'), true); assert.equal(validSecurityCode('1234', 'VISA'), false);
  assert.equal(validSecurityCode('1234', 'AMEX'), true); assert.equal(validSecurityCode('123', 'AMEX'), false);
});
