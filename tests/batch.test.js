const test = require('node:test');
const assert = require('node:assert/strict');

test('Batch Detail, Drill-down & Audit Trail Test', async (t) => {
  const { getBatchById, updateBatch, listBatches } = require('../controllers/batchController');
  const { saveBatchTransaction } = require('../controllers/uploadController');

  // Insert a test batch for testing
  const saved = await saveBatchTransaction({
    batchData: {
      identity: {
        productName: 'NUGGET AYAM 500G',
        productCode: 'NUG-500',
        productionDate: '2026-09-24',
        line: 'Line 1',
        batchNumber: 'BATCH-DETAIL-001',
        workHours: 8.0,
        meatPercentage: 55.0,
        formRejectPercentage: 1.5
      },
      materials: [
        { category: 'bahan_baku', itemName: 'SBB BL', batchCode: 'B-01', temperatureC: -2.0, weightKg: 1000.0 }
      ],
      totalMaterialKg: 1000.0,
      machineMetrics: [
        { machineName: 'Fryer', parameterName: 'Suhu Aktual', unit: '°C', metricType: 'actual', valueNumeric: 180.0, valueText: null }
      ],
      rejects: [
        { stage: 'cooking', rejectType: 'Rusak', weightKg: 10.0 }
      ],
      totalRejectKg: 10.0,
      outputs: [
        { palletNo: 'Palet 1', boxCount: 50, weightKg: 990.0, bstbNo: 'BSTB-01' }
      ],
      outputGoodKg: 990.0,
      calculatedRejectPct: 1.0,
      fileHash: 'test_hash_detail_123'
    },
    branchId: 1,
    userId: 3,
    ipAddress: '127.0.0.1'
  });

  const testBatchId = saved.batchId;

  await t.test('retrieves complete batch with all related tables', async () => {
    const batch = await getBatchById(testBatchId, 1);
    assert.ok(batch, 'Batch should be retrieved');
    assert.equal(batch.batch_number, 'BATCH-DETAIL-001');
    assert.ok(batch.materials.length > 0, 'Materials should be populated');
    assert.ok(batch.machineMetrics.length > 0, 'Machine metrics should be populated');
    assert.ok(batch.rejects.length > 0, 'Rejects should be populated');
    assert.ok(batch.outputs.length > 0, 'Outputs should be populated');
    assert.ok(batch.auditLogs.length > 0, 'Audit logs should be populated');
  });

  await t.test('blocks branch user from viewing another branch batch', async () => {
    // Attempt to access batch of branch 1 while scoped to branch 2
    const forbiddenBatch = await getBatchById(testBatchId, 2);
    assert.equal(forbiddenBatch, null, 'Should return null for unauthorized branch access');
  });

  await t.test('records audit log on batch modification', async () => {
    const updateResult = await updateBatch(testBatchId, {
      productName: 'NUGGET AYAM 500G REVISI',
      line: 'Line 1',
      workHours: 8.5,
      meatPercentage: 56.0,
      reason: 'Koreksi penulisan nama produk dan jam kerja'
    }, 1, '127.0.0.1');

    assert.equal(updateResult.success, true);

    const updatedBatch = await getBatchById(testBatchId, null); // Central view
    assert.equal(updatedBatch.product_name, 'NUGGET AYAM 500G REVISI');
    
    const updateAudit = updatedBatch.auditLogs.find(a => a.action === 'UPDATE_BATCH');
    assert.ok(updateAudit, 'Audit log for UPDATE_BATCH should exist');
    assert.ok(updateAudit.details.includes('Koreksi penulisan'));
  });
});
