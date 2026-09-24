const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

test('Excel Parser for LPP FP REV 2', async (t) => {
  const { generateSampleExcel } = require('../services/sampleExcelGenerator');
  const { parseLppExcel } = require('../services/excelParser');

  const testFilePath = path.join(__dirname, 'temp_sample_lpp.xlsx');
  
  await t.test('generate sample valid LPP Excel file', async () => {
    await generateSampleExcel(testFilePath, {
      productName: 'NUGGET AYAM 500G',
      productCode: 'NUG-500',
      productionDate: '2026-09-24',
      line: 'Line 1',
      batchNumber: 'BATCH-20260924-001',
      workHours: 8.0,
      meatPercentage: 55.5
    });
    assert.ok(fs.existsSync(testFilePath), 'Sample excel file should be generated');
  });

  await t.test('parse valid LPP Excel file and extract structured sections', async () => {
    const result = await parseLppExcel(testFilePath);
    assert.ok(result, 'Parser should return a result object');
    assert.equal(result.errors.length, 0, 'Should not have extraction errors');

    // Identity
    assert.equal(result.identity.productName, 'NUGGET AYAM 500G');
    assert.equal(result.identity.productCode, 'NUG-500');
    assert.equal(result.identity.line, 'Line 1');
    assert.equal(result.identity.batchNumber, 'BATCH-20260924-001');

    // Materials
    assert.ok(result.materials.length > 0, 'Should extract materials');
    const meatMat = result.materials.find(m => m.itemName.includes('SBB'));
    assert.ok(meatMat, 'Should contain SBB material');
    assert.ok(meatMat.weightKg > 0, 'Weight should be greater than 0');

    // Machine Metrics
    assert.ok(result.machineMetrics.length > 0, 'Should extract machine metrics');
    const fryerTemp = result.machineMetrics.find(m => m.machineName === 'Fryer' && m.parameterName.includes('Suhu Aktual'));
    assert.ok(fryerTemp, 'Should extract Fryer Suhu Aktual');

    // Rejects
    assert.ok(result.rejects.length > 0, 'Should extract reject categories');

    // Outputs
    assert.ok(result.outputs.length > 0, 'Should extract output product boxes & kg');
    assert.ok(result.outputGoodKg > 0, 'Total output good kg should be calculated');
  });

  await t.test('detect missing sheet or invalid format gracefully', async () => {
    const invalidFilePath = path.join(__dirname, 'temp_invalid.xlsx');
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('UNKNOWN_SHEET');
    await wb.xlsx.writeFile(invalidFilePath);

    const result = await parseLppExcel(invalidFilePath);
    assert.ok(result.errors.length > 0, 'Should flag missing required sheets DEPAN and BELAKANG');

    if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
  });

  // Cleanup
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
});
