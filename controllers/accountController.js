import { register, authenticate, accountFor, accountBookings, limitAuth } from '../services/accountService.js';
import { AccountBooking, Notification } from '../models/accountModel.js';
import { Reservation } from '../models/bookingModel.js';
import { fail, positiveId } from '../services/validation.js';
async function startSession(req, account) {
  const { bookingPreview, bookingId, bookingToken, language, currency } = req.session;
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  Object.assign(req.session, { accountId: account.id, bookingPreview, bookingId, bookingToken, language, currency });
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
export async function accountContext(req, res, next) {
  try { req.account = await accountFor(req.session.accountId); res.locals.account = req.account; res.locals.isAdmin = req.account?.role === 'ADMIN'; next(); } catch (error) { next(error); }
}
export function requireAccount(req, res, next) { if (!req.account) return next(Object.assign(new Error('Sign in to continue.'), { status: 401 })); next(); }
export function requireAdmin(req, res, next) {
  if (!req.account) return req.path.startsWith('/api/') ? next(Object.assign(new Error('Sign in to continue.'), { status: 401 })) : res.redirect('/sign-in');
  if (req.account.role !== 'ADMIN') return next(Object.assign(new Error('Administrator access is required.'), { status: 403 }));
  next();
}
const accountHome = account => account.role === 'ADMIN' ? '/admin' : '/account';
export const accountController = {
  signIn: (req, res) => req.account ? res.redirect(accountHome(req.account)) : res.render('auth', { title: 'Sign in | StayBook' }),
  join: (req, res) => req.account ? res.redirect(accountHome(req.account)) : res.render('auth', { title: 'Create account | StayBook', joining: true }),
  page: (req, res) => !req.account ? res.redirect('/sign-in') : req.account.role === 'ADMIN' ? res.redirect('/admin') : res.render('account', { title: 'My StayBook', account: req.account }),
  register: async (req, res) => { limitAuth(req.ip); const account = await register(req.body); await startSession(req, account); res.json({ success: true, redirect: req.session.bookingPreview ? '/confirmation' : '/account' }); },
  signInApi: async (req, res) => { limitAuth(req.ip); const account = await authenticate(req.body); await startSession(req, account); res.json({ success: true, redirect: account.role === 'ADMIN' ? '/admin' : req.session.bookingPreview ? '/confirmation' : '/account' }); },
  signOut: async (req, res) => { await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve())); res.clearCookie('staybook.sid'); res.json({ success: true, redirect: '/' }); },
  bookings: async (req, res) => res.json({ success: true, bookings: await accountBookings(req.account.id) }),
  notifications: async (req, res) => {
    const notifications = await Notification.findAll({ where: { account_id: req.account.id }, attributes: ['notification_id', 'reservation_id', 'reference', 'kind', 'read_at', 'created_at'], order: [['created_at', 'DESC'], ['notification_id', 'DESC']], limit: 25 });
    const unread = await Notification.count({ where: { account_id: req.account.id, read_at: null } });
    res.json({ success: true, notifications, unread });
  },
  readNotifications: async (req, res) => {
    const where = { account_id: req.account.id, read_at: null };
    if (req.body.notificationId !== undefined) where.notification_id = positiveId(req.body.notificationId);
    await Notification.update({ read_at: new Date() }, { where });
    res.json({ success: true });
  },
  openBooking: async (req, res) => {
    const id = positiveId(req.body.reservationId);
    const link = await AccountBooking.findOne({ where: { account_id: req.account.id, reservation_id: id } });
    if (!link) fail(404, 'Booking not found.');
    const booking = await Reservation.findByPk(id);
    if (!booking) fail(404, 'Booking not found.');
    req.session.bookingId = id; req.session.bookingToken = booking.access_token;
    res.json({ success: true, redirect: '/confirmation' });
  },
};
