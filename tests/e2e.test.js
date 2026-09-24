const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

test('End-to-End System Integration & Workflow Test', async (t) => {
  const { runMigrations, query } = require('../config/database');
  const { authenticateUser } = require('../controllers/authController');
  const { generateSampleExcel } = require('../services/sampleExcelGenerator');
  const { parseLppExcel } = require('../services/excelParser');
  const { validateBatchData } = require('../services/validationService');
  const { saveBatchTransaction } = require('../controllers/uploadController');
  const { getDashboardMetrics } = require('../services/dashboardService');
  const { getBatchById } = require('../controllers/batchController');

  await t.test('1. Database migration and seeding', async () => {
    const res = await runMigrations();
    assert.equal(res.success, true);
  });

  await t.test('2. Multi-user authentication & role resolution', async () => {
    const admin = await authenticateUser('admin.pusat', 'password123');
    assert.equal(admin.role, 'admin_pusat');
    assert.equal(admin.branch_id, null);

    const cikandeUser = await authenticateUser('uploader.cikande', 'password123');
    assert.equal(cikandeUser.role, 'pengunggah_cabang');
    assert.equal(cikandeUser.branch_id, 1);
  });

  const sampleFile = path.join(__dirname, 'e2e_sample.xlsx');

  await t.test('3. Excel generation, parsing, validation and atomic save', async () => {
    await generateSampleExcel(sampleFile, {
      productName: 'CHICKEN NUGGET PREMIUM 500G',
      productCode: 'CNG-500',
      productionDate: '2026-09-24',
      line: 'Line 1',
      batchNumber: 'BATCH-E2E-999',
      workHours: 8.0,
      meatPercentage: 60.0
    });

    const parsed = await parseLppExcel(sampleFile);
    const validation = await validateBatchData(parsed, 1);
    assert.equal(validation.isValid, true);

    const saved = await saveBatchTransaction({
      batchData: parsed,
      branchId: 1,
      userId: 3,
      ipAddress: '127.0.0.1'
    });
    assert.ok(saved.batchId > 0);

    // Verify batch details
    const batch = await getBatchById(saved.batchId, 1);
    assert.equal(batch.batch_number, 'BATCH-E2E-999');
    assert.ok(batch.materials.length > 0);
    assert.ok(batch.machineMetrics.length > 0);
  });

  await t.test('4. Dashboard metrics and branch isolation', async () => {
    // Scoped to Cikande (branch 1)
    const branchMetrics = await getDashboardMetrics({}, 1);
    assert.ok(branchMetrics.kpis.totalBatches >= 1);
    assert.ok(branchMetrics.kpis.totalOutputKg > 0);

    // Central analyst view (cross-branch)
    const centralMetrics = await getDashboardMetrics({}, null);
    assert.ok(centralMetrics.kpis.totalBatches >= branchMetrics.kpis.totalBatches);
  });

  // Cleanup
  if (fs.existsSync(sampleFile)) fs.unlinkSync(sampleFile);
});
