import { AuditLog } from '../models/auditModel.js';
export const recordAudit = (actor, action, targetType, targetId, reference, changes = {}, transaction) => AuditLog.create({
  actor_id: actor?.id || null, actor_name: actor ? `${actor.firstName} ${actor.lastName}` : 'Local provisioning',
  actor_role: actor?.role ?? null, action, target_type: targetType, target_id: targetId, reference, changes,
}, { transaction });
export const auditDisplay = (row, locale) => {
  const value = row.toJSON();
  const labels = { ROOM_UPDATED: 'Room updated', CLOSURE_CREATED: 'Booking dates closed', CLOSURE_RELEASED: 'Booking dates reopened', REPORT_EXPORTED: 'Report exported', BOOKING_CREATED: 'Booking saved', BOOKING_CONFIRMED: 'Booking confirmed', BOOKING_UPDATED: 'Booking updated', BOOKING_CANCELLED: 'Booking cancelled', BOOKING_DELETED: 'Booking deleted', BOOKING_DELETION_REQUESTED: 'Booking deletion requested', BOOKING_DELETION_DISMISSED: 'Booking deletion dismissed', ACCOUNT_CREATED: 'Account created', ACCOUNT_UPDATED: 'Account updated', ACCOUNT_ROLE_CHANGED: 'Role changed', PASSWORD_RESET: 'Password reset', ACCOUNT_DELETED: 'Account deleted' };
  const kind = value.action.split('_').at(-1);
  const event = ({ CREATED: 'Created', UPDATED: 'Updated', CHANGED: 'Updated', DELETED: 'Deleted' })[kind] || 'Activity';
  const role = ({ ADMIN: 'Administrator', BOOKING_STAFF: 'Booking Staff', GUEST: 'Guest' })[value.actor_role] || 'Not recorded';
  const source = ({ BOOKING: 'Bookings', ROOM: 'Rooms & rates', ACCOUNT: 'Users', CLOSURE: 'Availability', REPORT: 'Reports' })[value.target_type] || value.target_type;
  const actionLabel = labels[value.action] || value.action;
  return {
    id: value.audit_id, actor_name: value.actor_name, reference: value.reference, role, source, event,
    eventClass: event.toLowerCase(), actionLabel,
    timestamp: new Date(value.createdAt).toLocaleString(locale, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }),
  };
};

const formatValue = value => ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '—';

export function auditFields(changes) {
  return Object.entries(changes || {})
    .filter(([name]) => !/password|secret|(?:access|card|session)_?token|security_code/i.test(name))
    .map(([name, value]) => {
      const isDiff = value && typeof value === 'object' && ('before' in value || 'after' in value);
      return {
        field: (name.charAt(0).toUpperCase() + name.slice(1)).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
        before: isDiff ? formatValue(value.before) : '—',
        after: formatValue(isDiff ? value.after : value),
      };
    });
}
