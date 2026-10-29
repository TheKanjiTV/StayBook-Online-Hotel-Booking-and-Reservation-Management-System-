import { Op, fn, col, literal } from 'sequelize';
import { Reservation } from '../models/bookingModel.js';
import { email, string, positiveId, fail } from '../services/validation.js';
import { hotelForRoom } from '../services/hotelCatalog.js';
const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
const status = value => value === 'CANCELLED' ? 'Cancelled' : value === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation';
export const adminGuestController = {
  list: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '', page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const where = q ? { email: { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` } } : {};
    const [count, groups] = await Promise.all([
      Reservation.count({ where, distinct: true, col: 'email' }),
      Reservation.findAll({ where, attributes: ['email', [fn('COUNT', col('reservation_id')), 'bookingCount'], [fn('MAX', col('reservation_id')), 'latestId'], [fn('MAX', col('check_in')), 'latestCheckIn'], [fn('SUM', literal("CASE WHEN status IN ('LOCAL_CONFIRMED','ADMIN_CONFIRMED') THEN total_amount ELSE 0 END")), 'bookingValue']], group: ['email'], order: [[fn('MAX', col('reservation_id')), 'DESC']], limit: 25, offset: (page - 1) * 25, raw: true }),
    ]);
    const profiles = groups.length ? await Reservation.findAll({ where: { reservation_id: groups.map(group => Number(group.latestId)) }, attributes: ['reservation_id', 'first_name', 'last_name', 'phone'] }) : [];
    const guests = groups.map(group => { const profile = profiles.find(row => row.reservation_id === Number(group.latestId)); return { ...group, firstName: profile?.first_name, lastName: profile?.last_name, phone: profile?.phone, value: php(group.bookingValue), historyUrl: `/admin/guests/history?${new URLSearchParams({ email: group.email })}` }; });
    const pages = Math.max(1, Math.ceil(count / 25)), link = target => `/admin/guests?${new URLSearchParams({ q, page: target })}`;
    res.render('admin-guests', { title: 'Guests | StayBook', q, count, guests, page, pages, previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
  history: async (req, res) => {
    const address = email(req.query.email), page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const [profile, result] = await Promise.all([
      Reservation.findOne({ where: { email: address }, attributes: ['first_name', 'last_name', 'email', 'phone'], order: [['reservation_id', 'DESC']] }),
      Reservation.findAndCountAll({ where: { email: address }, attributes: ['reservation_id', 'reference', 'room_id', 'room_type', 'check_in', 'check_out', 'total_amount', 'status'], order: [['reservation_id', 'DESC']], limit: 25, offset: (page - 1) * 25 }),
    ]);
    if (!profile) fail(404, 'Guest not found.');
    const pages = Math.max(1, Math.ceil(result.count / 25)), link = target => `/admin/guests/history?${new URLSearchParams({ email: address, page: target })}`;
    res.render('admin-guest-history', { title: 'Guest history | StayBook', profile: profile.toJSON(), count: result.count, bookings: result.rows.map(row => ({ ...row.toJSON(), hotelName: hotelForRoom(row.room_id)?.name, total: php(row.total_amount), statusLabel: status(row.status) })), newBookingUrl: `/admin/bookings/new?${new URLSearchParams({ guestEmail: address })}`, page, pages, previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
};
