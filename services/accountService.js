import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Account, AccountBooking } from '../models/accountModel.js';
import { Reservation } from '../models/bookingModel.js';
import { email, string, fail } from './validation.js';
import { hotelForRoom } from './hotelCatalog.js';
const scrypt = promisify(scryptCallback);
const safe = row => row ? { id: row.account_id, firstName: row.first_name, lastName: row.last_name, email: row.email, role: row.role } : null;
const attempts = new Map();
export function limitAuth(ip) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const item = attempts.get(ip) || { count: 0, until: now + 900000 };
  attempts.set(ip, item);
  if (++item.count > 20) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
}
export async function register(body) {
  const first_name = string(body.firstName, 'First name'), last_name = string(body.lastName, 'Last name'), address = email(body.email);
  if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) fail(400, 'Use a password with 10–128 characters.');
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(body.password, salt, 64);
  try { return safe(await Account.create({ first_name, last_name, email: address, password_hash: `${salt}:${digest.toString('hex')}` })); }
  catch (error) { if (error.name === 'SequelizeUniqueConstraintError') fail(409, 'Unable to create this account. Try signing in or use another email.'); throw error; }
}
export async function authenticate(body) {
  const identifier = string(body.email, 'Email or username', 255).toLowerCase();
  const message = 'Email, username or password is incorrect.';
  if (typeof body.password !== 'string' || body.password.length > 128) fail(401, message);
  const field = identifier.includes('@') ? 'email' : 'username';
  if (field === 'email') email(identifier);
  else if (!/^[a-z0-9][a-z0-9_.-]{1,99}$/.test(identifier)) fail(401, message);
  const account = await Account.findOne({ where: { [field]: identifier } });
  const [salt, stored] = (account?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const digest = await scrypt(body.password, salt, 64);
  if (!account || !timingSafeEqual(digest, Buffer.from(stored, 'hex'))) fail(401, message);
  return safe(account);
}
export async function accountFor(id) { return id ? safe(await Account.findByPk(id)) : null; }
export async function accountBookings(id) {
  const links = await AccountBooking.findAll({ where: { account_id: id }, attributes: ['reservation_id'] });
  if (!links.length) return [];
  const bookings = await Reservation.findAll({ where: { reservation_id: links.map(link => link.reservation_id) },
    attributes: ['reservation_id', 'reference', 'room_id', 'room_type', 'check_in', 'check_out', 'total_amount', 'status'], order: [['created_at', 'DESC']] });
  return bookings.map(booking => ({ ...booking.toJSON(), hotelName: hotelForRoom(booking.room_id)?.name }));
}
