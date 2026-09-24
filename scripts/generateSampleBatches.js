const { saveBatchTransaction } = require('../controllers/uploadController');
const { runMigrations, query } = require('../config/database');

async function seedSampleBatches() {
  console.log('🌱 Seeding demo production batches across branches...');
  await runMigrations();

  const branches = await query('SELECT id, code, name FROM branches');
  if (!branches || branches.length === 0) {
    console.warn('No branches found to seed.');
    return;
  }

  const sampleProducts = [
    { name: 'NUGGET AYAM 500G', code: 'NUG-500', meat: 55.0 },
    { name: 'CHICKEN STICK 250G', code: 'STK-250', meat: 52.0 },
    { name: 'KARAGE AYAM 500G', code: 'KRG-500', meat: 62.0 },
    { name: 'SOSIS AYAM PREMIUM', code: 'SOS-300', meat: 68.0 }
  ];

  const lines = ['Line 1', 'Line 2', 'Line 3'];
  const dates = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];

  let count = 0;
  for (const branch of branches) {
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const prod = sampleProducts[(branch.id + i) % sampleProducts.length];
      const line = lines[i % lines.length];
      const batchNo = `BATCH-${branch.code}-${date.replace(/-/g, '')}-0${i + 1}`;

      const totalMat = 1500 + (Math.random() * 300);
      const totalOut = totalMat * (0.95 + (Math.random() * 0.03));
      const totalRej = totalMat - totalOut;
      const rejectPct = parseFloat(((totalRej / totalMat) * 100).toFixed(2));

      const batchData = {
        fileHash: `hash_${branch.code}_${batchNo}`,
        identity: {
          productName: prod.name,
          productCode: prod.code,
          productionDate: date,
          line: line,
          batchNumber: batchNo,
          workHours: 8.0,
          meatPercentage: prod.meat,
          formRejectPercentage: rejectPct
        },
        materials: [
          { category: 'bahan_baku', itemName: 'SBB/Dp BL/BB', batchCode: `B-MEAT-${i}`, temperatureC: -2.0 - (Math.random() * 2), weightKg: parseFloat((totalMat * 0.65).toFixed(2)) },
          { category: 'bahan_baku', itemName: 'Skin', batchCode: `B-SKN-${i}`, temperatureC: -1.0, weightKg: parseFloat((totalMat * 0.15).toFixed(2)) },
          { category: 'bahan_baku', itemName: 'Emulsi', batchCode: `B-EML-${i}`, temperatureC: 3.5, weightKg: parseFloat((totalMat * 0.10).toFixed(2)) },
          { category: 'batter', itemName: 'Batter', batchCode: null, temperatureC: null, weightKg: parseFloat((totalMat * 0.06).toFixed(2)) },
          { category: 'predust_breader', itemName: 'Predust & Breader', batchCode: null, temperatureC: null, weightKg: parseFloat((totalMat * 0.04).toFixed(2)) }
        ],
        totalMaterialKg: parseFloat(totalMat.toFixed(2)),
        machineMetrics: [
          { machineName: 'Fryer', parameterName: 'Suhu Aktual', unit: '°C', metricType: 'actual', valueNumeric: parseFloat((180 + Math.random() * 5).toFixed(1)), valueText: null },
          { machineName: 'Fryer', parameterName: 'TPM Minyak', unit: '%', metricType: 'actual', valueNumeric: parseFloat((12 + Math.random() * 4).toFixed(1)), valueText: null },
          { machineName: 'Kualitas Produk', parameterName: 'Suhu Pusat (CT)', unit: '°C', metricType: 'actual', valueNumeric: parseFloat((75 + Math.random() * 3).toFixed(1)), valueText: null },
          { machineName: 'Bowl Cutter', parameterName: 'Speed', unit: 'RPM', metricType: 'actual', valueNumeric: 3200, valueText: null },
          { machineName: 'Forming / Revo', parameterName: 'Pressure', unit: 'bar', metricType: 'actual', valueNumeric: parseFloat((3.2 + Math.random() * 0.6).toFixed(1)), valueText: null }
        ],
        rejects: [
          { stage: 'cooking', rejectType: 'Rusak', weightKg: parseFloat((totalRej * 0.4).toFixed(2)) },
          { stage: 'cooking', rejectType: 'Gosong', weightKg: parseFloat((totalRej * 0.25).toFixed(2)) },
          { stage: 'packing', rejectType: 'Jatuh ke lantai', weightKg: parseFloat((totalRej * 0.2).toFixed(2)) },
          { stage: 'packing', rejectType: 'Serpihan', weightKg: parseFloat((totalRej * 0.15).toFixed(2)) }
        ],
        totalRejectKg: parseFloat(totalRej.toFixed(2)),
        calculatedRejectPct: rejectPct,
        outputs: [
          { palletNo: 'Palet 1', boxCount: 40, weightKg: parseFloat((totalOut * 0.5).toFixed(2)), bstbNo: `BSTB-${branch.code}-01` },
          { palletNo: 'Palet 2', boxCount: 40, weightKg: parseFloat((totalOut * 0.5).toFixed(2)), bstbNo: `BSTB-${branch.code}-02` }
        ],
        outputGoodKg: parseFloat(totalOut.toFixed(2))
      };

      try {
        await saveBatchTransaction({
          batchData,
          branchId: branch.id,
          userId: 1,
          ipAddress: '127.0.0.1'
        });
        count++;
      } catch (err) {
        // Skip duplicate
      }
    }
  }

  console.log(`✅ Berhasil membuat ${count} demo batch produksi.`);
}

if (require.main === module) {
  seedSampleBatches().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedSampleBatches };
