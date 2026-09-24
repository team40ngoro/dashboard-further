const test = require('node:test');
const assert = require('node:assert/strict');

test('Dashboard Analytics & Chart Metrics Aggregation Test', async (t) => {
  const { getDashboardMetrics } = require('../services/dashboardService');
  const { saveBatchTransaction } = require('../controllers/uploadController');

  // Insert test batches for branch 1 and branch 2
  await saveBatchTransaction({
    batchData: {
      identity: {
        productName: 'NUGGET AYAM 500G',
        productCode: 'NUG-500',
        productionDate: '2026-09-24',
        line: 'Line 1',
        batchNumber: 'BATCH-METRIC-01',
        workHours: 8.0,
        meatPercentage: 55.0
      },
      materials: [{ category: 'bahan_baku', itemName: 'SBB', weightKg: 1000.0 }],
      totalMaterialKg: 1000.0,
      machineMetrics: [
        { machineName: 'Fryer', parameterName: 'Suhu Aktual', unit: '°C', metricType: 'actual', valueNumeric: 182.0, valueText: null }
      ],
      rejects: [{ stage: 'cooking', rejectType: 'Gosong', weightKg: 20.0 }],
      totalRejectKg: 20.0,
      outputs: [{ palletNo: 'P1', weightKg: 980.0 }],
      outputGoodKg: 980.0,
      calculatedRejectPct: 2.0,
      fileHash: 'hash_m1'
    },
    branchId: 1,
    userId: 3
  });

  await t.test('calculates summary KPIs accurately', async () => {
    const metrics = await getDashboardMetrics({}, 1); // Scoped to Branch 1
    assert.ok(metrics, 'Metrics object should be returned');
    assert.ok(metrics.kpis.totalBatches >= 1);
    assert.ok(metrics.kpis.totalMaterialKg >= 1000.0);
    assert.ok(metrics.kpis.totalOutputKg >= 980.0);
    assert.ok(metrics.kpis.totalRejectKg >= 20.0);
    assert.ok(metrics.kpis.globalRejectPct > 0);
  });

  await t.test('returns structured chart series for Output vs Material, Rejects, and Machines', async () => {
    const metrics = await getDashboardMetrics({}, 1);
    
    // Output vs Material chart data
    assert.ok(metrics.charts.outputTrend.labels.length > 0);
    assert.ok(metrics.charts.outputTrend.outputData.length > 0);
    assert.ok(metrics.charts.outputTrend.materialData.length > 0);

    // Rejects Breakdown chart data
    assert.ok(metrics.charts.rejectsBreakdown.labels.length > 0);
    assert.ok(metrics.charts.rejectsBreakdown.data.length > 0);

    // Machine Metrics chart data
    assert.ok(Array.isArray(metrics.availableMachineParams));
  });
});
