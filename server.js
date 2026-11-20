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

function toFiscalKey(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split('-');
  return `${Number(y) + 543}-${m}`;
}

app.post('/api/hosxp/sync-dashboard', async (req, res) => {
  const cfg = store.getRawHosxpConfig();
  if (!cfg.host || !cfg.user) {
    return res.status(400).json({ ok: false, error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล HOSxP' });
  }
  const startDate = '2026-10-01';
  const endDate = '2027-09-30';
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: Number(cfg.port || 3306),
      user: cfg.user,
      password: cfg.password || '',
      database: cfg.database || 'hos',
      connectTimeout: 8000
    });

    const syncedItems = [];
    const applyMonthlyRows = (itemId, rows, notePrefix) => {
      for (const r of rows) {
        const key = toFiscalKey(r.ym);
        if (!key) continue;
        store.updateItemMonthly(itemId, key, {
          count: Number(r.cnt || 0),
          amount: Math.round(Number(r.amt || 0) * 100) / 100,
          note: `${notePrefix} (ซิงค์จาก HOSxP)`
        });
      }
      syncedItems.push(itemId);
    };

    // 1. PT-01: 8610 รองเท้า Plantar Fasciitis
    const [pt01] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COALESCE(SUM(op.sum_price),0) AS amt
       FROM opitemrece op
       JOIN nondrugitems n ON n.icode = op.icode
       WHERE op.vstdate BETWEEN ? AND ? AND (op.icode IN ('3010607','3010971') OR n.billcode='8610')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('pt-01', pt01, '8610');

    // 2. PT-02: กายอุปกรณ์และอุปกรณ์ช่วยเดิน
    const [pt02Codes] = await conn.query(
      `SELECT icode FROM nondrugitems
       WHERE name LIKE '%Pick-up-walker%' OR name LIKE '%Walker%' OR name LIKE '%Knee support%'
          OR name LIKE '%Tripod%' OR name LIKE '%Single Cane%' OR name LIKE '%Crutch%' OR name LIKE '%Wheelchair%'`
    );
    const pt02Icodes = pt02Codes.map((x) => x.icode);
    if (pt02Icodes.length > 0) {
      const [pt02] = await conn.query(
        `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COALESCE(SUM(op.sum_price),0) AS amt
         FROM opitemrece op
         WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN (?)
         GROUP BY ym`,
        [startDate, endDate, pt02Icodes]
      );
      applyMonthlyRows('pt-02', pt02, 'กายอุปกรณ์');
    }

    // 3. PT-04 & PT-06: กายภาพบำบัดแยกสิทธิ (income = '14')
    const [pt14Codes] = await conn.query(`SELECT icode FROM nondrugitems WHERE income = '14'`);
    const pt14Icodes = pt14Codes.map((x) => x.icode);
    if (pt14Icodes.length > 0) {
      const [ptUc] = await conn.query(
        `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COALESCE(SUM(op.sum_price),0) AS amt
         FROM opitemrece op
         JOIN ovst o ON o.vn = op.vn
         JOIN pttype pt ON pt.pttype = o.pttype
         WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN (?) AND pt.pcode = 'UC'
         GROUP BY ym`,
        [startDate, endDate, pt14Icodes]
      );
      applyMonthlyRows('pt-04', ptUc, 'กายภาพ UC');

      const [ptCscd] = await conn.query(
        `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COALESCE(SUM(op.sum_price),0) AS amt
         FROM opitemrece op
         JOIN ovst o ON o.vn = op.vn
         JOIN pttype pt ON pt.pttype = o.pttype
         WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN (?) AND pt.pcode IN ('A2','A7','A8','A9')
         GROUP BY ym`,
        [startDate, endDate, pt14Icodes]
      );
      applyMonthlyRows('pt-06', ptCscd, 'กายภาพ CSCD/อปท.');
    }

    // 4. LR-01: ตึกคลอด (ward '02')
    const [lr01] = await conn.query(
      `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, COUNT(*) AS cnt, COALESCE(SUM(a.income),0) AS amt
       FROM ipt i
       JOIN an_stat a ON a.an = i.an
       WHERE i.ward = '02' AND i.dchdate BETWEEN ? AND ?
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('lr-01', lr01, 'ตึกคลอด');

    // 5. ER-01 (ตรวจวินิจฉัย ER ขรก./อปท./ปกส.) & ER-04 (EMS ESI 1-2)
    const [er01] = await conn.query(
      `SELECT DATE_FORMAT(e.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT e.vn) AS cnt, COALESCE(SUM(v.income),0) AS amt
       FROM er_regist e
       JOIN ovst o ON o.vn = e.vn
       JOIN pttype pt ON pt.pttype = o.pttype
       JOIN vn_stat v ON v.vn = e.vn
       WHERE e.vstdate BETWEEN ? AND ? AND pt.pcode IN ('A2','A7','A8','A9')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('er-01', er01, 'ER ขรก./อปท./ปกส.');

    const [er04] = await conn.query(
      `SELECT DATE_FORMAT(e.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT e.vn) AS cnt, COALESCE(SUM(v.income),0) AS amt
       FROM er_regist e
       JOIN vn_stat v ON v.vn = e.vn
       WHERE e.vstdate BETWEEN ? AND ? AND e.er_emergency_level_id IN (1, 2)
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('er-04', er04, 'ER ESI 1-2');

    // 6. IPD-03: ห้องพิเศษ ตึกร่มโพธิ์ 84 ปี ชั้น 3 (ward '03')
    const [ipd03] = await conn.query(
      `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, COUNT(*) AS cnt, COALESCE(SUM(a.income),0) AS amt
       FROM ipt i
       JOIN an_stat a ON a.an = i.an
       WHERE i.ward = '03' AND i.dchdate BETWEEN ? AND ?
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('ipd-03', ipd03, 'ห้องพิเศษร่มโพธิ์ 3');

    // 7. Pharmacy cost reduction: Recormon (1670037) & EPOTIV (1690005)
    const [phm1] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COALESCE(SUM(op.qty),0) AS cnt, COALESCE(SUM(op.qty * 203.33),0) AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '1670037'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('pharm-01', phm1, 'Recormon');

    const [phm2] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COALESCE(SUM(op.qty),0) AS cnt, COALESCE(SUM(op.qty * 425.96),0) AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '1690005'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('pharm-02', phm2, 'EPOTIV');

    // 8. อนามัยแม่และเด็ก / ANC-PNC (anc-01..anc-10)
    const [anc01] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 75 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN ('3010866','3010056','3000929')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-01', anc01, 'UPT/PRT');

    const [anc02] = await conn.query(
      `SELECT DATE_FORMAT(anc_service_date,'%Y-%m') AS ym, COUNT(*) AS cnt, COUNT(*) * 360 AS amt
       FROM person_anc_service
       WHERE anc_service_date BETWEEN ? AND ?
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-02', anc02, 'ANC 1-8');

    const [anc03] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 600 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN ('3010864','3010233')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-03', anc03, 'Lab1 ANC');

    const [anc04] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 190 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN ('3010865','3010234')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-04', anc04, 'Lab2 ANC');

    const [anc05] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 400 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN ('3010571','3000706')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-05', anc05, 'US ANC');

    const [anc07] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 100 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3001137'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-07', anc07, 'TPHA');

    const [anc09] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 150 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010867'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-09', anc09, 'PNC 1-3');

    const [anc10] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 135 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '1530019'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('anc-10', anc10, 'Triferdine');

    // 9. คัดกรองสุขภาพสตรี (women-01, women-02)
    const [wom01] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 80 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010876'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('women-01', wom01, 'Ferrofolic');

    const [wom02] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 50 AS amt
       FROM opitemrece op
       WHERE op.vstdate BETWEEN ? AND ? AND op.icode IN ('3010993','3010794','3010795','3010796','3010797','3010798','3010799','3010685')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('women-02', wom02, 'HPV DNA');

    // 10. วางแผนครอบครัว (fp-01..fp-03)
    const [fp01] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 40 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010952' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('fp-01', fp01, 'ยาเม็ดฮอร์โมนรวม');

    const [fp02] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 80 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010951' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('fp-02', fp02, 'ยาเม็ดฮอร์โมนเดี่ยว');

    const [fp03] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 60 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010953' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('fp-03', fp03, 'ยาฉีดคุมกำเนิด');

    // 11. อนามัยวัยทำงาน (work-01..work-04)
    const [wrk01] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 40 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010873' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('work-01', wrk01, 'FPG 35-59 ปี');

    const [wrk02] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 160 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010874' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('work-02', wrk02, 'HDL 45-70 ปี');

    const [wrk03] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COALESCE(SUM(op.sum_price),0) AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010908' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('work-03', wrk03, 'Telemedicine');

    const [wrk04] = await conn.query(
      `SELECT DATE_FORMAT(op.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT op.vn) AS cnt, COUNT(DISTINCT op.vn) * 60 AS amt
       FROM opitemrece op WHERE op.vstdate BETWEEN ? AND ? AND op.icode = '3010878' GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('work-04', wrk04, 'FIT Test');

    // 12. ER พ.ร.บ. (er-02) และ ER นอกจังหวัด (er-03)
    const [er02] = await conn.query(
      `SELECT DATE_FORMAT(e.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT e.vn) AS cnt, COALESCE(SUM(v.income),0) AS amt
       FROM er_regist e
       JOIN ovst o ON o.vn = e.vn
       JOIN pttype pt ON pt.pttype = o.pttype
       JOIN vn_stat v ON v.vn = e.vn
       WHERE e.vstdate BETWEEN ? AND ? AND (pt.pcode = 'A9' OR pt.name LIKE '%พรบ%')
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('er-02', er02, 'ER พ.ร.บ.');

    const [er03] = await conn.query(
      `SELECT DATE_FORMAT(e.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT e.vn) AS cnt, COALESCE(SUM(v.income),0) AS amt
       FROM er_regist e
       JOIN ovst o ON o.vn = e.vn
       JOIN pttype pt ON pt.pttype = o.pttype
       JOIN vn_stat v ON v.vn = e.vn
       WHERE e.vstdate BETWEEN ? AND ? AND pt.name LIKE '%นอกเขตฉุกเฉินต่างจังหวัด%'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('er-03', er03, 'ER นอกจังหวัด');

    // 13. ห้องคลอดนอกเขต (lr-02) และ ประกันสังคม (lr-03)
    const [lr02] = await conn.query(
      `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, COUNT(*) AS cnt, COALESCE(SUM(a.income),0) AS amt
       FROM ipt i
       JOIN an_stat a ON a.an = i.an
       JOIN pttype pt ON pt.pttype = i.pttype
       WHERE i.ward = '02' AND i.dchdate BETWEEN ? AND ? AND pt.name LIKE '%นอกเขต%'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('lr-02', lr02, 'คลอดนอกเขต');

    const [lr03] = await conn.query(
      `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, COUNT(*) AS cnt, COALESCE(SUM(a.income),0) AS amt
       FROM ipt i
       JOIN an_stat a ON a.an = i.an
       JOIN pttype pt ON pt.pttype = i.pttype
       WHERE i.ward = '02' AND i.dchdate BETWEEN ? AND ? AND pt.pcode = 'A7'
       GROUP BY ym`,
      [startDate, endDate]
    );
    applyMonthlyRows('lr-03', lr03, 'คลอด ปกส.');

    res.json({
      ok: true,
      syncedItems,
      summary: store.getDashboardSummary()
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
