import { AuditLog } from '../models/auditModel.js';
export const recordAudit = (actor, action, targetType, targetId, reference, changes = {}, transaction) => AuditLog.create({
  actor_id: actor?.id || null, actor_name: actor ? `${actor.firstName} ${actor.lastName}` : 'Local provisioning',
  action, target_type: targetType, target_id: targetId, reference, changes,
}, { transaction });
export const auditDisplay = (row, locale) => {
  const value = row.toJSON();
  const labels = { ROOM_UPDATED: 'Room updated', CLOSURE_CREATED: 'Booking dates closed', CLOSURE_RELEASED: 'Booking dates reopened', REPORT_EXPORTED: 'Report exported', BOOKING_CREATED: 'Booking saved', BOOKING_CONFIRMED: 'Booking confirmed', BOOKING_UPDATED: 'Booking updated', BOOKING_CANCELLED: 'Booking cancelled', BOOKING_DELETED: 'Booking deleted', ACCOUNT_CREATED: 'Account created', ACCOUNT_UPDATED: 'Account updated', ACCOUNT_ROLE_CHANGED: 'Role changed', PASSWORD_RESET: 'Password reset', ACCOUNT_DELETED: 'Account deleted' };
  return { ...value, actionLabel: labels[value.action] || value.action, timestamp: new Date(value.createdAt).toLocaleString(locale, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }), changesText: JSON.stringify(value.changes, null, 2) };
};
