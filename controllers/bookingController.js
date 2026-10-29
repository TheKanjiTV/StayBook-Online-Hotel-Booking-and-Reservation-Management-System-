import { getAvailableRooms, getRoomById } from '../services/pmsApi.js';
import { searchInput, guestInput, fail } from '../services/validation.js';
import { randomUUID } from 'node:crypto';
import { saveBooking, getBooking, findBooking, cancelBooking } from '../services/bookingService.js';
const lookupAttempts = new Map();
export const bookingController = {
  home: (req, res) => res.render('home', { title: 'StayBook | Online booking' }),
  roomsPage: (req, res) => res.render('rooms', { title: 'Rooms | StayBook' }),
  guestDetailsPage: (req, res) => res.render('guest-details', { title: 'Guest details | StayBook' }),
  confirmationPage: (req, res) => {
    if (!req.session.bookingPreview && !req.session.bookingId) return res.redirect('/');
    res.render('confirmation', { title: 'Your online booking | StayBook' });
  },
  searchRooms: async (req, res) => {
    const { checkIn, checkOut, guests } = searchInput(req.query);
    res.json({ success: true, rooms: await getAvailableRooms(checkIn, checkOut, guests) });
  },
  createBookingPreview: async (req, res) => {
    const dates = searchInput(req.body), guest = guestInput(req.body);
    const room = await getRoomById(req.body.roomId);
    if (!room) fail(404, 'Room not found.');
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    req.session.bookingPreview = { ...dates, roomId: room.id, roomName: room.name, firstName: guest.first_name, lastName: guest.last_name,
      email: guest.email, phone: guest.phone, address: guest.address, pricePerNight: room.price, totalAmount: room.price * dates.nights, status: 'REVIEW', requestKey: randomUUID() };
    delete req.session.bookingId; delete req.session.bookingToken;
    res.json({ success: true, redirect: '/confirmation' });
  },
  getBookingPreview: (req, res) => {
    if (!req.session.bookingPreview) fail(404, 'No reservation review found.');
    res.json({ success: true, booking: req.session.bookingPreview });
  },
  confirmBooking: async (req, res) => {
    if (!req.session.bookingPreview) fail(404, 'Start a room search first.');
    const booking = await saveBooking({ ...req.session.bookingPreview, simulateFailure: req.body.simulateFailure === true });
    req.session.bookingId = booking.reservation_id; req.session.bookingToken = booking.access_token;
    res.json({ success: true, reservation: await getBooking(req.session.bookingId, req.session.bookingToken) });
  },
  currentBooking: async (req, res) => {
    const reservation = req.session.bookingId ? await getBooking(req.session.bookingId, req.session.bookingToken) : null;
    res.json({ success: true, reservation });
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
