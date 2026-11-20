const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const store = require('./lib/store');

const app = express();
const PORT = Number(process.env.PORT || 3540);
const EDIT_PIN = process.env.EDIT_PIN || 'ksp2570';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ksp-action-plan', fiscalYear: '2570', timestamp: new Date().toISOString() });
});

// Verify edit PIN
app.post('/api/auth/verify', (req, res) => {
  const { pin } = req.body || {};
  if (pin === EDIT_PIN) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'รหัสผ่านโหมดแก้ไขไม่ถูกต้อง' });
});

// Dashboard summary
app.get('/api/dashboard', (req, res) => {
  res.json(store.getDashboardSummary());
});

// List action items
app.get('/api/items', (req, res) => {
  const items = store.listItems(req.query);
  res.json({ items, total: items.length });
});

// Get single action item
app.get('/api/items/:id', (req, res) => {
  const item = store.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการที่ระบุ' });
  res.json(item);
});

// Create action item
app.post('/api/items', (req, res) => {
  if (!req.body || !req.body.title) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อกิจกรรมหลัก' });
  }
  const created = store.createItem(req.body);
  res.status(201).json(created);
});

// Update action item
app.put('/api/items/:id', (req, res) => {
  const updated = store.updateItem(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'ไม่พบรายการที่ระบุ' });
  res.json(updated);
});

// Update monthly progress for an item
app.patch('/api/items/:id/monthly', (req, res) => {
  const { monthKey, count, amount, note } = req.body || {};
  if (!monthKey) return res.status(400).json({ error: 'กรุณาระบุเดือน (monthKey)' });
  const updated = store.updateItemMonthly(req.params.id, monthKey, { count, amount, note });
  if (!updated) return res.status(404).json({ error: 'ไม่พบรายการที่ระบุ' });
  res.json(updated);
});

// Delete action item
app.delete('/api/items/:id', (req, res) => {
  const ok = store.deleteItem(req.params.id);
  if (!ok) return res.status(404).json({ error: 'ไม่พบรายการที่ระบุ' });
  res.json({ ok: true });
});

// List PPFS 54 items
app.get('/api/ppfs', (req, res) => {
  const ppfs = store.listPpfs(req.query);
  res.json({ items: ppfs, total: ppfs.length });
});

// Update PPFS item target/actual
app.patch('/api/ppfs/:no', (req, res) => {
  const updated = store.updatePpfs(req.params.no, req.body || {});
  if (!updated) return res.status(404).json({ error: 'ไม่พบรายการ PPFS ที่ระบุ' });
  res.json(updated);
});

// Roadmaps & Insights
app.get('/api/roadmaps', (req, res) => {
  const db = store.getDb();
  res.json({
    roadmaps: db.roadmaps,
    fiscalMonths: db.fiscalMonths
  });
});

// ==================== IT Dashboard Monitor Hub ====================
app.get('/api/it-reports', (req, res) => {
  const reports = store.listItReports(req.query);
  res.json({ items: reports, total: reports.length });
});

app.patch('/api/it-reports/:id', (req, res) => {
  const updated = store.updateItReport(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'ไม่พบรายการรายงาน IT ที่ระบุ' });
  res.json(updated);
});

app.get('/api/hosxp/config', (req, res) => {
  res.json(store.getHosxpConfig());
});

app.put('/api/hosxp/config', (req, res) => {
  const updated = store.updateHosxpConfig(req.body || {});
  res.json(updated);
});

app.post('/api/hosxp/test', async (req, res) => {
  const cfg = store.getRawHosxpConfig();
  if (!cfg.host || !cfg.user) {
    return res.status(400).json({ ok: false, error: 'กรุณาระบุ Host และ Username ของฐานข้อมูล HOSxP ก่อน' });
  }
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: Number(cfg.port || 3306),
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database || 'hos',
      connectTimeout: 5000
    });
    const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db');
    res.json({ ok: true, info: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

app.post('/api/it-reports/:id/run', async (req, res) => {
  const report = store.getItReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'ไม่พบรายงาน IT ที่ระบุ' });

  const sqlText = ((req.body && req.body.sqlQuery) || report.sqlQuery || '').trim();
  const cleanSql = sqlText.replace(/^--.*$/gm, '').trim();
  if (!/^select\b/i.test(cleanSql)) {
    return res.status(400).json({ error: 'อนุญาตเฉพาะคำสั่ง SELECT แบบอ่านอย่างเดียวเท่านั้น' });
  }

  const cfg = store.getRawHosxpConfig();
  if (!cfg.host || !cfg.user) {
    return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล HOSxP' });
  }

  const startDate = (req.body && req.body.startDate) || '2026-10-01';
  const endDate = (req.body && req.body.endDate) || '2027-09-30';

  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: Number(cfg.port || 3306),
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database || 'hos',
      connectTimeout: 6000
    });
    const preparedSql = sqlText
      .replace(/:start_date/g, conn.escape(startDate))
      .replace(/:end_date/g, conn.escape(endDate));
    const [rows, fields] = await conn.query(preparedSql);
    const columns = fields ? fields.map((f) => f.name) : [];
    res.json({
      ok: true,
      columns,
      rows: Array.isArray(rows) ? rows.slice(0, 500) : [],
      totalRows: Array.isArray(rows) ? rows.length : 0
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KSP Action Plan 2570 running on http://0.0.0.0:${PORT}`);
});
