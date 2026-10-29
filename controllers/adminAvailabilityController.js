import { Op } from 'sequelize';
import { BookingRoom, Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { BookingClosure } from '../models/availabilityModel.js';
import { hotels, hotelForRoom } from '../services/hotelCatalog.js';
import { today, validDate, positiveId, fail } from '../services/validation.js';
import { closeBookingDates, releaseBookingDates } from '../services/availabilityService.js';
const plus = (day, n) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
export const adminAvailabilityController = {
  page: async (req, res) => {
    const start = req.query.start || today(); if (!validDate(start)) fail(400, 'Choose a valid start date.');
    const end = plus(start, 14), hotelId = req.query.hotelId ? positiveId(req.query.hotelId, 'hotel') : null, hotel = hotels.find(row => row.id === hotelId);
    if (hotelId && !hotel) fail(400, 'Choose a valid hotel.');
    const [rooms, bookings, closures, upcoming] = await Promise.all([
      BookingRoom.findAll({ where: hotel ? { room_id: hotel.rooms } : {}, order: [['room_id', 'ASC']] }),
      Reservation.findAll({ where: { status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: end }, check_out: { [Op.gt]: start } }, attributes: ['reservation_id', 'reference', 'room_id', 'status', 'check_in', 'check_out'] }),
      BookingClosure.findAll({ where: { starts_on: { [Op.lt]: end }, ends_on: { [Op.gt]: start } } }),
      BookingClosure.findAll({ where: { ends_on: { [Op.gt]: today() }, ...(hotel ? { room_id: hotel.rooms } : {}) }, order: [['starts_on', 'ASC']] }),
    ]);
    const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(res.locals.preferences.locale, { month: 'short', day: 'numeric' });
    const days = Array.from({ length: 14 }, (_, n) => ({ date: plus(start, n), label: date(plus(start, n)) }));
    const rows = rooms.map(room => ({ ...room.toJSON(), hotelName: hotelForRoom(room.room_id)?.name, cells: days.map(day => {
      const booking = bookings.find(row => row.room_id === room.room_id && row.check_in <= day.date && row.check_out > day.date), closure = closures.find(row => row.room_id === room.room_id && row.starts_on <= day.date && row.ends_on > day.date);
      return { date: day.date, state: booking ? 'booked' : closure ? 'closed' : !room.is_published ? 'hidden' : 'free', label: booking ? booking.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation' : closure ? 'Closed' : room.is_published ? 'Available' : 'Hidden from booking', href: booking ? `/admin/bookings/${booking.reservation_id}` : !closure && room.is_published && day.date >= today() ? `/admin/bookings/new?${new URLSearchParams({ roomId: room.room_id, checkIn: day.date, checkOut: plus(day.date, 1) })}` : null, reference: booking?.reference, reason: closure?.reason };
    }) }));
    const link = day => `/admin/availability?${new URLSearchParams({ start: day, ...(hotelId ? { hotelId } : {}) })}`;
    res.render('admin-availability', { title: 'Availability | StayBook', start, today: today(), tomorrow: plus(today(), 1), days, rooms: rows, hotels: hotels.map(row => ({ ...row, selected: row.id === hotelId })), previous: link(plus(start, -14)), next: link(end), closures: upcoming.map(row => ({ ...row.toJSON(), roomNumber: rooms.find(room => room.room_id === row.room_id)?.room_number, startLabel: date(row.starts_on), endLabel: date(row.ends_on) })) });
  },
  close: async (req, res) => { const row = await closeBookingDates(req.body, req.account); res.json({ success: true, redirect: '/admin/availability', closureId: row.closure_id }); },
  release: async (req, res) => { await releaseBookingDates(positiveId(req.params.id), req.account); res.json({ success: true, redirect: '/admin/availability' }); },
};
