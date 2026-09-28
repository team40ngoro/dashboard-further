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

  await t.test('verify plant access code PIN validation and save with null user', async () => {
    const branches = await query('SELECT * FROM branches WHERE id = ?', [1]);
    assert.equal(branches.length, 1);
    assert.equal(branches[0].access_code, '1234');

    const parsed = await parseLppExcel(testFilePath);
    parsed.identity.batchNumber = 'BATCH-PIN-TEST-003';
    const result = await saveBatchTransaction({
      batchData: parsed,
      branchId: 1,
      userId: null,
      ipAddress: '192.168.1.50'
    });

    assert.ok(result.batchId > 0);
    const batches = await query('SELECT * FROM production_batches WHERE id = ?', [result.batchId]);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].batch_number, 'BATCH-PIN-TEST-003');
  });

  await t.test('AJAX upload process returns structured JSON response with validation status', async () => {
    const { handleUploadProcess } = require('../controllers/uploadController');
    
    // Test with invalid PIN
    const mockReqBadPin = {
      file: { path: testFilePath },
      body: { branchId: 1, accessCode: '9999' },
      xhr: true,
      headers: { accept: 'application/json' },
      session: {}
    };
    let responseStatus = 200;
    let responseJson = null;
    const mockRes = {
      status: (code) => { responseStatus = code; return mockRes; },
      json: (data) => { responseJson = data; return mockRes; }
    };

    await handleUploadProcess(mockReqBadPin, mockRes);
    assert.equal(responseStatus, 403);
    assert.equal(responseJson.success, false);
    assert.ok(responseJson.errors.length > 0);
  });

  await t.test('sequential queue processor commits valid item and isolates invalid item', async () => {
    const { handleProcessQueueItem } = require('../controllers/uploadController');
    const validQueueFile = path.join(__dirname, 'queue_test_valid.xlsx');
    const invalidQueueFile = path.join(__dirname, 'queue_test_invalid.xlsx');

    // 1. Generate valid queue item
    await generateSampleExcel(validQueueFile, {
      productName: 'NUGGET AYAM 500G',
      productCode: 'NUG-500',
      productionDate: '2026-09-25',
      line: 'Line 3',
      batchNumber: 'BATCH-QUEUE-VAL-001'
    });

    // 2. Generate invalid queue item (missing batchNumber and negative weight)
    await generateSampleExcel(invalidQueueFile, {
      productName: '',
      productCode: '',
      productionDate: '2026-09-25',
      line: 'Line 3',
      batchNumber: ''
    });

    // Process valid queue item
    let statusValid = 200;
    let jsonValid = null;
    await handleProcessQueueItem({
      file: { path: validQueueFile, originalname: 'queue_test_valid.xlsx' },
      body: { branchId: 1, accessCode: '1234' },
      ip: '127.0.0.1'
    }, {
      status: (code) => { statusValid = code; return { json: (d) => { jsonValid = d; } }; },
      json: (d) => { jsonValid = d; }
    });

    assert.equal(jsonValid.success, true);
    assert.ok(jsonValid.batchId > 0);
    assert.equal(jsonValid.batchNumber, 'BATCH-QUEUE-VAL-001');

    // Process invalid queue item -> should fail gracefully with errors without stopping queue
    let statusInvalid = 200;
    let jsonInvalid = null;
    await handleProcessQueueItem({
      file: { path: invalidQueueFile, originalname: 'queue_test_invalid.xlsx' },
      body: { branchId: 1, accessCode: '1234' },
      ip: '127.0.0.1'
    }, {
      status: (code) => { statusInvalid = code; return { json: (d) => { jsonInvalid = d; } }; },
      json: (d) => { jsonInvalid = d; }
    });

    assert.equal(statusInvalid, 422);
    assert.equal(jsonInvalid.success, false);
    assert.ok(jsonInvalid.errors.length > 0);

    // Clean up
    if (fs.existsSync(validQueueFile)) fs.unlinkSync(validQueueFile);
    if (fs.existsSync(invalidQueueFile)) fs.unlinkSync(invalidQueueFile);
  });

  await t.test('server /health endpoint returns 200 OK status', async () => {
    const app = require('../server');
    await new Promise((resolve, reject) => {
      const server = app.listen(0, async () => {
        const port = server.address().port;
        try {
          const res = await fetch(`http://127.0.0.1:${port}/health`);
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.status, 'ok');
          assert.ok(typeof body.uptime === 'number');
          server.close(resolve);
        } catch (err) {
          server.close(() => reject(err));
        }
      });
    });
  });

  // Cleanup
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
});
