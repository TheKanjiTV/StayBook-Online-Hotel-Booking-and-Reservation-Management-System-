import { amount, cents } from './validation.js';

const includedGuests = 2;
const extraGuestCents = 100000;

export function quoteStay(baseRate, { guests, nights }) {
  const extra = Math.max(0, guests - includedGuests) * extraGuestCents;
  const nightly = cents(baseRate) + extra;
  return { nightlyRate: amount(nightly), extraGuestNightly: amount(extra), total: amount(nightly * nights) };
}
