// Illustrative properties in StayBook's own sample catalog, not live hotel inventory.
// Replace with the agreed PMS property/room API when integration is ready.
export const hotels = [
  { id: 1, name: 'StayBook City Hotel', kind: 'Hotel', collection: 'City collection', rooms: [1, 3, 5], image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=85', description: 'A room for a city break, a work trip or a quiet night away.' },
  { id: 2, name: 'StayBook Coast Resort', kind: 'Resort', collection: 'Coast collection', rooms: [2, 4, 6], image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=85', description: 'Slow mornings, room to relax and a little more time together.' },
];
export const hotelForRoom = id => hotels.find(hotel => hotel.rooms.includes(Number(id)));
