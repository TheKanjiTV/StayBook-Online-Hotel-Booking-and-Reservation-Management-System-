// Local sample catalog for the Online Booking module only.
// TODO (future PMS integration): replace these functions with authenticated
// server-to-server API calls after the team agrees on endpoints and room IDs.
// Do not connect directly to another team's database.
import { Op } from 'sequelize';
import { BookingRoom, Reservation, activeBookingStatuses } from '../models/bookingModel.js';
import { hotelForRoom, hotels } from './hotelCatalog.js';
import { BookingClosure } from '../models/availabilityModel.js';
const types = [
  { type: 'Deluxe Room', price: 2500, capacity: 2, description: 'Queen bed, air conditioning, Wi-Fi and a private bathroom.', image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900' },
  { type: 'Superior Room', price: 3500, capacity: 3, description: 'A spacious room with a queen bed, an extra single bed and breakfast.', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900' },
  { type: 'Family Suite', price: 5000, capacity: 4, description: 'A family room with two beds and a separate sitting area.', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900' },
];
export const sampleRooms = types.flatMap((room, index) => [1, 2].map(n => ({ ...room, id: index * 2 + n, roomNumber: `${index + 1}0${n}`, name: `${room.type} · ${index + 1}0${n}` })));
const dto = room => ({ id: room.room_id, roomNumber: room.room_number, name: room.name, type: room.type, description: room.description, capacity: room.capacity, price: Number(room.price), image: room.image, hotel: hotelForRoom(room.room_id) });
export async function getAvailableRooms(checkIn, checkOut, guests, hotelId) {
  const [booked, closures] = await Promise.all([Reservation.findAll({ where: { status: { [Op.in]: activeBookingStatuses }, check_in: { [Op.lt]: checkOut }, check_out: { [Op.gt]: checkIn } }, attributes: ['room_id'] }), BookingClosure.findAll({ where: { starts_on: { [Op.lt]: checkOut }, ends_on: { [Op.gt]: checkIn } }, attributes: ['room_id'] })]);
  const unavailable = [...new Set([...booked, ...closures].map(row => row.room_id))];
  const rooms = await BookingRoom.findAll({ where: { is_published: true, capacity: { [Op.gte]: guests }, ...(unavailable.length ? { room_id: { [Op.notIn]: unavailable } } : {}) }, order: [['room_id', 'ASC']] });
  if (hotelId && !hotels.some(hotel => hotel.id === Number(hotelId))) return [];
  return rooms.map(dto).filter(room => !hotelId || room.hotel?.id === Number(hotelId));
}
export async function getRoomById(id) { const room = await BookingRoom.findOne({ where: { room_id: Number(id), is_published: true } }); return room ? dto(room) : null; }
