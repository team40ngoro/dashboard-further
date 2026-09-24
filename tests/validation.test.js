const test = require('node:test');
const assert = require('node:assert/strict');

test('Batch Validation Engine Test', async (t) => {
  const { validateBatchData } = require('../services/validationService');

  const validParsedData = {
    isValid: true,
    fileHash: 'abcdef1234567890abcdef1234567890',
    identity: {
      productName: 'NUGGET AYAM 500G',
      productCode: 'NUG-500',
      productionDate: '2026-09-24',
      line: 'Line 1',
      batchNumber: 'BATCH-20260924-001',
      workHours: 8.0,
      meatPercentage: 55.5
    },
    materials: [
      { category: 'bahan_baku', itemName: 'SBB/Dp BL/BB', batchCode: 'B-01', temperatureC: -2.5, weightKg: 1200.0 }
    ],
    totalMaterialKg: 1200.0,
    machineMetrics: [
      { machineName: 'Fryer', parameterName: 'Suhu Aktual', unit: '°C', metricType: 'actual', valueNumeric: 182.5, valueText: null }
    ],
    rejects: [
      { stage: 'cooking', rejectType: 'Rusak', weightKg: 10.0 }
    ],
    totalRejectKg: 10.0,
    outputs: [
      { palletNo: 'Palet 1', boxCount: 50, weightKg: 1190.0, bstbNo: 'BSTB-01' }
    ],
    outputGoodKg: 1190.0,
    errors: [],
    warnings: []
  };

  await t.test('accepts valid batch data', async () => {
    const result = await validateBatchData(validParsedData, 1);
    assert.equal(result.isValid, true, 'Valid batch should pass validation');
    assert.equal(result.errors.length, 0);
  });

  await t.test('rejects missing mandatory identity fields', async () => {
    const invalidData = JSON.parse(JSON.stringify(validParsedData));
    invalidData.identity.batchNumber = '';
    invalidData.identity.productionDate = null;

    const result = await validateBatchData(invalidData, 1);
    assert.equal(result.isValid, false, 'Should be invalid if batchNumber or date missing');
    assert.ok(result.errors.some(e => e.includes('Nomor Batch')));
    assert.ok(result.errors.some(e => e.includes('Tanggal Produksi')));
  });

  await t.test('flags negative weights or invalid numbers', async () => {
    const negativeData = JSON.parse(JSON.stringify(validParsedData));
    negativeData.materials[0].weightKg = -50;

    const result = await validateBatchData(negativeData, 1);
    assert.equal(result.isValid, false, 'Negative material weight should be invalid');
    assert.ok(result.errors.some(e => e.includes('negatif')));
  });
});
