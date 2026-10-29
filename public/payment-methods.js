// Selectable demo methods only. No SDK, authorization or real charge is performed.
export const paymentMethods = [
  { id: 'GCASH', label: 'GCash', kind: 'E-wallet', logo: 'gcash.svg' },
  { id: 'MAYA', label: 'Maya', kind: 'E-wallet', logo: 'maya.svg' },
  { id: 'APPLE_PAY', label: 'Apple Pay', kind: 'Digital wallet', logo: 'apple-pay.svg' },
  { id: 'GOOGLE_PAY', label: 'Google Pay', kind: 'Digital wallet', logo: 'google-pay.png' },
  { id: 'VISA', label: 'Visa', kind: 'Card', logo: 'visa.svg' },
  { id: 'MASTERCARD', label: 'Mastercard', kind: 'Card', logo: 'mastercard.svg' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer', kind: 'Bank', logo: 'bank-transfer.svg' },
];
export const paymentLabel = id => paymentMethods.find(method => method.id === id)?.label || 'Payment preference';
