const ExcelJS = require('exceljs');

/**
 * Generate sample Excel workbook conforming to template LPP FP REV 2
 */
async function generateSampleExcel(outputPath, customData = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT. Charoen Pokphand Indonesia - Food Division';
  wb.created = new Date();

  // 1. SHEET DEPAN
  const wsDepan = wb.addWorksheet('DEPAN');

  // Header Title
  wsDepan.getCell('A1').value = 'PT.CHAROEN POKPHAND INDONESIA';
  wsDepan.getCell('A2').value = 'FOOD DIVISION';
  wsDepan.getCell('F1').value = 'LAPORAN PENGENDALIAN PRODUK';

  // Identity
  wsDepan.getCell('A4').value = 'Nama Produk :';
  wsDepan.getCell('C4').value = customData.productName || 'NUGGET AYAM 500G';

  wsDepan.getCell('A5').value = 'Kode Produk :';
  wsDepan.getCell('C5').value = customData.productCode || 'NUG-500';

  wsDepan.getCell('D4').value = 'Tgl. Produksi :';
  wsDepan.getCell('E4').value = customData.productionDate || '2026-09-24';

  wsDepan.getCell('D5').value = 'Waktu Kerja :';
  wsDepan.getCell('E5').value = customData.workHours !== undefined ? customData.workHours : 8.0;

  wsDepan.getCell('F4').value = 'Line :';
  wsDepan.getCell('G4').value = customData.line || 'Line 1';

  wsDepan.getCell('F5').value = 'No. Batch :';
  wsDepan.getCell('G5').value = customData.batchNumber || 'BATCH-20260924-001';

  wsDepan.getCell('J4').value = '% Total Meat :';
  wsDepan.getCell('K4').value = customData.meatPercentage !== undefined ? customData.meatPercentage : 55.5;

  wsDepan.getCell('L4').value = '% Rijek :';
  wsDepan.getCell('M4').value = customData.formRejectPercentage !== undefined ? customData.formRejectPercentage : 1.8;

  // Bahan Baku Table (Left)
  wsDepan.getCell('A7').value = 'Bahan - bahan Baku';
  wsDepan.getCell('C7').value = 'Kode batch';
  wsDepan.getCell('D7').value = 'Suhu (°C)';
  wsDepan.getCell('E7').value = 'Berat (kg)';

  const rawMaterials = [
    { row: 8, name: 'SBB/Dp BL/BB', code: 'B-MEAT-01', temp: -2.5, weight: 1200.0 },
    { row: 9, name: 'Skin', code: 'B-SKN-02', temp: -1.0, weight: 300.0 },
    { row: 10, name: 'Emulsi', code: 'B-EML-03', temp: 4.0, weight: 200.0 },
    { row: 11, name: 'Terigu', code: 'B-TRG-04', temp: null, weight: 150.0 },
    { row: 12, name: 'SAP', code: 'B-SAP-05', temp: null, weight: 50.0 }
  ];

  rawMaterials.forEach(m => {
    wsDepan.getCell(`A${m.row}`).value = m.name;
    wsDepan.getCell(`C${m.row}`).value = m.code;
    wsDepan.getCell(`D${m.row}`).value = m.temp;
    wsDepan.getCell(`E${m.row}`).value = m.weight;
  });

  // Marinade / TSP
  wsDepan.getCell('A16').value = 'Marinade/ TSP';
  wsDepan.getCell('A17').value = 'Air';
  wsDepan.getCell('E17').value = 100.0;
  wsDepan.getCell('A18').value = 'Suhu Air';
  wsDepan.getCell('D18').value = 4.5;
  wsDepan.getCell('A19').value = 'Sayuran';
  wsDepan.getCell('E19').value = 80.0;

  // Lain-lain
  wsDepan.getCell('A23').value = 'Lain - lain';
  wsDepan.getCell('A24').value = 'Bumbu Ekstra';
  wsDepan.getCell('E24').value = 25.0;

  // Batter & Breader
  wsDepan.getCell('A27').value = 'Batter';
  wsDepan.getCell('A28').value = 'Batter';
  wsDepan.getCell('E28').value = 120.0;
  wsDepan.getCell('A29').value = 'Air';
  wsDepan.getCell('E29').value = 180.0;
  wsDepan.getCell('A33').value = 'Predust & Breader';
  wsDepan.getCell('A34').value = 'Predust & Breader';
  wsDepan.getCell('E34').value = 250.0;

  // Parameter Mesin (Tengah & Kanan)
  wsDepan.getCell('F8').value = 'Suhu ruang Meatprep';
  wsDepan.getCell('G8').value = 12.0;
  wsDepan.getCell('F9').value = 'Suhu Ruang Chillroom';
  wsDepan.getCell('G9').value = 4.0;

  wsDepan.getCell('F11').value = 'Bowl cutter Speed';
  wsDepan.getCell('G11').value = 3200;
  wsDepan.getCell('F12').value = 'Bowl cutter Suhu emulsi';
  wsDepan.getCell('G12').value = 8.5;

  wsDepan.getCell('F14').value = 'Grinder Ukuran Saringan';
  wsDepan.getCell('G14').value = 4;
  wsDepan.getCell('F15').value = 'Grinder Hasil';
  wsDepan.getCell('G15').value = 1500;

  wsDepan.getCell('F17').value = 'Mixer Suhu Air';
  wsDepan.getCell('G17').value = 3.5;
  wsDepan.getCell('F18').value = 'Mixer Lama Pengadukan';
  wsDepan.getCell('G18').value = 15;
  wsDepan.getCell('F20').value = 'Mixer Viscositas';
  wsDepan.getCell('G20').value = 450;
  wsDepan.getCell('F21').value = 'Mixer Salinitas';
  wsDepan.getCell('G21').value = 1.6;

  wsDepan.getCell('F23').value = 'Mixer Unimix Suhu Adonan';
  wsDepan.getCell('G23').value = 6.0;

  wsDepan.getCell('F28').value = 'Tumbler Drum Speed';
  wsDepan.getCell('G28').value = 18;
  wsDepan.getCell('F29').value = 'Tumbler Total Lama Waktu';
  wsDepan.getCell('G29').value = 45;

  wsDepan.getCell('F35').value = 'Forming Suhu Adonan';
  wsDepan.getCell('G35').value = 4.5;
  wsDepan.getCell('F36').value = 'Forming Preasure';
  wsDepan.getCell('G36').value = 3.5;
  wsDepan.getCell('F37').value = 'Forming Speed';
  wsDepan.getCell('G37').value = 65;

  // Batter, Fryer, HLT (Kanan)
  wsDepan.getCell('L8').value = 'Batter Suhu Batter';
  wsDepan.getCell('M8').value = 10.0;
  wsDepan.getCell('L9').value = 'Batter Viscositas';
  wsDepan.getCell('M9').value = 22;
  wsDepan.getCell('L10').value = 'Batter Salinitasi';
  wsDepan.getCell('M10').value = 1.4;

  wsDepan.getCell('L15').value = 'Fryer Suhu Seting';
  wsDepan.getCell('M15').value = 185;
  wsDepan.getCell('L16').value = 'Fryer Suhu Aktual';
  wsDepan.getCell('M16').value = 182.5;
  wsDepan.getCell('L17').value = 'Fryer Lama Pemasakan';
  wsDepan.getCell('M17').value = 45;
  wsDepan.getCell('L18').value = 'Fryer TPM minyak';
  wsDepan.getCell('M18').value = 14.5;

  wsDepan.getCell('L20').value = 'HLT Suhu Awal Daging';
  wsDepan.getCell('M20').value = -1.5;
  wsDepan.getCell('L21').value = 'HLT Suhu Infeed';
  wsDepan.getCell('M21').value = 85.0;
  wsDepan.getCell('L22').value = 'HLT Suhu OutFeed';
  wsDepan.getCell('M22').value = 88.0;

  wsDepan.getCell('L27').value = 'Suhu Pusat (CT)';
  wsDepan.getCell('M27').value = 76.5;

  // Rejects Table
  wsDepan.getCell('A40').value = 'Jenis';
  wsDepan.getCell('D40').value = 'cooking';
  wsDepan.getCell('E40').value = 'packing';

  const rejectsList = [
    { row: 41, name: 'Rusak', cooking: 12.5, packing: 8.0 },
    { row: 42, name: 'Jatuh ke lantai', cooking: 5.0, packing: 3.5 },
    { row: 43, name: 'Kulit', cooking: 2.0, packing: 1.0 },
    { row: 44, name: 'Serpihan', cooking: 4.5, packing: 2.0 },
    { row: 45, name: 'Serbuk', cooking: 6.0, packing: 3.0 },
    { row: 46, name: 'Gosong', cooking: 8.5, packing: 0.0 },
    { row: 47, name: 'Sampel QC', cooking: 3.0, packing: 2.0 }
  ];

  rejectsList.forEach(r => {
    wsDepan.getCell(`A${r.row}`).value = r.name;
    wsDepan.getCell(`D${r.row}`).value = r.cooking;
    wsDepan.getCell(`E${r.row}`).value = r.packing;
  });

  // 2. SHEET BELAKANG
  const wsBelakang = wb.addWorksheet('BELAKANG');
  wsBelakang.getCell('A1').value = 'PT.CHAROEN POKPHAND INDONESIA';
  wsBelakang.getCell('A2').value = 'FOOD DIVISION - PENGEMASAN & PRODUK JADI';

  wsBelakang.getCell('A4').value = 'Suhu Ruang Packing';
  wsBelakang.getCell('C4').value = 15.0;
  wsBelakang.getCell('A5').value = 'Suhu Ruang IQF';
  wsBelakang.getCell('C5').value = -35.0;
  wsBelakang.getCell('A6').value = 'Speed conveyor';
  wsBelakang.getCell('C6').value = 12.5;
  wsBelakang.getCell('A7').value = 'Suhu Pusat';
  wsBelakang.getCell('C7').value = -18.0;

  // Output Products Table
  wsBelakang.getCell('G19').value = 'JUMLAH PRODUK';
  wsBelakang.getCell('G20').value = 'Palet';
  wsBelakang.getCell('H20').value = 'Boks';
  wsBelakang.getCell('I20').value = 'Kg';
  wsBelakang.getCell('J20').value = 'No. BSTB';

  const outputProducts = [
    { row: 21, pallet: 'Palet 1', boxes: 60, kg: 1200.0, bstb: 'BSTB-001' },
    { row: 22, pallet: 'Palet 2', boxes: 55, kg: 1100.0, bstb: 'BSTB-002' }
  ];

  outputProducts.forEach(op => {
    wsBelakang.getCell(`G${op.row}`).value = op.pallet;
    wsBelakang.getCell(`H${op.row}`).value = op.boxes;
    wsBelakang.getCell(`I${op.row}`).value = op.kg;
    wsBelakang.getCell(`J${op.row}`).value = op.bstb;
  });

  wsBelakang.getCell('G23').value = 'Total';
  wsBelakang.getCell('H23').value = 115;
  wsBelakang.getCell('I23').value = 2300.0;

  if (outputPath) {
    await wb.xlsx.writeFile(outputPath);
    return outputPath;
  }
  return await wb.xlsx.writeBuffer();
}

async function generateSampleExcelBuffer(customData = {}) {
  return await generateSampleExcel(null, customData);
}

module.exports = {
  generateSampleExcel,
  generateSampleExcelBuffer
};
