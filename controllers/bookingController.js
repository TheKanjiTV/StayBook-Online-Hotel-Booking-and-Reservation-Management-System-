import { getAvailableRooms, getRoomById } from '../services/pmsApi.js';
import { searchInput, guestInput, fail } from '../services/validation.js';
export const bookingController = {
  home: (req, res) => res.render('home', { title: 'StayBook | Online booking' }),
  roomsPage: (req, res) => res.render('rooms', { title: 'Rooms | StayBook' }),
  guestDetailsPage: (req, res) => res.render('guest-details', { title: 'Guest details | StayBook' }),
  confirmationPage: (req, res) => {
    if (!req.session.bookingPreview) return res.redirect('/');
    res.render('confirmation', { title: 'Reservation review | StayBook', booking: req.session.bookingPreview });
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
      email: guest.email, phone: guest.phone, address: guest.address, pricePerNight: room.price, totalAmount: room.price * dates.nights, status: 'REVIEW ONLY' };
    res.json({ success: true, redirect: '/confirmation' });
  },
  getBookingPreview: (req, res) => {
    if (!req.session.bookingPreview) fail(404, 'No reservation review found.');
    res.json({ success: true, booking: req.session.bookingPreview });
  },
};
