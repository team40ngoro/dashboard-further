const { query } = require('../config/database');

/**
 * Calculates aggregated dashboard metrics, KPIs, and chart data series
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

  batchSql += ' ORDER BY b.production_date ASC, b.created_at ASC';

  const batches = await query(batchSql, params);
  const batchIds = batches.map(b => b.id);

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

  // 3. Prepare Chart 1: Output vs Material Trend (Grouped by Date)
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

  // 4. Prepare Chart 2: Rejects Breakdown (by Type)
  let rejectsBreakdown = { labels: [], data: [], colors: [] };
  if (batchIds.length > 0) {
    const rejectRows = await query(`
      SELECT reject_type, stage, SUM(weight_kg) as total_kg
      FROM batch_rejects
      WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
      GROUP BY reject_type, stage
      ORDER BY total_kg DESC
    `, batchIds);

    const typeAgg = new Map();
    rejectRows.forEach(r => {
      const key = `${r.reject_type} (${r.stage})`;
      typeAgg.set(key, (typeAgg.get(key) || 0) + Number(r.total_kg));
    });

    rejectsBreakdown = {
      labels: Array.from(typeAgg.keys()),
      data: Array.from(typeAgg.values()).map(v => parseFloat(v.toFixed(2)))
    };
  }

  // 5. Prepare Chart 3: Machine Parameters Trend
  // Available parameters list
  let availableMachineParams = [];
  let machineMetricsTrend = { labels: [], values: [], unit: '', paramName: '' };

  if (batchIds.length > 0) {
    const distinctParams = await query(`
      SELECT DISTINCT machine_name, parameter_name, unit
      FROM batch_machine_metrics
      WHERE batch_id IN (${batchIds.map(() => '?').join(',')})
      ORDER BY machine_name ASC, parameter_name ASC
    `, batchIds);

    availableMachineParams = distinctParams.map(p => ({
      key: `${p.machine_name} - ${p.parameter_name}`,
      machineName: p.machine_name,
      parameterName: p.parameter_name,
      unit: p.unit
    }));

    // Selected parameter
    const selectedParamKey = filters.machineParam || (availableMachineParams.length > 0 ? availableMachineParams[0].key : null);
    
    if (selectedParamKey) {
      const matched = availableMachineParams.find(p => p.key === selectedParamKey) || availableMachineParams[0];
      if (matched) {
        const metricRows = await query(`
          SELECT mm.value_numeric, mm.unit, b.batch_number, b.production_date
          FROM batch_machine_metrics mm
          JOIN production_batches b ON mm.batch_id = b.id
          WHERE mm.batch_id IN (${batchIds.map(() => '?').join(',')})
            AND mm.machine_name = ?
            AND mm.parameter_name = ?
            AND mm.value_numeric IS NOT NULL
          ORDER BY b.production_date ASC, b.id ASC
        `, [...batchIds, matched.machineName, matched.parameterName]);

        machineMetricsTrend = {
          paramName: matched.key,
          unit: matched.unit,
          labels: metricRows.map(r => r.batch_number),
          values: metricRows.map(r => Number(r.value_numeric))
        };
      }
    }
  }

  return {
    kpis: {
      totalBatches,
      totalMaterialKg,
      totalOutputKg,
      totalRejectKg,
      globalRejectPct
    },
    charts: {
      outputTrend,
      rejectsBreakdown,
      machineMetricsTrend
    },
    availableMachineParams,
    batchesSummaryTable: batches.slice(0, 20) // Top 20 for table preview
  };
}

module.exports = {
  getDashboardMetrics
};
