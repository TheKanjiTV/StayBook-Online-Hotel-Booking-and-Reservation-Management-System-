// Browser-only preview helpers. Card numbers must never enter booking payloads,
// sessions, storage or logs. Real processing requires a provider-hosted field.
export const cardDigits = value => String(value || '').replace(/\D/g, '').slice(0, 19);
export function cardBrand(value) {
  const digits = cardDigits(value);
  if (/^4/.test(digits)) return 'VISA';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'DISCOVER';
  const range = Number(digits.slice(0, 4));
  if (/^5[1-5]/.test(digits) || (digits.length >= 4 && range >= 2221 && range <= 2720)) return 'MASTERCARD';
  return null;
}
export const formatCardNumber = value => cardDigits(value).replace(/(.{4})/g, '$1 ').trim();
export function validCardNumber(value) {
  const digits = cardDigits(value), brand = cardBrand(digits);
  const lengths = { VISA: [13, 16, 19], MASTERCARD: [16], AMEX: [15], DISCOVER: [16, 19] };
  if (!brand || !lengths[brand].includes(digits.length)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--, double = !double) {
    let number = Number(digits[i]); if (double) { number *= 2; if (number > 9) number -= 9; } sum += number;
  }
  return sum % 10 === 0;
}
export const formatExpiry = value => String(value || '').replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2');
export function validExpiry(value, now = new Date()) {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]), year = 2000 + Number(match[2]);
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Manila' }).formatToParts(now);
  const currentYear = Number(parts.find(part => part.type === 'year').value), currentMonth = Number(parts.find(part => part.type === 'month').value);
  return month >= 1 && month <= 12 && (year > currentYear || year === currentYear && month >= currentMonth);
}
export const validSecurityCode = (value, brand) => (brand === 'AMEX' ? /^\d{4}$/ : /^\d{3}$/).test(value);
