/* 静态演示版 mock API：拦截 /api/* 请求，用 localStorage 模拟后端。
   仅用于 GitHub Pages 演示，数据保存在当前浏览器。 */
(function () {
  const KEY = 'jb_demo_db_v2';
  const FEE_RATE = 0.1;
  const memFiles = {};
  let db = null;
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const dstr = (n) => new Date(now + n * day).toISOString().slice(0, 10);

  function seed() {
    return {
      seq: { tasks: 5, applications: 3, orders: 3, reviews: 1, notifications: 4, files: 0, withdrawals: 0 },
      users: [
        { id: 1, role: 'student', username: 'student', password: '123456', name: '张同学', school: '湖南大学', phone: '138****0001', credit: 620, verified: true, certStatus: 'approved', certInfo: { school: '湖南大学', studentNo: '2023****01' }, balance: 72, createdAt: now - 30 * day },
        { id: 2, role: 'student', username: 'student2', password: '123456', name: '李同学', school: '中南大学', phone: '138****0002', credit: 600, verified: false, certStatus: 'none', certInfo: {}, balance: 0, createdAt: now - 20 * day },
        { id: 3, role: 'student', username: 'student3', password: '123456', name: '王同学', school: '湖南师范大学', phone: '138****0003', credit: 605, verified: true, certStatus: 'approved', certInfo: { school: '湖南师范大学', studentNo: '2022****03' }, balance: 0, createdAt: now - 15 * day },
        { id: 10, role: 'enterprise', username: 'company', password: '123456', name: '茶颜悦色（五一广场店）', company: '长沙茶悦餐饮管理有限公司', creditCode: '91430100MA4L****XX', industry: '餐饮零售', phone: '0731-8****001', verified: true, certStatus: 'approved', certInfo: { company: '长沙茶悦餐饮管理有限公司', creditCode: '91430100MA4L****XX', industry: '餐饮零售' }, balance: 49785, createdAt: now - 60 * day },
        { id: 11, role: 'enterprise', username: 'company2', password: '123456', name: '星辰会展服务有限公司', company: '长沙星辰会展服务有限公司', creditCode: '91430100MA4M****YY', industry: '会展服务', phone: '0731-8****002', verified: false, certStatus: 'none', certInfo: {}, balance: 8000, createdAt: now - 10 * day },
        { id: 99, role: 'admin', username: 'admin', password: '123456', name: '平台运营', verified: true, certStatus: 'approved', createdAt: now - 90 * day }
      ],
      tasks: [
        { id: 1, entId: 10, title: '茶颜悦色五一广场店 · 周末小时工', category: '门店兼职', city: '长沙', address: '五一广场地铁站 3 号口', desc: '负责点单、出杯、门店卫生，周末 10:00-18:00，提供工作餐与工服。', headcount: 3, price: 22, startDate: dstr(3), endDate: dstr(3), startTime: '10:00', endTime: '18:00', settleType: '当日结', status: 'open', createdAt: now - 2 * day, reviewedBy: 99, lat: 28.1955, lng: 112.977, district: '芙蓉区' },
        { id: 2, entId: 10, title: '新品试饮推广 · 校园地推', category: '校园推广', city: '长沙', address: '湖南大学天马学生公寓', desc: '在宿舍区派发试饮券并引导扫码，半天 4 小时，需自备深色长裤。', headcount: 5, price: 80, startDate: dstr(5), endDate: dstr(5), startTime: '14:00', endTime: '18:00', settleType: '完工结', status: 'open', createdAt: now - 1 * day, reviewedBy: 99, lat: 28.179, lng: 112.945, district: '岳麓区' },
        { id: 3, entId: 11, title: '春季教育展 · 现场协助', category: '展会协助', city: '长沙', address: '湖南国际会展中心', desc: '展位引导、资料发放、观众登记，需正装，提供午餐。', headcount: 8, price: 150, startDate: dstr(7), endDate: dstr(8), startTime: '09:00', endTime: '17:00', settleType: '完工结', status: 'pending', createdAt: now - 6 * 3600 * 1000, lat: 28.232, lng: 113.083, district: '雨花区' },
        { id: 4, entId: 10, title: '用户口味问卷调研（线上）', category: '问卷调研', city: '长沙', address: '线上完成', desc: '完成 20 份有效问卷，每份约 5 分钟，按份计酬，需提交问卷截图。', headcount: 10, price: 15, startDate: dstr(1), endDate: dstr(6), startTime: '00:00', endTime: '23:59', settleType: '按件结', status: 'open', createdAt: now - 12 * 3600 * 1000, reviewedBy: 99, lat: null, lng: null, district: '线上' },
        { id: 5, entId: 10, title: 'AI 训练数据标注（图片分类）', category: '数据标注', city: '长沙', address: '线上完成', desc: '对 500 张商品图进行分类标注，平台提供工具与培训，验收合格后结算。', headcount: 6, price: 120, startDate: dstr(2), endDate: dstr(9), startTime: '00:00', endTime: '23:59', settleType: '按件结', status: 'open', createdAt: now - 20 * 3600 * 1000, reviewedBy: 99, lat: null, lng: null, district: '线上' }
      ],
      applications: [
        { id: 1, taskId: 2, studentId: 1, status: 'hired', createdAt: now - 20 * 3600 * 1000 },
        { id: 2, taskId: 4, studentId: 3, status: 'hired', createdAt: now - 6 * 3600 * 1000 },
        { id: 3, taskId: 5, studentId: 3, status: 'hired', createdAt: now - 8 * 3600 * 1000 }
      ],
      orders: [
        { id: 1, taskId: 2, studentId: 1, entId: 10, price: 80, platformFee: 8, netPay: 72, status: 'settled', escrow: 0, createdAt: now - 20 * 3600 * 1000, checkinAt: now - 19 * 3600 * 1000, deliverAt: now - 18 * 3600 * 1000, acceptAt: now - 17 * 3600 * 1000, settledAt: now - 17 * 3600 * 1000, deliverNote: '完成湖南大学天马公寓地推，扫码试饮券 128 人' },
        { id: 2, taskId: 4, studentId: 3, entId: 10, price: 15, platformFee: 1.5, netPay: 13.5, status: 'delivered', escrow: 15, createdAt: now - 6 * 3600 * 1000, checkinAt: now - 5 * 3600 * 1000, deliverAt: now - 4 * 3600 * 1000, deliverNote: '已完成 20 份有效问卷' },
        { id: 3, taskId: 5, studentId: 3, entId: 10, price: 120, platformFee: 12, netPay: 108, status: 'disputed', escrow: 120, createdAt: now - 9 * 3600 * 1000, checkinAt: now - 8 * 3600 * 1000, deliverAt: now - 7 * 3600 * 1000, deliverNote: '已完成 500 张图片分类标注', complaint: { by: 10, reason: '抽样检查发现约 15% 的图片分类不准确，要求返工或部分结算', at: now - 5 * 3600 * 1000 } }
      ],
      reviews: [{ id: 1, orderId: 1, fromId: 1, toId: 10, fromRole: 'student', score: 5, content: '结算很快，岗位真实', createdAt: now - 16 * 3600 * 1000 }],
      notifications: [
        { id: 1, userId: 1, type: 'settle', title: '已结算到账', body: '「新品试饮推广 · 校园地推」验收通过，72.00 元已到账。', orderId: 1, read: false, createdAt: now - 17 * 3600 * 1000 },
        { id: 2, userId: 10, type: 'deliver', title: '有新的成果待验收', body: '「用户口味问卷调研（线上）」学生已提交成果，请及时验收。', orderId: 2, read: false, createdAt: now - 4 * 3600 * 1000 },
        { id: 3, userId: 99, type: 'task_pending', title: '有 1 个任务待审核', body: '「春季教育展 · 现场协助」等待审核。', orderId: null, read: false, createdAt: now - 6 * 3600 * 1000 },
        { id: 4, userId: 99, type: 'dispute', title: '有新的争议待仲裁', body: '订单 #3「AI 训练数据标注（图片分类）」被发起争议。', orderId: 3, read: false, createdAt: now - 5 * 3600 * 1000 }
      ],
      withdrawals: [], sessions: {}
    };
  }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); return; } } catch (e) {}
    db = seed(); save();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function nextId(c) { db.seq[c] = (db.seq[c] || 0) + 1; return db.seq[c]; }
  function userById(id) { return db.users.find((u) => u.id === Number(id)); }
  function taskById(id) { return db.tasks.find((t) => t.id === Number(id)); }
  function hiredCount(id) { return db.orders.filter((o) => o.taskId === id && !['cancelled', 'refunded'].includes(o.status)).length; }
  function appFor(t, s) { return db.applications.find((a) => a.taskId === t && a.studentId === s); }
  function auth(t) { const s = db.sessions[t]; return s ? userById(s.userId) : null; }
  function pub(u) { if (!u) return null; const c = Object.assign({}, u); delete c.password; return c; }
  function dist(lat1, lng1, lat2, lng2) {
    const R = 6371000, r = (x) => (x * Math.PI) / 180;
    const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }
  function fileView(id) { const f = memFiles[id]; return f ? { id: f.id, name: f.name, mime: f.mime, size: f.size, url: f.url } : null; }
  function notify(uid, type, title, body, oid) { if (uid) db.notifications.push({ id: nextId('notifications'), userId: uid, type, title, body, orderId: oid || null, read: false, createdAt: Date.now() }); }
  function notifyAdmins(type, title, body, oid) { db.users.filter((u) => u.role === 'admin').forEach((a) => notify(a.id, type, title, body, oid)); }
  function orderView(o) {
    const t = taskById(o.taskId) || {}, s = userById(o.studentId) || {}, e = userById(o.entId) || {};
    return Object.assign({}, o, {
      taskTitle: t.title || '已删除任务', category: t.category || '', address: t.address || '',
      studentName: s.name || '', enterpriseName: e.name || '',
      checkinPhoto: o.checkinPhotoId ? fileView(o.checkinPhotoId) : null,
      deliverFiles: (o.deliverFileIds || []).map(fileView).filter(Boolean)
    });
  }
  function rating(entId) {
    const l = db.reviews.filter((r) => r.toId === entId && r.fromRole === 'student');
    return l.length ? { avg: Number((l.reduce((s, r) => s + r.score, 0) / l.length).toFixed(1)), count: l.length } : { avg: null, count: 0 };
  }
  function ok(d) { return { status: 200, data: d }; }
  function err(m, s) { return { status: s || 400, data: { error: m } }; }

  async function handle(method, path, query, body, token) {
    const u = auth(token);
    const need = (roles) => {
      if (!u) return { status: 401, data: { error: '请先登录' } };
      if (roles && !roles.includes(u.role)) return { status: 403, data: { error: '当前账号无权进行此操作' } };
      return null;
    };
    let m;

    if (method === 'POST' && path === '/api/login') {
      const x = db.users.find((y) => y.username === String(body.username || '').trim() && y.password === String(body.password || ''));
      if (!x) return err('账号或密码错误', 401);
      const t = 'demo-' + x.id + '-' + Math.random().toString(36).slice(2, 8);
      db.sessions[t] = { userId: x.id, at: Date.now() }; save();
      return ok({ token: t, user: pub(x) });
    }
    if (method === 'GET' && path === '/api/me') { const e = need(); return e || ok({ user: pub(u) }); }
    if (method === 'POST' && path === '/api/logout') { if (token) delete db.sessions[token]; save(); return ok({ ok: true }); }
    if (method === 'POST' && path === '/api/cert/student') {
      const e = need(['student']); if (e) return e;
      if (u.certStatus === 'approved') return err('已通过认证，无需重复提交');
      if (u.certStatus === 'pending') return err('认证资料审核中，请耐心等待');
      u.certStatus = 'pending'; u.certInfo = { school: body.school, studentNo: body.studentNo }; u.school = body.school;
      notifyAdmins('cert', '有新的学生认证待审核', u.name + '（' + body.school + '）提交了学籍认证。');
      save(); return ok({ message: '资料已提交，等待平台审核', certStatus: 'pending' });
    }
    if (method === 'POST' && path === '/api/cert/enterprise') {
      const e = need(['enterprise']); if (e) return e;
      if (u.certStatus === 'approved') return err('已通过认证，无需重复提交');
      if (u.certStatus === 'pending') return err('认证资料审核中，请耐心等待');
      u.certStatus = 'pending'; u.certInfo = { company: body.company, creditCode: body.creditCode, industry: body.industry };
      u.company = body.company; u.creditCode = body.creditCode; u.industry = body.industry;
      notifyAdmins('cert', '有新的企业认证待审核', body.company + ' 提交了营业执照认证。');
      save(); return ok({ message: '资料已提交，等待平台审核', certStatus: 'pending' });
    }
    if (method === 'POST' && path === '/api/upload') {
      if (!u) return err('请先登录', 401);
      const mm = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(body.data || ''));
      if (!mm) return err('图片格式不正确');
      const id = nextId('files');
      memFiles[id] = { id, name: body.name || ('img' + id), mime: mm[1], size: Math.round(mm[2].length * 0.75), url: body.data };
      save();
      return ok({ file: { id, name: memFiles[id].name, url: body.data } });
    }
    if (method === 'GET' && path === '/api/notifications') {
      const e = need(); if (e) return e;
      return ok({ notifications: db.notifications.filter((n) => n.userId === u.id).slice().reverse().slice(0, 50), unread: db.notifications.filter((n) => n.userId === u.id && !n.read).length });
    }
    if (method === 'POST' && path === '/api/notifications/read') {
      const e = need(); if (e) return e;
      db.notifications.forEach((n) => { if (n.userId === u.id) n.read = true; });
      save(); return ok({ ok: true });
    }
    if (method === 'GET' && path === '/api/tasks') {
      const e = need(); if (e) return e;
      const cat = query.get('category'), kw = (query.get('keyword') || '').trim(), sort = query.get('sort') || 'new';
      let list = db.tasks.filter((t) => t.status === 'open');
      if (u.role === 'enterprise') list = db.tasks.filter((t) => t.status === 'open' || t.entId === u.id);
      if (u.role === 'admin') list = db.tasks.slice();
      if (cat && cat !== '全部') list = list.filter((t) => t.category === cat);
      if (kw) list = list.filter((t) => (t.title + t.desc).includes(kw));
      if (sort === 'price') list.sort((a, b) => b.price - a.price);
      else if (sort === 'hot') list.sort((a, b) => hiredCount(b.id) - hiredCount(a.id));
      else list.sort((a, b) => b.createdAt - a.createdAt);
      return ok({ tasks: list.map((t) => Object.assign({}, t, { hiredCount: hiredCount(t.id), applied: u.role === 'student' ? !!appFor(t.id, u.id) : false, enterpriseName: (userById(t.entId) || {}).name || '', rating: rating(t.entId) })) });
    }
    if (method === 'GET' && (m = path.match(/^\/api\/tasks\/(\d+)$/))) {
      const e = need(); if (e) return e;
      const t = taskById(m[1]); if (!t) return err('任务不存在', 404);
      const apps = db.applications.filter((a) => a.taskId === t.id).map((a) => { const s = userById(a.studentId) || {}; return Object.assign({}, a, { studentName: s.name, school: s.school, credit: s.credit, verified: s.verified }); });
      return ok({ task: Object.assign({}, t, { hiredCount: hiredCount(t.id), enterpriseName: (userById(t.entId) || {}).name, rating: rating(t.entId) }), applications: u.role === 'student' ? apps.filter((a) => a.studentId === u.id) : apps, reviews: db.reviews.filter((r) => r.toId === t.entId && r.fromRole === 'student').slice(-5).reverse() });
    }
    if (method === 'POST' && path === '/api/tasks') {
      const e = need(['enterprise']); if (e) return e;
      if (!u.verified) return err('企业资质未通过审核，暂不能发布任务', 403);
      if (!body.title || !body.category || !body.headcount || !body.price) return err('请填写标题、类目、人数与单价');
      if (u.balance < Number(body.headcount) * Number(body.price)) return err('账户余额不足，请先充值');
      const t = { id: nextId('tasks'), entId: u.id, title: body.title, category: body.category, city: body.city || '长沙', address: body.address || '', desc: body.desc || '', headcount: Number(body.headcount), price: Number(body.price), lat: body.lat ? Number(body.lat) : null, lng: body.lng ? Number(body.lng) : null, district: body.district || '', startDate: body.startDate || '', endDate: body.endDate || '', startTime: body.startTime || '09:00', endTime: body.endTime || '18:00', settleType: body.settleType || '完工结', status: 'pending', createdAt: Date.now() };
      db.tasks.push(t);
      notifyAdmins('task_pending', '有新的任务待审核', '「' + t.title + '」由 ' + u.name + ' 提交，等待审核。');
      save(); return ok({ task: t, message: '任务已提交，等待平台审核' });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/tasks\/(\d+)\/apply$/))) {
      const e = need(['student']); if (e) return e;
      const t = taskById(m[1]); if (!t) return err('任务不存在', 404);
      if (t.status !== 'open') return err('该任务当前不可报名');
      if (!u.verified) return err('请先完成学籍认证后再报名', 403);
      if (appFor(t.id, u.id)) return err('你已报名该任务');
      if (hiredCount(t.id) >= t.headcount) return err('任务名额已满');
      const a = { id: nextId('applications'), taskId: t.id, studentId: u.id, status: 'applied', createdAt: Date.now() };
      db.applications.push(a);
      notify(t.entId, 'apply', '有新的报名', u.name + ' 报名了「' + t.title + '」，请及时处理。', t.id);
      save(); return ok({ application: a, message: '报名成功，等待企业录用' });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/tasks\/(\d+)\/contact$/))) {
      const e = need(['student']); if (e) return e;
      const t = taskById(m[1]); if (!t) return err('任务不存在', 404);
      if (!u.verified) return err('请先完成学籍认证', 403);
      if (!appFor(t.id, u.id)) return err('报名该任务后才能查看企业联系方式', 403);
      const ent = userById(t.entId) || {}, h = String(t.id * 7919 + u.id * 104729).slice(-8);
      return ok({ virtual: '170' + h.slice(0, 4) + '****' + h.slice(4) + ' 转 ' + (h.slice(0, 3) || '100'), phone: ent.phone || '0731-8****001', hotline: '400-800-1234', note: '演示环境为模拟隐私号，仅用于本单沟通。' });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/applications\/(\d+)\/hire$/))) {
      const e = need(['enterprise']); if (e) return e;
      const a = db.applications.find((x) => x.id === Number(m[1])); if (!a) return err('报名记录不存在', 404);
      const t = taskById(a.taskId);
      if (t.entId !== u.id) return err('只能处理自己任务下的报名', 403);
      if (a.status !== 'applied') return err('该报名已处理');
      if (hiredCount(t.id) >= t.headcount) return err('名额已满');
      if (u.balance < t.price) return err('账户余额不足，无法冻结任务款');
      u.balance = Number((u.balance - t.price).toFixed(2)); a.status = 'hired';
      const o = { id: nextId('orders'), taskId: t.id, studentId: a.studentId, entId: u.id, price: t.price, platformFee: Number((t.price * FEE_RATE).toFixed(2)), netPay: Number((t.price * (1 - FEE_RATE)).toFixed(2)), status: 'hired', escrow: t.price, createdAt: Date.now() };
      db.orders.push(o);
      if (hiredCount(t.id) >= t.headcount) t.status = 'full';
      notify(a.studentId, 'hire', '你被录用了', '「' + t.title + '」已录用，任务款已托管，请按时打卡。', o.id);
      save(); return ok({ order: orderView(o), message: '已录用，任务款已冻结在托管账户' });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/applications\/(\d+)\/reject$/))) {
      const e = need(['enterprise']); if (e) return e;
      const a = db.applications.find((x) => x.id === Number(m[1])); if (!a) return err('报名记录不存在', 404);
      const t = taskById(a.taskId); if (t.entId !== u.id) return err('无权操作', 403);
      a.status = 'rejected'; notify(a.studentId, 'reject', '报名未通过', '「' + t.title + '」未录用你。', t.id);
      save(); return ok({ ok: true });
    }
    if (method === 'GET' && path === '/api/my/tasks') {
      const e = need(['enterprise']); if (e) return e;
      return ok({ tasks: db.tasks.filter((t) => t.entId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((t) => Object.assign({}, t, { hiredCount: hiredCount(t.id), applyCount: db.applications.filter((a) => a.taskId === t.id && a.status === 'applied').length })) });
    }
    if (method === 'GET' && path === '/api/my/applications') {
      const e = need(['student']); if (e) return e;
      return ok({ applications: db.applications.filter((a) => a.studentId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((a) => {
        const t = taskById(a.taskId) || {}, o = db.orders.find((x) => x.taskId === a.taskId && x.studentId === u.id);
        return Object.assign({}, a, { taskTitle: t.title, category: t.category, price: t.price, address: t.address, orderStatus: o ? o.status : null, orderId: o ? o.id : null });
      }) });
    }
    if (method === 'GET' && path === '/api/my/orders') {
      const e = need(['student', 'enterprise']); if (e) return e;
      return ok({ orders: db.orders.filter((o) => (u.role === 'student' ? o.studentId === u.id : o.entId === u.id)).sort((a, b) => b.createdAt - a.createdAt).map(orderView) });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/orders\/(\d+)\/(checkin|deliver|accept|reject|review|complaint)$/))) {
      const o = db.orders.find((x) => x.id === Number(m[1])); const act = m[2];
      const e = need(act === 'accept' || act === 'reject' ? ['enterprise'] : ['student', 'enterprise']); if (e) return e;
      if (!o) return err('订单不存在', 404);
      const t = taskById(o.taskId) || {};
      if (act === 'checkin') {
        if (o.studentId !== u.id) return err('只能操作自己的订单', 403);
        if (o.status !== 'hired') return err('当前状态不能打卡');
        let d = null;
        if (body.lat && body.lng && t.lat && t.lng) {
          d = dist(Number(body.lat), Number(body.lng), t.lat, t.lng);
          if (d > 5000) return err('当前定位距任务地点约 ' + d + ' 米（超过 5 公里），无法打卡');
        }
        o.status = 'checked_in'; o.checkinAt = Date.now(); o.checkinPhotoId = body.photoId || null;
        o.checkinLat = body.lat || null; o.checkinLng = body.lng || null; o.checkinDistance = d; o.checkinAbnormal = d !== null && d > 800;
        notify(o.entId, 'checkin', '学生已打卡', '「' + t.title + '」学生已打卡到岗。', o.id);
        save(); return ok({ order: orderView(o), message: d === null ? '打卡成功（未获取定位，已用现场照片留痕）' : '打卡成功，距任务地点约 ' + d + ' 米' });
      }
      if (act === 'deliver') {
        if (o.studentId !== u.id) return err('只能操作自己的订单', 403);
        if (!['hired', 'checked_in'].includes(o.status)) return err('当前状态不能提交成果');
        o.status = 'delivered'; o.deliverAt = Date.now(); o.deliverNote = body.note || '已按要求完成工作';
        o.deliverFileIds = (body.fileIds || []).filter((f) => memFiles[f]).slice(0, 3);
        notify(o.entId, 'deliver', '有新的成果待验收', '「' + t.title + '」学生已提交成果，请及时验收。', o.id);
        save(); return ok({ order: orderView(o), message: '成果已提交，等待企业验收' });
      }
      if (act === 'accept') {
        if (o.entId !== u.id) return err('只能操作自己发布的订单', 403);
        if (o.status !== 'delivered') return err('学生尚未提交成果或订单处于争议中');
        o.status = 'settled'; o.acceptAt = Date.now(); o.settledAt = Date.now(); o.escrow = 0;
        const stu = userById(o.studentId); if (stu) { stu.balance = Number((stu.balance + o.netPay).toFixed(2)); stu.credit = Math.min(1000, (stu.credit || 600) + 2); }
        notify(o.studentId, 'settle', '已结算到账', '「' + t.title + '」验收通过，' + o.netPay.toFixed(2) + ' 元已到账。', o.id);
        save(); return ok({ order: orderView(o), message: '验收通过，已按 9:1 分账' });
      }
      if (act === 'reject') {
        if (o.entId !== u.id) return err('无权操作', 403);
        if (o.status !== 'delivered') return err('当前状态不能驳回');
        o.status = 'checked_in'; o.rejectReason = body.reason || '成果不符合要求，请补充完善';
        notify(o.studentId, 'reject', '成果被驳回', '「' + t.title + '」：' + o.rejectReason, o.id);
        save(); return ok({ order: orderView(o), message: '已驳回，学生可修改后重新提交' });
      }
      if (act === 'review') {
        if (o.status !== 'settled') return err('订单完成后才能评价');
        const fromStudent = o.studentId === u.id;
        if (!fromStudent && o.entId !== u.id) return err('无权评价该订单', 403);
        if (db.reviews.find((r) => r.orderId === o.id && r.fromId === u.id)) return err('你已评价过该订单');
        const r = { id: nextId('reviews'), orderId: o.id, fromId: u.id, toId: fromStudent ? o.entId : o.studentId, fromRole: u.role, score: Math.max(1, Math.min(5, Number(body.score) || 5)), content: body.content || '', createdAt: Date.now() };
        db.reviews.push(r); save(); return ok({ review: r, message: '评价成功' });
      }
      if (act === 'complaint') {
        if (![o.studentId, o.entId].includes(u.id)) return err('无权对该订单发起申诉', 403);
        if (o.status !== 'delivered') return err('只有已交付待验收的订单可以发起申诉');
        o.status = 'disputed'; o.complaint = { by: u.id, reason: body.reason, at: Date.now() };
        notifyAdmins('dispute', '有新的争议待仲裁', '订单 #' + o.id + '「' + t.title + '」被发起争议。', o.id);
        save(); return ok({ order: orderView(o), message: '已提交申诉，平台将介入仲裁' });
      }
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/orders\/(\d+)\/arbitrate$/))) {
      const e = need(['admin']); if (e) return e;
      const o = db.orders.find((x) => x.id === Number(m[1])); if (!o) return err('订单不存在', 404);
      if (o.status !== 'disputed') return err('该订单不在争议状态');
      if (body.result === 'refund') {
        const ent = userById(o.entId); if (ent && o.escrow > 0) ent.balance = Number((ent.balance + o.escrow).toFixed(2));
        o.escrow = 0; o.status = 'refunded';
        notify(o.studentId, 'arbitrate', '仲裁结果：退款', '订单 #' + o.id + ' 经平台仲裁，任务款退回企业。', o.id);
        notify(o.entId, 'arbitrate', '仲裁结果：退款', '订单 #' + o.id + ' 已退款。', o.id);
      } else {
        const stu = userById(o.studentId); if (stu) stu.balance = Number((stu.balance + o.netPay).toFixed(2));
        o.escrow = 0; o.status = 'settled'; o.settledAt = Date.now();
        notify(o.studentId, 'arbitrate', '仲裁结果：结算', '订单 #' + o.id + ' 仲裁后 ' + o.netPay.toFixed(2) + ' 元到账。', o.id);
        notify(o.entId, 'arbitrate', '仲裁结果：付款', '订单 #' + o.id + ' 已向学生付款。', o.id);
      }
      save(); return ok({ order: orderView(o), message: '仲裁完成' });
    }
    if (method === 'POST' && path === '/api/wallet/withdraw') {
      const e = need(['student']); if (e) return e;
      const amount = Number(body.amount);
      if (!(amount > 0)) return err('提现金额必须大于 0');
      if (amount > u.balance) return err('余额不足');
      u.balance = Number((u.balance - amount).toFixed(2));
      const w = { id: nextId('withdrawals'), userId: u.id, amount, status: 'processing', createdAt: Date.now() };
      db.withdrawals.push(w); save();
      return ok({ withdrawal: w, message: '提现申请已提交（演示）' });
    }
    if (method === 'POST' && path === '/api/wallet/recharge') {
      const e = need(['enterprise']); if (e) return e;
      const amount = Number(body.amount);
      if (!(amount > 0) || amount > 100000) return err('充值金额需在 1—100000 元之间（演示）');
      u.balance = Number((u.balance + amount).toFixed(2)); save();
      return ok({ balance: u.balance, message: '演示充值成功，当前余额 ' + u.balance.toFixed(2) + ' 元' });
    }
    if (method === 'GET' && path === '/api/admin/overview') {
      const e = need(['admin']); if (e) return e;
      const pendingUsers = db.users.filter((x) => x.role !== 'admin' && x.certStatus === 'pending');
      const pendingTasks = db.tasks.filter((t) => t.status === 'pending');
      const disputed = db.orders.filter((o) => o.status === 'disputed');
      const settled = db.orders.filter((o) => o.status === 'settled');
      const gmv = settled.reduce((s, o) => s + o.price, 0), fee = settled.reduce((s, o) => s + o.platformFee, 0);
      const byStatus = {}, byCategory = {};
      db.orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      db.tasks.forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + 1; });
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const st = new Date(); st.setHours(0, 0, 0, 0); st.setDate(st.getDate() - i);
        const en = st.getTime() + 24 * 3600 * 1000;
        days.push({ date: (st.getMonth() + 1) + '/' + st.getDate(), amount: Number(settled.filter((o) => o.settledAt >= st.getTime() && o.settledAt < en).reduce((s, o) => s + o.price, 0).toFixed(2)) });
      }
      return ok({
        stats: { users: db.users.filter((x) => x.role !== 'admin').length, students: db.users.filter((x) => x.role === 'student').length, enterprises: db.users.filter((x) => x.role === 'enterprise').length, tasks: db.tasks.length, openTasks: db.tasks.filter((t) => t.status === 'open').length, orders: db.orders.length, settledOrders: settled.length, gmv: Number(gmv.toFixed(2)), platformFee: Number(fee.toFixed(2)), pendingTasks: pendingTasks.length, pendingUsers: pendingUsers.length, disputes: disputed.length, contacts: 0, geoTasks: db.tasks.filter((t) => t.lat).length },
        charts: { byStatus, byCategory, days },
        pendingUsers: pendingUsers.map(pub),
        pendingTasks: pendingTasks.map((t) => Object.assign({}, t, { enterpriseName: (userById(t.entId) || {}).name || '' })),
        disputes: disputed.map(orderView),
        recentOrders: db.orders.slice(-8).reverse().map(orderView)
      });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/users\/(\d+)\/(verify|reject)$/))) {
      const e = need(['admin']); if (e) return e;
      const target = userById(m[1]); if (!target) return err('用户不存在', 404);
      if (m[2] === 'verify') { target.verified = true; target.certStatus = 'approved'; notify(target.id, 'cert_ok', '认证已通过', '你的认证已通过。'); }
      else { target.verified = false; target.certStatus = 'rejected'; target.certNote = body.reason || '资料不完整'; notify(target.id, 'cert_reject', '认证被驳回', '原因：' + target.certNote); }
      save(); return ok({ user: pub(target), message: m[2] === 'verify' ? '已通过资质审核' : '已驳回认证' });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/tasks\/(\d+)\/(approve|reject)$/))) {
      const e = need(['admin']); if (e) return e;
      const t = taskById(m[1]); if (!t) return err('任务不存在', 404);
      if (m[2] === 'approve') { t.status = 'open'; notify(t.entId, 'task_ok', '任务审核通过', '「' + t.title + '」已上线。'); }
      else { t.status = 'rejected'; notify(t.entId, 'task_reject', '任务审核未通过', '「' + t.title + '」：' + (body.reason || '')); }
      save(); return ok({ task: t, message: m[2] === 'approve' ? '任务已通过审核并上线' : '任务已驳回' });
    }
    if (method === 'GET' && path === '/api/admin/orders') {
      const e = need(['admin']); if (e) return e;
      return ok({ orders: db.orders.slice().reverse().map(orderView) });
    }
    return err('接口不存在', 404);
  }

  load();
  const origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith('/api/')) return origFetch(input, init);
    const method = (init && init.method) || (input && input.method) || 'GET';
    const query = new URLSearchParams(url.indexOf('?') >= 0 ? url.slice(url.indexOf('?') + 1) : '');
    const path = url.split('?')[0];
    let body = {};
    if (init && init.body) { try { body = JSON.parse(init.body); } catch (e) {} }
    const headers = (init && init.headers) || {};
    const h = headers.Authorization || headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    let out;
    try { out = await handle(method, path, query, body, token); }
    catch (e) { out = { status: 500, data: { error: '演示脚本错误：' + e.message } }; }
    return new Response(JSON.stringify(out.data), { status: out.status, headers: { 'Content-Type': 'application/json' } });
  };
})();
