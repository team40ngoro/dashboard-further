/**
 * LPP Food Division Compact Multi-Panel Dashboard Controller (Light Mode Optimized)
 */

let chartInstances = {};

function safeDestroyChart(id) {
  if (chartInstances[id]) {
    try { chartInstances[id].destroy(); } catch (_) {}
    delete chartInstances[id];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const initialDataElem = document.getElementById('initial-dashboard-data');
  if (initialDataElem) {
    try {
      const data = JSON.parse(initialDataElem.textContent);
      initAllCharts(data);
    } catch (e) {
      console.error('Failed to parse initial dashboard data:', e);
    }
  }

  // Bind filter form submission via AJAX
  const filterForm = document.getElementById('dashboard-filter-form');
  if (filterForm) {
    filterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await fetchAndUpdateDashboard();
    });

    const branchSelect = document.getElementById('branchId');
    if (branchSelect) {
      branchSelect.addEventListener('change', () => {
        fetchAndUpdateDashboard();
      });
    }

    const lineSelect = document.getElementById('line');
    if (lineSelect) {
      lineSelect.addEventListener('change', () => {
        fetchAndUpdateDashboard();
      });
    }
  }
});

function initAllCharts(metrics) {
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.06)';
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.font.size = 11;

  const defaultLineOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 10, padding: 8, font: { size: 10 } }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { ticks: { maxRotation: 0, font: { size: 9 }, autoSkip: true, maxTicksLimit: 6 } },
      y: { beginAtZero: false, ticks: { font: { size: 9 } } }
    }
  };

  const c = metrics.charts || {};

  // 1. Chart Finished Goods vs Material Trend (Kg)
  const ctxOutput = document.getElementById('chartOutputTrend')?.getContext('2d');
  if (ctxOutput) {
    safeDestroyChart('output');
    chartInstances['output'] = new Chart(ctxOutput, {
      type: 'bar',
      data: {
        labels: c.outputTrend?.labels || [],
        datasets: [
          {
            type: 'bar',
            label: 'Finished Goods (Kg)',
            data: c.outputTrend?.outputData || [],
            backgroundColor: 'rgba(5, 150, 105, 0.85)',
            borderColor: '#059669',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Bahan Baku (Kg)',
            data: c.outputTrend?.materialData || [],
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 2.5
          }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 2. Chart Materials Composition (Doughnut)
  const ctxMat = document.getElementById('chartMaterialsComposition')?.getContext('2d');
  if (ctxMat) {
    safeDestroyChart('materials');
    const matColors = ['#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#475569', '#334155'];
    chartInstances['materials'] = new Chart(ctxMat, {
      type: 'doughnut',
      data: {
        labels: c.materialsComposition?.labels || [],
        datasets: [{
          data: c.materialsComposition?.data || [],
          backgroundColor: matColors.slice(0, (c.materialsComposition?.labels || []).length),
          borderWidth: 1.5,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, padding: 6, font: { size: 10 } } }
        },
        cutout: '60%'
      }
    });
  }

  // 3. Chart Production Yield & Efficiency (%)
  const ctxYield = document.getElementById('chartProductionYield')?.getContext('2d');
  if (ctxYield) {
    safeDestroyChart('yield');
    chartInstances['yield'] = new Chart(ctxYield, {
      type: 'line',
      data: {
        labels: c.productionYield?.labels || [],
        datasets: [
          {
            label: 'Rendemen (%)',
            data: c.productionYield?.yieldData || [],
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.06)',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 3
          },
          {
            label: 'Rasio Rijek (%)',
            data: c.productionYield?.rejectData || [],
            borderColor: '#64748b',
            borderWidth: 1.5,
            borderDash: [4, 4],
            tension: 0.2,
            pointRadius: 2
          }
        ]
      },
      options: {
        ...defaultLineOpts,
        scales: {
          x: defaultLineOpts.scales.x,
          y: { min: 0, max: 105, ticks: { font: { size: 9 }, callback: (v) => v + '%' } }
        }
      }
    });
  }

  // 4. Suhu Ruang & Area Kritis (°C)
  const ctxTemp = document.getElementById('chartTempCritical')?.getContext('2d');
  if (ctxTemp) {
    safeDestroyChart('tempCritical');
    chartInstances['tempCritical'] = new Chart(ctxTemp, {
      type: 'line',
      data: {
        labels: c.tempCriticalZone?.labels || [],
        datasets: [
          { label: 'Meatprep (°C)', data: c.tempCriticalZone?.meatprep || [], borderColor: '#0891b2', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Chillroom (°C)', data: c.tempCriticalZone?.chillroom || [], borderColor: '#2563eb', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'IQF (°C)', data: c.tempCriticalZone?.iqf || [], borderColor: '#4f46e5', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Suhu CT (°C)', data: c.tempCriticalZone?.suhuPusat || [], borderColor: '#059669', borderWidth: 2, tension: 0.2, pointRadius: 2.5 }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 5. Mixer & Preparasi Adonan
  const ctxMixer = document.getElementById('chartMixerPrep')?.getContext('2d');
  if (ctxMixer) {
    safeDestroyChart('mixerPrep');
    chartInstances['mixerPrep'] = new Chart(ctxMixer, {
      type: 'line',
      data: {
        labels: c.mixerPrep?.labels || [],
        datasets: [
          { label: 'Suhu Air (°C)', data: c.mixerPrep?.suhuAir || [], borderColor: '#0284c7', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Suhu Emulsi (°C)', data: c.mixerPrep?.suhuEmulsi || [], borderColor: '#d97706', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Waktu Aduk (menit)', data: c.mixerPrep?.lamaPengadukan || [], borderColor: '#7c3aed', borderWidth: 1.5, tension: 0.2, pointRadius: 2 }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 6. Penggorengan / Fryer
  const ctxFryer = document.getElementById('chartFryerMetrics')?.getContext('2d');
  if (ctxFryer) {
    safeDestroyChart('fryer');
    chartInstances['fryer'] = new Chart(ctxFryer, {
      type: 'line',
      data: {
        labels: c.fryerMetrics?.labels || [],
        datasets: [
          { label: 'Suhu Setting (°C)', data: c.fryerMetrics?.suhuSetting || [], borderColor: '#94a3b8', borderDash: [3, 3], borderWidth: 1.5, pointRadius: 0 },
          { label: 'Suhu Aktual (°C)', data: c.fryerMetrics?.suhuAktual || [], borderColor: '#dc2626', borderWidth: 2, tension: 0.2, pointRadius: 2.5 },
          { label: 'TPM Minyak (%)', data: c.fryerMetrics?.tpmMinyak || [], borderColor: '#d97706', borderWidth: 1.5, tension: 0.2, pointRadius: 2 }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 7. Stasiun Batter
  const ctxBatter = document.getElementById('chartBatterStation')?.getContext('2d');
  if (ctxBatter) {
    safeDestroyChart('batter');
    chartInstances['batter'] = new Chart(ctxBatter, {
      type: 'line',
      data: {
        labels: c.batterStation?.labels || [],
        datasets: [
          { label: 'Suhu Batter (°C)', data: c.batterStation?.suhuBatter || [], borderColor: '#2563eb', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Viskositas (sec)', data: c.batterStation?.viskositas || [], borderColor: '#059669', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Salinitas (%)', data: c.batterStation?.salinitas || [], borderColor: '#d97706', borderWidth: 1.5, tension: 0.2, pointRadius: 2 }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 8. HLT Continuous Cooker
  const ctxHlt = document.getElementById('chartHltMetrics')?.getContext('2d');
  if (ctxHlt) {
    safeDestroyChart('hlt');
    chartInstances['hlt'] = new Chart(ctxHlt, {
      type: 'line',
      data: {
        labels: c.hltMetrics?.labels || [],
        datasets: [
          { label: 'Suhu Awal Daging (°C)', data: c.hltMetrics?.suhuAwalDaging || [], borderColor: '#3b82f6', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Suhu Infeed (°C)', data: c.hltMetrics?.suhuInfeed || [], borderColor: '#f59e0b', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Suhu Outfeed (°C)', data: c.hltMetrics?.suhuOutfeed || [], borderColor: '#ef4444', borderWidth: 1.5, tension: 0.2, pointRadius: 2 }
        ]
      },
      options: defaultLineOpts
    });
  }

  // 9. Forming & Revo
  const ctxForming = document.getElementById('chartFormingMetrics')?.getContext('2d');
  if (ctxForming) {
    safeDestroyChart('forming');
    chartInstances['forming'] = new Chart(ctxForming, {
      type: 'line',
      data: {
        labels: c.formingMetrics?.labels || [],
        datasets: [
          { label: 'Pressure (bar)', data: c.formingMetrics?.pressure || [], borderColor: '#7c3aed', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Speed (spm)', data: c.formingMetrics?.speed || [], borderColor: '#059669', borderWidth: 1.5, tension: 0.2, pointRadius: 2 },
          { label: 'Suhu Adonan (°C)', data: c.formingMetrics?.suhuAdonan || [], borderColor: '#2563eb', borderWidth: 1.5, tension: 0.2, pointRadius: 2 }
        ]
      },
      options: defaultLineOpts
    });
  }
}

async function fetchAndUpdateDashboard() {
  const form = document.getElementById('dashboard-filter-form');
  if (!form) return;

  const formData = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (value) params.append(key, value);
  }

  try {
    const res = await fetch(`/api/dashboard/metrics?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Gagal memuat data metrik');
    const data = await res.json();

    // 1. Update KPIs
    document.getElementById('kpi-total-batches').textContent = data.kpis.totalBatches;
    document.getElementById('kpi-total-material').textContent = data.kpis.totalMaterialKg.toLocaleString('id-ID') + ' kg';
    document.getElementById('kpi-total-output').textContent = data.kpis.totalOutputKg.toLocaleString('id-ID') + ' kg';
    document.getElementById('kpi-yield-pct').textContent = (data.kpis.globalYieldPct || 0) + '%';
    document.getElementById('kpi-total-reject').textContent = 'Rasio rijek: ' + (data.kpis.globalRejectPct || 0) + '% (' + data.kpis.totalRejectKg.toLocaleString('id-ID') + ' kg)';

    // 2. Update All Compact Charts
    initAllCharts(data);

    // 3. Update Table Body
    const tbody = document.querySelector('#dashboard-batches-table tbody');
    if (tbody && data.batchesSummaryTable) {
      if (data.batchesSummaryTable.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-muted">Tidak ada batch yang ditemukan untuk kriteria filter saat ini.</td></tr>';
      } else {
        tbody.innerHTML = data.batchesSummaryTable.map(b => {
          const matKg = Number(b.total_material_kg) || 0;
          const outKg = Number(b.output_good_kg) || 0;
          const yieldRate = matKg > 0 ? ((outKg / matKg) * 100).toFixed(1) : 0;
          const dStr = typeof b.production_date === 'string' ? b.production_date.split('T')[0] : (b.production_date ? new Date(b.production_date).toISOString().split('T')[0] : '-');
          const rejClass = Number(b.calculated_reject_pct) > 3 ? 'text-danger font-bold' : 'text-muted';
          return `
            <tr>
              <td class="font-bold text-primary"><a href="/batches/${b.id}" class="table-link">${b.batch_number}</a></td>
              <td>${dStr}</td>
              <td><span class="badge badge-branch">${b.branch_code || b.branch_name}</span></td>
              <td><strong>${b.product_name}</strong><div class="text-xs text-muted">${b.product_code}</div></td>
              <td>${b.line}</td>
              <td class="text-right">${matKg.toLocaleString('id-ID')}</td>
              <td class="text-right font-semibold text-success">${outKg.toLocaleString('id-ID')}</td>
              <td class="text-right font-semibold text-primary">${yieldRate}%</td>
              <td class="text-right ${rejClass}">${b.calculated_reject_pct}%</td>
              <td><a href="/batches/${b.id}" class="btn btn-sm btn-outline-primary">Detail</a></td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Update dashboard error:', err);
  }
}
