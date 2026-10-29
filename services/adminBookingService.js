import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';
import { BookingRoom, Reservation, Payment, activeBookingStatuses } from '../models/bookingModel.js';
import { Account, AccountBooking, Notification } from '../models/accountModel.js';
import { BookingClosure } from '../models/availabilityModel.js';
import { guestInput, positiveId, searchInput, cents, amount, fail } from './validation.js';
import { cancelBooking, saveBooking } from './bookingService.js';
import { recordAudit } from './auditService.js';
export async function createAdminBooking(body, actor) {
  let owner;
  if (body.accountId) {
    owner = await Account.findOne({ where: { account_id: positiveId(body.accountId, 'account'), role: 'GUEST' } });
    if (!owner || owner.email !== String(body.email).trim().toLowerCase()) fail(400, 'The selected account must match the guest email.');
  }
  return saveBooking({ ...body, accountId: owner?.account_id, simulateFailure: false }, { source: 'ADMIN', onCreate: (booking, transaction) => recordAudit(actor, 'BOOKING_CREATED', 'BOOKING', booking.reservation_id, booking.reference, { source: 'ADMIN', status: booking.status, room_id: booking.room_id, total_amount: booking.total_amount, account_id: owner?.account_id || null }, transaction) });
}

export function checkVersion(row, body) {
  if (!/^\d+$/.test(String(body.version)) || Number(body.version) !== row.version) fail(409, 'This record changed. Reload the page before saving.');
}
async function lockedBooking(id, extraRoomId, work) {
  return sequelize.transaction(async transaction => {
    const snapshot = await Reservation.findByPk(positiveId(id), { transaction });
    if (!snapshot) fail(404, 'Booking not found.');
    const ids = [...new Set([snapshot.room_id, ...(extraRoomId ? [extraRoomId] : [])])].sort((a, b) => a - b);
    const rooms = await BookingRoom.findAll({ where: { room_id: ids }, order: [['room_id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    const booking = await Reservation.findByPk(snapshot.reservation_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.room_id !== snapshot.room_id) fail(409, 'This booking changed. Reload the page and try again.');
    return work(booking, rooms, transaction);
  });
}
async function notify(booking, kind, transaction) {
  const owner = await AccountBooking.findByPk(booking.reservation_id, { transaction });
  if (!owner) return;
  const [notice, created] = await Notification.findOrCreate({ where: { reservation_id: booking.reservation_id, kind }, defaults: { account_id: owner.account_id, reference: booking.reference }, transaction });
  if (!created) await notice.update({ read_at: null }, { transaction });
}
export const confirmAdminBooking = (id, actor) => lockedBooking(id, null, async (booking, rooms, transaction) => {
  if (booking.status === 'ADMIN_CONFIRMED') return;
  if (booking.status !== 'LOCAL_CONFIRMED') fail(409, 'Only pending bookings can be confirmed.');
  await booking.update({ status: 'ADMIN_CONFIRMED' }, { transaction });
  await notify(booking, 'BOOKING_CONFIRMED', transaction);
  await recordAudit(actor, 'BOOKING_CONFIRMED', 'BOOKING', booking.reservation_id, booking.reference, { status: { before: 'LOCAL_CONFIRMED', after: 'ADMIN_CONFIRMED' } }, transaction);
});
export async function updateAdminBooking(id, body, actor) {
  const roomId = positiveId(body.roomId, 'room'), guest = guestInput(body);
  return lockedBooking(id, roomId, async (booking, rooms, transaction) => {
    checkVersion(booking, body);
    if (!activeBookingStatuses.includes(booking.status)) fail(409, 'Cancelled bookings cannot be edited.');
    const room = rooms.find(row => row.room_id === roomId);
    if (!room) fail(404, 'Room not found.');
    const guests = Number(body.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const datesChanged = body.checkIn !== booking.check_in || body.checkOut !== booking.check_out;
    const dates = datesChanged ? searchInput(body) : { checkIn: booking.check_in, checkOut: booking.check_out, nights: booking.nights };
    const stayChanged = datesChanged || roomId !== booking.room_id;
    if (stayChanged && !room.is_published) fail(409, 'This room is not available for new bookings.');
    const conflict = await Reservation.findOne({ where: { reservation_id: { [Op.ne]: booking.reservation_id }, room_id: roomId, status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: dates.checkOut }, check_out: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE });
    if (conflict) fail(409, 'This room is already booked for those dates.');
    if (await BookingClosure.findOne({ where: { room_id: roomId, starts_on: { [Op.lt]: dates.checkOut }, ends_on: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE })) fail(409, 'This room is closed for online booking on those dates.');
    const rate = stayChanged ? room.price : booking.nightly_rate;
    const values = { ...guest, room_id: roomId, room_name: room.name, room_number: room.room_number, room_type: room.type, guests, check_in: dates.checkIn, check_out: dates.checkOut, nights: dates.nights, nightly_rate: rate, total_amount: amount(cents(rate) * dates.nights), status: stayChanged ? 'LOCAL_CONFIRMED' : booking.status };
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => String(booking[key] ?? '') !== String(value ?? '')).map(([key, value]) => [key, { before: booking[key], after: value }]));
    if (!Object.keys(changes).length) return;
    await booking.update(values, { transaction });
    await Payment.update({ amount: values.total_amount }, { where: { reservation_id: booking.reservation_id, purpose: 'BOOKING', payment_status: 'PAID' }, transaction });
    await notify(booking, 'BOOKING_UPDATED', transaction);
    await recordAudit(actor, 'BOOKING_UPDATED', 'BOOKING', booking.reservation_id, booking.reference, changes, transaction);
  });
}
export const deleteAdminBooking = (id, actor) => lockedBooking(id, null, async (booking, rooms, transaction) => {
  const previousStatus = booking.status;
  if (activeBookingStatuses.includes(booking.status)) { await cancelBooking(booking.reservation_id, booking.access_token, { transaction }); await booking.reload({ transaction }); }
  await recordAudit(actor, 'BOOKING_DELETED', 'BOOKING', booking.reservation_id, booking.reference, { deleted: true, previousStatus }, transaction);
  await booking.destroy({ transaction });
});
