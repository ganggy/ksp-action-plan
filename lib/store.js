const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  FISCAL_MONTHS,
  DEPARTMENTS,
  ACTION_ITEMS,
  PPFS_ITEMS,
  ROADMAPS,
  emptyMonthly
} = require('../data/seed');
const { IT_REPORTS } = require('../data/itReports');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      meta: {
        hospitalName: 'โรงพยาบาลโคกศรีสุพรรณ',
        location: 'อำเภอโคกศรีสุพรรณ จังหวัดสกลนคร',
        fiscalYear: '2570',
        updatedAt: new Date().toISOString()
      },
      fiscalMonths: clone(FISCAL_MONTHS),
      departments: clone(DEPARTMENTS),
      items: clone(ACTION_ITEMS),
      ppfs: clone(PPFS_ITEMS),
      roadmaps: clone(ROADMAPS),
      itReports: clone(IT_REPORTS),
      hosxpConfig: {
        host: process.env.HOSXP_HOST || '127.0.0.1',
        port: Number(process.env.HOSXP_PORT || 3306),
        user: process.env.HOSXP_USER || '',
        password: process.env.HOSXP_PASSWORD || '',
        database: process.env.HOSXP_DB || 'hos'
      }
    };
    saveDb(initial);
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  let changed = false;
  if (!parsed.itReports) {
    parsed.itReports = clone(IT_REPORTS);
    changed = true;
  }
  if (!parsed.hosxpConfig) {
    parsed.hosxpConfig = {
      host: process.env.HOSXP_HOST || '127.0.0.1',
      port: Number(process.env.HOSXP_PORT || 3306),
      user: process.env.HOSXP_USER || '',
      password: process.env.HOSXP_PASSWORD || '',
      database: process.env.HOSXP_DB || 'hos'
    };
    changed = true;
  }
  if (changed) saveDb(parsed);
  return parsed;
}

function saveDb(data) {
  data.meta.updatedAt = new Date().toISOString();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

let db = initDb();

function getDb() {
  return db;
}

function computeItemTotals(item) {
  let actualCount = 0;
  let actualAmount = 0;
  if (item.monthly) {
    for (const key of Object.keys(item.monthly)) {
      const m = item.monthly[key];
      actualCount += Number(m.count || 0);
      actualAmount += Number(m.amount || 0);
    }
  }
  const expectedAmount = Number(item.expectedAmount || 0);
  const targetCount = Number(item.targetCount || 0);
  const amountProgress = expectedAmount > 0 ? Math.min(999, Math.round((actualAmount / expectedAmount) * 1000) / 10) : 0;
  const countProgress = targetCount > 0 ? Math.min(999, Math.round((actualCount / targetCount) * 1000) / 10) : 0;
  return {
    ...item,
    actualCount,
    actualAmount,
    amountProgress,
    countProgress
  };
}

function getDashboardSummary() {
  const items = db.items.map(computeItemTotals);
  const deptMap = {};
  for (const d of db.departments) {
    deptMap[d.id] = {
      ...d,
      expectedRevenue: 0,
      actualRevenue: 0,
      expectedCostReduction: 0,
      actualCostReduction: 0,
      itemCount: 0,
      completedCount: 0,
      itReadyCount: 0
    };
  }

  let totalExpectedRevenue = 0;
  let totalActualRevenue = 0;
  let totalExpectedCostReduction = 0;
  let totalActualCostReduction = 0;
  let itReady = 0;
  let itInProgress = 0;
  let itPending = 0;

  const monthlyTotals = {};
  for (const fm of db.fiscalMonths) {
    monthlyTotals[fm.key] = { key: fm.key, label: fm.label, revenue: 0, costReduction: 0 };
  }

  for (const item of items) {
    const dept = deptMap[item.departmentId];
    if (dept) {
      dept.itemCount += 1;
      if (item.status === 'completed') dept.completedCount += 1;
      if (item.itStatus === 'ready') dept.itReadyCount += 1;
    }
    if (item.itStatus === 'ready') itReady += 1;
    else if (item.itStatus === 'in_progress') itInProgress += 1;
    else itPending += 1;

    if (item.planType === 'revenue') {
      totalExpectedRevenue += Number(item.expectedAmount || 0);
      totalActualRevenue += item.actualAmount;
      if (dept) {
        dept.expectedRevenue += Number(item.expectedAmount || 0);
        dept.actualRevenue += item.actualAmount;
      }
    } else if (item.planType === 'cost_reduction') {
      totalExpectedCostReduction += Number(item.expectedAmount || 0);
      totalActualCostReduction += item.actualAmount;
      if (dept) {
        dept.expectedCostReduction += Number(item.expectedAmount || 0);
        dept.actualCostReduction += item.actualAmount;
      }
    }

    if (item.monthly) {
      for (const fm of db.fiscalMonths) {
        const m = item.monthly[fm.key];
        if (!m) continue;
        if (item.planType === 'revenue') {
          monthlyTotals[fm.key].revenue += Number(m.amount || 0);
        } else if (item.planType === 'cost_reduction') {
          monthlyTotals[fm.key].costReduction += Number(m.amount || 0);
        }
      }
    }
  }

  return {
    meta: db.meta,
    kpis: {
      totalExpectedRevenue,
      totalActualRevenue,
      revenueProgress: totalExpectedRevenue > 0 ? Math.round((totalActualRevenue / totalExpectedRevenue) * 1000) / 10 : 0,
      totalExpectedCostReduction,
      totalActualCostReduction,
      costProgress: totalExpectedCostReduction > 0 ? Math.round((totalActualCostReduction / totalExpectedCostReduction) * 1000) / 10 : 0,
      totalItems: items.length,
      completedItems: items.filter((i) => i.status === 'completed').length,
      itTasks: {
        total: items.length,
        ready: itReady,
        inProgress: itInProgress,
        pending: itPending
      },
      ppfsTotal: db.ppfs.length
    },
    departments: Object.values(deptMap),
    monthlySeries: db.fiscalMonths.map((fm) => monthlyTotals[fm.key])
  };
}

function listItems(filters = {}) {
  let items = db.items.map(computeItemTotals);
  if (filters.departmentId && filters.departmentId !== 'all') {
    items = items.filter((i) => i.departmentId === filters.departmentId);
  }
  if (filters.planType && filters.planType !== 'all') {
    items = items.filter((i) => i.planType === filters.planType);
  }
  if (filters.status && filters.status !== 'all') {
    items = items.filter((i) => i.status === filters.status);
  }
  if (filters.itStatus && filters.itStatus !== 'all') {
    items = items.filter((i) => i.itStatus === filters.itStatus);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (i) =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.detail || '').toLowerCase().includes(q) ||
        (i.owner || '').toLowerCase().includes(q) ||
        (i.itMonitor || '').toLowerCase().includes(q) ||
        (i.kpi || '').toLowerCase().includes(q) ||
        (i.departmentName || '').toLowerCase().includes(q)
    );
  }
  return items;
}

function getItem(id) {
  const item = db.items.find((i) => i.id === id);
  return item ? computeItemTotals(item) : null;
}

function createItem(payload) {
  const dept = db.departments.find((d) => d.id === payload.departmentId);
  const newItem = {
    id: `${payload.departmentId || 'custom'}-${crypto.randomBytes(3).toString('hex')}`,
    departmentId: payload.departmentId || 'pt',
    departmentName: dept ? dept.name : payload.departmentName || 'อื่นๆ',
    planType: payload.planType || 'revenue',
    title: payload.title || 'กิจกรรมใหม่',
    detail: payload.detail || '',
    targetText: payload.targetText || '',
    targetCount: Number(payload.targetCount || 0),
    targetUnit: payload.targetUnit || 'คน',
    expectedAmount: Number(payload.expectedAmount || 0),
    amountFormula: payload.amountFormula || '',
    kpi: payload.kpi || '',
    itMonitor: payload.itMonitor || '',
    itStatus: payload.itStatus || 'pending',
    itSource: payload.itSource || 'HOSxP',
    owner: payload.owner || '',
    status: payload.status || 'in_progress',
    monthly: emptyMonthly()
  };
  db.items.push(newItem);
  saveDb(db);
  return computeItemTotals(newItem);
}

function updateItem(id, payload) {
  const idx = db.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const current = db.items[idx];
  const dept = payload.departmentId ? db.departments.find((d) => d.id === payload.departmentId) : null;

  const updated = {
    ...current,
    ...payload,
    id: current.id,
    departmentName: dept ? dept.name : current.departmentName,
    targetCount: payload.targetCount !== undefined ? Number(payload.targetCount) : current.targetCount,
    expectedAmount: payload.expectedAmount !== undefined ? Number(payload.expectedAmount) : current.expectedAmount,
    monthly: payload.monthly ? payload.monthly : current.monthly
  };
  db.items[idx] = updated;
  saveDb(db);
  return computeItemTotals(updated);
}

function updateItemMonthly(id, monthKey, { count, amount, note }) {
  const idx = db.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  if (!db.items[idx].monthly) {
    db.items[idx].monthly = emptyMonthly();
  }
  db.items[idx].monthly[monthKey] = {
    count: Number(count || 0),
    amount: Number(amount || 0),
    note: note || ''
  };
  saveDb(db);
  return computeItemTotals(db.items[idx]);
}

function deleteItem(id) {
  const idx = db.items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  db.items.splice(idx, 1);
  saveDb(db);
  return true;
}

function listPpfs(filters = {}) {
  let list = [...db.ppfs];
  if (filters.category && filters.category !== 'all') {
    list = list.filter((p) => p.category === filters.category);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.adpCode.toLowerCase().includes(q) ||
        p.claimChannel.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q)
    );
  }
  return list;
}

function updatePpfs(no, payload) {
  const idx = db.ppfs.findIndex((p) => p.no === Number(no));
  if (idx === -1) return null;
  db.ppfs[idx] = {
    ...db.ppfs[idx],
    targetCount: payload.targetCount !== undefined ? Number(payload.targetCount) : db.ppfs[idx].targetCount,
    actualCount: payload.actualCount !== undefined ? Number(payload.actualCount) : db.ppfs[idx].actualCount,
    note: payload.note !== undefined ? payload.note : db.ppfs[idx].note || ''
  };
  saveDb(db);
  return db.ppfs[idx];
}

function listItReports(filters = {}) {
  let list = [...(db.itReports || [])];
  if (filters.departmentId && filters.departmentId !== 'all') {
    list = list.filter((r) => r.departmentId === filters.departmentId);
  }
  if (filters.status && filters.status !== 'all') {
    list = list.filter((r) => r.status === filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
    list = list.filter((r) => r.priority === filters.priority);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.departmentName.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q)
    );
  }
  return list;
}

function getItReport(id) {
  return (db.itReports || []).find((r) => r.id === id) || null;
}

function updateItReport(id, payload) {
  const idx = (db.itReports || []).findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const cur = db.itReports[idx];
  db.itReports[idx] = {
    ...cur,
    status: payload.status !== undefined ? payload.status : cur.status,
    priority: payload.priority !== undefined ? payload.priority : cur.priority,
    assignee: payload.assignee !== undefined ? payload.assignee : cur.assignee,
    sqlQuery: payload.sqlQuery !== undefined ? payload.sqlQuery : cur.sqlQuery,
    note: payload.note !== undefined ? payload.note : cur.note || '',
    updatedAt: new Date().toISOString()
  };
  saveDb(db);
  return db.itReports[idx];
}

function getHosxpConfig() {
  const cfg = db.hosxpConfig || {};
  return {
    host: cfg.host || '127.0.0.1',
    port: cfg.port || 3306,
    user: cfg.user || '',
    hasPassword: Boolean(cfg.password),
    database: cfg.database || 'hos'
  };
}

function updateHosxpConfig(payload) {
  const cur = db.hosxpConfig || {};
  db.hosxpConfig = {
    host: payload.host !== undefined ? payload.host : cur.host,
    port: payload.port !== undefined ? Number(payload.port) : cur.port,
    user: payload.user !== undefined ? payload.user : cur.user,
    password: payload.password !== undefined && payload.password !== '' ? payload.password : cur.password,
    database: payload.database !== undefined ? payload.database : cur.database
  };
  saveDb(db);
  return getHosxpConfig();
}

function getRawHosxpConfig() {
  return db.hosxpConfig || {};
}

module.exports = {
  getDb,
  getDashboardSummary,
  listItems,
  getItem,
  createItem,
  updateItem,
  updateItemMonthly,
  deleteItem,
  listPpfs,
  updatePpfs,
  listItReports,
  getItReport,
  updateItReport,
  getHosxpConfig,
  updateHosxpConfig,
  getRawHosxpConfig
};
