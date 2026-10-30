import { hotels } from '../services/hotelCatalog.js';
import { reportFilters, reservationReport, reservationCsv } from '../services/reportService.js';
import { recordAudit } from '../services/auditService.js';
const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
export const adminReportController = {
  page: async (req, res) => {
    const filters = reportFilters(req.query), report = await reservationReport(filters);
    const query = new URLSearchParams({ from: filters.from, to: filters.to, ...(filters.hotelId ? { hotelId: filters.hotelId } : {}) });
    res.render('admin-reports', { title: 'Reports | StayBook', ...report, from: filters.from, to: filters.to, valueLabel: php(report.value), types: report.types.map(row => ({ ...row, valueLabel: php(row.value) })), hotels: hotels.map(row => ({ ...row, selected: row.id === filters.hotelId })), exportUrl: `/admin/reports/export?${query}` });
  },
  export: async (req, res) => {
    const filters = reportFilters(req.query), file = await reservationCsv(filters);
    await recordAudit(req.account, 'REPORT_EXPORTED', 'REPORT', null, `${filters.from} – ${filters.to}`, { from: filters.from, to: filters.to, hotelId: filters.hotelId, records: file.count });
    res.set('Content-Disposition', `attachment; filename="staybook-reservations-${filters.from}-${filters.to}.csv"`).type('text/csv; charset=utf-8').send(file.csv);
  },
};
