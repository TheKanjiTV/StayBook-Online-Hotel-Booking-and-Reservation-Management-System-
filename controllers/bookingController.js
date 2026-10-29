import { getAvailableRooms, getRoomById } from '../services/pmsApi.js';
import { searchInput, guestInput, positiveId, fail } from '../services/validation.js';
import { randomUUID } from 'node:crypto';
import { hotels } from '../services/hotelCatalog.js';
import { paymentLabel } from '../public/payment-methods.js';
import { BookingRoom } from '../models/bookingModel.js';
import { saveBooking, getBooking, findBooking, cancelBooking } from '../services/bookingService.js';
const lookupAttempts = new Map();
const guestOptions = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1} ${i ? 'guests' : 'guest'}`, selected: i === 1 }));
export const bookingController = {
  hotels: async (req, res) => { const rooms = await BookingRoom.findAll({ where: { is_published: true }, attributes: ['room_id'] }); res.render('hotels', { title: 'Hotels & Resorts | StayBook', hotels: hotels.map(hotel => ({ ...hotel, rooms: rooms.filter(room => hotel.rooms.includes(room.room_id)) })) }); },
  home: async (req, res) => {
    const rooms = await Promise.all([1, 3, 5].map(getRoomById));
    const featuredRooms = rooms.filter(Boolean).map(room => ({ ...room, formattedPrice: Number(room.price).toLocaleString('en-PH') }));
    res.render('home', { title: 'StayBook | A comfortable stay, simply booked', featuredRooms, guestOptions, hotels });
  },
  roomsPage: (req, res) => res.render('rooms', { title: 'Choose your room | StayBook', guestOptions, hotels }),
  guestDetailsPage: async (req, res) => {
    if (!req.query.roomId) return res.redirect('/rooms');
    const stay = searchInput(req.query), room = await getRoomById(positiveId(req.query.roomId, 'room'));
    if (!room) fail(404, 'Room not found.');
    if (stay.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const preferences = res.locals.preferences;
    const money = value => new Intl.NumberFormat(preferences.locale, { style: 'currency', currency: preferences.currency }).format(value * preferences.rate);
    const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(preferences.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const searchQuery = new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests, hotelId: room.hotel?.id || '' }).toString();
    res.render('guest-details', { title: 'Guest details | StayBook', room, guest: req.session.bookingPreview || req.account,
      searchQuery, stay: { ...stay, checkInLabel: date(stay.checkIn), checkOutLabel: date(stay.checkOut), nightlyRate: money(room.price), total: money(room.price * stay.nights), nightsLabel: stay.nights === 1 ? 'night' : 'nights', guestsLabel: stay.guests === 1 ? 'guest' : 'guests' } });
  },
  confirmationPage: (req, res) => {
    if (!req.session.bookingPreview && !req.session.bookingId) return res.redirect('/');
    res.render('confirmation', { title: 'Your online booking | StayBook' });
  },
  searchRooms: async (req, res) => {
    const { checkIn, checkOut, guests } = searchInput(req.query);
    res.json({ success: true, rooms: await getAvailableRooms(checkIn, checkOut, guests, req.query.hotelId) });
  },
  createBookingPreview: async (req, res) => {
    const dates = searchInput(req.body), guest = guestInput(req.body);
    const room = await getRoomById(positiveId(req.body.roomId, 'room'));
    if (!room) fail(404, 'Room not found.');
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    req.session.bookingPreview = { ...dates, roomId: room.id, roomName: room.name, firstName: guest.first_name, lastName: guest.last_name,
      email: guest.email, phone: guest.phone, address: guest.address, hotelName: room.hotel?.name, hotelId: room.hotel?.id, roomImage: room.image, roomType: room.type, roomNumber: room.roomNumber, pricePerNight: room.price, totalAmount: room.price * dates.nights, status: 'REVIEW', requestKey: randomUUID() };
    delete req.session.bookingId; delete req.session.bookingToken;
    res.json({ success: true, redirect: '/confirmation' });
  },
  getBookingPreview: (req, res) => {
    if (!req.session.bookingPreview) fail(404, 'No reservation review found.');
    res.json({ success: true, booking: req.session.bookingPreview });
  },
  confirmBooking: async (req, res) => {
    if (!req.session.bookingPreview) fail(404, 'Start a room search first.');
    const booking = await saveBooking({ ...req.session.bookingPreview, accountId: req.account?.id, paymentMethod: req.body.paymentMethod, simulateFailure: req.body.simulateFailure === true });
    req.session.bookingId = booking.reservation_id; req.session.bookingToken = booking.access_token;
    res.json({ success: true, reservation: await getBooking(req.session.bookingId, req.session.bookingToken) });
  },
  currentBooking: async (req, res) => {
    const reservation = req.session.bookingId ? await getBooking(req.session.bookingId, req.session.bookingToken) : null;
    res.json({ success: true, reservation });
  },
  receipt: async (req, res) => {
    if (!req.session.bookingId) return res.redirect('/manage-booking');
    const booking = await getBooking(req.session.bookingId, req.session.bookingToken);
    const payment = booking.payments[0], preferences = res.locals.preferences;
    const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value));
    const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(preferences.locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const estimate = preferences.currency !== 'PHP' ? new Intl.NumberFormat(preferences.locale, { style: 'currency', currency: preferences.currency }).format(Number(booking.total_amount) * preferences.rate) : '';
    res.render('receipt', { title: 'Booking receipt | StayBook', booking, receipt: {
      cancelled: booking.status === 'CANCELLED', method: paymentLabel(payment?.payment_method), reference: payment?.reference,
      paidAt: payment?.paid_at ? new Date(payment.paid_at).toLocaleString(preferences.locale, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '',
      total: php(booking.total_amount), nightlyRate: php(booking.nightly_rate), checkIn: date(booking.check_in), checkOut: date(booking.check_out), estimate,
      nightsLabel: booking.nights === 1 ? 'night' : 'nights', guestsLabel: booking.guests === 1 ? 'guest' : 'guests',
    } });
  },
  lookupBooking: async (req, res) => {
    const previous = lookupAttempts.get(req.ip), now = Date.now();
    const attempts = previous && previous.until > now ? previous : { count: 0, until: now + 900000 };
    lookupAttempts.set(req.ip, attempts);
    if (++attempts.count > 20) fail(429, 'Too many lookup attempts. Try again in 15 minutes.');
    const booking = await findBooking(req.body.reference, req.body.email);
    req.session.bookingId = booking.reservation_id; req.session.bookingToken = booking.access_token;
    res.json({ success: true, redirect: '/confirmation' });
  },
  cancelBooking: async (req, res) => {
    if (!req.session.bookingId) fail(404, 'Booking not found.');
    await cancelBooking(req.session.bookingId, req.session.bookingToken);
    res.json({ success: true });
  },
};
