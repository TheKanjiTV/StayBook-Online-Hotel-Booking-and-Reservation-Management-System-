// Local sample catalog for the Online Booking module only.
// TODO (future PMS integration): replace these functions with authenticated
// server-to-server API calls after the team agrees on endpoints and room IDs.
// Do not connect directly to another team's database.
import { Op } from 'sequelize';
import { BookingRoom, Reservation } from '../models/bookingModel.js';
const types = [
  { type: 'Deluxe Room', price: 2500, capacity: 2, description: 'Queen bed, air conditioning, Wi-Fi and a private bathroom.', image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900' },
  { type: 'Superior Room', price: 3500, capacity: 3, description: 'A spacious room with a queen bed, an extra single bed and breakfast.', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900' },
  { type: 'Family Suite', price: 5000, capacity: 4, description: 'A family room with two beds and a separate sitting area.', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900' },
];
export const sampleRooms = types.flatMap((room, index) => [1, 2].map(n => ({ ...room, id: index * 2 + n, roomNumber: `${index + 1}0${n}`, name: `${room.type} · ${index + 1}0${n}` })));
const dto = room => ({ id: room.room_id, roomNumber: room.room_number, name: room.name, type: room.type, description: room.description, capacity: room.capacity, price: Number(room.price), image: room.image });
export async function getAvailableRooms(checkIn, checkOut, guests) {
  const booked = await Reservation.findAll({ where: { status: 'LOCAL_CONFIRMED', check_in: { [Op.lt]: checkOut }, check_out: { [Op.gt]: checkIn } }, attributes: ['room_id'] });
  const rooms = await BookingRoom.findAll({ where: { capacity: { [Op.gte]: guests }, ...(booked.length ? { room_id: { [Op.notIn]: booked.map(r => r.room_id) } } : {}) }, order: [['room_id', 'ASC']] });
  return rooms.map(dto);
}
export async function getRoomById(id) { const room = await BookingRoom.findByPk(Number(id)); return room ? dto(room) : null; }
