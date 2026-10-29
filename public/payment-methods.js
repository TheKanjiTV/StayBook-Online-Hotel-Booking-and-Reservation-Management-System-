// Selectable demo methods only. No SDK, authorization or real charge is performed.
export const paymentMethods = [
  { id: 'GCASH', label: 'GCash', kind: 'E-wallet' },
  { id: 'MAYA', label: 'Maya', kind: 'E-wallet' },
  { id: 'APPLE_PAY', label: 'Apple Pay', kind: 'Digital wallet' },
  { id: 'GOOGLE_PAY', label: 'Google Pay', kind: 'Digital wallet' },
  { id: 'VISA', label: 'Visa', kind: 'Card' },
  { id: 'MASTERCARD', label: 'Mastercard', kind: 'Card' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer', kind: 'Bank' },
];
export const paymentLabel = id => paymentMethods.find(method => method.id === id)?.label || 'Demo payment';
