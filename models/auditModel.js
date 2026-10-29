import { DataTypes as D } from 'sequelize';
import { sequelize } from './db.js';
export const AuditLog = sequelize.define('AdminAuditLog', {
  audit_id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
  actor_id: { type: D.INTEGER, allowNull: true }, actor_name: { type: D.STRING(200), allowNull: false },
  action: { type: D.STRING(60), allowNull: false }, target_type: { type: D.STRING(30), allowNull: false },
  target_id: { type: D.INTEGER, allowNull: true }, reference: { type: D.STRING(255), allowNull: false },
  changes: { type: D.JSON, allowNull: false },
}, { timestamps: true, updatedAt: false, underscored: true, indexes: [{ fields: ['created_at', 'audit_id'] }, { fields: ['target_type', 'target_id'] }] });
