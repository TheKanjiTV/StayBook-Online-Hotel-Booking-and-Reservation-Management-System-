// Browser-only preview helpers. Card numbers must never enter booking payloads,
// sessions, storage or logs. Real processing requires a provider-hosted field.
export const cardDigits = value => String(value || '').replace(/\D/g, '').slice(0, 19);
export function cardBrand(value) {
  const digits = cardDigits(value);
  if (/^4/.test(digits)) return 'VISA';
  const range = Number(digits.slice(0, 4));
  if (/^5[1-5]/.test(digits) || (digits.length >= 4 && range >= 2221 && range <= 2720)) return 'MASTERCARD';
  return null;
}
export const formatCardNumber = value => cardDigits(value).replace(/(.{4})/g, '$1 ').trim();
export function validCardNumber(value) {
  const digits = cardDigits(value), brand = cardBrand(digits);
  if (!brand || !(brand === 'VISA' ? [13, 16, 19].includes(digits.length) : digits.length === 16)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--, double = !double) {
    let number = Number(digits[i]); if (double) { number *= 2; if (number > 9) number -= 9; } sum += number;
  }
  return sum % 10 === 0;
}
