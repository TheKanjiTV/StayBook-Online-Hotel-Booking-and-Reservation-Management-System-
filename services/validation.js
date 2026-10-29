import { createHash } from 'node:crypto';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const fail = (status, message) => { throw new HttpError(status, message); };
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function searchInput(body) {
  const checkIn = body.checkIn, checkOut = body.checkOut, guests = Number(body.guests);
  if (!validDate(checkIn) || !validDate(checkOut) || checkIn < today() || checkOut <= checkIn) fail(400, 'Choose valid dates: check-in must be today or later, and check-out after check-in.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 10) fail(400, 'Guests must be a whole number from 1 to 10.');
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
  if (nights > 365) fail(400, 'A reservation may not exceed 365 nights.');
  return { checkIn, checkOut, guests, nights };
}
export function string(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${label} is required (maximum ${max} characters).`);
  return value.trim();
}
export function email(value) {
  const result = string(value, 'Email', 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Enter a valid email address.');
  return result;
}
export function positiveId(value, label = 'ID') {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) fail(400, `Invalid ${label}.`);
  return result;
}
export function cents(value, label = 'Amount', allowZero = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value))) fail(400, `${label} must have at most two decimal places.`);
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1) || result > 99999999999) fail(400, `Invalid ${label}.`);
  return result;
}
export const amount = value => (value / 100).toFixed(2);
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function guestInput(body) {
  const phone = string(body.phone, 'Phone', 20);
  if (!/^[0-9+()\s-]{7,20}$/.test(phone)) fail(400, 'Enter a valid phone number.');
  return { first_name: string(body.firstName, 'First name'), last_name: string(body.lastName, 'Last name'), email: email(body.email), phone, address: typeof body.address === 'string' ? body.address.trim().slice(0, 1000) : '' };
}
export const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
