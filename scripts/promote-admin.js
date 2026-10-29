import { Account } from '../models/accountModel.js';
import { sequelize } from '../models/db.js';
import { recordAudit } from '../services/auditService.js';

try {
  const identifier = process.argv[2]?.trim().toLowerCase();
  if (!identifier || identifier.length > 255) throw new Error('Usage: node scripts/promote-admin.js <existing-username-or-email>');
  const account = await Account.findOne({ where: { [identifier.includes('@') ? 'email' : 'username']: identifier } });
  if (!account) throw new Error('Account not found. Create the account before granting admin access.');
  if (account.role !== 'ADMIN') await sequelize.transaction(async transaction => { await account.update({ role: 'ADMIN' }, { transaction }); await recordAudit(null, 'ACCOUNT_ROLE_CHANGED', 'ACCOUNT', account.account_id, account.username || account.email, { role: { before: 'GUEST', after: 'ADMIN' } }, transaction); });
  console.log('Admin access granted to the requested account.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await sequelize.close(); }
