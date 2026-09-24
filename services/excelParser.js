const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');

/**
 * Normalizes Excel date or string to YYYY-MM-DD
 */
function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (isNaN(dateInfo.getTime())) return null;
    return dateInfo.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'tgl. produksi' || str.toLowerCase() === 'tanggal') {
    return null;
  }
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
  // Parse standard Date string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
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
    return parseNum(val.result);
  }
  const clean = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  if (!clean || clean === '-' || clean === '.') return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Gets cell raw value from SheetJS worksheet
 */
function getCellRaw(ws, address) {
  if (!ws || !address) return null;
  const cell = ws[address];
  if (!cell) return null;
  if (cell.v !== undefined && cell.v !== null) return cell.v;
  if (cell.w !== undefined && cell.w !== null) return cell.w;
  return null;
}

/**
 * Safely gets string cell value
 */
function getCellStr(ws, address) {
  const v = getCellRaw(ws, address);
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Safely gets numeric cell value
 */
function getCellNum(ws, address) {
  const v = getCellRaw(ws, address);
  return parseNum(v);
}

/**
 * Helper to get value checking primary address and fallback addresses
 */
function getFirstValidStr(ws, addresses) {
  for (const addr of addresses) {
    const s = getCellStr(ws, addr);
    if (s && s !== ':' && s !== '-' && s !== 'null' && s !== 'undefined') {
      return s;
    }
  }
  return '';
}

function getFirstValidNum(ws, addresses) {
  for (const addr of addresses) {
    const n = getCellNum(ws, addr);
    if (n !== null && !isNaN(n)) {
      return n;
    }
  }
  return null;
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

  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true,
      raw: false
    });
  } catch (err) {
    return {
      isValid: false,
      fileHash,
      errors: ['Berkas Excel tidak dapat dibaca. Pastikan berkas berformat .xlsx yang valid dan tidak terkunci sandi.'],
      warnings
    };
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      isValid: false,
      fileHash,
      errors: ['Berkas Excel tidak memiliki lembar kerja (worksheet).'],
      warnings
    };
  }

  // Find Sheets (case-insensitive & trimmed)
  const sheetDepanName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'DEPAN');
  const sheetBelakangName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'BELAKANG');

  if (!sheetDepanName) {
    errors.push('Sheet "DEPAN" tidak ditemukan pada file Excel.');
  }
  if (!sheetBelakangName) {
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

  const sheetDepan = workbook.Sheets[sheetDepanName];
  const sheetBelakang = workbook.Sheets[sheetBelakangName];

  // 1. Ekstraksi Identitas (Sheet DEPAN)
  // Mendukung posisi sel standar dan variasi format merger sel
  const rawDate = getCellRaw(sheetDepan, 'E4') || getCellRaw(sheetDepan, 'F4') || getCellRaw(sheetDepan, 'G4');
  const normalizedDate = normalizeDate(rawDate);

  const rawProductName = getFirstValidStr(sheetDepan, ['C4', 'D4']);
  const rawProductCode = getFirstValidStr(sheetDepan, ['C5', 'D5']);
  const rawLine = getFirstValidStr(sheetDepan, ['G4', 'H4', 'I4', 'K4']);
  const rawBatchNumber = getFirstValidStr(sheetDepan, ['G5', 'H5', 'I5', 'K5']);

  const identity = {
    productName: rawProductName,
    productCode: rawProductCode,
    productionDate: normalizedDate,
    workHours: getFirstValidNum(sheetDepan, ['E5', 'F5']),
    line: (rawLine && rawLine.toLowerCase() !== 'line') ? rawLine : '',
    batchNumber: (rawBatchNumber && rawBatchNumber.toLowerCase() !== 'jam' && rawBatchNumber.toLowerCase() !== 'no. batch') ? rawBatchNumber : '',
    meatPercentage: getFirstValidNum(sheetDepan, ['K4', 'N5', 'O5', 'P5']),
    formRejectPercentage: getFirstValidNum(sheetDepan, ['M4', 'Q4', 'R4', 'S4'])
  };

  // Cek apakah file merupakan template kosong (belum diisi data sama sekali)
  const isCompletelyEmptyTemplate = !identity.productName && !identity.productCode && !identity.batchNumber && !identity.productionDate;
  if (isCompletelyEmptyTemplate) {
    errors.push('Berkas Excel yang diunggah masih berupa template kosong (belum terisi data produksi). Harap isi data batch pada formulir sebelum diunggah.');
  } else {
    // Validasi Identitas Wajib
    if (!identity.productName) errors.push('Nama Produk (sel C4/D4) wajib diisi.');
    if (!identity.productCode) errors.push('Kode Produk (sel C5/D5) wajib diisi.');
    if (!identity.productionDate) errors.push('Tanggal Produksi (sel E4/F4) wajib diisi dengan format tanggal yang benar.');
    if (!identity.line) errors.push('Line Produksi (sel G4/K4) wajib diisi.');
    if (!identity.batchNumber) errors.push('Nomor Batch (sel G5/K5) wajib diisi.');
  }

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
    const batchCode = getCellStr(sheetDepan, `C${item.row}`) || getCellStr(sheetDepan, `B${item.row}`);
    const temp = getCellNum(sheetDepan, `D${item.row}`) !== null ? getCellNum(sheetDepan, `D${item.row}`) : getCellNum(sheetDepan, `C${item.row}`);
    const weight = getCellNum(sheetDepan, `E${item.row}`) !== null ? getCellNum(sheetDepan, `E${item.row}`) : getCellNum(sheetDepan, `D${item.row}`);
    
    if (weight !== null && weight > 0) {
      materials.push({
        category: item.cat,
        itemName: customName,
        batchCode: (batchCode && batchCode !== customName) ? batchCode : null,
        temperatureC: temp,
        weightKg: weight
      });
    }
  });

  // Marinade / TSP
  const airMarinadeWeight = getCellNum(sheetDepan, 'E17') || getCellNum(sheetDepan, 'D17') || getCellNum(sheetDepan, 'E27') || getCellNum(sheetDepan, 'D27');
  const airMarinadeTemp = getCellNum(sheetDepan, 'D18') || getCellNum(sheetDepan, 'C18') || getCellNum(sheetDepan, 'D28');
  if (airMarinadeWeight !== null && airMarinadeWeight > 0) {
    materials.push({
      category: 'marinade_tsp',
      itemName: 'Air (Marinade)',
      batchCode: null,
      temperatureC: airMarinadeTemp,
      weightKg: airMarinadeWeight
    });
  }

  const sayuranWeight = getCellNum(sheetDepan, 'E19') || getCellNum(sheetDepan, 'D19') || getCellNum(sheetDepan, 'E30') || getCellNum(sheetDepan, 'D30');
  if (sayuranWeight !== null && sayuranWeight > 0) {
    materials.push({
      category: 'marinade_tsp',
      itemName: getCellStr(sheetDepan, 'A19') || getCellStr(sheetDepan, 'A30') || 'Sayuran',
      batchCode: null,
      temperatureC: null,
      weightKg: sayuranWeight
    });
  }

  // Lain-lain
  const lainLainWeight = getCellNum(sheetDepan, 'E24') || getCellNum(sheetDepan, 'D24') || getCellNum(sheetDepan, 'E26') || getCellNum(sheetDepan, 'D26');
  if (lainLainWeight !== null && lainLainWeight > 0) {
    materials.push({
      category: 'lain_lain',
      itemName: getCellStr(sheetDepan, 'A24') || getCellStr(sheetDepan, 'A26') || 'Lain-lain',
      batchCode: null,
      temperatureC: null,
      weightKg: lainLainWeight
    });
  }

  // Batter & Breader
  const batterWeight = getCellNum(sheetDepan, 'E28') || getCellNum(sheetDepan, 'D28') || getCellNum(sheetDepan, 'E8') || getCellNum(sheetDepan, 'D8');
  if (batterWeight !== null && batterWeight > 0 && !materials.some(m => m.itemName === 'Batter')) {
    materials.push({
      category: 'batter',
      itemName: 'Batter',
      batchCode: null,
      temperatureC: null,
      weightKg: batterWeight
    });
  }

  const airBatterWeight = getCellNum(sheetDepan, 'E29') || getCellNum(sheetDepan, 'D29');
  if (airBatterWeight !== null && airBatterWeight > 0) {
    materials.push({
      category: 'batter',
      itemName: 'Air (Batter)',
      batchCode: null,
      temperatureC: null,
      weightKg: airBatterWeight
    });
  }

  const breaderWeight = getCellNum(sheetDepan, 'E34') || getCellNum(sheetDepan, 'D34') || getCellNum(sheetDepan, 'E14') || getCellNum(sheetDepan, 'D14');
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
  function addMetric(machineName, parameterName, unit, addresses, metricType = 'actual') {
    const addrs = Array.isArray(addresses) ? addresses : [addresses];
    let valNum = null;
    let valStr = null;

    for (const addr of addrs) {
      const n = getCellNum(sheetDepan, addr);
      if (n !== null) {
        valNum = n;
        break;
      }
      const s = getCellStr(sheetDepan, addr);
      if (s && s !== '-' && s !== ':') {
        valStr = s;
        break;
      }
    }

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
  addMetric('Ruang', 'Suhu ruang Meatprep', '°C', ['G8', 'F8', 'E8']);
  addMetric('Ruang', 'Suhu Ruang Chillroom', '°C', ['G9', 'F9', 'E9']);
  addMetric('Bowl Cutter', 'Speed', 'RPM', ['G11', 'F11', 'G12']);
  addMetric('Bowl Cutter', 'Suhu Emulsi', '°C', ['G12', 'F12', 'E13']);
  addMetric('Grinder', 'Ukuran Saringan', 'mm', ['G14', 'F14', 'E17']);
  addMetric('Grinder', 'Hasil', 'kg', ['G15', 'F15', 'E18']);
  addMetric('Mixer Preparation', 'Suhu Air', '°C', ['G17', 'F17', 'E21']);
  addMetric('Mixer Preparation', 'Lama Pengadukan', 'menit', ['G18', 'F18', 'E22']);
  addMetric('Mixer Preparation', 'Viscositas', 'cP', ['G20', 'F20', 'E24']);
  addMetric('Mixer Preparation', 'Salinitas', '%', ['G21', 'F21', 'E25']);
  addMetric('Mixer Unimix', 'Suhu Adonan', '°C', ['G23', 'F23', 'E28']);
  addMetric('Preparasi Fla', 'Suhu Fla after Cooling', '°C', ['G25', 'F25', 'E30']);
  addMetric('Tumbler', 'Drum Speed', 'RPM', ['G28', 'F28']);
  addMetric('Tumbler', 'Total Lama Waktu', 'menit', ['G29', 'F29']);
  addMetric('Forming / Revo', 'Suhu Adonan', '°C', ['G35', 'F35']);
  addMetric('Forming / Revo', 'Pressure', 'bar', ['G36', 'F36']);
  addMetric('Forming / Revo', 'Speed', 'spm', ['G37', 'F37']);

  addMetric('Batter Station', 'Suhu Batter', '°C', ['M8', 'L8', 'N9', 'O9']);
  addMetric('Batter Station', 'Viscositas', 'sec', ['M9', 'L9', 'N10', 'O10']);
  addMetric('Batter Station', 'Salinitas', '%', ['M10', 'L10', 'N11', 'O11']);
  addMetric('Fryer', 'Suhu Seting', '°C', ['M15', 'L15', 'N19', 'O19'], 'setting');
  addMetric('Fryer', 'Suhu Aktual', '°C', ['M16', 'L16', 'N20', 'O20'], 'actual');
  addMetric('Fryer', 'Lama Pemasakan', 'detik', ['M17', 'L17', 'N21', 'O21']);
  addMetric('Fryer', 'TPM Minyak', '%', ['M18', 'L18', 'N22', 'O22']);
  addMetric('HLT', 'Suhu Awal Daging', '°C', ['M20', 'L20', 'N28', 'O28']);
  addMetric('HLT', 'Suhu Infeed', '°C', ['M21', 'L21', 'N29', 'O29']);
  addMetric('HLT', 'Suhu OutFeed', '°C', ['M22', 'L22', 'N30', 'O30']);
  addMetric('Kualitas Produk', 'Suhu Pusat (CT)', '°C', ['M27', 'L27', 'A10', 'B10']);

  // Metrik Ruang Packing (dari BELAKANG)
  const packingTemp = getCellNum(sheetBelakang, 'C4') || getCellNum(sheetBelakang, 'B7') || getCellNum(sheetBelakang, 'C7');
  if (packingTemp !== null) {
    machineMetrics.push({ machineName: 'Packing Room', parameterName: 'Suhu Ruang Packing', unit: '°C', metricType: 'actual', valueNumeric: packingTemp, valueText: null });
  }
  const iqfTemp = getCellNum(sheetBelakang, 'C5') || getCellNum(sheetBelakang, 'B8') || getCellNum(sheetBelakang, 'C8');
  if (iqfTemp !== null) {
    machineMetrics.push({ machineName: 'IQF', parameterName: 'Suhu Ruang IQF', unit: '°C', metricType: 'actual', valueNumeric: iqfTemp, valueText: null });
  }

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
    const cookingKg = getCellNum(sheetDepan, `D${r.row}`) || getCellNum(sheetDepan, `C${r.row}`);
    const packingKg = getCellNum(sheetDepan, `E${r.row}`) || getCellNum(sheetDepan, `D${r.row}`);

    if (cookingKg !== null && cookingKg > 0) {
      rejects.push({ stage: 'cooking', rejectType: typeName, weightKg: cookingKg });
    }
    if (packingKg !== null && packingKg > 0 && packingKg !== cookingKg) {
      rejects.push({ stage: 'packing', rejectType: typeName, weightKg: packingKg });
    }
  });

  const totalRejectKg = rejects.reduce((sum, r) => sum + r.weightKg, 0);

  // 5. Ekstraksi Output Produk (Sheet BELAKANG)
  const outputs = [];
  for (let r = 21; r <= 32; r++) {
    const pallet = getCellStr(sheetBelakang, `G${r}`) || getCellStr(sheetBelakang, `V${r}`);
    const boxes = getCellNum(sheetBelakang, `H${r}`) || getCellNum(sheetBelakang, `W${r}`);
    const kg = getCellNum(sheetBelakang, `I${r}`) || getCellNum(sheetBelakang, `Y${r}`);
    const bstb = getCellStr(sheetBelakang, `J${r}`) || getCellStr(sheetBelakang, `AA${r}`);

    if (pallet && pallet.toUpperCase() === 'TOTAL') break;
    if (kg !== null && kg > 0) {
      outputs.push({
        palletNo: (pallet && pallet.toUpperCase() !== 'PALET') ? pallet : `Palet ${outputs.length + 1}`,
        boxCount: boxes,
        weightKg: kg,
        bstbNo: bstb || null
      });
    }
  }

  // Hitung total output good
  let outputGoodKg = outputs.reduce((sum, o) => sum + o.weightKg, 0);
  if (outputGoodKg === 0) {
    const explicitTotal = getCellNum(sheetBelakang, 'I23') || getCellNum(sheetBelakang, 'Y26') || getCellNum(sheetBelakang, 'Y39');
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
