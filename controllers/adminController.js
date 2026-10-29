import { Op } from 'sequelize';
import { Reservation, Payment } from '../models/bookingModel.js';
import { cancelBooking } from '../services/bookingService.js';
import { hotelForRoom } from '../services/hotelCatalog.js';
import { paymentLabel } from '../public/payment-methods.js';
import { positiveId, string, fail } from '../services/validation.js';
import { Account } from '../models/accountModel.js';
import { AuditLog } from '../models/auditModel.js';
import { recordAudit, auditDisplay } from '../services/auditService.js';

const fields = ['reservation_id', 'reference', 'room_id', 'room_type', 'room_number', 'first_name', 'last_name', 'email', 'check_in', 'check_out', 'total_amount', 'status'];
const php = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(amount));
function display(row, locale) {
  const booking = row.toJSON();
  const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return { ...booking, hotelName: hotelForRoom(booking.room_id)?.name, checkIn: date(booking.check_in), checkOut: date(booking.check_out), total: php(booking.total_amount), cancelled: booking.status === 'CANCELLED' };
}
export const adminController = {
  dashboard: async (req, res) => {
    const [pending, cancelled, users, bookings, audits] = await Promise.all([
      Reservation.count({ where: { status: 'LOCAL_CONFIRMED' } }), Reservation.count({ where: { status: 'CANCELLED' } }), Account.count(),
      Reservation.findAll({ attributes: fields, order: [['createdAt', 'DESC']], limit: 5 }), AuditLog.findAll({ order: [['audit_id', 'DESC']], limit: 5 }),
    ]);
    res.render('admin-dashboard', { title: 'Dashboard | StayBook', adminTitle: 'Dashboard', pending, cancelled, users, bookings: bookings.map(row => display(row, res.locals.preferences.locale)), audits: audits.map(row => auditDisplay(row, res.locals.preferences.locale)) });
  },
  list: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '';
    const status = req.query.status || '';
    if (!['', 'LOCAL_CONFIRMED', 'CANCELLED'].includes(status)) fail(400, 'Choose a valid booking status.');
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
      activeSelected: status === 'LOCAL_CONFIRMED', cancelledSelected: status === 'CANCELLED', previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
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
    await cancelBooking(id, booking.access_token, { onChange: (row, transaction) => recordAudit(req.account, 'BOOKING_CANCELLED', 'BOOKING', id, row.reference, { status: { before: 'LOCAL_CONFIRMED', after: 'CANCELLED' } }, transaction) });
    res.json({ success: true, redirect: `/admin/bookings/${id}` });
  },
  audit: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '';
    const page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const where = q ? { [Op.or]: ['action', 'actor_name', 'reference'].map(field => ({ [field]: { [Op.like]: pattern } })) } : {};
    const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['audit_id', 'DESC']], limit: 25, offset: (page - 1) * 25 });
    const pages = Math.max(1, Math.ceil(count / 25)), link = target => `/admin/audit-logs?${new URLSearchParams({ q, page: target })}`;
    res.render('admin-audit', { title: 'Audit logs | StayBook', adminTitle: 'Audit logs', q, count, page, pages, audits: rows.map(row => auditDisplay(row, res.locals.preferences.locale)), previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
};
