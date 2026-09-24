const ExcelJS = require('exceljs');
const crypto = require('crypto');
const fs = require('fs');

/**
 * Normalizes Excel date or string to YYYY-MM-DD
 */
function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Match DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  return str;
}

/**
 * Safely parses numeric value
 */
function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'object' && val.result !== undefined) {
    // Formula result in ExcelJS
    return parseNum(val.result);
  }
  const clean = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Safely gets string cell value
 */
function getCellStr(ws, address) {
  const cell = ws.getCell(address);
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && cell.value.text) return cell.value.text.trim();
  if (typeof cell.value === 'object' && cell.value.result) return String(cell.value.result).trim();
  return String(cell.value).trim();
}

/**
 * Safely gets numeric cell value
 */
function getCellNum(ws, address) {
  const cell = ws.getCell(address);
  if (!cell) return null;
  return parseNum(cell.value);
}

/**
 * Parses LPP Excel File (.xlsx)
 */
async function parseLppExcel(filePathOrBuffer) {
  const errors = [];
  const warnings = [];

  let fileBuffer;
  if (typeof filePathOrBuffer === 'string') {
    fileBuffer = fs.readFileSync(filePathOrBuffer);
  } else {
    fileBuffer = filePathOrBuffer;
  }

  // Calculate SHA-256 Hash
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  // Find Sheets (case-insensitive)
  const sheetDepan = workbook.worksheets.find(w => w.name.trim().toUpperCase() === 'DEPAN');
  const sheetBelakang = workbook.worksheets.find(w => w.name.trim().toUpperCase() === 'BELAKANG');

  if (!sheetDepan) {
    errors.push('Sheet "DEPAN" tidak ditemukan pada file Excel.');
  }
  if (!sheetBelakang) {
    errors.push('Sheet "BELAKANG" tidak ditemukan pada file Excel.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      fileHash,
      errors,
      warnings
    };
  }

  // 1. Ekstraksi Identitas (Sheet DEPAN)
  const identity = {
    productName: getCellStr(sheetDepan, 'C4'),
    productCode: getCellStr(sheetDepan, 'C5'),
    productionDate: normalizeDate(sheetDepan.getCell('E4').value),
    workHours: getCellNum(sheetDepan, 'E5'),
    line: getCellStr(sheetDepan, 'G4'),
    batchNumber: getCellStr(sheetDepan, 'G5'),
    meatPercentage: getCellNum(sheetDepan, 'K4'),
    formRejectPercentage: getCellNum(sheetDepan, 'M4')
  };

  // Validasi Identitas Wajib
  if (!identity.productName) errors.push('Nama Produk (C4) wajib diisi.');
  if (!identity.productCode) errors.push('Kode Produk (C5) wajib diisi.');
  if (!identity.productionDate) errors.push('Tanggal Produksi (E4) wajib diisi.');
  if (!identity.line) errors.push('Line (G4) wajib diisi.');
  if (!identity.batchNumber) errors.push('Nomor Batch (G5) wajib diisi.');

  // 2. Ekstraksi Bahan Baku (Sheet DEPAN)
  const materials = [];

  // Baris Bahan Baku Utama (8-12)
  const rawMatDefs = [
    { row: 8, defName: 'SBB/Dp BL/BB', cat: 'bahan_baku' },
    { row: 9, defName: 'Skin', cat: 'bahan_baku' },
    { row: 10, defName: 'Emulsi', cat: 'bahan_baku' },
    { row: 11, defName: 'Terigu', cat: 'bahan_baku' },
    { row: 12, defName: 'SAP', cat: 'bahan_baku' }
  ];

  rawMatDefs.forEach(item => {
    const customName = getCellStr(sheetDepan, `A${item.row}`) || item.defName;
    const batchCode = getCellStr(sheetDepan, `C${item.row}`);
    const temp = getCellNum(sheetDepan, `D${item.row}`);
    const weight = getCellNum(sheetDepan, `E${item.row}`);
    if (weight !== null && weight > 0) {
      materials.push({
        category: item.cat,
        itemName: customName,
        batchCode: batchCode || null,
        temperatureC: temp,
        weightKg: weight
      });
    }
  });

  // Marinade / TSP
  const airMarinadeWeight = getCellNum(sheetDepan, 'E17');
  const airMarinadeTemp = getCellNum(sheetDepan, 'D18');
  if (airMarinadeWeight !== null && airMarinadeWeight > 0) {
    materials.push({
      category: 'marinade_tsp',
      itemName: 'Air (Marinade)',
      batchCode: null,
      temperatureC: airMarinadeTemp,
      weightKg: airMarinadeWeight
    });
  }

  const sayuranWeight = getCellNum(sheetDepan, 'E19');
  if (sayuranWeight !== null && sayuranWeight > 0) {
    materials.push({
      category: 'marinade_tsp',
      itemName: getCellStr(sheetDepan, 'A19') || 'Sayuran',
      batchCode: null,
      temperatureC: null,
      weightKg: sayuranWeight
    });
  }

  // Lain-lain
  const lainLainWeight = getCellNum(sheetDepan, 'E24');
  if (lainLainWeight !== null && lainLainWeight > 0) {
    materials.push({
      category: 'lain_lain',
      itemName: getCellStr(sheetDepan, 'A24') || 'Lain-lain',
      batchCode: null,
      temperatureC: null,
      weightKg: lainLainWeight
    });
  }

  // Batter & Breader
  const batterWeight = getCellNum(sheetDepan, 'E28');
  if (batterWeight !== null && batterWeight > 0) {
    materials.push({
      category: 'batter',
      itemName: 'Batter',
      batchCode: null,
      temperatureC: null,
      weightKg: batterWeight
    });
  }

  const airBatterWeight = getCellNum(sheetDepan, 'E29');
  if (airBatterWeight !== null && airBatterWeight > 0) {
    materials.push({
      category: 'batter',
      itemName: 'Air (Batter)',
      batchCode: null,
      temperatureC: null,
      weightKg: airBatterWeight
    });
  }

  const breaderWeight = getCellNum(sheetDepan, 'E34');
  if (breaderWeight !== null && breaderWeight > 0) {
    materials.push({
      category: 'predust_breader',
      itemName: 'Predust & Breader',
      batchCode: null,
      temperatureC: null,
      weightKg: breaderWeight
    });
  }

  const totalMaterialKg = materials.reduce((sum, m) => sum + (m.weightKg || 0), 0);

  // 3. Ekstraksi Parameter Mesin (EAV)
  const machineMetrics = [];
  function addMetric(machineName, parameterName, unit, address, metricType = 'actual') {
    const valNum = getCellNum(sheetDepan, address);
    const valStr = getCellStr(sheetDepan, address);
    if (valNum !== null || (valStr && valStr.length > 0)) {
      machineMetrics.push({
        machineName,
        parameterName,
        unit,
        metricType,
        valueNumeric: valNum,
        valueText: valNum === null ? valStr : null
      });
    }
  }

  // Parameter Ruang & Mesin
  addMetric('Ruang', 'Suhu ruang Meatprep', '°C', 'G8');
  addMetric('Ruang', 'Suhu Ruang Chillroom', '°C', 'G9');
  addMetric('Bowl Cutter', 'Speed', 'RPM', 'G11');
  addMetric('Bowl Cutter', 'Suhu Emulsi', '°C', 'G12');
  addMetric('Grinder', 'Ukuran Saringan', 'mm', 'G14');
  addMetric('Grinder', 'Hasil', 'kg', 'G15');
  addMetric('Mixer Preparation', 'Suhu Air', '°C', 'G17');
  addMetric('Mixer Preparation', 'Lama Pengadukan', 'menit', 'G18');
  addMetric('Mixer Preparation', 'Viscositas', 'cP', 'G20');
  addMetric('Mixer Preparation', 'Salinitas', '%', 'G21');
  addMetric('Mixer Unimix', 'Suhu Adonan', '°C', 'G23');
  addMetric('Preparasi Fla', 'Suhu Fla after Cooling', '°C', 'G25');
  addMetric('Tumbler', 'Drum Speed', 'RPM', 'G28');
  addMetric('Tumbler', 'Total Lama Waktu', 'menit', 'G29');
  addMetric('Forming / Revo', 'Suhu Adonan', '°C', 'G35');
  addMetric('Forming / Revo', 'Pressure', 'bar', 'G36');
  addMetric('Forming / Revo', 'Speed', 'spm', 'G37');

  addMetric('Batter Station', 'Suhu Batter', '°C', 'M8');
  addMetric('Batter Station', 'Viscositas', 'sec', 'M9');
  addMetric('Batter Station', 'Salinitas', '%', 'M10');
  addMetric('Fryer', 'Suhu Seting', '°C', 'M15', 'setting');
  addMetric('Fryer', 'Suhu Aktual', '°C', 'M16', 'actual');
  addMetric('Fryer', 'Lama Pemasakan', 'detik', 'M17');
  addMetric('Fryer', 'TPM Minyak', '%', 'M18');
  addMetric('HLT', 'Suhu Awal Daging', '°C', 'M20');
  addMetric('HLT', 'Suhu Infeed', '°C', 'M21');
  addMetric('HLT', 'Suhu OutFeed', '°C', 'M22');
  addMetric('Kualitas Produk', 'Suhu Pusat (CT)', '°C', 'M27');

  // Metrik Ruang Packing (dari BELAKANG)
  const packingTemp = getCellNum(sheetBelakang, 'C4');
  if (packingTemp !== null) machineMetrics.push({ machineName: 'Packing Room', parameterName: 'Suhu Ruang Packing', unit: '°C', metricType: 'actual', valueNumeric: packingTemp, valueText: null });
  const iqfTemp = getCellNum(sheetBelakang, 'C5');
  if (iqfTemp !== null) machineMetrics.push({ machineName: 'IQF', parameterName: 'Suhu Ruang IQF', unit: '°C', metricType: 'actual', valueNumeric: iqfTemp, valueText: null });

  // 4. Ekstraksi Rijek (Sheet DEPAN)
  const rejects = [];
  const rejectDefs = [
    { row: 41, defName: 'Rusak' },
    { row: 42, defName: 'Jatuh ke lantai' },
    { row: 43, defName: 'Kulit' },
    { row: 44, defName: 'Serpihan' },
    { row: 45, defName: 'Serbuk' },
    { row: 46, defName: 'Gosong' },
    { row: 47, defName: 'Sampel QC' }
  ];

  rejectDefs.forEach(r => {
    const typeName = getCellStr(sheetDepan, `A${r.row}`) || r.defName;
    const cookingKg = getCellNum(sheetDepan, `D${r.row}`);
    const packingKg = getCellNum(sheetDepan, `E${r.row}`);

    if (cookingKg !== null && cookingKg > 0) {
      rejects.push({ stage: 'cooking', rejectType: typeName, weightKg: cookingKg });
    }
    if (packingKg !== null && packingKg > 0) {
      rejects.push({ stage: 'packing', rejectType: typeName, weightKg: packingKg });
    }
  });

  const totalRejectKg = rejects.reduce((sum, r) => sum + r.weightKg, 0);

  // 5. Ekstraksi Output Produk (Sheet BELAKANG)
  const outputs = [];
  for (let r = 21; r <= 30; r++) {
    const pallet = getCellStr(sheetBelakang, `G${r}`);
    const boxes = getCellNum(sheetBelakang, `H${r}`);
    const kg = getCellNum(sheetBelakang, `I${r}`);
    const bstb = getCellStr(sheetBelakang, `J${r}`);

    if (pallet.toUpperCase() === 'TOTAL') break;
    if (kg !== null && kg > 0) {
      outputs.push({
        palletNo: pallet || `Palet ${outputs.length + 1}`,
        boxCount: boxes,
        weightKg: kg,
        bstbNo: bstb || null
      });
    }
  }

  // Hitung total output good
  let outputGoodKg = outputs.reduce((sum, o) => sum + o.weightKg, 0);
  if (outputGoodKg === 0) {
    // Fallback baca sel Total di I23 jika rincian tidak terisi
    const explicitTotal = getCellNum(sheetBelakang, 'I23');
    if (explicitTotal !== null && explicitTotal > 0) {
      outputGoodKg = explicitTotal;
    }
  }

  // Hitung rasio rijek sesuai standar PRD: Total Rijek / (Output Baik + Total Rijek) * 100
  let calculatedRejectPct = 0;
  const denominator = outputGoodKg + totalRejectKg;
  if (denominator > 0) {
    calculatedRejectPct = parseFloat(((totalRejectKg / denominator) * 100).toFixed(2));
  }

  return {
    isValid: errors.length === 0,
    fileHash,
    identity,
    materials,
    totalMaterialKg: parseFloat(totalMaterialKg.toFixed(2)),
    machineMetrics,
    rejects,
    totalRejectKg: parseFloat(totalRejectKg.toFixed(2)),
    calculatedRejectPct,
    outputs,
    outputGoodKg: parseFloat(outputGoodKg.toFixed(2)),
    errors,
    warnings
  };
}

module.exports = {
  parseLppExcel,
  normalizeDate,
  parseNum
};
