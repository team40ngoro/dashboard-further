/**
 * LPP Food Division Interactive Dashboard Controller (Light Mode Optimized)
 */

let outputChartInstance = null;
let rejectsChartInstance = null;
let machineChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const initialDataElem = document.getElementById('initial-dashboard-data');
  if (initialDataElem) {
    try {
      const data = JSON.parse(initialDataElem.textContent);
      initCharts(data);
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

    // Auto update when machine parameter select changes
    const machineSelect = document.getElementById('machineParam');
    if (machineSelect) {
      machineSelect.addEventListener('change', () => {
        fetchAndUpdateDashboard();
      });
    }

    const branchSelect = document.getElementById('branchId');
    if (branchSelect) {
      branchSelect.addEventListener('change', () => {
        fetchAndUpdateDashboard();
      });
    }
  }
});

function initCharts(metrics) {
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.07)';
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";

  // 1. Chart Output vs Material Trend
  const ctxOutput = document.getElementById('chartOutputTrend')?.getContext('2d');
  if (ctxOutput) {
    if (outputChartInstance) outputChartInstance.destroy();
    outputChartInstance = new Chart(ctxOutput, {
      type: 'bar',
      data: {
        labels: metrics.charts.outputTrend.labels || [],
        datasets: [
          {
            type: 'bar',
            label: 'Output Baik (Kg)',
            data: metrics.charts.outputTrend.outputData || [],
            backgroundColor: 'rgba(5, 150, 105, 0.8)',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            type: 'line',
            label: 'Total Bahan Baku (Kg)',
            data: metrics.charts.outputTrend.materialData || [],
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderColor: '#2563eb',
            borderWidth: 2.5,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#2563eb'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Kilogram (Kg)' }
          }
        }
      }
    });
  }

  // 2. Chart Rejects Breakdown (Doughnut)
  const ctxRejects = document.getElementById('chartRejectsBreakdown')?.getContext('2d');
  if (ctxRejects) {
    if (rejectsChartInstance) rejectsChartInstance.destroy();
    const colors = [
      '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', 
      '#ec4899', '#0d9488', '#64748b', '#e11d48'
    ];
    rejectsChartInstance = new Chart(ctxRejects, {
      type: 'doughnut',
      data: {
        labels: metrics.charts.rejectsBreakdown.labels || [],
        datasets: [{
          data: metrics.charts.rejectsBreakdown.data || [],
          backgroundColor: colors.slice(0, (metrics.charts.rejectsBreakdown.labels || []).length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Chart Machine Parameters Trend
  const ctxMachine = document.getElementById('chartMachineTrend')?.getContext('2d');
  if (ctxMachine) {
    if (machineChartInstance) machineChartInstance.destroy();
    const mTrend = metrics.charts.machineMetricsTrend;
    machineChartInstance = new Chart(ctxMachine, {
      type: 'line',
      data: {
        labels: mTrend?.labels || [],
        datasets: [{
          label: `${mTrend?.paramName || 'Parameter'} (${mTrend?.unit || ''})`,
          data: mTrend?.values || [],
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: '#d97706'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            title: { display: true, text: mTrend?.unit || 'Nilai Aktual' }
          }
        }
      }
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
    document.getElementById('kpi-reject-pct').textContent = data.kpis.globalRejectPct + '%';
    document.getElementById('kpi-total-reject').textContent = 'Total rijek: ' + data.kpis.totalRejectKg.toLocaleString('id-ID') + ' kg';

    // 2. Update Charts
    initCharts(data);

    // 3. Update Available Machine Params Dropdown if changed
    const machineSelect = document.getElementById('machineParam');
    if (machineSelect && data.availableMachineParams) {
      const currentVal = machineSelect.value;
      machineSelect.innerHTML = '<option value="">-- Pilih Parameter Mesin --</option>';
      data.availableMachineParams.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.key} (${p.unit})`;
        if (p.key === currentVal || (!currentVal && p.key === data.charts.machineMetricsTrend?.paramName)) {
          opt.selected = true;
        }
        machineSelect.appendChild(opt);
      });
    }

  } catch (err) {
    console.error('Update dashboard error:', err);
  }
}
