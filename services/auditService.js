import { AuditLog } from '../models/auditModel.js';
export const recordAudit = (actor, action, targetType, targetId, reference, changes = {}, transaction) => AuditLog.create({
  actor_id: actor?.id || null, actor_name: actor ? `${actor.firstName} ${actor.lastName}` : 'Local provisioning',
  action, target_type: targetType, target_id: targetId, reference, changes,
}, { transaction });
export const auditDisplay = (row, locale) => {
  const value = row.toJSON();
  return { ...value, timestamp: new Date(value.createdAt).toLocaleString(locale, { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }), changesText: JSON.stringify(value.changes, null, 2) };
};
