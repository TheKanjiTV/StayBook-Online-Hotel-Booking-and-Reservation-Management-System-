const rooms = [
  { id: 1, name: "Deluxe Room", type: "Deluxe", price: 2500, capacity: 2, description: "A comfortable room with a queen-sized bed.", amenities: ["Wi-Fi", "Air Conditioning", "Smart TV"], image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900" },
  { id: 2, name: "Superior Room", type: "Superior", price: 3500, capacity: 3, description: "A spacious room perfect for a relaxing stay.", amenities: ["Wi-Fi", "Air Conditioning", "Breakfast"], image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900" },
  { id: 3, name: "Family Suite", type: "Suite", price: 5000, capacity: 4, description: "A spacious suite designed for families.", amenities: ["Wi-Fi", "Living Area", "Smart TV"], image: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900" }
];

export async function getAvailableRooms(checkIn, checkOut, guests) {
  return rooms.filter(room => room.capacity >= guests);
}

export async function getRoomById(roomId) {
  return rooms.find(room => room.id === Number(roomId)) || null;
}