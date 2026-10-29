import { Op } from 'sequelize';
import { BookingRoom } from '../models/bookingModel.js';
import { hotels, hotelForRoom } from '../services/hotelCatalog.js';
import { positiveId, string, fail } from '../services/validation.js';
import { updateCatalogRoom } from '../services/adminCatalogService.js';
const display = room => ({ ...room.toJSON(), hotelName: hotelForRoom(room.room_id)?.name, priceLabel: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(room.price)) });
export const adminCatalogController = {
  rooms: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '', hotelId = req.query.hotelId ? positiveId(req.query.hotelId, 'hotel') : null;
    const hotel = hotelId ? hotels.find(item => item.id === hotelId) : null;
    if (hotelId && !hotel) fail(400, 'Choose a valid hotel.');
    const where = hotel ? { room_id: hotel.rooms } : {};
    if (q) where[Op.or] = ['room_number', 'type'].map(field => ({ [field]: { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` } }));
    const rooms = await BookingRoom.findAll({ where, order: [['room_id', 'ASC']] });
    res.render('admin-rooms', { title: 'Rooms & rates | StayBook', q, rooms: rooms.map(display), hotels: hotels.map(item => ({ ...item, selected: item.id === hotelId })) });
  },
  editRoom: async (req, res) => {
    const room = await BookingRoom.findByPk(positiveId(req.params.id)); if (!room) fail(404, 'Room not found.');
    res.render('admin-room-edit', { title: 'Edit room | StayBook', room: display(room) });
  },
  updateRoom: async (req, res) => { const id = positiveId(req.params.id); await updateCatalogRoom(id, req.body, req.account); res.json({ success: true, redirect: `/admin/rooms/${id}/edit` }); },
};
