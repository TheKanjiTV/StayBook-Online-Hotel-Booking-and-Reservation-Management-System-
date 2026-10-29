import { sequelize } from '../models/db.js';
import { Account } from '../models/accountModel.js';
import { email, string, positiveId, fail } from './validation.js';
import { hashPassword } from './accountService.js';
import { recordAudit } from './auditService.js';
import { checkVersion } from './adminBookingService.js';

function accountValues(body) {
  const username = body.username ? string(body.username, 'Username', 100).toLowerCase() : null;
  if (username && !/^[a-z0-9][a-z0-9_.-]{1,99}$/.test(username)) fail(400, 'Use 2–100 letters, numbers, dots, hyphens or underscores for the username.');
  if (!['GUEST', 'ADMIN'].includes(body.role)) fail(400, 'Choose a valid account role.');
  return { first_name: string(body.firstName, 'First name'), last_name: string(body.lastName, 'Last name'), email: email(body.email), username, role: body.role };
}
// Serialize role/delete changes against all current admins, including the actor.
// Rechecking here prevents concurrent demotions from removing the last admin.
async function adminTransaction(actor, work) {
  try {
    return await sequelize.transaction(async transaction => {
      const admins = await Account.findAll({ where: { role: 'ADMIN' }, order: [['account_id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
      if (!admins.some(admin => admin.account_id === actor.id)) fail(403, 'Administrator access is required.');
      return work(admins, transaction);
    });
  } catch (error) { if (error.name === 'SequelizeUniqueConstraintError') fail(409, 'Email or username already exists.'); throw error; }
}
export async function createAdminAccount(body, actor) {
  const values = accountValues(body), password_hash = await hashPassword(body.password);
  return adminTransaction(actor, async (admins, transaction) => {
    const account = await Account.create({ ...values, password_hash }, { transaction });
    await recordAudit(actor, 'ACCOUNT_CREATED', 'ACCOUNT', account.account_id, values.username || values.email, values, transaction);
    return account;
  });
}
export async function updateAdminAccount(id, body, actor) {
  const values = accountValues(body), passwordHash = body.password ? await hashPassword(body.password) : null;
  return adminTransaction(actor, async (admins, transaction) => {
    const account = await Account.findByPk(positiveId(id), { transaction, lock: transaction.LOCK.UPDATE });
    if (!account) fail(404, 'Account not found.');
    checkVersion(account, body);
    if (account.role === 'ADMIN' && values.role !== 'ADMIN' && admins.length <= 1) fail(409, 'At least one administrator must remain.');
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => String(account[key] ?? '') !== String(value ?? '')).map(([key, value]) => [key, { before: account[key], after: value }]));
    const beforeRole = account.role;
    if (passwordHash) { values.password_hash = passwordHash; values.session_version = account.session_version + 1; }
    if (Object.keys(changes).length || passwordHash) await account.update(values, { transaction });
    const reference = account.username || account.email;
    if (Object.keys(changes).length) await recordAudit(actor, 'ACCOUNT_UPDATED', 'ACCOUNT', account.account_id, reference, changes, transaction);
    if (beforeRole !== values.role) await recordAudit(actor, 'ACCOUNT_ROLE_CHANGED', 'ACCOUNT', account.account_id, reference, { role: { before: beforeRole, after: values.role } }, transaction);
    if (passwordHash) await recordAudit(actor, 'PASSWORD_RESET', 'ACCOUNT', account.account_id, reference, { password: 'reset', sessions: 'revoked' }, transaction);
    return { account, passwordChanged: Boolean(passwordHash) };
  });
}
export const deleteAdminAccount = (id, actor) => adminTransaction(actor, async (admins, transaction) => {
  const account = await Account.findByPk(positiveId(id), { transaction, lock: transaction.LOCK.UPDATE });
  if (!account) fail(404, 'Account not found.');
  if (account.account_id === actor.id) fail(400, 'You cannot delete your own account.');
  if (account.role === 'ADMIN' && admins.length <= 1) fail(409, 'At least one administrator must remain.');
  await account.update({ session_version: account.session_version + 1 }, { transaction });
  await recordAudit(actor, 'ACCOUNT_DELETED', 'ACCOUNT', account.account_id, account.username || account.email, { access: 'removed', role: account.role }, transaction);
  await account.destroy({ transaction });
});
