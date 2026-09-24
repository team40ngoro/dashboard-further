const { query } = require('../config/database');

/**
 * Calculates aggregated dashboard metrics, KPIs, and compact multi-chart datasets
 */
async function getDashboardMetrics(filters = {}, effectiveBranchId = null) {
  const targetBranch = effectiveBranchId || filters.branchId;

  // 1. Fetch filtered production batches
  let batchSql = `
    SELECT b.*, br.name AS branch_name, br.code AS branch_code
    FROM production_batches b
    JOIN branches br ON b.branch_id = br.id
    WHERE 1=1
  `;
  const params = [];

  if (targetBranch) {
    batchSql += ' AND b.branch_id = ?';
    params.push(Number(targetBranch));
  }

  if (filters.startDate) {
    batchSql += ' AND b.production_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    batchSql += ' AND b.production_date <= ?';
    params.push(filters.endDate);
  }

  if (filters.productCode) {
    batchSql += ' AND (b.product_code LIKE ? OR b.product_name LIKE ?)';
    params.push(`%${filters.productCode}%`, `%${filters.productCode}%`);
  }

  if (filters.line) {
    batchSql += ' AND b.line = ?';
    params.push(filters.line);
  }

  batchSql += ' ORDER BY b.production_date ASC, b.id ASC';

  const batches = await query(batchSql, params);
  const batchIds = batches.map(b => b.id);
  const batchLabels = batches.map(b => b.batch_number);

  // 2. Compute KPI summaries
  const totalBatches = batches.length;
  let totalMaterialKg = 0;
  let totalOutputKg = 0;
  let totalRejectKg = 0;

  batches.forEach(b => {
    totalMaterialKg += Number(b.total_material_kg) || 0;
    totalOutputKg += Number(b.output_good_kg) || 0;
    totalRejectKg += Number(b.total_reject_kg) || 0;
  });

  totalMaterialKg = parseFloat(totalMaterialKg.toFixed(2));
  totalOutputKg = parseFloat(totalOutputKg.toFixed(2));
  totalRejectKg = parseFloat(totalRejectKg.toFixed(2));

  // Global reject percentage per PRD: Total Reject / (Total Output Good + Total Reject) * 100
  let globalRejectPct = 0;
  const denominator = totalOutputKg + totalRejectKg;
  if (denominator > 0) {
    globalRejectPct = parseFloat(((totalRejectKg / denominator) * 100).toFixed(2));
  }

  // Global yield percentage (Output Good / Total Material) * 100
  let globalYieldPct = 0;
  if (totalMaterialKg > 0) {
    globalYieldPct = parseFloat(((totalOutputKg / totalMaterialKg) * 100).toFixed(2));
  }

  // 3. Section A Chart 1: Output vs Material Trend (Grouped by Date/Batch)
  const dateMap = new Map();
  batches.forEach(b => {
    const dStr = typeof b.production_date === 'string' ? b.production_date.split('T')[0] : (b.production_date ? b.production_date.toISOString().split('T')[0] : 'Unknown');
    if (!dateMap.has(dStr)) {
      dateMap.set(dStr, { output: 0, material: 0, count: 0 });
    }
    const entry = dateMap.get(dStr);
    entry.output += Number(b.output_good_kg) || 0;
    entry.material += Number(b.total_material_kg) || 0;
    entry.count += 1;
  });

  const outputTrend = {
    labels: Array.from(dateMap.keys()),
    outputData: Array.from(dateMap.values()).map(v => parseFloat(v.output.toFixed(2))),
    materialData: Array.from(dateMap.values()).map(v => parseFloat(v.material.toFixed(2)))
  };

  // 4. Section A Chart 2: Komposisi Bahan Baku (Materials Composition Breakdown)
  let materialsComposition = { labels: [], data: [] };
  if (batchIds.length > 0) {
    const placeholders = batchIds.map(() => '?').join(',');
    const matRows = await query(`
      SELECT item_name, category, SUM(weight_kg) as total_kg
      FROM batch_materials
      WHERE batch_id IN (${placeholders})
      GROUP BY item_name, category
      ORDER BY total_kg DESC
    `, batchIds);

    const matAgg = new Map();
    matRows.forEach(r => {
      const name = r.item_name || r.category || 'Bahan Baku';
      matAgg.set(name, (matAgg.get(name) || 0) + Number(r.total_kg || 0));
    });

    materialsComposition = {
      labels: Array.from(matAgg.keys()).slice(0, 7),
      data: Array.from(matAgg.values()).slice(0, 7).map(v => parseFloat(v.toFixed(2)))
    };
  }

  // 5. Section A Chart 3: Efisiensi Rendemen & Rasio Rijek per Batch (Yield & Reject Trend)
  const productionYield = {
    labels: batchLabels,
    yieldData: batches.map(b => {
      const mat = Number(b.total_material_kg) || 0;
      const out = Number(b.output_good_kg) || 0;
      return mat > 0 ? parseFloat(((out / mat) * 100).toFixed(2)) : 0;
    }),
    rejectData: batches.map(b => parseFloat(Number(b.calculated_reject_pct || 0).toFixed(2)))
  };

  // 6. Section B: Machine & Process Parameters Extraction (6 Compact Datasets)
  let machineRows = [];
  if (batchIds.length > 0) {
    const placeholders = batchIds.map(() => '?').join(',');
    machineRows = await query(`
      SELECT mm.batch_id, b.batch_number, mm.machine_name, mm.parameter_name, mm.unit, mm.metric_type, mm.value_numeric, mm.value_text
      FROM batch_machine_metrics mm
      JOIN production_batches b ON mm.batch_id = b.id
      WHERE mm.batch_id IN (${placeholders})
      ORDER BY b.production_date ASC, b.id ASC
    `, batchIds);
  }

  // Helper to extract series per parameter name matching
  function getMetricSeries(searchParams) {
    const map = new Map();
    // initialize each batch with null
    batchIds.forEach(id => map.set(id, null));

    machineRows.forEach(row => {
      if (row.value_numeric !== null && row.value_numeric !== undefined) {
        const pName = (row.parameter_name || '').toLowerCase();
        const mName = (row.machine_name || '').toLowerCase();
        for (const sp of searchParams) {
          if ((sp.param && pName.includes(sp.param.toLowerCase())) || 
              (sp.machine && mName.includes(sp.machine.toLowerCase()) && (!sp.param || pName.includes(sp.param.toLowerCase())))) {
            map.set(row.batch_id, Number(row.value_numeric));
            break;
          }
        }
      }
    });

    return batchIds.map(id => map.get(id));
  }

  // B1: Suhu Ruang & Area Kritis (°C)
  const tempCriticalZone = {
    labels: batchLabels,
    meatprep: getMetricSeries([{ machine: 'Ruang', param: 'Meatprep' }, { param: 'Suhu ruang Meatprep' }]),
    chillroom: getMetricSeries([{ machine: 'Ruang', param: 'Chillroom' }, { param: 'Suhu Ruang Chillroom' }]),
    iqf: getMetricSeries([{ machine: 'IQF', param: 'IQF' }, { param: 'Suhu Ruang IQF' }]),
    suhuPusat: getMetricSeries([{ param: 'Suhu Pusat' }, { param: 'CT' }])
  };

  // B2: Mixer & Preparasi Adonan
  const mixerPrep = {
    labels: batchLabels,
    speedRpm: getMetricSeries([{ machine: 'Bowl Cutter', param: 'Speed' }, { machine: 'Mixer', param: 'Speed' }]),
    suhuAir: getMetricSeries([{ machine: 'Mixer', param: 'Suhu Air' }, { param: 'Suhu Air' }]),
    suhuEmulsi: getMetricSeries([{ machine: 'Bowl Cutter', param: 'Emulsi' }, { machine: 'Mixer', param: 'Adonan' }]),
    lamaPengadukan: getMetricSeries([{ machine: 'Mixer', param: 'Lama Pengadukan' }, { param: 'Lama Pengadukan' }])
  };

  // B3: Penggorengan / Fryer
  const fryerMetrics = {
    labels: batchLabels,
    suhuSetting: getMetricSeries([{ machine: 'Fryer', param: 'Seting' }, { machine: 'Fryer', param: 'Setting' }]),
    suhuAktual: getMetricSeries([{ machine: 'Fryer', param: 'Aktual' }]),
    lamaPemasakan: getMetricSeries([{ machine: 'Fryer', param: 'Lama Pemasakan' }]),
    tpmMinyak: getMetricSeries([{ machine: 'Fryer', param: 'TPM' }])
  };

  // B4: Stasiun Batter
  const batterStation = {
    labels: batchLabels,
    suhuBatter: getMetricSeries([{ machine: 'Batter', param: 'Suhu Batter' }, { param: 'Suhu Batter' }]),
    viskositas: getMetricSeries([{ machine: 'Batter', param: 'Viscositas' }, { param: 'Viskositas' }]),
    salinitas: getMetricSeries([{ machine: 'Batter', param: 'Salinitasi' }, { param: 'Salinitas' }])
  };

  // B5: HLT Continuous Cooker
  const hltMetrics = {
    labels: batchLabels,
    suhuAwalDaging: getMetricSeries([{ machine: 'HLT', param: 'Awal Daging' }]),
    suhuInfeed: getMetricSeries([{ machine: 'HLT', param: 'Infeed' }]),
    suhuOutfeed: getMetricSeries([{ machine: 'HLT', param: 'Outfeed' }])
  };

  // B6: Forming & Revo
  const formingMetrics = {
    labels: batchLabels,
    pressure: getMetricSeries([{ machine: 'Forming', param: 'Pressure' }]),
    speed: getMetricSeries([{ machine: 'Forming', param: 'Speed' }]),
    suhuAdonan: getMetricSeries([{ machine: 'Forming', param: 'Suhu Adonan' }])
  };

  return {
    kpis: {
      totalBatches,
      totalMaterialKg,
      totalOutputKg,
      totalRejectKg,
      globalRejectPct,
      globalYieldPct
    },
    charts: {
      outputTrend,
      materialsComposition,
      productionYield,
      tempCriticalZone,
      mixerPrep,
      fryerMetrics,
      batterStation,
      hltMetrics,
      formingMetrics
    },
    batchesSummaryTable: batches.slice(0, 20) // Top 20 for table preview
  };
}

module.exports = {
  getDashboardMetrics
};
