import test from 'node:test';
import assert from 'node:assert/strict';
import { cardBrand, formatCardNumber, validCardNumber } from '../public/card.js';
// Published test fixtures: https://docs.stripe.com/testing#cards
test('Card preview distinguishes Visa and both Mastercard ranges', () => {
  assert.equal(cardBrand('4'), 'VISA');
  for (const value of ['51', '55', '2221', '2720']) assert.equal(cardBrand(value), 'MASTERCARD');
  for (const value of ['', '50', '56', '2220', '2721', '6011', '3782']) assert.equal(cardBrand(value), null);
});
test('Card preview validates length/checksum and formats test input', () => {
  for (const value of ['4242424242424242', '5555555555554444', '2223003122003222']) assert.equal(validCardNumber(value), true);
  for (const value of ['', '4242', '4242424242424241', '6011111111111117', '0000000000000000']) assert.equal(validCardNumber(value), false);
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
});
