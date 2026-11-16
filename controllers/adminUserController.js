import { Op } from 'sequelize';
import { Account, accountRoles } from '../models/accountModel.js';
import { accountHome } from './accountController.js';
import { positiveId, string, fail } from '../services/validation.js';
import { createAdminAccount, updateAdminAccount, deleteAdminAccount } from '../services/adminAccountService.js';
const fields = ['account_id', 'first_name', 'last_name', 'email', 'username', 'role', 'version'];
const roleLabels = { GUEST: 'Guest', ADMIN: 'Administrator', BOOKING_STAFF: 'Booking Staff' };
export const adminUserController = {
  list: async (req, res) => {
    const q = req.query.q ? string(req.query.q, 'Search', 100) : '', role = req.query.role || '';
    if (role && !accountRoles.includes(role)) fail(400, 'Choose a valid account role.');
    const page = req.query.page === undefined ? 1 : positiveId(req.query.page, 'page');
    if (page > 10000) fail(400, 'Choose a valid page.');
    const where = role ? { role } : {}, pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    if (q) where[Op.or] = ['first_name', 'last_name', 'email', 'username'].map(field => ({ [field]: { [Op.like]: pattern } }));
    const { count, rows } = await Account.findAndCountAll({ where, attributes: fields, order: [['account_id', 'DESC']], limit: 25, offset: (page - 1) * 25 });
    const pages = Math.max(1, Math.ceil(count / 25)), link = target => `/admin/users?${new URLSearchParams({ q, role, page: target })}`;
    res.render('admin-users', { title: 'Users | StayBook', adminTitle: 'Users', q, count, page, pages, adminSelected: role === 'ADMIN', guestSelected: role === 'GUEST', staffSelected: role === 'BOOKING_STAFF', users: rows.map(row => ({ ...row.toJSON(), roleLabel: roleLabels[row.role] })), previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null });
  },
  form: async (req, res) => {
    const account = req.params.id ? await Account.findByPk(positiveId(req.params.id), { attributes: fields }) : null;
    if (req.params.id && !account) fail(404, 'Account not found.');
    res.render('admin-user-form', { title: `${account ? 'Edit account' : 'Add user'} | StayBook`, adminTitle: account ? 'Edit account' : 'Add user', user: account?.toJSON(), editing: Boolean(account), administrator: account?.role === 'ADMIN', staffSelected: account?.role === 'BOOKING_STAFF', ownAccount: account?.account_id === req.account.id });
  },
  create: async (req, res) => { const account = await createAdminAccount(req.body, req.account); res.json({ success: true, redirect: `/admin/users/${account.account_id}/edit` }); },
  update: async (req, res) => {
    const id = positiveId(req.params.id), result = await updateAdminAccount(id, req.body, req.account);
    let redirect = `/admin/users/${id}/edit`;
    if (id === req.account.id && result.account.role !== 'ADMIN') redirect = accountHome(result.account);
    if (id === req.account.id && result.passwordChanged) redirect = '/sign-in';
    res.json({ success: true, redirect });
  },
  delete: async (req, res) => { await deleteAdminAccount(positiveId(req.params.id), req.account); res.json({ success: true, redirect: '/admin/users' }); },
};
