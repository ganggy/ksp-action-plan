// ศูนย์รวมข้อกำหนดรายงาน IT Dashboard Monitor ครบทุกกลุ่มงาน ปีงบประมาณ 2570
// โรงพยาบาลโคกศรีสุพรรณ

const IT_REPORTS = [
  // ==================== 1. งานกายภาพบำบัด ====================
  {
    id: 'IT-PT-01',
    departmentId: 'pt',
    departmentName: '1. งานกายภาพบำบัด',
    title: 'รายงานจ่ายรองเท้า/อุปกรณ์ 8610 และบริการ Plantar Fasciitis (M7297)',
    description: 'ดึงรายการจ่ายรหัส 8610 อุปกรณ์พยุงส้นเท้าและฝ่าเท้าชนิดหล่อพิเศษเฉพาะราย และยอดใช้บริการกายภาพบำบัดในผู้ป่วย Plantar Fasciitis (ICD-10: M7297) แยกสิทธิ CSCD และ อปท.',
    source: 'HOSxP / จ่ายตรง CSCD / อปท.',
    frequency: 'รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT o.vstdate, o.vn, p.hn, CONCAT(p.pname,p.fname,' ',p.lname) AS ptname,
  o.pttype, pt.name AS pttype_name, od.icd10, op.icode, n.name AS item_name, op.qty, op.sum_price
FROM ovst o
JOIN patient p ON p.hn = o.hn
JOIN pttype pt ON pt.pttype = o.pttype
LEFT JOIN ovstdiag od ON od.vn = o.vn AND od.icd10 LIKE 'M729%'
LEFT JOIN opitemrece op ON op.vn = o.vn
LEFT JOIN nondrugitems n ON n.icode = op.icode
WHERE o.vstdate BETWEEN :start_date AND :end_date
  AND (od.icd10 LIKE 'M729%' OR n.billcode = '8610' OR n.name LIKE '%8610%')
ORDER BY o.vstdate DESC;`,
    sampleColumns: ['วันที่รับบริการ', 'HN', 'สิทธิ', 'ICD-10', 'รายการ', 'จำนวน', 'มูลค่า(บาท)'],
    sampleRows: [
      ['2569-10-15', '0012345', 'จ่ายตรง (CSCD)', 'M7297', '8610 อุปกรณ์พยุงส้นเท้าฯ', 1, 7240],
      ['2569-10-18', '0023456', 'อปท.', 'M7297', '8610 อุปกรณ์พยุงส้นเท้าฯ', 1, 7240]
    ]
  },
  {
    id: 'IT-PT-02',
    departmentId: 'pt',
    departmentName: '1. งานกายภาพบำบัด',
    title: 'รายงานจ่ายกายอุปกรณ์และอุปกรณ์ช่วยเดินแยกรายรหัส',
    description: 'สรุปจำนวนและมูลค่าการจ่าย LS, Knee support, Walker, Tripod, Single Cane, Crutches, W-Wheelchair แยกรายรหัสและสิทธิการรักษา',
    source: 'HOSxP / รหัสกายอุปกรณ์',
    frequency: 'รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT op.icode, n.name AS device_name, COUNT(DISTINCT op.vn) AS total_visits,
  SUM(op.qty) AS total_qty, SUM(op.sum_price) AS total_amount
FROM opitemrece op
JOIN nondrugitems n ON n.icode = op.icode
WHERE op.vstdate BETWEEN :start_date AND :end_date
  AND (n.name LIKE '%LS%' OR n.name LIKE '%Knee%' OR n.name LIKE '%Walker%'
    OR n.name LIKE '%Tripod%' OR n.name LIKE '%Cane%' OR n.name LIKE '%Crutch%' OR n.name LIKE '%Wheelchair%')
GROUP BY op.icode, n.name
ORDER BY total_amount DESC;`,
    sampleColumns: ['รหัสอุปกรณ์', 'ชื่อรายการ', 'จำนวน(คน)', 'มูลค่ารวม(บาท)'],
    sampleRows: [
      ['LS-01', 'LS Support', 72, 72000],
      ['KN-01', 'Knee Support', 45, 36000],
      ['WW-01', 'W-Wheelchair', 3, 13200]
    ]
  },
  {
    id: 'IT-PT-03',
    departmentId: 'pt',
    departmentName: '1. งานกายภาพบำบัด',
    title: 'รายงานหัตถการตรวจหลอดเลือด ABI / TBI และบริการกายภาพแยกสิทธิ',
    description: 'รายงานหัตถการการตรวจ ABI, TBI (CSCD+อปท.) และยอดใช้บริการกายภาพบำบัดแยกสิทธิ UC (OPD), UC (Community), CSCD และ อปท.',
    source: 'HOSxP / หัตถการกายภาพฯ',
    frequency: 'รายเดือน',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT pt.pcode, pt.name AS pttype_name, COUNT(DISTINCT o.vn) AS visits,
  SUM(op.sum_price) AS sum_amount
FROM ovst o
JOIN pttype pt ON pt.pttype = o.pttype
JOIN opitemrece op ON op.vn = o.vn
JOIN nondrugitems n ON n.icode = op.icode
WHERE o.vstdate BETWEEN :start_date AND :end_date
  AND (n.name LIKE '%ABI%' OR n.name LIKE '%TBI%' OR n.income = '14')
GROUP BY pt.pcode, pt.name
ORDER BY sum_amount DESC;`,
    sampleColumns: ['กลุ่มสิทธิ', 'ประเภทบริการ', 'จำนวน(ราย)', 'มูลค่า(บาท)'],
    sampleRows: [
      ['CSCD + อปท.', 'ตรวจ ABI / TBI', 85, 102000],
      ['UC (OPD)', 'กายภาพบำบัดผู้ป่วยนอก', 430, 17630],
      ['CSCD + อปท.', 'กายภาพบำบัด', 142, 305300]
    ]
  },

  // ==================== 2-6. อนามัยแม่และเด็ก / คัดกรอง / วัคซีน / PPFS ====================
  {
    id: 'IT-ANC-01',
    departmentId: 'anc',
    departmentName: '2. อนามัยแม่และเด็ก / ANC-PNC',
    title: 'ติดตาม ANC 1-8, ขาดนัด, 5 ครั้งคุณภาพ และยอดเบิกรายการ PPFS แม่และเด็ก',
    description: 'ดึงจำนวนบริการและยอดเบิกรายการ UPT, ANC 1-8 (รวม 5 ครั้งคุณภาพ), Lab1/Lab2 ANC, US, NIPT, TPHA/Thal สามี, PNC 1-3, Triferdine พร้อมรายชื่อหญิงตั้งครรภ์ขาดนัด',
    source: 'HOSxP / ANC / FDH / KTB13 / NPRP',
    frequency: 'รายสัปดาห์',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT a.person_anc_id, p.hn, CONCAT(p.pname,p.fname,' ',p.lname) AS ptname,
  a.lmp, a.edc, a.preg_no, s.anc_service_date, s.anc_service_number, s.next_appointment_date
FROM person_anc a
JOIN person ps ON ps.person_id = a.person_id
JOIN patient p ON p.cid = ps.cid
LEFT JOIN person_anc_service s ON s.person_anc_id = a.person_anc_id
WHERE a.discharge <> 'Y' OR a.discharge IS NULL
ORDER BY s.next_appointment_date ASC;`,
    sampleColumns: ['HN', 'ชื่อ-สกุล', 'EDC', 'ครั้งที่ ANC', 'นัดครั้งถัดไป', 'สถานะ'],
    sampleRows: [
      ['0041122', 'นางสาว ก.', '2570-02-14', 4, '2569-11-25', 'ตามนัด'],
      ['0041199', 'นาง ข.', '2570-01-20', 5, '2569-11-10', 'ขาดนัด']
    ]
  },
  {
    id: 'IT-WOM-01',
    departmentId: 'women',
    departmentName: '3. คัดกรองสุขภาพสตรี',
    title: 'รายชื่อสตรีไทยอายุ 30-60 ปี ที่ยังไม่ได้รับการตรวจมะเร็งปากมดลูก (HPV DNA)',
    description: 'ดึงรายชื่อประชากรสตรีไทยในเขตรับผิดชอบอายุ 30-60 ปี ที่ยังไม่มีประวัติตรวจคัดกรอง HPV DNA / Pap smear เพื่อติดตามมารับบริการและเบิก KTB',
    source: 'HOSxP / Person / KTB',
    frequency: 'รายเดือน',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT p.person_id, p.cid, CONCAT(p.pname,p.fname,' ',p.lname) AS fullname,
  TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) AS age, v.village_name
FROM person p
JOIN village v ON v.village_id = p.village_id
WHERE p.sex = '2' AND p.death <> 'Y'
  AND TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) BETWEEN 30 AND 60
  AND p.person_id NOT IN (
    SELECT DISTINCT person_id FROM person_women_service WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
  )
ORDER BY v.village_name, age;`,
    sampleColumns: ['หมู่บ้าน', 'จำนวนกลุ่มเป้าหมาย', 'ตรวจแล้ว', 'คงเหลือยังไม่ตรวจ'],
    sampleRows: [
      ['ม.1 บ้านโคกศรีสุพรรณ', 140, 92, 48],
      ['ม.2 บ้านดอน', 115, 74, 41]
    ]
  },
  {
    id: 'IT-WRK-01',
    departmentId: 'working',
    departmentName: '5. อนามัยวัยทำงานและควบคุมโรค',
    title: 'กลุ่มเสี่ยงเบาหวาน (35-59 ปี), คัดกรองไขมัน (45-70 ปี), Telemedicine และ FIT Test',
    description: '1. รายชื่อกลุ่มเสี่ยง DM (FPG)\n2. ประชากร 45-70 ปี ที่ไม่เป็น DM/HT และไม่มีประวัติรักษาไขมัน\n3. รายงาน Telemedicine เทียบจำนวนนัดหมาย NCD\n4. รายชื่อถึงรอบ FIT Test 50-70 ปี และติดตามผลบวกจนส่งต่อ',
    source: 'HOSxP / NCD / FDH',
    frequency: 'รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT p.person_id, p.hn, CONCAT(p.pname,p.fname,' ',p.lname) AS fullname,
  TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) AS age
FROM person p
WHERE p.death <> 'Y'
  AND TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) BETWEEN 45 AND 70
  AND p.person_id NOT IN (SELECT person_id FROM clinicmember WHERE clinic IN ('001','002'))
LIMIT 500;`,
    sampleColumns: ['รายการคัดกรอง', 'กลุ่มเป้าหมาย', 'คัดกรองแล้ว', 'ร้อยละ'],
    sampleRows: [
      ['FPG กลุ่มเสี่ยง 35-59 ปี', 400, 0, '0%'],
      ['ไขมันในเลือด 45-70 ปี', 2000, 0, '0%'],
      ['FIT Test 50-70 ปี', 250, 0, '0%']
    ]
  },
  {
    id: 'IT-VAC-01',
    departmentId: 'vaccine',
    departmentName: '6. งานวัคซีนและวัยปฐมวัย',
    title: 'ติดตามประวัติวัคซีนตามช่วงอายุและรายชื่อเด็กขาดนัด',
    description: 'แสดงวันเกิด, วัคซีนและเข็ม, วันที่ได้รับ, หน่วยให้บริการ, รายชื่อขาดนัด และสัดส่วนผู้ได้รับวัคซีนตามเกณฑ์',
    source: 'HOSxP / EPI',
    frequency: 'รายสัปดาห์',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT p.person_id, CONCAT(p.pname,p.fname,' ',p.lname) AS child_name, p.birthdate,
  w.vaccine_name, e.vaccine_date, e.hospcode
FROM person p
JOIN person_epi pe ON pe.person_id = p.person_id
LEFT JOIN person_epi_vaccine e ON e.person_epi_id = pe.person_epi_id
LEFT JOIN epi_vaccine w ON w.epi_vaccine_id = e.epi_vaccine_id
WHERE p.death <> 'Y' AND TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) <= 5
ORDER BY p.birthdate DESC;`,
    sampleColumns: ['ชื่อเด็ก', 'วันเกิด', 'วัคซีน/เข็ม', 'วันที่รับ', 'หน่วยบริการ'],
    sampleRows: [
      ['ด.ช. ตัวอย่าง', '2568-05-10', 'DTP-HB-Hib 3', '2568-11-12', 'รพ.โคกศรีสุพรรณ']
    ]
  },

  // ==================== 7. งานห้องคลอด ====================
  {
    id: 'IT-LR-01',
    departmentId: 'lr',
    departmentName: '7. งานห้องคลอด',
    title: 'รายงานผู้คลอดรายเดือนแยกสิทธิ, เทียบ EDC กับคลอดจริง และสาเหตุส่งต่อ',
    description: 'จำนวนผู้คลอดรายเดือนแยกตามสิทธิ, เทียบ EDC กับคลอดจริง, อัตราการส่งต่อแยกสาเหตุ, Authen นอกเขตไม่สมบูรณ์, คลอด ปกส./ต่างด้าวค้างชำระ, Checklist ค่าบริการไม่ครบ และ Adj.RW เฉลี่ย',
    source: 'HOSxP / ห้องคลอด / Authen / IPD',
    frequency: 'รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT i.an, i.hn, i.regdate, i.dchdate, pt.name AS pttype_name, i.adjrw,
  IF(i.chart_doctor IS NULL OR i.chart_doctor='', 'ยังไม่สรุป', 'สรุปแล้ว') AS chart_status
FROM ipt i
JOIN pttype pt ON pt.pttype = i.pttype
WHERE i.ward = '03' -- ปรับรหัสหอห้องคลอดตามจริง
  AND i.dchdate BETWEEN :start_date AND :end_date
ORDER BY i.dchdate DESC;`,
    sampleColumns: ['เดือน', 'สิทธิ', 'จำนวนคลอด', 'Adj.RW เฉลี่ย', 'Authen ไม่สมบูรณ์'],
    sampleRows: [
      ['ต.ค. 69', 'บัตรทองในเขต', 5, 0.82, 0],
      ['ต.ค. 69', 'ประกันสังคม', 1, 0.91, 0]
    ]
  },

  // ==================== 8. งานอุบัติเหตุฉุกเฉินและนิติเวช (ER) ====================
  {
    id: 'IT-ER-01',
    departmentId: 'er',
    departmentName: '8. งานอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
    title: '[ER หน้า 1] สรุปผู้บริหาร ER: รายรับ 4 กิจกรรม, Visits, ยอดเบิก-ชำระ-ค้าง',
    description: 'หน้าสรุปผู้บริหาร: รายรับจากกิจกรรม 4 กลุ่ม (ตรวจวินิจฉัย, พ.ร.บ., นอกจังหวัด, EMS) เทียบเป้าหมายรายเดือน/สะสมทั้งปี จำนวน visits ยอดเรียกเก็บ ยอดชำระ ยอดค้าง',
    source: 'HOSxP / E-Claim / STM',
    frequency: 'รายวัน / รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT DATE_FORMAT(e.vstdate,'%Y-%m') AS ym, COUNT(DISTINCT e.vn) AS er_visits,
  SUM(v.income) AS total_charge, SUM(v.paid_money) AS paid, SUM(v.uc_money) AS claim_uc
FROM er_regist e
JOIN vn_stat v ON v.vn = e.vn
WHERE e.vstdate BETWEEN :start_date AND :end_date
GROUP BY ym ORDER BY ym;`,
    sampleColumns: ['กิจกรรม ER', 'เป้าหมาย(ปี)', 'Visits จริง', 'ยอดเรียกเก็บ', 'ยอดชดเชย'],
    sampleRows: [
      ['1. ตรวจวินิจฉัย ขรก./อปท./ปกส.', 600000, 0, 0, 0],
      ['2. สิทธิ พ.ร.บ. อุบัติเหตุจราจร', 600000, 0, 0, 0],
      ['3. อุบัติเหตุ/ฉุกเฉินนอกจังหวัด', 700000, 0, 0, 0],
      ['4. ระบบการแพทย์ฉุกเฉิน EMS ESI 1-2', 150000, 0, 0, 0]
    ]
  },
  {
    id: 'IT-ER-02',
    departmentId: 'er',
    departmentName: '8. งานอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
    title: '[ER หน้า 2] ตรวจสอบสิทธิและความครบถ้วน (Pre-claim ER)',
    description: 'รายชื่อ visit ER ที่ยังไม่ระบุสิทธิ / เอกสารไม่ครบ / ไม่มีรายการค่าบริการที่สัมพันธ์กับการรักษา พร้อมสถานะผู้รับผิดชอบ',
    source: 'HOSxP / ER / ประกันสุขภาพ',
    frequency: 'รายวัน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT e.vn, o.hn, e.vstdate, e.er_emergency_level_id AS esi, o.pttype, v.income
FROM er_regist e
JOIN ovst o ON o.vn = e.vn
JOIN vn_stat v ON v.vn = e.vn
WHERE e.vstdate BETWEEN :start_date AND :end_date
  AND (v.income = 0 OR o.pttype IS NULL OR o.pttype = '')
ORDER BY e.vstdate DESC;`,
    sampleColumns: ['VN', 'HN', 'วันที่', 'ESI', 'สิทธิ', 'ปัญหาที่พบ'],
    sampleRows: [
      ['691120001', '0033445', '2569-11-18', 2, 'พ.ร.บ.', 'รอเอกสาร พ.ร.บ.']
    ]
  },
  {
    id: 'IT-ER-03',
    departmentId: 'er',
    departmentName: '8. งานอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
    title: '[ER หน้า 3] รายการตรวจและหัตถการ (EKG, US, X-ray, Lab, ทำแผล/เย็บแผล)',
    description: 'ดึงข้อมูล EKG, Ultrasound, X-ray, Lab, Echocardiogram, ทำแผล, เย็บแผล แยกตามสิทธิและวันที่',
    source: 'HOSxP / ER / Order',
    frequency: 'รายสัปดาห์',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT o.vstdate, pt.name AS pttype_name, n.name AS item_name, COUNT(*) AS cnt, SUM(op.sum_price) AS amount
FROM er_regist e
JOIN ovst o ON o.vn = e.vn
JOIN pttype pt ON pt.pttype = o.pttype
JOIN opitemrece op ON op.vn = e.vn
JOIN nondrugitems n ON n.icode = op.icode
WHERE e.vstdate BETWEEN :start_date AND :end_date
  AND (n.name LIKE '%EKG%' OR n.name LIKE '%Ultrasound%' OR n.name LIKE '%Echo%' OR n.name LIKE '%เย็บ%' OR n.name LIKE '%ทำแผล%')
GROUP BY o.vstdate, pt.name, n.name
ORDER BY o.vstdate DESC;`,
    sampleColumns: ['รายการตรวจ/หัตถการ', 'สิทธิ', 'จำนวนครั้ง', 'มูลค่า(บาท)'],
    sampleRows: [
      ['EKG', 'จ่ายตรง (CSCD)', 18, 3600],
      ['Ultrasound', 'จ่ายตรง (CSCD)', 6, 4800]
    ]
  },
  {
    id: 'IT-ER-04',
    departmentId: 'er',
    departmentName: '8. งานอุบัติเหตุฉุกเฉินและนิติเวช (ER)',
    title: '[ER หน้า 4-5] ติดตามเคลม พ.ร.บ./นอกจังหวัด และรายงานปฏิบัติการ EMS (ESI 1-2)',
    description: 'หน้าติดตามเคลม (เลข visit, สิทธิ, วันที่ส่ง, สถานะอนุมัติ/ปฏิเสธ, เหตุผล, อายุลูกหนี้) และหน้ารายงาน EMS (จำนวนปฏิบัติการ, ESI, ประเภทบริการ, ความครบถ้วนเอกสาร, ยอดชดเชย)',
    source: 'HOSxP / ITEMS / E-Claim / STM',
    frequency: 'รายสัปดาห์',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT e.vn, e.vstdate, e.er_emergency_level_id AS esi, e.er_pt_type, o.pttype, v.income
FROM er_regist e
JOIN ovst o ON o.vn = e.vn
JOIN vn_stat v ON v.vn = e.vn
WHERE e.vstdate BETWEEN :start_date AND :end_date
  AND e.er_emergency_level_id IN (1, 2)
ORDER BY e.vstdate DESC;`,
    sampleColumns: ['VN', 'วันที่', 'ESI', 'ประเภท', 'สถานะเคลม', 'มูลค่า(บาท)'],
    sampleRows: [
      ['691119012', '2569-11-19', 1, 'EMS รับผู้ป่วย', 'รอส่งเคลม', 1000]
    ]
  },

  // ==================== 9. งานผู้ป่วยใน (IPD) ====================
  {
    id: 'IT-IPD-01',
    departmentId: 'ipd',
    departmentName: '9. งานผู้ป่วยใน (IPD)',
    title: '[IPD-1] Pre-bill Check: ชาร์ตค้างสรุป (>7 วัน), Dx-หัตถการไม่สอดคล้อง, Refer ว่าง, DENY/ติด C',
    description: '1. รายชื่อ AN จำหน่ายแล้วยังไม่สรุปชาร์ต แยกแพทย์/จำนวนวันค้าง\n2. AN ที่ Dx-หัตถการไม่สอดคล้อง (เช่น D63.0 ไม่มีให้เลือด)\n3. AN ส่งต่อที่ช่อง refer in/out (171/514) ว่าง\n4. DENY/ติด C รายเดือนแยกสาเหตุ',
    source: 'HOSxP / IPD / E-Claim / STM',
    frequency: 'รายวัน / รายสัปดาห์',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT i.an, i.hn, i.dchdate, DATEDIFF(CURDATE(), i.dchdate) AS overdue_days,
  d.name AS doctor_name, w.name AS ward_name
FROM ipt i
LEFT JOIN doctor d ON d.code = i.dch_doctor
LEFT JOIN ward w ON w.ward = i.ward
WHERE i.dchdate IS NOT NULL
  AND (i.chart_state IS NULL OR i.chart_state <> 'Y')
  AND DATEDIFF(CURDATE(), i.dchdate) > 7
ORDER BY overdue_days DESC;`,
    sampleColumns: ['AN', 'HN', 'วันที่จำหน่าย', 'ค้างสรุป(วัน)', 'แพทย์เจ้าของไข้', 'ปัญหาที่ตรวจพบ'],
    sampleRows: [
      ['69001234', '0011223', '2569-11-01', 19, 'พญ. ตัวอย่าง', 'ยังไม่สรุปชาร์ต > 7 วัน']
    ]
  },
  {
    id: 'IT-IPD-02',
    departmentId: 'ipd',
    departmentName: '9. งานผู้ป่วยใน (IPD)',
    title: '[IPD-2] คุณภาพข้อมูล CMI / AdjRW, สัดส่วนโรคร่วม CC/MCC และผู้ป่วยนอน > 7 วัน',
    description: '1. AdjRW และ CMI รายเดือนแยกหอ/แพทย์\n2. สัดส่วน AN ที่มีโรคร่วม (CC/MCC) แยกกลุ่มโรคเทียบเดือนก่อน\n3. รายชื่อ AN นอน > 7 วัน ที่ยังไม่ทบทวน',
    source: 'HOSxP / DRG / IPD',
    frequency: 'รายสัปดาห์ / รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, w.name AS ward_name,
  COUNT(*) AS total_dch, ROUND(SUM(i.adjrw), 2) AS sum_adjrw, ROUND(AVG(i.adjrw), 3) AS cmi
FROM ipt i
JOIN ward w ON w.ward = i.ward
WHERE i.dchdate BETWEEN :start_date AND :end_date
GROUP BY ym, w.name
ORDER BY ym DESC, sum_adjrw DESC;`,
    sampleColumns: ['เดือน', 'หอผู้ป่วย', 'จำนวนจำหน่าย', 'Sum AdjRW', 'CMI เฉลี่ย'],
    sampleRows: [
      ['2569-10', 'หอผู้ป่วยสามัญ ชินโสภณพนิช', 205, 135.3, 0.660]
    ]
  },
  {
    id: 'IT-IPD-03',
    departmentId: 'ipd',
    departmentName: '9. งานผู้ป่วยใน (IPD)',
    title: '[IPD-3] ห้องพิเศษ ร่มโพธิ์ 3: Admit / วันนอน / รายได้ แยกสิทธิ และสัดส่วน OFC/อปท.',
    description: 'ติดตาม Admit, วันนอน, รายได้ห้องพิเศษ ร่มโพธิ์ 3 แยกสิทธิรายเดือน และสัดส่วนผู้มีสิทธิ OFC/อปท. ที่เลือกห้องพิเศษ',
    source: 'HOSxP / ห้องพิเศษ / การเงิน',
    frequency: 'รายเดือน',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT DATE_FORMAT(i.dchdate,'%Y-%m') AS ym, pt.name AS pttype_name,
  COUNT(*) AS admit_cnt, SUM(a.admdate) AS los_days, SUM(a.income) AS total_income
FROM ipt i
JOIN an_stat a ON a.an = i.an
JOIN pttype pt ON pt.pttype = i.pttype
WHERE i.ward = '04' -- ปรับรหัสหอร่มโพธิ์ 3 ตามจริง
  AND i.dchdate BETWEEN :start_date AND :end_date
GROUP BY ym, pt.name;`,
    sampleColumns: ['เดือน', 'สิทธิ', 'Admit(ราย)', 'วันนอนรวม', 'รายได้(บาท)'],
    sampleRows: [
      ['2569-10', 'จ่ายตรง (OFC)', 24, 82, 96192],
      ['2569-10', 'อปท.', 8, 25, 32064]
    ]
  },
  {
    id: 'IT-IPD-04',
    departmentId: 'ipd',
    departmentName: '9. งานผู้ป่วยใน (IPD)',
    title: '[IPD-4 & 6] เคส ER/Observe ไม่ได้ Admit, Admit < 1 วัน, ALOS, Readmit และ HAI',
    description: '1. เคส ER/หอสังเกตอาการอยู่นานหรือได้สารน้ำ/ยาฉีดที่ไม่ได้ Admit\n2. Admit นอน < 1 วัน\n3. ALOS แยกหอ\n4. Readmit ≤ 48 ชม./7/28 วัน\n5. HAI รายเดือน',
    source: 'HOSxP / ER / IPD / ICN',
    frequency: 'รายสัปดาห์ / รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT w.name AS ward_name, COUNT(*) AS dch_count,
  ROUND(AVG(a.admdate), 2) AS alos,
  SUM(CASE WHEN a.admdate < 1 THEN 1 ELSE 0 END) AS stay_under_1d
FROM ipt i
JOIN an_stat a ON a.an = i.an
JOIN ward w ON w.ward = i.ward
WHERE i.dchdate BETWEEN :start_date AND :end_date
GROUP BY w.name;`,
    sampleColumns: ['หอผู้ป่วย', 'จำหน่าย(ราย)', 'ALOS(วัน)', 'นอน < 1 วัน', 'Readmit ≤ 48 ชม.'],
    sampleRows: [
      ['หอผู้ป่วยสามัญ ชินโสภณพนิช', 205, 3.48, 4, 1]
    ]
  },
  {
    id: 'IT-IPD-05',
    departmentId: 'ipd',
    departmentName: '9. งานผู้ป่วยใน (IPD)',
    title: '[IPD-5] ผู้ป่วย Palliative นอน รพ. เทียบทะเบียน สปสช. และเยี่ยมบ้านยังไม่ปิดสิทธิ',
    description: 'ตรวจสอบผู้ป่วย Palliative (Z51.5 / Z71.8) ระหว่างนอน รพ. เทียบทะเบียน สปสช. และติดตามการเยี่ยมบ้าน/Home ward ที่ยังไม่ปิดสิทธิ',
    source: 'HOSxP / Palliative / สปสช.',
    frequency: 'รายสัปดาห์',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT i.an, i.hn, i.regdate, i.dchdate, id.icd10
FROM ipt i
JOIN iptdiag id ON id.an = i.an
WHERE id.icd10 IN ('Z515', 'Z718')
  AND i.regdate BETWEEN :start_date AND :end_date
ORDER BY i.regdate DESC;`,
    sampleColumns: ['AN', 'HN', 'ICD-10', 'ลงทะเบียน สปสช.', 'ปิดสิทธิเยี่ยมบ้าน'],
    sampleRows: [
      ['69001501', '0055667', 'Z515', 'ลงทะเบียนแล้ว', 'ปิดสิทธิแล้ว']
    ]
  },

  // ==================== 10. งานซักฟอก / ซัพพลาย (CSSD) ====================
  {
    id: 'IT-CSSD-01',
    departmentId: 'cssd',
    departmentName: '10. งานซักฟอก/ซัพพลาย (CSSD)',
    title: 'Dashboard รวม CSSD/ซักฟอก: Re-sterile, ต้นทุนน้ำยา, ผ้าเช็ดมือ และทะเบียนผ้าสูญหาย',
    description: '1. Re-sterile แยกหน่วย (ER, LR, ร่มโพธิ์, ตึกขินฯ) / สาเหตุ / เดือน พร้อมแจ้งเตือนเกินเกณฑ์\n2. น้ำยารายเดือนเทียบปริมาณผ้า (กก.)\n3. ผลิต/จ่าย/คงเหลือผ้าเช็ดมือและต้นทุนต่อผืน\n4. ทะเบียนผ้า รับ-จ่าย-สูญหาย-รับคืน',
    source: 'CSSD / งานซักฟอก / Stock',
    frequency: 'รายเดือน',
    priority: 'medium',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `-- ตารางติดตาม Re-sterile และผ้า (บันทึกผ่านระบบภายใน CSSD / Excel Import)`,
    sampleColumns: ['หน่วยงาน', 'Re-sterile(ปี 69)', 'เป้าปี 70 (≤)', 'เกิดจริงสะสม'],
    sampleRows: [
      ['ER', 157, 130, 0],
      ['LR (ห้องคลอด)', 129, 110, 0],
      ['หอพิเศษร่มโพธิ์', 85, 80, 0],
      ['ตึกชินโสภณพนิช', 63, 60, 0]
    ]
  },

  // ==================== 11. กลุ่มงานเภสัชกรรม ====================
  {
    id: 'IT-PHM-01',
    departmentId: 'pharm',
    departmentName: '11. กลุ่มงานเภสัชกรรม (ลดรายจ่าย)',
    title: 'รายงานมูลค่าการใช้ยาเป้าหมายลดรายจ่าย (Recormon, EPOTIV, EVOFLOW, ครีมไพร)',
    description: 'คำนวณปริมาณและมูลค่าการใช้ยาเทียบราคาจัดซื้อเป้าหมาย: RECORMON INJ (@951.16), EPOTIV INJ (@428), EVOFLOW 25/125 (@118.77), ครีมไพร (@35)',
    source: 'HOSxP / คลังยา',
    frequency: 'รายเดือน',
    priority: 'high',
    status: 'pending',
    assignee: 'ทีม IT',
    sqlQuery: `SELECT d.icode, d.name AS drug_name, SUM(op.qty) AS total_qty,
  ROUND(SUM(op.sum_price), 2) AS hosp_price_sum
FROM opitemrece op
JOIN drugitems d ON d.icode = op.icode
WHERE op.vstdate BETWEEN :start_date AND :end_date
  AND (d.name LIKE '%RECORMON%' OR d.name LIKE '%EPOTIV%' OR d.name LIKE '%EVOFLOW%' OR d.name LIKE '%ครีมไพร%')
GROUP BY d.icode, d.name
ORDER BY total_qty DESC;`,
    sampleColumns: ['รายการยา', 'ราคาเป้าหมาย/หน่วย', 'ปริมาณใช้จริง', 'มูลค่าตามราคาเป้าหมาย(บาท)'],
    sampleRows: [
      ['RECORMON INJ', 951.16, 0, 0],
      ['EPOTIV INJ', 428.00, 0, 0],
      ['EVOFLOW 25/125', 118.77, 0, 0],
      ['ครีมไพร', 35.00, 0, 0]
    ]
  }
];

module.exports = { IT_REPORTS };
