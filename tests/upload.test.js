const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

test('Upload, Preview & Atomic Batch Commit Test', async (t) => {
  const { generateSampleExcel } = require('../services/sampleExcelGenerator');
  const { parseLppExcel } = require('../services/excelParser');
  const { validateBatchData } = require('../services/validationService');
  const { saveBatchTransaction } = require('../controllers/uploadController');
  const { query } = require('../config/database');

  const testFilePath = path.join(__dirname, 'temp_upload_test.xlsx');
  await generateSampleExcel(testFilePath, {
    productName: 'NUGGET AYAM 500G',
    productCode: 'NUG-500',
    productionDate: '2026-09-24',
    line: 'Line 2',
    batchNumber: 'BATCH-20260924-002',
    workHours: 7.5,
    meatPercentage: 58.0
  });

  await t.test('parse and validate uploaded file for preview', async () => {
    const parsed = await parseLppExcel(testFilePath);
    const validation = await validateBatchData(parsed, 1);
    assert.equal(validation.isValid, true);
    assert.equal(parsed.identity.line, 'Line 2');
    assert.equal(parsed.identity.batchNumber, 'BATCH-20260924-002');
  });

  await t.test('save batch in atomic database transaction with audit log', async () => {
    const parsed = await parseLppExcel(testFilePath);
    const result = await saveBatchTransaction({
      batchData: parsed,
      branchId: 1,
      userId: 3,
      ipAddress: '127.0.0.1'
    });

    assert.ok(result, 'Transaction should return result');
    assert.ok(result.batchId > 0, 'Batch ID should be generated');

    // Verify batch inserted
    const batches = await query('SELECT * FROM production_batches WHERE id = ?', [result.batchId]);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].batch_number, 'BATCH-20260924-002');
  });

  // Cleanup
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
});
