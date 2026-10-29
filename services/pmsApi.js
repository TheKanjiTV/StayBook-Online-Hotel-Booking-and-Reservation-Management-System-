// Local sample catalog for the Online Booking module only.
// TODO (future PMS integration): replace these functions with authenticated
// server-to-server API calls after the team agrees on endpoints and room IDs.
// Do not connect directly to another team's database.
const types = [
  { type: 'Deluxe Room', price: 2500, capacity: 2, description: 'Queen bed, air conditioning, Wi-Fi and a private bathroom.', image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900' },
  { type: 'Superior Room', price: 3500, capacity: 3, description: 'A spacious room with a queen bed, an extra single bed and breakfast.', image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900' },
  { type: 'Family Suite', price: 5000, capacity: 4, description: 'A family room with two beds and a separate sitting area.', image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900' },
];
export const sampleRooms = types.flatMap((room, index) => [1, 2].map(n => ({ ...room, id: index * 2 + n, roomNumber: `${index + 1}0${n}`, name: `${room.type} · ${index + 1}0${n}` })));
export async function getAvailableRooms(checkIn, checkOut, guests) { return sampleRooms.filter(room => room.capacity >= guests); }
export async function getRoomById(id) { return sampleRooms.find(room => room.id === Number(id)) || null; }
