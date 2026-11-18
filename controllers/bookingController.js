import { searchCatalogRooms, getRoomById } from '../services/pmsApi.js';
import { searchInput, guestInput, positiveId, fail, today, maxStayNights } from '../services/validation.js';
import { randomUUID } from 'node:crypto';
import { hotels } from '../services/hotelCatalog.js';
import { paymentLabel } from '../public/payment-methods.js';
import { quoteStay } from '../services/bookingPrice.js';
import { BookingRoom } from '../models/bookingModel.js';
import { saveBooking, getBooking, findBookingSummary, cancelBooking, refundPolicy } from '../services/bookingService.js';
const lookupAttempts = new Map();
const guestOptions = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1} ${i ? 'guests' : 'guest'}`, selected: i === 1 }));
export const bookingController = {
  hotels: async (req, res) => { const rooms = await BookingRoom.findAll({ attributes: ['room_id'] }); res.render('hotels', { title: 'Hotels & Resorts | StayBook', hotels: hotels.map(hotel => ({ ...hotel, rooms: rooms.filter(room => hotel.rooms.includes(room.room_id)) })) }); },
  home: async (req, res) => {
    const checkIn = today(), checkOut = new Date(Date.parse(checkIn) + 86400000).toISOString().slice(0, 10);
    const { rooms, unavailableRooms } = await searchCatalogRooms(checkIn, checkOut, 1);
    const featuredRooms = [1, 3, 5].map(id => {
      const available = rooms.find(room => room.id === id);
      const room = available || unavailableRooms.find(entry => entry.id === id);
      return room && { ...room, available: Boolean(available), formattedPrice: room.price.toLocaleString('en-PH') };
    }).filter(Boolean);
    res.render('home', { title: 'StayBook | A comfortable stay, simply booked', featuredRooms, guestOptions, hotels });
  },
  roomsPage: (req, res) => res.render('rooms', { title: 'Choose your room | StayBook', guestOptions, hotels }),
  guestDetailsPage: async (req, res) => {
    if (!req.query.roomId) return res.redirect('/rooms');
    const stay = searchInput(req.query), room = await getRoomById(positiveId(req.query.roomId, 'room'));
    if (!room) fail(404, 'Room not found.');
    if (stay.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const quote = quoteStay(room.price, stay);
    const preferences = res.locals.preferences;
    const money = value => new Intl.NumberFormat(preferences.locale, { style: 'currency', currency: preferences.currency }).format(value * preferences.rate);
    const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(preferences.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const searchQuery = new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests, hotelId: room.hotel?.id || '' }).toString();
    res.render('guest-details', { title: 'Guest details | StayBook', room, guest: req.session.bookingPreview || req.account,
      searchQuery, stay: { ...stay, checkInLabel: date(stay.checkIn), checkOutLabel: date(stay.checkOut), nightlyRate: money(quote.nightlyRate), extraGuestNightly: Number(quote.extraGuestNightly) ? money(quote.extraGuestNightly) : null, total: money(quote.total), nightsLabel: stay.nights === 1 ? 'night' : 'nights', guestsLabel: stay.guests === 1 ? 'guest' : 'guests' } });
  },
  confirmationPage: (req, res) => {
    if (!req.session.bookingPreview && !req.session.bookingId) return res.redirect('/');
    res.render('confirmation', { title: 'Your online booking | StayBook', refundPolicy, maxStayNights });
  },
  searchRooms: async (req, res) => {
    const { checkIn, checkOut, guests } = searchInput(req.query);
    res.json({ success: true, ...await searchCatalogRooms(checkIn, checkOut, guests, req.query.hotelId) });
  },
  createBookingPreview: async (req, res) => {
    const dates = searchInput(req.body), guest = guestInput(req.body);
    const room = await getRoomById(positiveId(req.body.roomId, 'room'));
    if (!room) fail(404, 'Room not found.');
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');
    const quote = quoteStay(room.price, dates);
    req.session.bookingPreview = { ...dates, roomId: room.id, roomName: room.name, firstName: guest.first_name, lastName: guest.last_name,
      email: guest.email, phone: guest.phone, address: guest.address, hotelName: room.hotel?.name, hotelId: room.hotel?.id, roomImage: room.image, roomType: room.type, roomNumber: room.roomNumber, pricePerNight: Number(quote.nightlyRate), extraGuestNightly: Number(quote.extraGuestNightly), totalAmount: Number(quote.total), status: 'REVIEW', requestKey: randomUUID() };
    delete req.session.bookingId; delete req.session.bookingToken;
    res.json({ success: true, redirect: '/confirmation' });
  },
  getBookingPreview: async (req, res) => {
    const preview = req.session.bookingPreview;
    if (!preview) fail(404, 'No reservation review found.');
    const room = await getRoomById(preview.roomId);
    if (!room) fail(409, 'This room is not available for new bookings.');
    res.json({ success: true, booking: { ...preview, roomCapacity: room.capacity } });
  },
  updateBookingPreview: async (req, res) => {
    const preview = req.session.bookingPreview;
    if (!preview) fail(404, 'No reservation review found.');
    if (req.session.bookingId || req.body.requestKey !== preview.requestKey) {
      fail(409, 'This booking review has changed. Reload the page and try again.');
    }

    const nights = Number(req.body.nights);
    if (!Number.isInteger(nights) || nights < 1 || nights > maxStayNights) {
      fail(400, 'Choose a stay from 1 to 365 nights.');
    }
    const checkOut = new Date(Date.parse(preview.checkIn) + nights * 86400000).toISOString().slice(0, 10);
    const dates = searchInput({ checkIn: preview.checkIn, checkOut, guests: req.body.guests });
    const room = await getRoomById(preview.roomId);
    if (!room) fail(409, 'This room is not available for new bookings.');
    if (dates.guests > room.capacity) fail(400, 'Room capacity exceeded.');

    const { rooms } = await searchCatalogRooms(dates.checkIn, dates.checkOut, dates.guests, room.hotel?.id);
    const quote = rooms.find(entry => entry.id === room.id);
    if (!quote) fail(409, 'This room is unavailable for the selected dates. Try fewer nights or choose another room.');
    const booking = {
      ...preview, ...dates, roomCapacity: quote.capacity, pricePerNight: quote.price,
      extraGuestNightly: quote.extraGuestNightly, totalAmount: quote.stayTotal, requestKey: randomUUID(),
    };
    req.session.bookingPreview = booking;
    res.json({ success: true, booking });
  },
  confirmBooking: async (req, res) => {
    const preview = req.session.bookingPreview;
    if (!preview) fail(404, 'Start a room search first.');
    const reviewed = req.body.requestKey !== undefined;
    if (reviewed && req.body.requestKey !== preview.requestKey) {
      fail(409, 'This booking review has changed. Reload the page and try again.');
    }
    const booking = await saveBooking({
      ...preview, accountId: req.account?.id, paymentMethod: req.body.paymentMethod,
      cardLast4: req.body.cardLast4, simulateFailure: req.body.simulateFailure === true,
    }, { expectedTotal: reviewed ? preview.totalAmount : undefined });
    req.session.bookingId = booking.reservation_id; req.session.bookingToken = booking.access_token;
    res.json({ success: true, reservation: await getBooking(req.session.bookingId, req.session.bookingToken) });
  },
  currentBooking: async (req, res) => {
    const reservation = req.session.bookingId ? await getBooking(req.session.bookingId, req.session.bookingToken) : null;
    res.json({ success: true, reservation });
  },
  bookingPanel: async (req, res) => {
    if (!req.session.bookingId) fail(404, 'Booking not found.');
    const booking = await getBooking(req.session.bookingId, req.session.bookingToken);
    const payment = booking.payments[0], preferences = res.locals.preferences;
    const date = value => new Date(value + 'T12:00:00Z').toLocaleDateString(preferences.locale, { dateStyle: 'medium' });
    const total = new Intl.NumberFormat(preferences.locale, { style: 'currency', currency: preferences.currency }).format(Number(booking.total_amount) * preferences.rate);
    const cancelled = booking.status === 'CANCELLED';
    const statusLabel = cancelled ? 'Cancelled' : booking.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation';
    res.set('Cache-Control', 'private, no-store');
    res.render('guest-booking-panel', {
      booking, total, cancelled, statusLabel, refundPolicy, checkIn: date(booking.check_in), checkOut: date(booking.check_out),
      method: paymentLabel(payment?.payment_method), cardLast4: payment?.card_last4,
    });
  },
  receipt: async (req, res) => {
    if (!req.session.bookingId) return res.redirect('/manage-booking');
    const booking = await getBooking(req.session.bookingId, req.session.bookingToken);
    const payment = booking.payments[0], preferences = res.locals.preferences;
    const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value));
    const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(preferences.locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const estimate = preferences.currency !== 'PHP' ? new Intl.NumberFormat(preferences.locale, { style: 'currency', currency: preferences.currency }).format(Number(booking.total_amount) * preferences.rate) : '';
    res.render('receipt', { title: 'Booking receipt | StayBook', booking, refundPolicy, receipt: {
      cancelled: booking.status === 'CANCELLED', method: paymentLabel(payment?.payment_method), reference: payment?.reference,
      cardLast4: payment?.card_last4,
      paidAt: payment?.paid_at ? new Date(payment.paid_at).toLocaleString(preferences.locale, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '',
      total: php(booking.total_amount), nightlyRate: php(booking.nightly_rate), extraGuestNightly: Number(booking.extra_guest_nightly) ? php(booking.extra_guest_nightly) : null, checkIn: date(booking.check_in), checkOut: date(booking.check_out), estimate,
      nightsLabel: booking.nights === 1 ? 'night' : 'nights', guestsLabel: booking.guests === 1 ? 'guest' : 'guests',
    } });
  },
  lookupPanel: async (req, res) => {
    if (!req.session.lookupReference) fail(404, 'Booking not found.');
    const booking = await findBookingSummary(req.session.lookupReference);
    const { locale, currency, rate } = res.locals.preferences;
    const date = value => new Date(value + 'T12:00:00Z').toLocaleDateString(locale, { dateStyle: 'medium' });
    const total = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(booking.total_amount) * rate);
    const statusLabel = booking.status === 'CANCELLED' ? 'Cancelled' : booking.status === 'ADMIN_CONFIRMED' ? 'Confirmed in StayBook' : 'Awaiting confirmation';
    res.render('booking-lookup-panel', { booking, statusLabel, total, checkIn: date(booking.check_in), checkOut: date(booking.check_out) });
  },
  lookupBooking: async (req, res) => {
    const previous = lookupAttempts.get(req.ip), now = Date.now();
    const attempts = previous && previous.until > now ? previous : { count: 0, until: now + 900000 };
    lookupAttempts.set(req.ip, attempts);
    if (++attempts.count > 20) fail(429, 'Too many lookup attempts. Try again in 15 minutes.');
    delete req.session.lookupReference;
    const booking = await findBookingSummary(req.body.reference);
    req.session.lookupReference = booking.reference;
    res.json({ success: true, redirect: '/booking/lookup' });
  },
  cancelBooking: async (req, res) => {
    if (!req.session.bookingId) fail(404, 'Booking not found.');
    await cancelBooking(req.session.bookingId, req.session.bookingToken);
    res.json({ success: true });
  },
};
