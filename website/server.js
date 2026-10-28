// 大学生兼职众包平台 · 可运行原型服务端（v2）
// 纯 Node.js 标准库实现，无第三方依赖；数据落在 data/db.json，图片落在 data/uploads/
// 启动：node server.js   默认 http://127.0.0.1:8788
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const os = require('os');

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC = path.join(ROOT, 'public');
const FEE_RATE = 0.1; // 平台服务费 10%
const MAX_FILE = 3 * 1024 * 1024;

let db = null;

// ---------- 数据层 ----------
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seed();
    save();
  }
  ['notifications', 'files', 'contactLogs'].forEach((k) => { if (!db[k]) db[k] = []; });
  if (!db.sessions) db.sessions = {};
  if (!db.seq) db.seq = {};
  db.users.forEach((u) => {
    if (!u.certStatus) u.certStatus = u.verified ? 'approved' : 'none';
    if (!u.certInfo) u.certInfo = {};
  });
}
function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
function nextId(coll) {
  db.seq[coll] = (db.seq[coll] || 0) + 1;
  return db.seq[coll];
}

function seed() {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const d = (n) => new Date(now + n * day).toISOString().slice(0, 10);
  return {
    seq: { tasks: 5, applications: 3, orders: 3, reviews: 1, notifications: 4, files: 0, contactLogs: 0 },
    users: [
      {
        id: 1, role: 'student', username: 'student', password: '123456', name: '张同学', school: '湖南大学',
        phone: '138****0001', credit: 620, verified: true, certStatus: 'approved',
        certInfo: { school: '湖南大学', studentNo: '2023****01' }, balance: 72, createdAt: now - 30 * day
      },
      {
        id: 2, role: 'student', username: 'student2', password: '123456', name: '李同学', school: '中南大学',
        phone: '138****0002', credit: 600, verified: false, certStatus: 'none', certInfo: {}, balance: 0,
        createdAt: now - 20 * day
      },
      {
        id: 3, role: 'student', username: 'student3', password: '123456', name: '王同学', school: '湖南师范大学',
        phone: '138****0003', credit: 605, verified: true, certStatus: 'approved',
        certInfo: { school: '湖南师范大学', studentNo: '2022****03' }, balance: 0, createdAt: now - 15 * day
      },
      {
        id: 10, role: 'enterprise', username: 'company', password: '123456', name: '茶颜悦色（五一广场店）',
        company: '长沙茶悦餐饮管理有限公司', creditCode: '91430100MA4L****XX', industry: '餐饮零售',
        phone: '0731-8****001', verified: true, certStatus: 'approved',
        certInfo: { company: '长沙茶悦餐饮管理有限公司', creditCode: '91430100MA4L****XX', industry: '餐饮零售' },
        balance: 49785, createdAt: now - 60 * day
      },
      {
        id: 11, role: 'enterprise', username: 'company2', password: '123456', name: '星辰会展服务有限公司',
        company: '长沙星辰会展服务有限公司', creditCode: '91430100MA4M****YY', industry: '会展服务',
        phone: '0731-8****002', verified: false, certStatus: 'none', certInfo: {}, balance: 8000,
        createdAt: now - 10 * day
      },
      { id: 99, role: 'admin', username: 'admin', password: '123456', name: '平台运营', verified: true, certStatus: 'approved', createdAt: now - 90 * day }
    ],
    tasks: [
      { id: 1, entId: 10, title: '茶颜悦色五一广场店 · 周末小时工', category: '门店兼职', city: '长沙', address: '五一广场地铁站 3 号口', desc: '负责点单、出杯、门店卫生，周末 10:00-18:00，提供工作餐与工服。', headcount: 3, price: 22, startDate: d(3), endDate: d(3), startTime: '10:00', endTime: '18:00', settleType: '当日结', status: 'open', createdAt: now - 2 * day, reviewedBy: 99, lat: 28.1955, lng: 112.977, district: '芙蓉区' },
      { id: 2, entId: 10, title: '新品试饮推广 · 校园地推', category: '校园推广', city: '长沙', address: '湖南大学天马学生公寓', desc: '在宿舍区派发试饮券并引导扫码，半天 4 小时，需自备深色长裤。', headcount: 5, price: 80, startDate: d(5), endDate: d(5), startTime: '14:00', endTime: '18:00', settleType: '完工结', status: 'open', createdAt: now - 1 * day, reviewedBy: 99, lat: 28.179, lng: 112.945, district: '岳麓区' },
      { id: 3, entId: 11, title: '春季教育展 · 现场协助', category: '展会协助', city: '长沙', address: '湖南国际会展中心', desc: '展位引导、资料发放、观众登记，需正装，提供午餐。', headcount: 8, price: 150, startDate: d(7), endDate: d(8), startTime: '09:00', endTime: '17:00', settleType: '完工结', status: 'pending', createdAt: now - 6 * 3600 * 1000, lat: 28.232, lng: 113.083, district: '雨花区' },
      { id: 4, entId: 10, title: '用户口味问卷调研（线上）', category: '问卷调研', city: '长沙', address: '线上完成', desc: '完成 20 份有效问卷，每份约 5 分钟，按份计酬，需提交问卷截图。', headcount: 10, price: 15, startDate: d(1), endDate: d(6), startTime: '00:00', endTime: '23:59', settleType: '按件结', status: 'open', createdAt: now - 12 * 3600 * 1000, reviewedBy: 99, lat: null, lng: null, district: '线上' },
      { id: 5, entId: 10, title: 'AI 训练数据标注（图片分类）', category: '数据标注', city: '长沙', address: '线上完成', desc: '对 500 张商品图进行分类标注，平台提供工具与培训，验收合格后结算。', headcount: 6, price: 120, startDate: d(2), endDate: d(9), startTime: '00:00', endTime: '23:59', settleType: '按件结', status: 'open', createdAt: now - 20 * 3600 * 1000, reviewedBy: 99, lat: null, lng: null, district: '线上' }
    ],
    applications: [
      { id: 1, taskId: 2, studentId: 1, status: 'hired', createdAt: now - 20 * 3600 * 1000 },
      { id: 2, taskId: 4, studentId: 3, status: 'hired', createdAt: now - 6 * 3600 * 1000 },
      { id: 3, taskId: 5, studentId: 3, status: 'hired', createdAt: now - 8 * 3600 * 1000 }
    ],
    orders: [
      {
        id: 1, taskId: 2, studentId: 1, entId: 10, price: 80, platformFee: 8, netPay: 72,
        status: 'settled', escrow: 0, createdAt: now - 20 * 3600 * 1000,
        checkinAt: now - 19 * 3600 * 1000, deliverAt: now - 18 * 3600 * 1000,
        acceptAt: now - 17 * 3600 * 1000, settledAt: now - 17 * 3600 * 1000,
        deliverNote: '完成湖南大学天马公寓地推，扫码试饮券 128 人，已上传现场照片'
      },
      {
        id: 2, taskId: 4, studentId: 3, entId: 10, price: 15, platformFee: 1.5, netPay: 13.5,
        status: 'delivered', escrow: 15, createdAt: now - 6 * 3600 * 1000,
        checkinAt: now - 5 * 3600 * 1000, deliverAt: now - 4 * 3600 * 1000,
        deliverNote: '已完成 20 份有效问卷，截图已提交'
      },
      {
        id: 3, taskId: 5, studentId: 3, entId: 10, price: 120, platformFee: 12, netPay: 108,
        status: 'disputed', escrow: 120, createdAt: now - 9 * 3600 * 1000,
        checkinAt: now - 8 * 3600 * 1000, deliverAt: now - 7 * 3600 * 1000,
        deliverNote: '已完成 500 张图片分类标注',
        complaint: { by: 10, reason: '抽样检查发现约 15% 的图片分类不准确，要求返工或部分结算', at: now - 5 * 3600 * 1000 }
      }
    ],
    reviews: [
      { id: 1, orderId: 1, fromId: 1, toId: 10, fromRole: 'student', score: 5, content: '结算很快，岗位真实', createdAt: now - 16 * 3600 * 1000 }
    ],
    notifications: [
      { id: 1, userId: 1, type: 'settle', title: '已结算到账', body: '「新品试饮推广 · 校园地推」验收通过，72.00 元已到账。', orderId: 1, read: false, createdAt: now - 17 * 3600 * 1000 },
      { id: 2, userId: 10, type: 'deliver', title: '有新的成果待验收', body: '「用户口味问卷调研（线上）」学生已提交成果，请及时验收。', orderId: 2, read: false, createdAt: now - 4 * 3600 * 1000 },
      { id: 3, userId: 99, type: 'task_pending', title: '有 1 个任务待审核', body: '「春季教育展 · 现场协助」由星辰会展提交，等待审核。', orderId: null, read: false, createdAt: now - 6 * 3600 * 1000 },
      { id: 4, userId: 99, type: 'dispute', title: '有新的争议待仲裁', body: '订单 #3「AI 训练数据标注（图片分类）」被发起争议。', orderId: 3, read: false, createdAt: now - 5 * 3600 * 1000 }
    ],
    files: [],
    contactLogs: [],
    withdrawals: [],
    sessions: {}
  };
}

// ---------- 工具 ----------
function token() {
  return crypto.randomBytes(24).toString('hex');
}
function currentUser(req) {
  const h = req.headers['authorization'] || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t || !db.sessions[t]) return null;
  return db.users.find((u) => u.id === db.sessions[t].userId) || null;
}
function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8 * 1024 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}
function bad(res, msg, code = 400) {
  return json(res, code, { error: msg });
}
function getTask(id) {
  return db.tasks.find((t) => t.id === Number(id));
}
function taskHiredCount(taskId) {
  return db.orders.filter((o) => o.taskId === taskId && !['cancelled', 'refunded'].includes(o.status)).length;
}
function appFor(taskId, studentId) {
  return db.applications.find((a) => a.taskId === taskId && a.studentId === studentId);
}
function notify(userId, type, title, body, orderId) {
  if (!userId) return;
  db.notifications.push({ id: nextId('notifications'), userId, type, title, body, orderId: orderId || null, read: false, createdAt: Date.now() });
}
function notifyAdmins(type, title, body, orderId) {
  db.users.filter((u) => u.role === 'admin').forEach((a) => notify(a.id, type, title, body, orderId));
}
function fileView(id) {
  const f = db.files.find((x) => x.id === Number(id));
  if (!f) return null;
  return { id: f.id, name: f.name, mime: f.mime, size: f.size, url: '/api/files/' + f.id };
}
function orderView(o) {
  const task = getTask(o.taskId);
  const stu = db.users.find((u) => u.id === o.studentId);
  const ent = db.users.find((u) => u.id === o.entId);
  return {
    ...o,
    taskTitle: task ? task.title : '已删除任务',
    category: task ? task.category : '',
    address: task ? task.address : '',
    studentName: stu ? stu.name : '',
    enterpriseName: ent ? ent.name : '',
    checkinPhoto: o.checkinPhotoId ? fileView(o.checkinPhotoId) : null,
    deliverFiles: (o.deliverFileIds || []).map(fileView).filter(Boolean)
  };
}
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
function maskPhone(phone) {
  const s = String(phone || '');
  if (s.length <= 7) return s.replace(/\d(?=\d{2})/g, '*');
  return s.slice(0, 4) + '****' + s.slice(-3);
}
function virtualNumber(taskId, studentId) {
  const h = crypto.createHash('md5').update('vno:' + taskId + ':' + studentId).digest('hex');
  const n = String(parseInt(h.slice(0, 8), 16) % 90000000 + 10000000);
  const ext = String(parseInt(h.slice(8, 12), 16) % 900 + 100);
  return { number: '170' + n.slice(0, 4) + '****' + n.slice(4), ext, display: '170' + n.slice(0, 4) + '****' + n.slice(4) + ' 转 ' + ext };
}
function enterpriseRating(entId) {
  const list = db.reviews.filter((r) => r.toId === entId && r.fromRole === 'student');
  if (!list.length) return { avg: null, count: 0 };
  return { avg: Number((list.reduce((s, r) => s + r.score, 0) / list.length).toFixed(1)), count: list.length };
}

// ---------- 路由 ----------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  }) + '$');
  routes.push({ method, re, keys, handler });
}
function need(res, user, roles) {
  if (!user) { bad(res, '请先登录', 401); return false; }
  if (roles && !roles.includes(user.role)) { bad(res, '当前账号无权进行此操作', 403); return false; }
  return true;
}

// ---------- 登录 ----------
route('POST', '/api/login', async (req, res) => {
  const b = await readBody(req);
  const u = db.users.find((x) => x.username === String(b.username || '').trim() && x.password === String(b.password || ''));
  if (!u) return bad(res, '账号或密码错误', 401);
  const t = token();
  db.sessions[t] = { userId: u.id, at: Date.now() };
  save();
  return json(res, 200, { token: t, user: publicUser(u) });
});
route('GET', '/api/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return bad(res, '未登录', 401);
  return json(res, 200, { user: publicUser(u) });
});
route('POST', '/api/logout', (req, res) => {
  const h = req.headers['authorization'] || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (t) { delete db.sessions[t]; save(); }
  json(res, 200, { ok: true });
});

// ---------- 认证 ----------
route('POST', '/api/cert/student', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  if (u.certStatus === 'approved') return bad(res, '已通过认证，无需重复提交');
  if (u.certStatus === 'pending') return bad(res, '认证资料审核中，请耐心等待');
  const b = await readBody(req);
  if (!b.school || !b.studentNo) return bad(res, '请填写学校与学号');
  u.certStatus = 'pending';
  u.certInfo = { school: String(b.school).slice(0, 40), studentNo: String(b.studentNo).slice(0, 30) };
  u.school = u.certInfo.school;
  u.certAt = Date.now();
  notifyAdmins('cert', '有新的学生认证待审核', u.name + '（' + u.certInfo.school + '）提交了学籍认证。');
  save();
  json(res, 200, { message: '资料已提交，等待平台审核（演示环境可登录运营账号通过）', certStatus: u.certStatus });
});
route('POST', '/api/cert/enterprise', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  if (u.certStatus === 'approved') return bad(res, '已通过认证，无需重复提交');
  if (u.certStatus === 'pending') return bad(res, '认证资料审核中，请耐心等待');
  const b = await readBody(req);
  if (!b.company || !b.creditCode) return bad(res, '请填写企业名称与统一社会信用代码');
  u.certStatus = 'pending';
  u.certInfo = {
    company: String(b.company).slice(0, 80),
    creditCode: String(b.creditCode).slice(0, 30),
    industry: String(b.industry || '').slice(0, 30)
  };
  u.company = u.certInfo.company;
  u.creditCode = u.certInfo.creditCode;
  u.industry = u.certInfo.industry;
  u.certAt = Date.now();
  notifyAdmins('cert', '有新的企业认证待审核', u.company + '（' + u.creditCode + '）提交了营业执照认证。');
  save();
  json(res, 200, { message: '资料已提交，等待平台审核', certStatus: u.certStatus });
});

// ---------- 文件上传 ----------
route('POST', '/api/upload', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u)) return;
  const b = await readBody(req);
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(b.data || ''));
  if (!m) return bad(res, '图片格式不正确');
  const mime = m[1];
  const allow = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
  if (!allow[mime]) return bad(res, '仅支持 PNG/JPG/WebP 图片');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_FILE) return bad(res, '图片不能超过 3MB');
  const stored = crypto.randomBytes(8).toString('hex') + allow[mime];
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buf);
  const f = {
    id: nextId('files'), ownerId: u.id, name: String(b.name || stored).slice(0, 80),
    mime, size: buf.length, storedName: stored, createdAt: Date.now()
  };
  db.files.push(f);
  save();
  json(res, 200, { file: fileView(f.id) });
});
route('GET', '/api/files/:id', (req, res, params) => {
  const f = db.files.find((x) => x.id === Number(params.id));
  if (!f) return bad(res, '文件不存在', 404);
  const p = path.join(UPLOAD_DIR, f.storedName);
  if (!fs.existsSync(p)) return bad(res, '文件已丢失', 404);
  res.writeHead(200, { 'Content-Type': f.mime, 'Cache-Control': 'public, max-age=86400' });
  fs.createReadStream(p).pipe(res);
});

// ---------- 通知 ----------
route('GET', '/api/notifications', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u)) return;
  const list = db.notifications.filter((n) => n.userId === u.id).slice().reverse().slice(0, 50);
  const unread = db.notifications.filter((n) => n.userId === u.id && !n.read).length;
  json(res, 200, { notifications: list, unread });
});
route('POST', '/api/notifications/read', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u)) return;
  const b = await readBody(req);
  db.notifications.forEach((n) => {
    if (n.userId !== u.id) return;
    if (!b.id || n.id === Number(b.id)) n.read = true;
  });
  save();
  json(res, 200, { ok: true });
});

// ---------- 任务 ----------
route('GET', '/api/tasks', (req, res, params, url) => {
  const u = currentUser(req);
  if (!need(res, u)) return;
  const cat = url.searchParams.get('category');
  const keyword = (url.searchParams.get('keyword') || '').trim();
  const sort = url.searchParams.get('sort') || 'new';
  let list = db.tasks.filter((t) => t.status === 'open');
  if (u.role === 'enterprise') list = db.tasks.filter((t) => t.status === 'open' || t.entId === u.id);
  if (u.role === 'admin') list = db.tasks.slice();
  if (cat && cat !== '全部') list = list.filter((t) => t.category === cat);
  if (keyword) list = list.filter((t) => (t.title + t.desc).includes(keyword));
  if (sort === 'price') list = list.sort((a, b) => b.price - a.price);
  else if (sort === 'hot') list = list.sort((a, b) => taskHiredCount(b.id) - taskHiredCount(a.id));
  else list = list.sort((a, b) => b.createdAt - a.createdAt);
  list = list.map((t) => ({
    ...t,
    hiredCount: taskHiredCount(t.id),
    applied: u.role === 'student' ? !!appFor(t.id, u.id) : false,
    enterpriseName: (db.users.find((x) => x.id === t.entId) || {}).name || '',
    rating: enterpriseRating(t.entId)
  }));
  json(res, 200, { tasks: list });
});
route('GET', '/api/tasks/:id', (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u)) return;
  const t = getTask(params.id);
  if (!t) return bad(res, '任务不存在', 404);
  const apps = db.applications.filter((a) => a.taskId === t.id).map((a) => {
    const s = db.users.find((x) => x.id === a.studentId) || {};
    return { ...a, studentName: s.name, school: s.school, credit: s.credit, verified: s.verified };
  });
  const rating = enterpriseRating(t.entId);
  const reviews = db.reviews.filter((r) => r.toId === t.entId && r.fromRole === 'student').slice(-5).reverse();
  json(res, 200, {
    task: { ...t, hiredCount: taskHiredCount(t.id), enterpriseName: (db.users.find((x) => x.id === t.entId) || {}).name, rating },
    applications: u.role === 'student' ? apps.filter((a) => a.studentId === u.id) : apps,
    reviews
  });
});
route('POST', '/api/tasks', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  if (!u.verified) return bad(res, '企业资质未通过审核，暂不能发布任务', 403);
  const b = await readBody(req);
  if (!b.title || !b.category || !b.headcount || !b.price) return bad(res, '请填写标题、类目、人数与单价');
  if (!(Number(b.headcount) > 0) || !(Number(b.price) > 0)) return bad(res, '人数与单价必须大于 0');
  const budget = Number(b.headcount) * Number(b.price);
  if (u.balance < budget) return bad(res, '账户余额不足（当前 ' + u.balance + ' 元，需 ' + budget + ' 元），请先充值');
  const t = {
    id: nextId('tasks'), entId: u.id, title: String(b.title).slice(0, 60), category: b.category,
    city: b.city || '长沙', address: b.address || '', desc: String(b.desc || '').slice(0, 500),
    headcount: Number(b.headcount), price: Number(b.price),
    lat: b.lat ? Number(b.lat) : null, lng: b.lng ? Number(b.lng) : null, district: b.district || '',
    startDate: b.startDate || '', endDate: b.endDate || '', startTime: b.startTime || '09:00', endTime: b.endTime || '18:00',
    settleType: b.settleType || '完工结', status: 'pending', createdAt: Date.now()
  };
  db.tasks.push(t);
  notifyAdmins('task_pending', '有新的任务待审核', '「' + t.title + '」由 ' + u.name + ' 提交，等待审核。');
  save();
  json(res, 200, { task: t, message: '任务已提交，等待平台审核' });
});
route('POST', '/api/tasks/:id/apply', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const t = getTask(params.id);
  if (!t) return bad(res, '任务不存在', 404);
  if (t.status !== 'open') return bad(res, '该任务当前不可报名');
  if (!u.verified) return bad(res, '请先完成学籍认证后再报名', 403);
  if (appFor(t.id, u.id)) return bad(res, '你已报名该任务');
  if (taskHiredCount(t.id) >= t.headcount) return bad(res, '任务名额已满');
  const a = { id: nextId('applications'), taskId: t.id, studentId: u.id, status: 'applied', createdAt: Date.now() };
  db.applications.push(a);
  notify(t.entId, 'apply', '有新的报名', u.name + ' 报名了「' + t.title + '」，请及时处理。', t.id);
  save();
  json(res, 200, { application: a, message: '报名成功，等待企业录用' });
});
route('POST', '/api/applications/:id/hire', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const a = db.applications.find((x) => x.id === Number(params.id));
  if (!a) return bad(res, '报名记录不存在', 404);
  const t = getTask(a.taskId);
  if (t.entId !== u.id) return bad(res, '只能处理自己任务下的报名', 403);
  if (a.status !== 'applied') return bad(res, '该报名已处理');
  if (taskHiredCount(t.id) >= t.headcount) return bad(res, '名额已满');
  if (u.balance < t.price) return bad(res, '账户余额不足，无法冻结任务款');
  u.balance = Number((u.balance - t.price).toFixed(2));
  a.status = 'hired';
  const o = {
    id: nextId('orders'), taskId: t.id, studentId: a.studentId, entId: u.id, price: t.price,
    platformFee: Number((t.price * FEE_RATE).toFixed(2)), netPay: Number((t.price * (1 - FEE_RATE)).toFixed(2)),
    status: 'hired', escrow: t.price, createdAt: Date.now()
  };
  db.orders.push(o);
  if (taskHiredCount(t.id) >= t.headcount) t.status = 'full';
  notify(a.studentId, 'hire', '你被录用了', '「' + t.title + '」已录用，任务款已托管，请按时打卡。', o.id);
  save();
  json(res, 200, { order: orderView(o), message: '已录用，任务款已冻结在托管账户' });
});
route('POST', '/api/applications/:id/reject', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const a = db.applications.find((x) => x.id === Number(params.id));
  if (!a) return bad(res, '报名记录不存在', 404);
  const t = getTask(a.taskId);
  if (t.entId !== u.id) return bad(res, '无权操作', 403);
  a.status = 'rejected';
  notify(a.studentId, 'reject', '报名未通过', '「' + t.title + '」未录用你，可以看看其他任务。', t.id);
  save();
  json(res, 200, { ok: true });
});
route('GET', '/api/my/tasks', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const list = db.tasks.filter((t) => t.entId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((t) => ({
    ...t,
    hiredCount: taskHiredCount(t.id),
    applyCount: db.applications.filter((a) => a.taskId === t.id && a.status === 'applied').length
  }));
  json(res, 200, { tasks: list });
});
route('GET', '/api/my/applications', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const list = db.applications.filter((a) => a.studentId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((a) => {
    const t = getTask(a.taskId) || {};
    const o = db.orders.find((x) => x.taskId === a.taskId && x.studentId === u.id);
    return { ...a, taskTitle: t.title, category: t.category, price: t.price, address: t.address, orderStatus: o ? o.status : null, orderId: o ? o.id : null };
  });
  json(res, 200, { applications: list });
});
route('GET', '/api/my/orders', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['student', 'enterprise'])) return;
  const list = db.orders.filter((o) => (u.role === 'student' ? o.studentId === u.id : o.entId === u.id)).sort((a, b) => b.createdAt - a.createdAt).map(orderView);
  json(res, 200, { orders: list });
});

// ---------- 联系方式（隐私号） ----------
route('POST', '/api/tasks/:id/contact', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const t = getTask(params.id);
  if (!t) return bad(res, '任务不存在', 404);
  if (!u.verified) return bad(res, '请先完成学籍认证', 403);
  if (!appFor(t.id, u.id)) return bad(res, '报名该任务后才能查看企业联系方式', 403);
  const ent = db.users.find((x) => x.id === t.entId) || {};
  const v = virtualNumber(t.id, u.id);
  db.contactLogs.push({ id: nextId('contactLogs'), taskId: t.id, studentId: u.id, entId: t.entId, createdAt: Date.now() });
  save();
  json(res, 200, {
    virtual: v.display,
    phone: maskPhone(ent.phone),
    hotline: '400-800-1234',
    note: '隐私号仅用于本单沟通；平台记录联系时间，请勿私下转账或缴费。'
  });
});

// ---------- 履约 ----------
route('POST', '/api/orders/:id/checkin', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.studentId !== u.id) return bad(res, '只能操作自己的订单', 403);
  if (o.status !== 'hired') return bad(res, '当前状态不能打卡');
  const b = await readBody(req);
  if (b.photoId && !db.files.find((f) => f.id === Number(b.photoId))) return bad(res, '照片不存在');
  const task = getTask(o.taskId) || {};
  let dist = null;
  if (b.lat && b.lng && task.lat && task.lng) {
    dist = distanceMeters(Number(b.lat), Number(b.lng), task.lat, task.lng);
    if (dist > 5000) return bad(res, '当前定位距任务地点约 ' + dist + ' 米（超过 5 公里），无法打卡，请到达现场后再试', 400);
  }
  o.status = 'checked_in';
  o.checkinAt = Date.now();
  if (b.photoId) o.checkinPhotoId = Number(b.photoId);
  o.checkinLat = b.lat ? Number(b.lat) : null;
  o.checkinLng = b.lng ? Number(b.lng) : null;
  o.checkinDistance = dist;
  o.checkinAbnormal = dist !== null && dist > 800;
  if (o.checkinAbnormal) notifyAdmins('location', '异常打卡提醒', '订单 #' + o.id + ' 打卡位置距任务地点约 ' + dist + ' 米，请关注。', o.id);
  notify(o.entId, 'checkin', '学生已打卡', '「' + (getTask(o.taskId) || {}).title + '」学生已打卡到岗。', o.id);
  save();
  json(res, 200, { order: orderView(o), message: dist === null ? '打卡成功（未获取定位，已用现场照片留痕）' : '打卡成功，距任务地点约 ' + dist + ' 米' });
});
route('POST', '/api/orders/:id/deliver', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.studentId !== u.id) return bad(res, '只能操作自己的订单', 403);
  if (!['hired', 'checked_in'].includes(o.status)) return bad(res, '当前状态不能提交成果');
  const b = await readBody(req);
  const ids = Array.isArray(b.fileIds) ? b.fileIds.map(Number).filter((id) => db.files.find((f) => f.id === id)) : [];
  o.status = 'delivered';
  o.deliverAt = Date.now();
  o.deliverNote = String(b.note || '').slice(0, 300) || '已按要求完成工作';
  o.deliverFileIds = ids.slice(0, 3);
  notify(o.entId, 'deliver', '有新的成果待验收', '「' + (getTask(o.taskId) || {}).title + '」学生已提交成果，请及时验收。', o.id);
  save();
  json(res, 200, { order: orderView(o), message: '成果已提交，等待企业验收' });
});
route('POST', '/api/orders/:id/accept', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.entId !== u.id) return bad(res, '只能操作自己发布的订单', 403);
  if (o.status !== 'delivered') return bad(res, '学生尚未提交成果或订单处于争议中');
  o.status = 'settled';
  o.acceptAt = Date.now();
  o.settledAt = Date.now();
  o.escrow = 0;
  const stu = db.users.find((x) => x.id === o.studentId);
  if (stu) {
    stu.balance = Number((stu.balance + o.netPay).toFixed(2));
    stu.credit = Math.min(1000, (stu.credit || 600) + 2);
  }
  u.credit = Math.min(1000, (u.credit || 600) + 1);
  notify(o.studentId, 'settle', '已结算到账', '「' + (getTask(o.taskId) || {}).title + '」验收通过，' + o.netPay.toFixed(2) + ' 元已到账。', o.id);
  save();
  json(res, 200, { order: orderView(o), message: '验收通过，已按 9:1 分账（学生到账 ' + o.netPay + ' 元，平台服务费 ' + o.platformFee + ' 元）' });
});
route('POST', '/api/orders/:id/reject', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.entId !== u.id) return bad(res, '无权操作', 403);
  if (o.status !== 'delivered') return bad(res, '当前状态不能驳回');
  const b = await readBody(req);
  o.status = 'checked_in';
  o.rejectReason = String(b.reason || '成果不符合要求，请补充完善').slice(0, 200);
  notify(o.studentId, 'reject', '成果被驳回', '「' + (getTask(o.taskId) || {}).title + '」：' + o.rejectReason, o.id);
  save();
  json(res, 200, { order: orderView(o), message: '已驳回，学生可修改后重新提交' });
});
route('POST', '/api/orders/:id/review', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student', 'enterprise'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.status !== 'settled') return bad(res, '订单完成后才能评价');
  const isStu = o.studentId === u.id;
  const isEnt = o.entId === u.id;
  if (!isStu && !isEnt) return bad(res, '无权评价该订单', 403);
  if (db.reviews.find((r) => r.orderId === o.id && r.fromId === u.id)) return bad(res, '你已评价过该订单');
  const b = await readBody(req);
  const score = Math.max(1, Math.min(5, Number(b.score) || 5));
  const r = {
    id: nextId('reviews'), orderId: o.id, fromId: u.id, toId: isStu ? o.entId : o.studentId,
    fromRole: u.role, score, content: String(b.content || '').slice(0, 200), createdAt: Date.now()
  };
  db.reviews.push(r);
  const target = db.users.find((x) => x.id === r.toId);
  if (target) target.credit = Math.max(0, (target.credit || 600) + (score - 3) * 2);
  save();
  json(res, 200, { review: r, message: '评价成功' });
});

// ---------- 争议与仲裁 ----------
route('POST', '/api/orders/:id/complaint', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['student', 'enterprise'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (![o.studentId, o.entId].includes(u.id)) return bad(res, '无权对该订单发起申诉', 403);
  if (o.status !== 'delivered') return bad(res, '只有已交付待验收的订单可以发起申诉');
  const b = await readBody(req);
  if (!b.reason || String(b.reason).length < 5) return bad(res, '请填写至少 5 个字的申诉理由');
  o.status = 'disputed';
  o.complaint = { by: u.id, reason: String(b.reason).slice(0, 300), at: Date.now() };
  notify(o.studentId === u.id ? o.entId : o.studentId, 'dispute', '对方发起争议', '「' + (getTask(o.taskId) || {}).title + '」进入争议处理，平台将在 48 小时内仲裁。', o.id);
  notifyAdmins('dispute', '有新的争议待仲裁', '订单 #' + o.id + '「' + (getTask(o.taskId) || {}).title + '」被发起争议。', o.id);
  save();
  json(res, 200, { order: orderView(o), message: '已提交申诉，平台将介入仲裁' });
});
route('POST', '/api/admin/orders/:id/arbitrate', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const o = db.orders.find((x) => x.id === Number(params.id));
  if (!o) return bad(res, '订单不存在', 404);
  if (o.status !== 'disputed') return bad(res, '该订单不在争议状态');
  const b = await readBody(req);
  const result = b.result;
  if (!['refund', 'pay'].includes(result)) return bad(res, '请选择裁决结果');
  if (result === 'refund') {
    const ent = db.users.find((x) => x.id === o.entId);
    if (ent && o.escrow > 0) ent.balance = Number((ent.balance + o.escrow).toFixed(2));
    o.escrow = 0;
    o.status = 'refunded';
    o.arbitration = { result: 'refund', note: String(b.note || '').slice(0, 200), by: u.id, at: Date.now() };
    notify(o.studentId, 'arbitrate', '仲裁结果：退款', '「' + (getTask(o.taskId) || {}).title + '」经平台仲裁，任务款退回企业。', o.id);
    notify(o.entId, 'arbitrate', '仲裁结果：退款', '订单 #' + o.id + ' 已退款至你的账户。', o.id);
  } else {
    const stu = db.users.find((x) => x.id === o.studentId);
    if (stu) {
      stu.balance = Number((stu.balance + o.netPay).toFixed(2));
      stu.credit = Math.min(1000, (stu.credit || 600) + 1);
    }
    o.escrow = 0;
    o.status = 'settled';
    o.settledAt = Date.now();
    o.arbitration = { result: 'pay', note: String(b.note || '').slice(0, 200), by: u.id, at: Date.now() };
    notify(o.studentId, 'arbitrate', '仲裁结果：结算', '「' + (getTask(o.taskId) || {}).title + '」经平台仲裁，' + o.netPay.toFixed(2) + ' 元已到账。', o.id);
    notify(o.entId, 'arbitrate', '仲裁结果：付款', '订单 #' + o.id + ' 已按裁决向学生付款。', o.id);
  }
  save();
  json(res, 200, { order: orderView(o), message: '仲裁完成：' + (result === 'refund' ? '退款给企业' : '按约结算给学生') });
});

// ---------- 钱包 ----------
route('POST', '/api/wallet/withdraw', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['student'])) return;
  const b = await readBody(req);
  const amount = Number(b.amount);
  if (!(amount > 0)) return bad(res, '提现金额必须大于 0');
  if (amount > u.balance) return bad(res, '余额不足');
  u.balance = Number((u.balance - amount).toFixed(2));
  const w = { id: nextId('withdrawals'), userId: u.id, amount, status: 'processing', createdAt: Date.now() };
  db.withdrawals.push(w);
  save();
  json(res, 200, { withdrawal: w, message: '提现申请已提交，预计 T+1 到账' });
});
route('POST', '/api/wallet/recharge', async (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['enterprise'])) return;
  const b = await readBody(req);
  const amount = Number(b.amount);
  if (!(amount > 0) || amount > 100000) return bad(res, '充值金额需在 1—100000 元之间（演示）');
  u.balance = Number((u.balance + amount).toFixed(2));
  save();
  json(res, 200, { balance: u.balance, message: '演示充值成功，当前余额 ' + u.balance.toFixed(2) + ' 元' });
});

// ---------- 运营后台 ----------
route('GET', '/api/admin/overview', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const pendingUsers = db.users.filter((x) => x.role !== 'admin' && x.certStatus === 'pending');
  const pendingTasks = db.tasks.filter((t) => t.status === 'pending');
  const disputed = db.orders.filter((o) => o.status === 'disputed');
  const settled = db.orders.filter((o) => o.status === 'settled');
  const gmv = settled.reduce((s, o) => s + o.price, 0);
  const fee = settled.reduce((s, o) => s + o.platformFee, 0);
  const byStatus = {};
  db.orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  const byCategory = {};
  db.tasks.forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + 1; });
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = start.getTime() + 24 * 3600 * 1000;
    const amount = settled.filter((o) => o.settledAt >= start.getTime() && o.settledAt < end).reduce((s, o) => s + o.price, 0);
    days.push({ date: (start.getMonth() + 1) + '/' + start.getDate(), amount: Number(amount.toFixed(2)) });
  }
  json(res, 200, {
    stats: {
      users: db.users.filter((x) => x.role !== 'admin').length,
      students: db.users.filter((x) => x.role === 'student').length,
      enterprises: db.users.filter((x) => x.role === 'enterprise').length,
      tasks: db.tasks.length,
      openTasks: db.tasks.filter((t) => t.status === 'open').length,
      orders: db.orders.length,
      settledOrders: settled.length,
      gmv: Number(gmv.toFixed(2)),
      platformFee: Number(fee.toFixed(2)),
      pendingTasks: pendingTasks.length,
      pendingUsers: pendingUsers.length,
      disputes: disputed.length,
      contacts: db.contactLogs.length,
      geoTasks: db.tasks.filter((t) => t.lat && t.lng).length
    },
    charts: { byStatus, byCategory, days },
    pendingUsers: pendingUsers.map(publicUser),
    pendingTasks: pendingTasks.map((t) => ({ ...t, enterpriseName: (db.users.find((u) => u.id === t.entId) || {}).name || '' })),
    disputes: disputed.map(orderView),
    recentOrders: db.orders.slice(-8).reverse().map(orderView)
  });
});
route('POST', '/api/admin/users/:id/verify', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const target = db.users.find((x) => x.id === Number(params.id));
  if (!target) return bad(res, '用户不存在', 404);
  target.verified = true;
  target.certStatus = 'approved';
  target.certAt = Date.now();
  notify(target.id, 'cert_ok', '认证已通过', '你的' + (target.role === 'student' ? '学籍' : '企业资质') + '认证已通过，现在可以' + (target.role === 'student' ? '报名任务' : '发布任务') + '了。');
  save();
  json(res, 200, { user: publicUser(target), message: '已通过资质审核' });
});
route('POST', '/api/admin/users/:id/reject', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const target = db.users.find((x) => x.id === Number(params.id));
  if (!target) return bad(res, '用户不存在', 404);
  const b = await readBody(req);
  target.verified = false;
  target.certStatus = 'rejected';
  target.certNote = String(b.reason || '资料不完整，请补充后重新提交').slice(0, 100);
  notify(target.id, 'cert_reject', '认证被驳回', '原因：' + target.certNote);
  save();
  json(res, 200, { user: publicUser(target), message: '已驳回认证' });
});
route('POST', '/api/admin/tasks/:id/approve', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const t = getTask(params.id);
  if (!t) return bad(res, '任务不存在', 404);
  t.status = 'open';
  t.reviewedBy = u.id;
  t.reviewedAt = Date.now();
  notify(t.entId, 'task_ok', '任务审核通过', '「' + t.title + '」已上线，开始招募学生。');
  save();
  json(res, 200, { task: t, message: '任务已通过审核并上线' });
});
route('POST', '/api/admin/tasks/:id/reject', async (req, res, params) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  const t = getTask(params.id);
  if (!t) return bad(res, '任务不存在', 404);
  const b = await readBody(req);
  t.status = 'rejected';
  t.reviewedBy = u.id;
  t.rejectReason = String(b.reason || '不符合平台发布规范').slice(0, 100);
  notify(t.entId, 'task_reject', '任务审核未通过', '「' + t.title + '」：' + t.rejectReason);
  save();
  json(res, 200, { task: t, message: '任务已驳回' });
});
route('GET', '/api/admin/orders', (req, res) => {
  const u = currentUser(req);
  if (!need(res, u, ['admin'])) return;
  json(res, 200, { orders: db.orders.slice().reverse().map(orderView) });
});

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC, rel.replace(/^\/+/, ''));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + rel);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------- 主服务 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = pathname.match(r.re);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => (params[k] = m[i + 1]));
        return await r.handler(req, res, params, url);
      }
      return bad(res, '接口不存在', 404);
    }
    serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) bad(res, '服务器错误：' + e.message, 500);
    else res.end();
  }
});
load();
server.listen(PORT, HOST, () => {
  console.log('兼职众包平台原型已启动，监听 ' + HOST + ':' + PORT);
  if (HOST === '0.0.0.0') {
    const nets = os.networkInterfaces();
    Object.keys(nets).forEach((name) => {
      (nets[name] || []).forEach((n) => {
        if (n.family === 'IPv4' && !n.internal) console.log('  局域网/公网可用地址: http://' + n.address + ':' + PORT + '  (' + name + ')');
      });
    });
  } else {
    console.log('  本机访问: http://127.0.0.1:' + PORT);
  }
  console.log('演示账号: student/123456 · company/123456 · admin/123456');
});
