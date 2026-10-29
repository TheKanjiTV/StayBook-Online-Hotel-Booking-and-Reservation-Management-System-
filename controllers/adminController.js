import { Op } from 'sequelize';
import { Reservation, Payment, BookingRoom } from '../models/bookingModel.js';
import { cancelBooking } from '../services/bookingService.js';
import { hotelForRoom } from '../services/hotelCatalog.js';
import { paymentLabel } from '../public/payment-methods.js';
import { positiveId, string, fail, today, validDate } from '../services/validation.js';
import { randomUUID } from 'node:crypto';
import { hotels } from '../services/hotelCatalog.js';
import { paymentMethods } from '../public/payment-methods.js';
import { Account } from '../models/accountModel.js';
import { AuditLog } from '../models/auditModel.js';
import { recordAudit, auditDisplay } from '../services/auditService.js';
import { confirmAdminBooking, updateAdminBooking, deleteAdminBooking, createAdminBooking } from '../services/adminBookingService.js';

const fields = ['reservation_id', 'reference', 'room_id', 'room_type', 'room_number', 'first_name', 'last_name', 'email', 'check_in', 'check_out', 'total_amount', 'status'];
const php = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(amount));
function display(row, locale) {
  const booking = row.toJSON();
  const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return { ...booking, hotelName: hotelForRoom(booking.room_id)?.name, checkIn: date(booking.check_in), checkOut: date(booking.check_out), total: php(booking.total_amount), cancelled: booking.status === 'CANCELLED', confirmed: booking.status === 'ADMIN_CONFIRMED', statusLabel: booking.status === 'CANCELLED' ? 'Cancelled' : booking.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation' };
}
export const adminController = {
  newBooking: async (req, res) => {
    const requestKey = randomUUID(), now = Date.now();
    req.session.adminBookingRequests = Object.fromEntries(Object.entries(req.session.adminBookingRequests || {}).filter(([, time]) => now - time < 7200000).slice(-19));
    req.session.adminBookingRequests[requestKey] = now;
    const checkIn = validDate(req.query.checkIn) ? req.query.checkIn : today(), checkOut = validDate(req.query.checkOut) ? req.query.checkOut : new Date(Date.parse(checkIn) + 86400000).toISOString().slice(0, 10);
    const roomId = req.query.roomId ? positiveId(req.query.roomId, 'room') : null;
    const [rooms, accounts] = await Promise.all([BookingRoom.findAll({ where: { is_published: true }, order: [['room_id', 'ASC']] }), Account.findAll({ where: { role: 'GUEST' }, attributes: ['account_id', 'first_name', 'last_name', 'email'], order: [['first_name', 'ASC']] })]);
    res.render('admin-booking-new', { title: 'Add booking | StayBook', adminTitle: 'Add booking', requestKey, checkIn, checkOut, today: today(), hotels, methods: paymentMethods, rooms: rooms.map(room => ({ ...room.toJSON(), hotelName: hotelForRoom(room.room_id)?.name, selected: room.room_id === roomId })), accounts: accounts.map(row => row.toJSON()) });
  },
  create: async (req, res) => {
    const key = req.body.requestKey, requests = req.session.adminBookingRequests || {};
    if (typeof key !== 'string' || !Object.hasOwn(requests, key) || Date.now() - requests[key] >= 7200000) fail(409, 'This booking form expired. Open a new booking form.');
    const booking = await createAdminBooking(req.body, req.account);
    res.json({ success: true, redirect: `/admin/bookings/${booking.reservation_id}`, reference: booking.reference });
  },
  dashboard: async (req, res) => {
    const [pending, cancelled, users, bookings, audits, confirmed] = await Promise.all([
      Reservation.count({ where: { status: 'LOCAL_CONFIRMED' } }), Reservation.count({ where: { status: 'CANCELLED' } }), Account.count(),
      Reservation.findAll({ attributes: fields, order: [['createdAt', 'DESC']], limit: 5 }), AuditLog.findAll({ order: [['audit_id', 'DESC']], limit: 5 }), Reservation.count({ where: { status: 'ADMIN_CONFIRMED' } }),
    ]);
    res.render('admin-dashboard', { title: 'Dashboard | StayBook', adminTitle: 'Dashboard', pending, confirmed, cancelled, users, bookings: bookings.map(row => display(row, res.locals.preferences.locale)), audits: audits.map(row => auditDisplay(row, res.locals.preferences.locale)) });
  },
  list: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '';
    const status = req.query.status || '';
    if (!['', 'LOCAL_CONFIRMED', 'ADMIN_CONFIRMED', 'CANCELLED'].includes(status)) fail(400, 'Choose a valid booking status.');
    const page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const where = status ? { status } : {};
    if (q) {
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where[Op.or] = ['reference', 'email', 'first_name', 'last_name'].map(field => ({ [field]: { [Op.like]: pattern } }));
    }
    const { count, rows } = await Reservation.findAndCountAll({ where, attributes: fields, order: [['createdAt', 'DESC'], ['reservation_id', 'DESC']], limit: 25, offset: (page - 1) * 25 });
    const pages = Math.max(1, Math.ceil(count / 25));
    const link = target => `/admin/bookings?${new URLSearchParams({ q, status, page: target })}`;
    res.render('admin', { title: 'Bookings | StayBook', adminTitle: 'Bookings', bookings: rows.map(row => display(row, res.locals.preferences.locale)), q, count, page, pages,
      activeSelected: status === 'LOCAL_CONFIRMED', confirmedSelected: status === 'ADMIN_CONFIRMED', cancelledSelected: status === 'CANCELLED', previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
  detail: async (req, res) => {
    const booking = await Reservation.findByPk(positiveId(req.params.id), { attributes: [...fields, 'phone', 'address', 'guests'] });
    if (!booking) fail(404, 'Booking not found.');
    const payment = await Payment.findOne({ where: { reservation_id: booking.reservation_id }, attributes: ['payment_method'], order: [['payment_id', 'ASC']] });
    res.render('admin-booking', { title: 'Booking details | StayBook', adminTitle: 'Booking details', booking: display(booking, res.locals.preferences.locale), paymentMethod: paymentLabel(payment?.payment_method) });
  },
  cancel: async (req, res) => {
    const id = positiveId(req.params.id);
    const booking = await Reservation.findByPk(id, { attributes: ['access_token'] });
    if (!booking) fail(404, 'Booking not found.');
    // Authorization is enforced by requireAdmin before this server-only token lookup.
    await cancelBooking(id, booking.access_token, { onChange: (row, transaction, before) => recordAudit(req.account, 'BOOKING_CANCELLED', 'BOOKING', id, row.reference, { status: { before, after: 'CANCELLED' } }, transaction) });
    res.json({ success: true, redirect: `/admin/bookings/${id}` });
  },
  edit: async (req, res) => {
    const booking = await Reservation.findByPk(positiveId(req.params.id), { attributes: [...fields, 'phone', 'address', 'guests', 'version'] });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.status === 'CANCELLED') fail(409, 'Cancelled bookings cannot be edited.');
    const rooms = await BookingRoom.findAll({ where: { [Op.or]: [{ is_published: true }, { room_id: booking.room_id }] }, order: [['room_id', 'ASC']] });
    res.render('admin-booking-edit', { title: 'Edit booking | StayBook', adminTitle: 'Edit booking', booking: booking.toJSON(), rooms: rooms.map(room => ({ ...room.toJSON(), hotelName: hotelForRoom(room.room_id)?.name, selected: room.room_id === booking.room_id })) });
  },
  update: async (req, res) => { const id = positiveId(req.params.id); await updateAdminBooking(id, req.body, req.account); res.json({ success: true, redirect: `/admin/bookings/${id}` }); },
  confirm: async (req, res) => { const id = positiveId(req.params.id); await confirmAdminBooking(id, req.account); res.json({ success: true, redirect: `/admin/bookings/${id}` }); },
  delete: async (req, res) => { await deleteAdminBooking(positiveId(req.params.id), req.account); res.json({ success: true, redirect: '/admin/bookings' }); },
  audit: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '';
    const page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const actionPattern = `%${q.replace(/\s+/g, '_').replace(/[\\%_]/g, '\\$&')}%`;
    const where = q ? { [Op.or]: ['action', 'actor_name', 'reference'].map(field => ({ [field]: { [Op.like]: field === 'action' ? actionPattern : pattern } })) } : {};
    const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['audit_id', 'DESC']], limit: 25, offset: (page - 1) * 25 });
    const pages = Math.max(1, Math.ceil(count / 25)), link = target => `/admin/audit-logs?${new URLSearchParams({ q, page: target })}`;
    res.render('admin-audit', { title: 'Audit logs | StayBook', adminTitle: 'Audit logs', q, count, page, pages, audits: rows.map(row => auditDisplay(row, res.locals.preferences.locale)), previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
};
