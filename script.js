// State Management
let dividendRate = 5.5; // percent
let voluntaryMonthly = 0; // RM
let employeeRate = 0.11; // 11% or 9%
let retireAge = 60; // 55, 58, 60
let cashflowMode = 'preserve'; // 'preserve', 'swr4', 'annuity20'
let mobileViewMode = 'card'; // 'card' or 'table'
let currentProjectionData = [];
let chartInstance = null;

// Career Specs for Teachers (IPG -> DG41 -> DG44 -> DG48 -> DG52 -> DG54)
const careerLadder = [
  { grade: "DG41", duration: 8, kgt: 225, allowance: 900,  startSalary: 2580 },
  { grade: "DG44", duration: 8, kgt: 250, allowance: 1100, promoIncrement: 250 },
  { grade: "DG48", duration: 6, kgt: 270, allowance: 1550, promoIncrement: 270 },
  { grade: "DG52", duration: 3, kgt: 290, allowance: 1600, promoIncrement: 290 },
  { grade: "DG54", duration: 15, kgt: 320, allowance: 2000, promoIncrement: 320 }
];

// Helper: Format Currency
function formatRM(val) {
  return "RM " + Math.round(val).toLocaleString("en-MY");
}

// Quick adjust functions for mobile touch
window.adjustDividend = function(delta) {
  dividendRate = Math.min(8.0, Math.max(2.0, parseFloat((dividendRate + delta).toFixed(1))));
  document.getElementById('dividend-slider').value = dividendRate;
  document.getElementById('dividend-input').value = dividendRate.toFixed(1);
  runSimulation();
};

window.setVoluntary = function(amount) {
  voluntaryMonthly = amount;
  document.getElementById('voluntary-slider').value = voluntaryMonthly;
  document.getElementById('voluntary-input').value = voluntaryMonthly;
  runSimulation();
};

// Simulation Core Logic
function runSimulation() {
  const startAge = 24;
  const totalYears = retireAge - startAge; // 60 - 24 = 36 years
  
  let currentSalary = careerLadder[0].startSalary;
  let epfTotalBalance = 0;
  let cumulativeMandatory = 0;
  let cumulativeVoluntary = 0;
  let cumulativeDividend = 0;

  let ladderIndex = 0;
  let yearsInCurrentGrade = 0;
  
  let records = [];

  for (let year = 1; year <= totalYears; year++) {
    const age = startAge + year - 1;

    // Promotion threshold
    if (ladderIndex < careerLadder.length - 1) {
      if (yearsInCurrentGrade >= careerLadder[ladderIndex].duration) {
        ladderIndex++;
        yearsInCurrentGrade = 0;
        currentSalary += careerLadder[ladderIndex].promoIncrement;
      }
    }

    const currentGradeObj = careerLadder[ladderIndex];
    const grade = currentGradeObj.grade;
    const basicSalary = currentSalary;
    const allowance = currentGradeObj.allowance;
    const grossSalary = basicSalary + allowance;

    // EPF Statutory Rates
    const employerRate = basicSalary <= 5000 ? 0.13 : 0.12;
    
    const monthlyEmployer = basicSalary * employerRate;
    const monthlyEmployee = basicSalary * employeeRate;
    const monthlyVoluntary = voluntaryMonthly;
    const monthlyNetSalary = grossSalary - monthlyEmployee;

    const annualMandatoryContribution = (monthlyEmployer + monthlyEmployee) * 12;
    const annualVoluntaryContribution = monthlyVoluntary * 12;
    const totalAnnualDeposit = annualMandatoryContribution + annualVoluntaryContribution;

    // Half-year convention
    const annualDividend = (epfTotalBalance * (dividendRate / 100)) + 
                           (totalAnnualDeposit * (dividendRate / 100) * 0.5);

    epfTotalBalance += totalAnnualDeposit + annualDividend;
    cumulativeMandatory += annualMandatoryContribution;
    cumulativeVoluntary += annualVoluntaryContribution;
    cumulativeDividend += annualDividend;

    records.push({
      year,
      age,
      grade,
      basicSalary,
      allowance,
      grossSalary,
      netSalary: monthlyNetSalary,
      annualEmployer: monthlyEmployer * 12,
      annualEmployee: monthlyEmployee * 12,
      annualVoluntary: annualVoluntaryContribution,
      totalDeposit: totalAnnualDeposit,
      annualDividend,
      closingBalance: epfTotalBalance,
      cumulativeMandatory,
      cumulativeVoluntary,
      cumulativeDividend
    });

    currentSalary += currentGradeObj.kgt;
    yearsInCurrentGrade++;
  }

  currentProjectionData = records;
  updateDashboardUI();
}

// Update UI
function updateDashboardUI() {
  if (currentProjectionData.length === 0) return;
  const lastRecord = currentProjectionData[currentProjectionData.length - 1];

  document.querySelectorAll('.retire-age-label').forEach(el => el.textContent = retireAge);

  const formattedTotal = formatRM(lastRecord.closingBalance);
  document.getElementById('metric-total-kwsp').textContent = formattedTotal;
  document.getElementById('bar-total-kwsp').textContent = formattedTotal;

  document.getElementById('metric-total-deposit').textContent = formatRM(lastRecord.cumulativeMandatory + lastRecord.cumulativeVoluntary);
  document.getElementById('metric-voluntary-total').textContent = `+ ${formatRM(lastRecord.cumulativeVoluntary)} Sukarela`;
  document.getElementById('metric-total-dividend').textContent = formatRM(lastRecord.cumulativeDividend);
  document.getElementById('metric-final-salary').textContent = formatRM(lastRecord.grossSalary);

  const dividendPercent = Math.round((lastRecord.cumulativeDividend / lastRecord.closingBalance) * 100) || 0;
  document.getElementById('metric-dividend-share').textContent = `${dividendPercent}% Dividen Kompaun`;

  // 3 Accounts Split
  document.getElementById('account-persaraan').textContent = formatRM(lastRecord.closingBalance * 0.75);
  document.getElementById('account-sejahtera').textContent = formatRM(lastRecord.closingBalance * 0.15);
  document.getElementById('account-fleksibel').textContent = formatRM(lastRecord.closingBalance * 0.10);

  updateCashflowSimulation(lastRecord);
  renderDataViews();
  renderChart();
}

// Cashflow Simulation
function updateCashflowSimulation(lastRecord) {
  const totalEPF = lastRecord.closingBalance;
  const rateDec = dividendRate / 100;
  let annualPayout = 0;
  let monthlyPayout = 0;
  let title = "";
  let desc = "";

  if (cashflowMode === 'preserve') {
    annualPayout = totalEPF * rateDec;
    monthlyPayout = annualPayout / 12;
    title = "Dividen Sebulan (Modal Kekal)";
    desc = "Modal simpanan RM " + Math.round(totalEPF).toLocaleString("en-MY") + " kekal 100% utuh.";
  } else if (cashflowMode === 'swr4') {
    annualPayout = totalEPF * 0.04;
    monthlyPayout = annualPayout / 12;
    title = "Pengeluaran (4% Selamat)";
    desc = "Kajian Trinity: Seimbang inflasi & tahan 30+ tahun.";
  } else if (cashflowMode === 'annuity20') {
    const n = 20;
    const r = rateDec;
    annualPayout = (totalEPF * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    monthlyPayout = annualPayout / 12;
    title = "Anuiti (Habis Umur 80)";
    desc = "Modal diagih habis secara sistematik dalam 20 tahun.";
  }

  const formattedMonthly = formatRM(monthlyPayout);
  document.getElementById('cashflow-monthly-label').textContent = title;
  document.getElementById('cashflow-monthly-value').textContent = formattedMonthly;
  document.getElementById('bar-monthly-dividend').textContent = formattedMonthly;

  document.getElementById('cashflow-annual-value').textContent = formatRM(annualPayout);
  document.getElementById('cashflow-monthly-desc').textContent = desc;
  document.getElementById('cashflow-dividend-rate').textContent = `${dividendRate}%`;

  const finalNetSalary = lastRecord.netSalary;
  const ratio = Math.round((monthlyPayout / finalNetSalary) * 100);
  document.getElementById('cashflow-replacement-ratio').textContent = `${ratio}%`;
}

// Dual Renderer: Cards for Mobile & Table for Desktop
function renderDataViews() {
  renderTable();
  renderMobileCards();
}

// Mobile Card Render (Easy on thumb & phone screens)
function renderMobileCards() {
  const container = document.getElementById('mobile-cards-container');
  if (!container) return;

  const gradeFilter = document.getElementById('grade-filter').value;
  container.innerHTML = '';

  const filtered = gradeFilter === 'ALL' 
    ? currentProjectionData 
    : currentProjectionData.filter(d => d.grade === gradeFilter);

  filtered.forEach(row => {
    const card = document.createElement('div');
    card.className = "p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.06] space-y-2.5";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-white">Umur ${row.age}</span>
          <span class="text-[10px] text-neutral-500">(Thn ${row.year})</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${getGradeBadge(row.grade)}">${row.grade}</span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/[0.04]">
        <div>
          <span class="text-neutral-500 block text-[10px]">Gaji Pokok / Elaun</span>
          <span class="font-medium text-neutral-300">${formatRM(row.basicSalary)} + ${formatRM(row.allowance)}</span>
        </div>
        <div>
          <span class="text-neutral-500 block text-[10px]">Gaji Kasar / Bersih</span>
          <span class="font-semibold text-white">${formatRM(row.grossSalary)} <span class="text-neutral-400 font-normal">(${formatRM(row.netSalary)})</span></span>
        </div>
      </div>

      <div class="flex items-center justify-between text-[11px] bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/[0.03]">
        <div>
          <span class="text-[9px] text-emerald-400 uppercase tracking-wider block font-medium">Dividen Thn</span>
          <span class="font-semibold text-emerald-400">+${formatRM(row.annualDividend)}</span>
        </div>
        <div class="text-right">
          <span class="text-[9px] text-neutral-400 uppercase tracking-wider block font-medium">Baki KWSP</span>
          <span class="font-bold text-white text-xs">${formatRM(row.closingBalance)}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Table Render (Desktop & Landscape)
function renderTable() {
  const tbody = document.getElementById('table-body');
  const gradeFilter = document.getElementById('grade-filter').value;
  tbody.innerHTML = '';

  const filtered = gradeFilter === 'ALL' 
    ? currentProjectionData 
    : currentProjectionData.filter(d => d.grade === gradeFilter);

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-white/[0.04] transition-colors border-b border-white/[0.02]";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-sans text-neutral-200 sticky-col">
        <span class="font-semibold text-white">${row.age} thn</span>
        <span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${getGradeBadge(row.grade)}">${row.grade}</span>
      </td>
      <td class="py-2.5 px-3">${formatRM(row.basicSalary)}</td>
      <td class="py-2.5 px-3 text-neutral-400">${formatRM(row.allowance)}</td>
      <td class="py-2.5 px-3 font-semibold text-neutral-100">${formatRM(row.grossSalary)}</td>
      <td class="py-2.5 px-3 text-neutral-300">${formatRM(row.netSalary)}</td>
      <td class="py-2.5 px-3 text-neutral-400">${formatRM(row.annualEmployer)}</td>
      <td class="py-2.5 px-3 text-neutral-400">${formatRM(row.annualEmployee)}</td>
      <td class="py-2.5 px-3 ${row.annualVoluntary > 0 ? 'text-amber-400' : 'text-neutral-500'}">${formatRM(row.annualVoluntary)}</td>
      <td class="py-2.5 px-3 text-emerald-400 font-medium">+${formatRM(row.annualDividend)}</td>
      <td class="py-2.5 px-3 text-right font-bold text-white">${formatRM(row.closingBalance)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function getGradeBadge(grade) {
  switch (grade) {
    case 'DG41': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'DG44': return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    case 'DG48': return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
    case 'DG52': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    case 'DG54': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    default: return 'bg-white/10 text-white';
  }
}

// Chart.js Setup
function renderChart() {
  const ctx = document.getElementById('growthChart').getContext('2d');
  const isMobile = window.innerWidth < 640;
  
  const labels = currentProjectionData.map((d, index) => {
    if (isMobile) {
      return (index % 5 === 0 || index === currentProjectionData.length - 1) ? `${d.age}` : '';
    }
    return `Umur ${d.age} (${d.grade})`;
  });

  const epfData = currentProjectionData.map(d => d.closingBalance);
  const mandatoryData = currentProjectionData.map(d => d.cumulativeMandatory);
  const voluntaryData = currentProjectionData.map(d => d.cumulativeVoluntary);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const gradientBlue = ctx.createLinearGradient(0, 0, 0, 260);
  gradientBlue.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
  gradientBlue.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total KWSP',
          data: epfData,
          borderColor: '#3b82f6',
          backgroundColor: gradientBlue,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#60a5fa'
        },
        {
          label: 'Modal Mandatori',
          data: mandatoryData,
          borderColor: '#818cf8',
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          tension: 0.2,
          borderWidth: 1.5,
          pointRadius: 0
        },
        {
          label: 'Modal Sukarela',
          data: voluntaryData,
          borderColor: '#fbbf24',
          borderDash: [3, 3],
          backgroundColor: 'transparent',
          tension: 0.2,
          borderWidth: 1.5,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: function(items) {
              const idx = items[0].dataIndex;
              const rec = currentProjectionData[idx];
              return `Umur ${rec.age} (${rec.grade}) - Tahun ${rec.year}`;
            },
            label: function(context) {
              return `${context.dataset.label}: ${formatRM(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#71717a', font: { size: 9 }, maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#71717a',
            font: { size: 9 },
            callback: function(value) {
              return 'RM ' + (value / 1000).toLocaleString() + 'k';
            }
          }
        }
      }
    }
  });
}

// Export CSV
function exportToCSV() {
  let csv = 'Tahun,Umur,Gred,Gaji Pokok (RM),Elaun (RM),Gaji Kasar (RM),Gaji Bersih (RM),Caruman Majikan (RM),Caruman Pekerja (RM),Caruman Sukarela (RM),Dividen Tahunan (RM),Baki Akhir KWSP (RM)\n';
  
  currentProjectionData.forEach(row => {
    csv += `${row.year},${row.age},${row.grade},${row.basicSalary},${row.allowance},${row.grossSalary},${row.netSalary.toFixed(2)},${row.annualEmployer},${row.annualEmployee},${row.annualVoluntary},${row.annualDividend.toFixed(2)},${row.closingBalance.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Unjuran_KWSP_Guru_${retireAge}Tahun.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const dividendSlider = document.getElementById('dividend-slider');
  const dividendInput = document.getElementById('dividend-input');
  const voluntarySlider = document.getElementById('voluntary-slider');
  const voluntaryInput = document.getElementById('voluntary-input');
  const retireSelect = document.getElementById('retire-age-select');
  const gradeFilter = document.getElementById('grade-filter');
  const btnRate9 = document.getElementById('toggle-rate-9');
  const btnRate11 = document.getElementById('toggle-rate-11');
  const exportBtn = document.getElementById('btn-export-csv');

  // Mobile View Mode Switcher
  const btnViewCard = document.getElementById('view-mode-card');
  const btnViewTable = document.getElementById('view-mode-table');
  const mobileCards = document.getElementById('mobile-cards-container');
  const desktopTable = document.getElementById('desktop-table-container');

  if (btnViewCard && btnViewTable) {
    btnViewCard.addEventListener('click', () => {
      btnViewCard.className = "px-2.5 py-1 text-[11px] rounded-md bg-blue-600 text-white font-medium transition-all";
      btnViewTable.className = "px-2.5 py-1 text-[11px] rounded-md text-neutral-400 font-medium transition-all";
      mobileCards.classList.remove('hidden');
      desktopTable.classList.add('hidden');
    });

    btnViewTable.addEventListener('click', () => {
      btnViewTable.className = "px-2.5 py-1 text-[11px] rounded-md bg-blue-600 text-white font-medium transition-all";
      btnViewCard.className = "px-2.5 py-1 text-[11px] rounded-md text-neutral-400 font-medium transition-all";
      mobileCards.classList.add('hidden');
      desktopTable.classList.remove('hidden');
      desktopTable.classList.add('block');
    });
  }

  dividendSlider.addEventListener('input', (e) => {
    dividendRate = parseFloat(e.target.value);
    dividendInput.value = dividendRate.toFixed(1);
    runSimulation();
  });
  dividendInput.addEventListener('change', (e) => {
    dividendRate = parseFloat(e.target.value) || 5.5;
    dividendSlider.value = dividendRate;
    runSimulation();
  });

  voluntarySlider.addEventListener('input', (e) => {
    voluntaryMonthly = parseFloat(e.target.value);
    voluntaryInput.value = voluntaryMonthly;
    runSimulation();
  });
  voluntaryInput.addEventListener('change', (e) => {
    voluntaryMonthly = parseFloat(e.target.value) || 0;
    voluntarySlider.value = voluntaryMonthly;
    runSimulation();
  });

  retireSelect.addEventListener('change', (e) => {
    retireAge = parseInt(e.target.value);
    runSimulation();
  });

  gradeFilter.addEventListener('change', () => {
    renderDataViews();
  });

  btnRate9.addEventListener('click', () => {
    employeeRate = 0.09;
    btnRate9.className = "px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white font-medium shadow-sm transition-all";
    btnRate11.className = "px-2.5 py-1 text-xs rounded-md text-neutral-400 font-medium transition-all";
    runSimulation();
  });
  btnRate11.addEventListener('click', () => {
    employeeRate = 0.11;
    btnRate11.className = "px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white font-medium shadow-sm transition-all";
    btnRate9.className = "px-2.5 py-1 text-xs rounded-md text-neutral-400 font-medium transition-all";
    runSimulation();
  });

  document.querySelectorAll('.cashflow-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cashflow-btn').forEach(b => {
        b.className = "cashflow-btn px-2 py-2 text-center text-[10px] sm:text-xs font-medium text-neutral-400 hover:text-white rounded-lg transition-all";
      });
      btn.className = "cashflow-btn px-2 py-2 text-center text-[10px] sm:text-xs font-semibold rounded-lg bg-blue-600 text-white transition-all shadow-sm";
      cashflowMode = btn.dataset.cashflowMode;
      const lastRecord = currentProjectionData[currentProjectionData.length - 1];
      updateCashflowSimulation(lastRecord);
    });
  });

  exportBtn.addEventListener('click', exportToCSV);

  window.addEventListener('resize', () => {
    renderChart();
  });

  runSimulation();
});
