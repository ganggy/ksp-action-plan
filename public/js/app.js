let state = {
  dashboard: null,
  items: [],
  ppfs: [],
  itReports: [],
  hosxpConfig: null,
  currentItReport: null,
  currentItResult: { columns: [], rows: [] },
  roadmaps: null,
  fiscalMonths: [],
  editMode: sessionStorage.getItem('ksp_edit_mode') === 'true',
  currentItem: null,
  deptChart: null,
  monthlyChart: null
};

const fmtNum = (n) => new Intl.NumberFormat('th-TH').format(Number(n || 0));
const fmtBaht = (n) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n || 0)) + ' ฿';

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg transition ${
    isError ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
  }`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2800);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'เกิดข้อผิดพลาด');
  return data;
}

// ==================== EDIT MODE ====================
function updateEditModeUI() {
  const dot = document.getElementById('edit-mode-dot');
  const label = document.getElementById('edit-mode-label');
  const addBtn = document.getElementById('btn-add-item');
  if (state.editMode) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
    label.textContent = 'โหมดแก้ไข (เปิดอยู่)';
    addBtn.classList.remove('hidden');
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-300';
    label.textContent = 'โหมดดูข้อมูล';
    addBtn.classList.add('hidden');
  }
}

async function toggleEditMode() {
  if (state.editMode) {
    state.editMode = false;
    sessionStorage.removeItem('ksp_edit_mode');
    updateEditModeUI();
    renderAll();
    showToast('ปิดโหมดแก้ไขแล้ว');
    return;
  }
  const pin = prompt('กรุณากรอกรหัสผ่านโหมดแก้ไข (ค่าเริ่มต้น: ksp2570):');
  if (!pin) return;
  try {
    await api('/api/auth/verify', { method: 'POST', body: JSON.stringify({ pin }) });
    state.editMode = true;
    sessionStorage.setItem('ksp_edit_mode', 'true');
    updateEditModeUI();
    renderAll();
    showToast('เข้าสู่โหมดแก้ไขสำเร็จ');
  } catch (err) {
    showToast(err.message, true);
  }
}

// ==================== TABS ====================
function switchTab(tabName) {
  document.querySelectorAll('main > section').forEach((sec) => sec.classList.add('hidden'));
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  if (tabName === 'dashboard') renderCharts();
}

// ==================== LOAD DATA ====================
async function syncDashboardFromHosxp() {
  const btn = document.getElementById('btn-sync-hosxp');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'กำลังซิงค์ข้อมูลจาก HOSxP...';
  }
  try {
    const res = await api('/api/hosxp/sync-dashboard', { method: 'POST' });
    await loadAll();
    showToast(`ซิงค์ยอดจริงจาก HOSxP สำเร็จ (${res.syncedItems.length} กิจกรรม)`);
  } catch (err) {
    showToast('ซิงค์ไม่สำเร็จ: ' + err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

async function loadAll() {
  try {
    const [dashboard, itemsRes, ppfsRes, roadmapRes, itRes, hosxpCfg] = await Promise.all([
      api('/api/dashboard'),
      api('/api/items'),
      api('/api/ppfs'),
      api('/api/roadmaps'),
      api('/api/it-reports'),
      api('/api/hosxp/config')
    ]);
    state.dashboard = dashboard;
    state.items = itemsRes.items;
    state.ppfs = ppfsRes.items;
    state.roadmaps = roadmapRes.roadmaps;
    state.fiscalMonths = roadmapRes.fiscalMonths;
    state.itReports = itRes.items || [];
    state.hosxpConfig = hosxpCfg;

    populateSelects();
    renderAll();
  } catch (err) {
    showToast('โหลดข้อมูลไม่สำเร็จ: ' + err.message, true);
  }
}

function populateSelects() {
  const deptSel = document.getElementById('filter-dept');
  const newDeptSel = document.getElementById('new-dept');
  const itDeptSel = document.getElementById('it-filter-dept');
  const currentDept = deptSel.value;
  const currentItDept = itDeptSel.value;

  deptSel.innerHTML = '<option value="all">ทุกกลุ่มงาน (11 กลุ่มงาน)</option>';
  itDeptSel.innerHTML = '<option value="all">ทุกกลุ่มงาน</option>';
  newDeptSel.innerHTML = '';
  for (const d of state.dashboard.departments) {
    deptSel.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
    itDeptSel.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
    newDeptSel.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
  }
  if (currentDept) deptSel.value = currentDept;
  if (currentItDept) itDeptSel.value = currentItDept;

  const ppfsCatSel = document.getElementById('ppfs-category');
  const currentCat = ppfsCatSel.value;
  const cats = [...new Set(state.ppfs.map((p) => p.category))];
  ppfsCatSel.innerHTML = '<option value="all">ทุกหมวดหมู่ (54 รายการ)</option>';
  for (const c of cats) {
    ppfsCatSel.innerHTML += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  if (currentCat) ppfsCatSel.value = currentCat;
}

function renderAll() {
  renderDashboard();
  renderPlansTable();
  renderPpfsTable();
  renderItMonitor();
  renderRoadmaps();
}

// ==================== TAB 1: DASHBOARD ====================
function renderDashboard() {
  const { kpis, departments } = state.dashboard;

  document.getElementById('kpi-expected-rev').textContent = fmtBaht(kpis.totalExpectedRevenue);
  document.getElementById('kpi-actual-rev').textContent = fmtBaht(kpis.totalActualRevenue);
  document.getElementById('kpi-rev-pct').textContent = `${kpis.revenueProgress}%`;
  document.getElementById('kpi-rev-bar').style.width = `${Math.min(100, kpis.revenueProgress)}%`;

  document.getElementById('kpi-expected-cost').textContent = fmtBaht(kpis.totalExpectedCostReduction);
  document.getElementById('kpi-actual-cost').textContent = fmtBaht(kpis.totalActualCostReduction);
  document.getElementById('kpi-cost-pct').textContent = `${kpis.costProgress}%`;
  document.getElementById('kpi-cost-bar').style.width = `${Math.min(100, kpis.costProgress)}%`;

  document.getElementById('kpi-total-items').textContent = `${kpis.totalItems} กิจกรรม`;
  document.getElementById('kpi-completed-items').textContent = `สำเร็จ ${kpis.completedItems} รายการ`;

  document.getElementById('kpi-it-ready').textContent = `${kpis.itTasks.ready} / ${kpis.itTasks.total} รายงาน`;
  document.getElementById('kpi-it-progress').textContent = `กำลังพัฒนา ${kpis.itTasks.inProgress}`;
  document.getElementById('kpi-it-pending').textContent = `รอทำ ${kpis.itTasks.pending}`;

  // Department cards
  const grid = document.getElementById('dept-cards-grid');
  grid.innerHTML = departments
    .map((d) => {
      const targetVal = d.expectedRevenue + d.expectedCostReduction;
      const actualVal = d.actualRevenue + d.actualCostReduction;
      const pct = targetVal > 0 ? Math.min(100, Math.round((actualVal / targetVal) * 1000) / 10) : 0;
      const isCost = d.expectedCostReduction > 0 && d.expectedRevenue === 0;
      return `
        <div onclick="jumpToDept('${d.id}')" class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 card-hover cursor-pointer flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span class="w-3 h-8 rounded-full shrink-0" style="background:${d.color}"></span>
                <div>
                  <h3 class="font-bold text-slate-800 text-sm leading-snug">${escapeHtml(d.name)}</h3>
                  <span class="text-xs text-slate-500">${d.itemCount} กิจกรรม · IT พร้อม ${d.itReadyCount}/${d.itemCount}</span>
                </div>
              </div>
              <span class="px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                isCost ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
              }">${isCost ? 'ลดรายจ่าย' : 'เพิ่มรายได้'}</span>
            </div>
            <div class="mt-4 flex items-baseline justify-between">
              <span class="text-xs text-slate-500">${isCost ? 'เป้าลดรายจ่าย' : 'เป้ารายได้คาดการณ์'}</span>
              <span class="text-base font-bold text-slate-900 tabular-nums">${fmtBaht(targetVal)}</span>
            </div>
            <div class="mt-1 flex items-baseline justify-between text-xs">
              <span class="text-slate-500">ผลงานจริงสะสม</span>
              <span class="font-semibold text-teal-700 tabular-nums">${fmtBaht(actualVal)} (${pct}%)</span>
            </div>
          </div>
          <div class="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%; background:${d.color}"></div>
          </div>
        </div>
      `;
    })
    .join('');

  renderCharts();
}

function jumpToDept(deptId) {
  document.getElementById('filter-dept').value = deptId;
  switchTab('plans');
  renderPlansTable();
}

function renderCharts() {
  if (!state.dashboard) return;
  const { departments, monthlySeries } = state.dashboard;

  const deptCtx = document.getElementById('deptChart');
  if (deptCtx) {
    if (state.deptChart) state.deptChart.destroy();
    const filteredDepts = departments.filter((d) => d.expectedRevenue + d.expectedCostReduction > 0);
    state.deptChart = new Chart(deptCtx, {
      type: 'bar',
      data: {
        labels: filteredDepts.map((d) => d.shortName),
        datasets: [
          {
            label: 'เป้าหมายทั้งปี (บาท)',
            data: filteredDepts.map((d) => d.expectedRevenue + d.expectedCostReduction),
            backgroundColor: filteredDepts.map((d) => d.color + 'cc'),
            borderRadius: 6
          },
          {
            label: 'ผลจริงสะสม (บาท)',
            data: filteredDepts.map((d) => d.actualRevenue + d.actualCostReduction),
            backgroundColor: '#0f172a',
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Sarabun' } } }
        },
        scales: {
          x: {
            ticks: {
              callback: (v) => (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : fmtNum(v))
            }
          },
          y: { ticks: { font: { family: 'Sarabun', size: 12 } } }
        }
      }
    });
  }

  const mCtx = document.getElementById('monthlyChart');
  if (mCtx) {
    if (state.monthlyChart) state.monthlyChart.destroy();
    state.monthlyChart = new Chart(mCtx, {
      type: 'bar',
      data: {
        labels: monthlySeries.map((m) => m.label),
        datasets: [
          {
            label: 'รายได้จริง (บาท)',
            data: monthlySeries.map((m) => m.revenue),
            backgroundColor: '#0d9488',
            borderRadius: 5
          },
          {
            label: 'ลดรายจ่ายจริง (บาท)',
            data: monthlySeries.map((m) => m.costReduction),
            backgroundColor: '#10b981',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Sarabun' } } }
        },
        scales: {
          x: { ticks: { font: { family: 'Sarabun', size: 11 } } },
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// ==================== TAB 2: ACTION PLANS ====================
function getFilteredPlans() {
  const q = document.getElementById('filter-q').value.trim().toLowerCase();
  const dept = document.getElementById('filter-dept').value;
  const type = document.getElementById('filter-type').value;

  return state.items.filter((i) => {
    if (dept !== 'all' && i.departmentId !== dept) return false;
    if (type !== 'all' && i.planType !== type) return false;
    if (q) {
      const hay = `${i.departmentName} ${i.title} ${i.detail} ${i.owner} ${i.itMonitor} ${i.kpi}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPlansTable() {
  const list = getFilteredPlans();
  const totalExpected = list.reduce((s, i) => s + Number(i.expectedAmount || 0), 0);
  const totalActual = list.reduce((s, i) => s + Number(i.actualAmount || 0), 0);

  document.getElementById('plans-count-label').textContent =
    `แสดง ${list.length} กิจกรรม · เป้าหมายรวม ${fmtBaht(totalExpected)} · ผลจริง ${fmtBaht(totalActual)}`;

  const tbody = document.getElementById('plans-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">ไม่พบกิจกรรมที่ตรงกับเงื่อนไข</td></tr>';
    return;
  }

  const typeBadge = {
    revenue: '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700">เพิ่มรายได้</span>',
    cost_reduction: '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">ลดรายจ่าย</span>',
    quality: '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">คุณภาพ/ต้นทุน</span>'
  };

  const itBadge = {
    ready: '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">พร้อมใช้</span>',
    in_progress: '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">กำลังพัฒนา</span>',
    pending: '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">รอพัฒนา</span>'
  };

  tbody.innerHTML = list
    .map((item) => {
      const pct = item.expectedAmount > 0 ? Math.min(100, item.amountProgress) : 0;
      return `
        <tr onclick="openItemModal('${item.id}')" class="hover:bg-teal-50/40 transition cursor-pointer">
          <td class="px-4 py-3.5 align-top max-w-md">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-xs font-semibold text-slate-500">${escapeHtml(item.departmentName)}</span>
              ${typeBadge[item.planType] || ''}
            </div>
            <div class="font-bold text-slate-900">${escapeHtml(item.title)}</div>
            <div class="text-xs text-slate-500 line-clamp-2 mt-0.5">${escapeHtml(item.detail)}</div>
          </td>
          <td class="px-4 py-3.5 align-top text-xs text-slate-700 max-w-xs">
            <div class="font-medium">${escapeHtml(item.targetText || `${fmtNum(item.targetCount)} ${item.targetUnit}`)}</div>
            <div class="text-slate-400 mt-1">ทำได้: ${fmtNum(item.actualCount)} ${escapeHtml(item.targetUnit)}</div>
          </td>
          <td class="px-4 py-3.5 align-top text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
            ${item.expectedAmount > 0 ? fmtBaht(item.expectedAmount) : '<span class="text-slate-400 font-normal">-</span>'}
          </td>
          <td class="px-4 py-3.5 align-top text-right whitespace-nowrap">
            <div class="font-bold text-teal-700 tabular-nums">${fmtBaht(item.actualAmount)}</div>
            <div class="w-24 ml-auto h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div class="h-full bg-teal-500 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">${item.amountProgress}%</div>
          </td>
          <td class="px-4 py-3.5 align-top max-w-xs">
            <div class="mb-1">${itBadge[item.itStatus] || itBadge.pending}</div>
            <div class="text-xs text-slate-600 line-clamp-2">${escapeHtml(item.itMonitor)}</div>
          </td>
          <td class="px-4 py-3.5 align-top text-xs text-slate-700">
            ${escapeHtml(item.owner)}
          </td>
        </tr>
      `;
    })
    .join('');
}

// ==================== ITEM MODAL ====================
function openItemModal(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  state.currentItem = item;

  document.getElementById('modal-dept-badge').textContent = item.departmentName;
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-detail').textContent = item.detail || '-';
  document.getElementById('modal-target').textContent = item.targetText || `${fmtNum(item.targetCount)} ${item.targetUnit}`;
  document.getElementById('modal-owner').textContent = item.owner || '-';
  document.getElementById('modal-expected').textContent = item.expectedAmount > 0 ? fmtBaht(item.expectedAmount) : 'ไม่ระบุเป็นตัวเงิน';
  document.getElementById('modal-actual').textContent = fmtBaht(item.actualAmount);
  document.getElementById('modal-formula').textContent = item.amountFormula ? `สูตร/ที่มา: ${item.amountFormula}` : '';
  document.getElementById('modal-kpi').textContent = item.kpi || '-';
  document.getElementById('modal-it').textContent = item.itMonitor || '-';
  document.getElementById('modal-it-source').textContent = item.itSource || 'HOSxP';

  document.querySelectorAll('.edit-only-col').forEach((el) => el.classList.toggle('hidden', !state.editMode));
  document.querySelectorAll('.edit-only-actions').forEach((el) => el.classList.toggle('hidden', !state.editMode));
  document.getElementById('modal-edit-hint').classList.toggle('hidden', state.editMode);

  const tbody = document.getElementById('modal-monthly-tbody');
  tbody.innerHTML = state.fiscalMonths
    .map((fm) => {
      const m = (item.monthly && item.monthly[fm.key]) || { count: 0, amount: 0, note: '' };
      if (!state.editMode) {
        return `
          <tr>
            <td class="px-3 py-2 font-medium text-slate-700">${fm.label} <span class="text-slate-400">(${fm.quarter})</span></td>
            <td class="px-3 py-2 text-right tabular-nums">${fmtNum(m.count)}</td>
            <td class="px-3 py-2 text-right tabular-nums font-medium text-teal-700">${fmtBaht(m.amount)}</td>
            <td class="px-3 py-2 text-slate-600">${escapeHtml(m.note)}</td>
          </tr>
        `;
      }
      return `
        <tr>
          <td class="px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">${fm.label} (${fm.quarter})</td>
          <td class="px-2 py-1.5 text-right">
            <input id="m-count-${fm.key}" type="number" value="${m.count}" class="w-24 px-2 py-1 rounded border border-slate-300 text-right tabular-nums" />
          </td>
          <td class="px-2 py-1.5 text-right">
            <input id="m-amount-${fm.key}" type="number" step="0.01" value="${m.amount}" class="w-28 px-2 py-1 rounded border border-slate-300 text-right tabular-nums" />
          </td>
          <td class="px-2 py-1.5">
            <input id="m-note-${fm.key}" type="text" value="${escapeHtml(m.note)}" placeholder="หมายเหตุ..." class="w-full px-2 py-1 rounded border border-slate-300" />
          </td>
          <td class="px-2 py-1.5 text-center">
            <button onclick="saveMonthlyRow('${item.id}', '${fm.key}')" class="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-medium cursor-pointer">
              บันทึก
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  const modal = document.getElementById('item-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal() {
  const modal = document.getElementById('item-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.currentItem = null;
}

async function saveMonthlyRow(itemId, monthKey) {
  const count = document.getElementById(`m-count-${monthKey}`).value;
  const amount = document.getElementById(`m-amount-${monthKey}`).value;
  const note = document.getElementById(`m-note-${monthKey}`).value;
  try {
    await api(`/api/items/${itemId}/monthly`, {
      method: 'PATCH',
      body: JSON.stringify({ monthKey, count, amount, note })
    });
    await loadAll();
    openItemModal(itemId);
    showToast('บันทึกผลงานรายเดือนเรียบร้อย');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteCurrentItem() {
  if (!state.currentItem) return;
  if (!confirm(`ยืนยันการลบกิจกรรม "${state.currentItem.title}" ?`)) return;
  try {
    await api(`/api/items/${state.currentItem.id}`, { method: 'DELETE' });
    closeModal();
    await loadAll();
    showToast('ลบกิจกรรมแล้ว');
  } catch (err) {
    showToast(err.message, true);
  }
}

// ==================== CREATE MODAL ====================
function openCreateModal() {
  document.getElementById('create-form').reset();
  const modal = document.getElementById('create-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCreateModal() {
  const modal = document.getElementById('create-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function submitCreateItem(e) {
  e.preventDefault();
  const payload = {
    departmentId: document.getElementById('new-dept').value,
    planType: document.getElementById('new-type').value,
    title: document.getElementById('new-title').value,
    detail: document.getElementById('new-detail').value,
    targetCount: document.getElementById('new-target-count').value,
    targetUnit: document.getElementById('new-target-unit').value,
    targetText: `${document.getElementById('new-target-count').value} ${document.getElementById('new-target-unit').value}`,
    expectedAmount: document.getElementById('new-expected').value,
    kpi: document.getElementById('new-kpi').value,
    owner: document.getElementById('new-owner').value,
    itMonitor: document.getElementById('new-it').value
  };
  try {
    await api('/api/items', { method: 'POST', body: JSON.stringify(payload) });
    closeCreateModal();
    await loadAll();
    showToast('เพิ่มกิจกรรมใหม่เรียบร้อย');
  } catch (err) {
    showToast(err.message, true);
  }
}

// ==================== TAB 3: PPFS 54 ====================
function getFilteredPpfs() {
  const q = document.getElementById('ppfs-q').value.trim().toLowerCase();
  const cat = document.getElementById('ppfs-category').value;
  return state.ppfs.filter((p) => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (q) {
      const hay = `${p.name} ${p.category} ${p.adpCode} ${p.claimChannel} ${p.owner} ${p.condition}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderPpfsTable() {
  const list = getFilteredPpfs();
  document.getElementById('ppfs-count-label').textContent = `แสดง ${list.length} จาก ${state.ppfs.length} รายการ PPFS`;
  const tbody = document.getElementById('ppfs-tbody');

  tbody.innerHTML = list
    .map((p) => {
      const targetCell = state.editMode
        ? `<input type="number" value="${p.targetCount}" onchange="updatePpfsField(${p.no}, 'targetCount', this.value)" class="w-20 px-2 py-1 rounded border border-slate-300 text-right tabular-nums text-xs" />`
        : fmtNum(p.targetCount || 0);
      const actualCell = state.editMode
        ? `<input type="number" value="${p.actualCount}" onchange="updatePpfsField(${p.no}, 'actualCount', this.value)" class="w-20 px-2 py-1 rounded border border-slate-300 text-right tabular-nums text-xs" />`
        : `<span class="font-semibold text-teal-700">${fmtNum(p.actualCount || 0)}</span>`;

      return `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3 align-top">
            <div class="text-[11px] font-semibold text-teal-700">${escapeHtml(p.category)}</div>
            <div class="font-semibold text-slate-900">${escapeHtml(p.name)}</div>
            ${p.condition ? `<div class="text-xs text-slate-500 mt-0.5">เงื่อนไข: ${escapeHtml(p.condition)}</div>` : ''}
          </td>
          <td class="px-4 py-3 align-top text-xs font-medium text-slate-800 whitespace-nowrap">${escapeHtml(p.rateText)}</td>
          <td class="px-4 py-3 align-top text-xs font-mono text-indigo-700">${escapeHtml(p.adpCode)}</td>
          <td class="px-4 py-3 align-top text-xs">
            <span class="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-medium">${escapeHtml(p.claimChannel)}</span>
            <div class="text-slate-500 mt-0.5">โอน: ${escapeHtml(p.transferChannel)}</div>
          </td>
          <td class="px-4 py-3 align-top text-right tabular-nums">${targetCell}</td>
          <td class="px-4 py-3 align-top text-right tabular-nums">${actualCell}</td>
          <td class="px-4 py-3 align-top text-xs text-slate-600">${escapeHtml(p.owner)}</td>
        </tr>
      `;
    })
    .join('');
}

async function updatePpfsField(no, field, value) {
  try {
    await api(`/api/ppfs/${no}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: Number(value) })
    });
    const item = state.ppfs.find((p) => p.no === no);
    if (item) item[field] = Number(value);
    showToast(`อัปเดต PPFS #${no} เรียบร้อย`);
  } catch (err) {
    showToast(err.message, true);
  }
}

// ==================== TAB 4: IT DASHBOARD MONITOR HUB ====================
function renderItMonitor() {
  const reports = state.itReports || [];
  const q = (document.getElementById('it-filter-q').value || '').trim().toLowerCase();
  const dept = document.getElementById('it-filter-dept').value;
  const statusFilter = document.getElementById('it-filter-status').value;
  const priorityFilter = document.getElementById('it-filter-priority').value;

  // Update summary counters
  document.getElementById('it-sum-total').textContent = reports.length;
  document.getElementById('it-sum-ready').textContent = reports.filter((r) => r.status === 'ready').length;
  document.getElementById('it-sum-progress').textContent = reports.filter((r) => r.status === 'in_progress').length;
  document.getElementById('it-sum-high').textContent = reports.filter((r) => r.priority === 'high').length;

  const badge = document.getElementById('it-hosxp-badge');
  if (state.hosxpConfig && state.hosxpConfig.user) {
    badge.textContent = `HOSxP: ${state.hosxpConfig.host}:${state.hosxpConfig.port}/${state.hosxpConfig.database}`;
  } else {
    badge.textContent = 'HOSxP: ยังไม่ตั้งค่า (โหมดตัวอย่าง)';
  }

  const list = reports.filter((r) => {
    if (dept !== 'all' && r.departmentId !== dept) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (q) {
      const hay = `${r.id} ${r.title} ${r.description} ${r.departmentName} ${r.source}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const container = document.getElementById('it-cards-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="col-span-full bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">ไม่พบรายงาน IT ที่ตรงกับเงื่อนไข</div>';
    return;
  }

  const statusMeta = {
    pending: { label: 'รอดำเนินการ', cls: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'กำลังพัฒนา', cls: 'bg-amber-100 text-amber-800' },
    ready: { label: 'พร้อมใช้งาน', cls: 'bg-emerald-100 text-emerald-800' }
  };
  const priorityMeta = {
    high: { label: 'ด่วนมาก', cls: 'bg-rose-50 text-rose-700 border border-rose-200' },
    medium: { label: 'ปานกลาง', cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
    low: { label: 'ปกติ', cls: 'bg-slate-50 text-slate-600 border border-slate-200' }
  };

  container.innerHTML = list
    .map((r) => {
      const st = statusMeta[r.status] || statusMeta.pending;
      const pr = priorityMeta[r.priority] || priorityMeta.medium;
      const quickBtns = state.editMode
        ? `
          <div class="flex gap-1.5">
            <button onclick="setItStatus('${r.id}', 'pending')" class="px-2 py-1 rounded-lg text-[11px] border ${r.status === 'pending' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'} cursor-pointer">รอทำ</button>
            <button onclick="setItStatus('${r.id}', 'in_progress')" class="px-2 py-1 rounded-lg text-[11px] border ${r.status === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600'} cursor-pointer">กำลังทำ</button>
            <button onclick="setItStatus('${r.id}', 'ready')" class="px-2 py-1 rounded-lg text-[11px] border ${r.status === 'ready' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'} cursor-pointer">พร้อมใช้</button>
          </div>
        `
        : '';

      return `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 card-hover flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">${escapeHtml(r.id)}</span>
                <span class="text-xs font-semibold text-teal-700">${escapeHtml(r.departmentName)}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${pr.cls}">${pr.label}</span>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}">${st.label}</span>
              </div>
            </div>
            <h3 class="font-bold text-slate-900 text-sm leading-snug">${escapeHtml(r.title)}</h3>
            <div class="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 whitespace-pre-line">${escapeHtml(r.description)}</div>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            <div class="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-1">
              <span>แหล่งข้อมูล: <strong class="text-indigo-700">${escapeHtml(r.source)}</strong></span>
              <span>ความถี่: <strong>${escapeHtml(r.frequency)}</strong></span>
            </div>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <button onclick="openItReportModal('${r.id}')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                เปิดดูรายงาน & SQL
              </button>
              ${quickBtns}
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

async function setItStatus(id, status) {
  try {
    await api(`/api/it-reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadAll();
    showToast(`อัปเดตสถานะ ${id} เรียบร้อย`);
  } catch (err) {
    showToast(err.message, true);
  }
}

function openItReportModal(id) {
  const r = state.itReports.find((x) => x.id === id);
  if (!r) return;
  state.currentItReport = r;

  document.getElementById('itr-code').textContent = r.id;
  document.getElementById('itr-dept').textContent = r.departmentName;
  document.getElementById('itr-title').textContent = r.title;
  document.getElementById('itr-desc').textContent = r.description;
  document.getElementById('itr-source').textContent = r.source;
  document.getElementById('itr-freq').textContent = r.frequency;
  document.getElementById('itr-assignee').textContent = r.assignee || 'ทีม IT';
  document.getElementById('itr-sql').value = r.sqlQuery || '';

  document.getElementById('itr-dev-controls').classList.toggle('hidden', !state.editMode);
  document.getElementById('itr-save-sql-btn').classList.toggle('hidden', !state.editMode);
  if (state.editMode) {
    document.getElementById('itr-edit-status').value = r.status;
    document.getElementById('itr-edit-priority').value = r.priority;
    document.getElementById('itr-edit-assignee').value = r.assignee || '';
    document.getElementById('itr-edit-note').value = r.note || '';
  }

  showItSampleData();
  const modal = document.getElementById('it-report-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeItReportModal() {
  const modal = document.getElementById('it-report-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.currentItReport = null;
}

function renderItResultTable(columns, rows, labelText) {
  state.currentItResult = { columns, rows };
  document.getElementById('itr-result-label').textContent = labelText;
  const thead = document.getElementById('itr-result-thead');
  const tbody = document.getElementById('itr-result-tbody');

  thead.innerHTML = `<tr>${columns.map((c) => `<th class="px-3 py-2 font-semibold whitespace-nowrap">${escapeHtml(c)}</th>`).join('')}</tr>`;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="px-3 py-6 text-center text-slate-400">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((row) => {
      const cells = Array.isArray(row) ? row : columns.map((c) => row[c]);
      return `<tr class="hover:bg-slate-50">${cells.map((v) => `<td class="px-3 py-2 whitespace-nowrap text-slate-700">${escapeHtml(v ?? '')}</td>`).join('')}</tr>`;
    })
    .join('');
}

function showItSampleData() {
  const r = state.currentItReport;
  if (!r) return;
  renderItResultTable(
    r.sampleColumns || ['ข้อมูล'],
    r.sampleRows || [],
    `ตัวอย่างโครงสร้างรายงาน (${(r.sampleRows || []).length} แถว) — ตั้งค่า HOSxP เพื่อดึงข้อมูลจริง`
  );
}

async function runItReportQuery() {
  const r = state.currentItReport;
  if (!r) return;
  const sqlQuery = document.getElementById('itr-sql').value;
  const startDate = document.getElementById('itr-start-date').value;
  const endDate = document.getElementById('itr-end-date').value;
  try {
    showToast('กำลังดึงข้อมูลจาก HOSxP...');
    const res = await api(`/api/it-reports/${r.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ sqlQuery, startDate, endDate })
    });
    renderItResultTable(res.columns, res.rows, `ผลลัพธ์จริงจาก HOSxP (${res.totalRows} แถว, แสดงสูงสุด 500 แถว)`);
    showToast(`ดึงข้อมูลสำเร็จ ${res.totalRows} แถว`);
  } catch (err) {
    showToast(err.message, true);
  }
}

function copyItSql() {
  const sql = document.getElementById('itr-sql').value;
  navigator.clipboard.writeText(sql).then(() => showToast('คัดลอกคำสั่ง SQL แล้ว'));
}

async function saveItReportMeta() {
  const r = state.currentItReport;
  if (!r) return;
  const payload = {
    sqlQuery: document.getElementById('itr-sql').value,
    status: document.getElementById('itr-edit-status').value,
    priority: document.getElementById('itr-edit-priority').value,
    assignee: document.getElementById('itr-edit-assignee').value,
    note: document.getElementById('itr-edit-note').value
  };
  try {
    await api(`/api/it-reports/${r.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await loadAll();
    showToast('บันทึกข้อมูลรายงาน IT เรียบร้อย');
  } catch (err) {
    showToast(err.message, true);
  }
}

function exportItReportCsv() {
  const { columns, rows } = state.currentItResult;
  if (!columns || columns.length === 0) return showToast('ไม่มีข้อมูลสำหรับ Export', true);
  const matrix = [columns];
  for (const row of rows) {
    matrix.push(Array.isArray(row) ? row : columns.map((c) => row[c]));
  }
  const code = state.currentItReport ? state.currentItReport.id : 'report';
  downloadCsv(`${code}.csv`, matrix);
}

// ==================== HOSXP CONFIG MODAL ====================
function openHosxpConfigModal() {
  const cfg = state.hosxpConfig || {};
  document.getElementById('hosxp-host').value = cfg.host || '127.0.0.1';
  document.getElementById('hosxp-port').value = cfg.port || 3306;
  document.getElementById('hosxp-db').value = cfg.database || 'hos';
  document.getElementById('hosxp-user').value = cfg.user || '';
  document.getElementById('hosxp-pass').value = '';
  document.getElementById('hosxp-test-result').classList.add('hidden');
  const modal = document.getElementById('hosxp-config-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeHosxpConfigModal() {
  const modal = document.getElementById('hosxp-config-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function saveHosxpConn() {
  const payload = {
    host: document.getElementById('hosxp-host').value.trim(),
    port: Number(document.getElementById('hosxp-port').value || 3306),
    database: document.getElementById('hosxp-db').value.trim(),
    user: document.getElementById('hosxp-user').value.trim(),
    password: document.getElementById('hosxp-pass').value
  };
  try {
    state.hosxpConfig = await api('/api/hosxp/config', { method: 'PUT', body: JSON.stringify(payload) });
    renderItMonitor();
    closeHosxpConfigModal();
    showToast('บันทึกการตั้งค่า HOSxP เรียบร้อย');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function testHosxpConn() {
  const box = document.getElementById('hosxp-test-result');
  const payload = {
    host: document.getElementById('hosxp-host').value.trim(),
    port: Number(document.getElementById('hosxp-port').value || 3306),
    database: document.getElementById('hosxp-db').value.trim(),
    user: document.getElementById('hosxp-user').value.trim(),
    password: document.getElementById('hosxp-pass').value
  };
  try {
    state.hosxpConfig = await api('/api/hosxp/config', { method: 'PUT', body: JSON.stringify(payload) });
    const res = await api('/api/hosxp/test', { method: 'POST' });
    box.className = 'p-2.5 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200';
    box.textContent = `เชื่อมต่อสำเร็จ! MySQL ${res.info.version} (DB: ${res.info.db})`;
    box.classList.remove('hidden');
  } catch (err) {
    box.className = 'p-2.5 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200';
    box.textContent = `เชื่อมต่อไม่สำเร็จ: ${err.message}`;
    box.classList.remove('hidden');
  }
}

// ==================== TAB 5: ROADMAP & INSIGHTS ====================
function renderRoadmaps() {
  if (!state.roadmaps) return;
  const { erPdca, ipdTimeline, ipdInsights } = state.roadmaps;

  document.getElementById('er-roadmap-grid').innerHTML = erPdca
    .map(
      (q) => `
      <div class="rounded-xl p-4 bg-rose-50/50 border border-rose-200/70">
        <div class="text-xs font-bold text-rose-700">${escapeHtml(q.phase)}</div>
        <div class="font-bold text-slate-900 text-sm mt-0.5 mb-2">${escapeHtml(q.title)}</div>
        <ul class="space-y-1 text-xs text-slate-700 list-disc list-inside">
          ${q.items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>
    `
    )
    .join('');

  document.getElementById('ipd-timeline-grid').innerHTML = ipdTimeline
    .map(
      (t) => `
      <div class="rounded-xl p-4 bg-indigo-50/50 border border-indigo-200/70">
        <div class="text-xs font-bold text-indigo-700 mb-2">${escapeHtml(t.phase)}</div>
        <ul class="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
          ${t.items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>
    `
    )
    .join('');

  document.getElementById('ipd-insights-grid').innerHTML = ipdInsights
    .map(
      (ins) => `
      <div class="rounded-xl p-4 bg-slate-50 border border-slate-200">
        <div class="font-bold text-slate-900 text-sm mb-1">${escapeHtml(ins.topic)}</div>
        <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(ins.detail)}</p>
      </div>
    `
    )
    .join('');
}

// ==================== CSV EXPORT ====================
function downloadCsv(filename, rows) {
  const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportPlansCsv() {
  const list = getFilteredPlans();
  const rows = [
    ['กลุ่มงาน', 'ประเภท', 'กิจกรรมหลัก', 'เป้าหมาย', 'หน่วย', 'มูลค่าคาดการณ์(บาท)', 'ผลงานจริง(จำนวน)', 'ผลงานจริง(บาท)', 'ตัวชี้วัด', 'IT Monitor', 'ผู้รับผิดชอบ']
  ];
  for (const i of list) {
    rows.push([
      i.departmentName,
      i.planType,
      i.title,
      i.targetText,
      i.targetUnit,
      i.expectedAmount,
      i.actualCount,
      i.actualAmount,
      i.kpi,
      i.itMonitor,
      i.owner
    ]);
  }
  downloadCsv('ksp-action-plan-2570.csv', rows);
}

function exportPpfsCsv() {
  const list = getFilteredPpfs();
  const rows = [['ลำดับ', 'หมวดหมู่', 'รายการ PPFS', 'อัตราจ่าย', 'รหัส ADP', 'ช่องทางเบิก', 'ช่องทางโอน', 'เป้าหมาย', 'ผลงานจริง', 'ผู้รับผิดชอบ']];
  for (const p of list) {
    rows.push([p.no, p.category, p.name, p.rateText, p.adpCode, p.claimChannel, p.transferChannel, p.targetCount, p.actualCount, p.owner]);
  }
  downloadCsv('ksp-ppfs-54-items-2570.csv', rows);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  updateEditModeUI();
  document.getElementById('filter-q').addEventListener('input', renderPlansTable);
  document.getElementById('filter-dept').addEventListener('change', renderPlansTable);
  document.getElementById('filter-type').addEventListener('change', renderPlansTable);
  document.getElementById('ppfs-q').addEventListener('input', renderPpfsTable);
  document.getElementById('ppfs-category').addEventListener('change', renderPpfsTable);
  document.getElementById('it-filter-q').addEventListener('input', renderItMonitor);
  document.getElementById('it-filter-dept').addEventListener('change', renderItMonitor);
  document.getElementById('it-filter-status').addEventListener('change', renderItMonitor);
  document.getElementById('it-filter-priority').addEventListener('change', renderItMonitor);
  loadAll();
});
