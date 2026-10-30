import { Op, fn, col } from 'sequelize';
import { Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { hotels, hotelForRoom } from './hotelCatalog.js';
import { today, validDate, positiveId, fail } from './validation.js';
export function reportFilters(query) {
  const current = today(), from = query.from || `${current.slice(0, 7)}-01`, to = query.to || new Date(Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0)).toISOString().slice(0, 10);
  if (!validDate(from) || !validDate(to) || to < from || Date.parse(to) - Date.parse(from) > 365 * 86400000) fail(400, 'Choose a valid report range of up to 366 days.');
  const end = new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10);
  if (!validDate(end)) fail(400, 'Choose a valid report range of up to 366 days.');
  const hotelId = query.hotelId ? positiveId(query.hotelId, 'hotel') : null, hotel = hotelId ? hotels.find(item => item.id === hotelId) : null;
  if (hotelId && !hotel) fail(400, 'Choose a valid hotel.');
  return { from, to, hotelId, where: { check_in: { [Op.gte]: from, [Op.lt]: end }, ...(hotel ? { room_id: hotel.rooms } : {}) } };
}
export async function reservationReport(filters) {
  const [statuses, types] = await Promise.all([
    Reservation.findAll({ where: filters.where, attributes: ['status', [fn('COUNT', col('reservation_id')), 'count'], [fn('SUM', col('nights')), 'nights'], [fn('SUM', col('total_amount')), 'value']], group: ['status'], raw: true }),
    Reservation.findAll({ where: { ...filters.where, status: { [Op.in]: activeBookingStatuses } }, attributes: ['room_type', [fn('COUNT', col('reservation_id')), 'count'], [fn('SUM', col('nights')), 'nights'], [fn('SUM', col('total_amount')), 'value']], group: ['room_type'], order: [['room_type', 'ASC']], raw: true }),
  ]);
  const count = state => Number(statuses.find(row => row.status === state)?.count || 0), active = statuses.filter(row => activeBookingStatuses.includes(row.status));
  return { count: statuses.reduce((sum, row) => sum + Number(row.count), 0), pending: count('LOCAL_CONFIRMED'), confirmed: count('ADMIN_CONFIRMED'), cancelled: count('CANCELLED'), nights: active.reduce((sum, row) => sum + Number(row.nights), 0), value: active.reduce((sum, row) => sum + Number(row.value), 0), types };
}
export function csvCell(value) {
  let text = String(value ?? ''); if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export async function reservationCsv(filters) {
  const rows = await Reservation.findAll({ where: filters.where, attributes: ['reference', 'first_name', 'last_name', 'email', 'room_id', 'room_number', 'room_type', 'check_in', 'check_out', 'guests', 'nights', 'status', 'total_amount'], order: [['check_in', 'ASC'], ['reservation_id', 'ASC']], limit: 5001 });
  if (rows.length > 5000) fail(400, 'Narrow the report range to export up to 5000 bookings.');
  const header = ['Booking reference', 'Guest', 'Email', 'Room', 'Hotel', 'Check-in', 'Check-out', 'Guests', 'Nights', 'Status', 'Quoted total (PHP)'];
  const lines = [header, ...rows.map(row => [row.reference, `${row.first_name} ${row.last_name}`, row.email, `${row.room_type} ${row.room_number}`, hotelForRoom(row.room_id)?.name || '', row.check_in, row.check_out, row.guests, row.nights, row.status === 'CANCELLED' ? 'Cancelled' : row.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation', row.total_amount])];
  return { count: rows.length, csv: '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n' };
}
