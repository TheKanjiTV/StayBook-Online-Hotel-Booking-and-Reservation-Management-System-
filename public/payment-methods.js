// Selectable demo methods only. No SDK, authorization or real charge is performed.
export const paymentMethods = [
  { id: 'APPLE_PAY', label: 'Apple Pay', kind: 'Digital wallet', logo: 'apple-pay.svg' },
  { id: 'GOOGLE_PAY', label: 'Google Pay', kind: 'Digital wallet', logo: 'google-pay.svg' },
  { id: 'VISA', label: 'Visa', kind: 'Card', logo: 'visa.svg' },
  { id: 'MASTERCARD', label: 'Mastercard', kind: 'Card', logo: 'mastercard.svg' },
  { id: 'AMEX', label: 'American Express', kind: 'Card', logo: 'amex.svg' },
  { id: 'DISCOVER', label: 'Discover', kind: 'Card', logo: 'discover.svg' },
];
// Retain text labels for bookings created before these methods were removed.
const previousMethods = { GCASH: 'GCash', MAYA: 'Maya', BANK_TRANSFER: 'Bank transfer' };
export const paymentLabel = id => paymentMethods.find(method => method.id === id)?.label || previousMethods[id] || 'Payment preference';
