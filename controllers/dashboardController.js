const { getDashboardMetrics } = require('../services/dashboardService');
const { query } = require('../config/database');

const dashboardController = {
  renderDashboard: async (req, res) => {
    const filters = {
      branchId: req.query.branchId || null,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      productCode: req.query.productCode || '',
      line: req.query.line || '',
      machineParam: req.query.machineParam || ''
    };

    try {
      const [metrics, branches] = await Promise.all([
        getDashboardMetrics(filters, req.effectiveBranchId),
        query('SELECT id, code, name FROM branches ORDER BY name ASC')
      ]);

      res.render('dashboard/index', {
        title: 'Dashboard Pengendalian Produk - CPI Food Division',
        user: req.session.user,
        branches,
        filters,
        metrics,
        initialDataJson: JSON.stringify(metrics)
      });
    } catch (err) {
      console.error('Dashboard render error:', err);
      res.status(500).render('errors/500', {
        title: 'Terjadi Kesalahan',
        message: err.message
      });
    }
  },

  getMetricsApi: async (req, res) => {
    const filters = {
      branchId: req.query.branchId || null,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      productCode: req.query.productCode || '',
      line: req.query.line || '',
      machineParam: req.query.machineParam || ''
    };

    try {
      const metrics = await getDashboardMetrics(filters, req.effectiveBranchId);
      res.json(metrics);
    } catch (err) {
      console.error('API metrics error:', err);
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = dashboardController;
