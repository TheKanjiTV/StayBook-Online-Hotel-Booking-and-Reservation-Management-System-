import { register, authenticate, accountFor, accountBookings, limitAuth } from '../services/accountService.js';
import { AccountBooking } from '../models/accountModel.js';
import { Reservation } from '../models/bookingModel.js';
import { fail, positiveId } from '../services/validation.js';
async function startSession(req, account) {
  const { bookingPreview, bookingId, bookingToken, language, currency } = req.session;
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  Object.assign(req.session, { accountId: account.id, bookingPreview, bookingId, bookingToken, language, currency });
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
export async function accountContext(req, res, next) {
  try { req.account = await accountFor(req.session.accountId); res.locals.account = req.account; next(); } catch (error) { next(error); }
}
export function requireAccount(req, res, next) { if (!req.account) return next(Object.assign(new Error('Sign in to continue.'), { status: 401 })); next(); }
export const accountController = {
  signIn: (req, res) => req.account ? res.redirect('/account') : res.render('auth', { title: 'Sign in | StayBook' }),
  join: (req, res) => req.account ? res.redirect('/account') : res.render('auth', { title: 'Create account | StayBook', joining: true }),
  page: (req, res) => req.account ? res.render('account', { title: 'My StayBook', account: req.account }) : res.redirect('/sign-in'),
  register: async (req, res) => { limitAuth(req.ip); const account = await register(req.body); await startSession(req, account); res.json({ success: true, redirect: req.session.bookingPreview ? '/confirmation' : '/account' }); },
  signInApi: async (req, res) => { limitAuth(req.ip); const account = await authenticate(req.body); await startSession(req, account); res.json({ success: true, redirect: req.session.bookingPreview ? '/confirmation' : '/account' }); },
  signOut: async (req, res) => { await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve())); res.clearCookie('staybook.sid'); res.json({ success: true, redirect: '/' }); },
  bookings: async (req, res) => res.json({ success: true, bookings: await accountBookings(req.account.id) }),
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
