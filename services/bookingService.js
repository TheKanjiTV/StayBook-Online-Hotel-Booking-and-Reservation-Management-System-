import { randomBytes, randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { sequelize } from '../models/db.js';
import { BookingRoom, Reservation, Payment, activeBookingStatuses } from '../models/bookingModel.js';
import { AccountBooking, Notification } from '../models/accountModel.js';
import { BookingClosure } from '../models/availabilityModel.js';
import { hotelForRoom } from './hotelCatalog.js';
import { paymentMethods } from '../public/payment-methods.js';
import { searchInput, guestInput, positiveId, fail, string, email, hash, cents, amount } from './validation.js';
export async function saveBooking(body, options = {}) {
  const dates = searchInput(body), guest = guestInput(body), roomId = positiveId(body.roomId, 'room');
  const requestKey = string(body.requestKey, 'Request key');
  const paymentMethod = body.paymentMethod ?? 'SIMULATED';
  if (!['SIMULATED', ...paymentMethods.map(method => method.id)].includes(paymentMethod)) fail(400, 'Choose a supported payment method.');
  const requestHash = hash({ dates, guest, roomId, paymentMethod, ...(options.source === 'ADMIN' ? { source: 'ADMIN', accountId: body.accountId || null } : {}) });
  return sequelize.transaction(async transaction => {
    const room = await BookingRoom.findByPk(roomId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) fail(404, 'Room not found.');
    const existing = await Reservation.findOne({ where: { request_key: requestKey }, transaction });
    if (existing) {
      const legacyRetry = paymentMethod === 'SIMULATED' && existing.request_hash === hash({ dates, guest, roomId });
      if (existing.request_hash !== requestHash && !legacyRetry) fail(409, 'This request key was already used for different details.');
      return existing;
    }
    if (!room.is_published) fail(409, 'This room is not available for new bookings.');
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const conflict = await Reservation.findOne({ where: { room_id: roomId, status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: dates.checkOut }, check_out: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE });
    if (conflict) fail(409, 'This sample room is already booked for those dates. Choose another room.');
    if (await BookingClosure.findOne({ where: { room_id: roomId, starts_on: { [Op.lt]: dates.checkOut }, ends_on: { [Op.gt]: dates.checkIn } }, transaction, lock: transaction.LOCK.UPDATE })) fail(409, 'This room is closed for online booking on those dates.');
    if (body.simulateFailure === true) fail(402, 'Payment could not be processed. No booking was saved. Please retry.');
    const total = amount(cents(room.price) * dates.nights);
    const booking = await Reservation.create({ ...guest, reference: `SB-${randomBytes(6).toString('hex').toUpperCase()}`, request_key: requestKey, request_hash: requestHash, access_token: randomBytes(32).toString('hex'),
      room_id: roomId, room_name: room.name, room_number: room.room_number, room_type: room.type, check_in: dates.checkIn, check_out: dates.checkOut,
      guests: dates.guests, nights: dates.nights, nightly_rate: room.price, total_amount: total, status: 'LOCAL_CONFIRMED' }, { transaction });
    await Payment.create({ reservation_id: booking.reservation_id, amount: total, payment_method: paymentMethod, payment_status: 'PAID', paid_at: new Date(), reference: randomUUID(), purpose: 'BOOKING' }, { transaction });
    if (body.accountId) {
      await AccountBooking.create({ account_id: body.accountId, reservation_id: booking.reservation_id }, { transaction });
      await Notification.create({ account_id: body.accountId, reservation_id: booking.reservation_id, reference: booking.reference, kind: 'BOOKING_SAVED' }, { transaction });
    }
    if (options.onCreate) await options.onCreate(booking, transaction);
    // TODO: send the agreed reservation payload to the PMS API in a later phase.
    // A locally saved booking must not be presented as acknowledged by the PMS.
    return booking;
  });
}
export async function getBooking(id, token) {
  const booking = await Reservation.findOne({ where: { reservation_id: positiveId(id), access_token: token } });
  if (!booking) fail(404, 'Booking not found.');
  const payments = await Payment.findAll({ where: { reservation_id: booking.reservation_id }, attributes: ['amount', 'payment_method', 'payment_status', 'paid_at', 'purpose', 'reference'], order: [['payment_id', 'ASC']] });
  const room = await BookingRoom.findByPk(booking.room_id, { attributes: ['image'] });
  const data = booking.toJSON(); delete data.access_token; delete data.request_key; delete data.request_hash;
  return { ...data, hotel: hotelForRoom(data.room_id), guest: { first_name: data.first_name, last_name: data.last_name, email: data.email },
    room: { room_number: data.room_number, roomType: { name: data.room_type }, image: room?.image || null }, payments, integration_status: 'NOT_CONNECTED' };
}
export async function findBooking(reference, guestEmail) {
  const booking = await Reservation.findOne({ where: { reference: string(reference, 'Booking reference', 30).toUpperCase(), email: email(guestEmail) } });
  if (!booking) fail(404, 'No booking matches that reference and email.');
  return booking;
}
export async function cancelBooking(id, token, options = {}) {
  const reference = await Reservation.findOne({ where: { reservation_id: positiveId(id), access_token: token }, transaction: options.transaction });
  if (!reference) fail(404, 'Booking not found.');
  const perform = async transaction => {
    await BookingRoom.findByPk(reference.room_id, { transaction, lock: transaction.LOCK.UPDATE });
    const booking = await Reservation.findByPk(reference.reservation_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.room_id !== reference.room_id) fail(409, 'This booking changed. Reload the page and try again.');
    if (booking.status === 'CANCELLED') return false;
    if (!activeBookingStatuses.includes(booking.status)) fail(409, 'This booking cannot be cancelled.');
    const previousStatus = booking.status;
    await booking.update({ status: 'CANCELLED' }, { transaction });
    await Payment.update({ payment_status: 'REFUNDED' }, { where: { reservation_id: booking.reservation_id, payment_status: 'PAID' }, transaction });
    const owner = await AccountBooking.findByPk(booking.reservation_id, { transaction });
    if (owner) await Notification.create({ account_id: owner.account_id, reservation_id: booking.reservation_id, reference: booking.reference, kind: 'BOOKING_CANCELLED' }, { transaction });
    if (options.onChange) await options.onChange(booking, transaction, previousStatus);
    // TODO: agree on cancellation acknowledgement and refunds with the PMS/payment
    // provider before replacing this local-only cancellation workflow.
    return true;
  };
  return options.transaction ? perform(options.transaction) : sequelize.transaction(perform);
}
