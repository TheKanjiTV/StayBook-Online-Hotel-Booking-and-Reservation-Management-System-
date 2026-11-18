// Local sample catalog for the Online Booking module only.
// TODO (future PMS integration): replace these functions with authenticated
// server-to-server API calls after the team agrees on endpoints and room IDs.
// Do not connect directly to another team's database.
import { Op } from 'sequelize';
import { BookingRoom, Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { hotelForRoom, hotels } from './hotelCatalog.js';
import { BookingClosure } from '../models/availabilityModel.js';
import { quoteStay } from './bookingPrice.js';
const types = [
  { type: 'Deluxe Room', price: 2500, capacity: 3, description: 'Queen bed, air conditioning, Wi-Fi and a private bathroom.', image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900' },
  { type: 'Superior Room', price: 3500, capacity: 3, description: 'A spacious room with a queen bed, an extra single bed and breakfast.', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900' },
  { type: 'Family Suite', price: 5000, capacity: 4, description: 'A family room with two beds and a separate sitting area.', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900' },
];
export const sampleRooms = types.flatMap((room, index) => [1, 2].map(n => ({ ...room, id: index * 2 + n, roomNumber: `${index + 1}0${n}`, name: `${room.type} · ${index + 1}0${n}` })));
const dto = room => ({ id: room.room_id, roomNumber: room.room_number, name: room.name, type: room.type, description: room.description, capacity: room.capacity, price: Number(room.price), image: room.image, hotel: hotelForRoom(room.room_id) });
export async function searchCatalogRooms(checkIn, checkOut, guests, hotelId) {
  const [booked, closures] = await Promise.all([Reservation.findAll({ where: { status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: checkOut }, check_out: { [Op.gt]: checkIn } }, attributes: ['room_id'] }), BookingClosure.findAll({ where: { starts_on: { [Op.lt]: checkOut }, ends_on: { [Op.gt]: checkIn } }, attributes: ['room_id'] })]);
  const blocked = new Set([...booked, ...closures].map(row => row.room_id));
  const hotel = hotelId && hotels.find(item => item.id === Number(hotelId));
  if (hotelId && !hotel) return { rooms: [], unavailableRooms: [] };
  const catalog = await BookingRoom.findAll({
    where: { capacity: { [Op.gte]: guests }, ...(hotel ? { room_id: hotel.rooms } : {}) },
    order: [['room_id', 'ASC']],
  });
  const rooms = [], unavailableRooms = [];
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
  for (const room of catalog) {
    const quote = quoteStay(room.price, { guests, nights });
    const listing = { ...dto(room), price: Number(quote.nightlyRate), extraGuestNightly: Number(quote.extraGuestNightly), stayTotal: Number(quote.total) };
    (room.is_published && !blocked.has(room.room_id) ? rooms : unavailableRooms).push(listing);
  }
  return { rooms, unavailableRooms };
}
export async function getRoomById(id) { const room = await BookingRoom.findOne({ where: { room_id: Number(id), is_published: true } }); return room ? dto(room) : null; }
