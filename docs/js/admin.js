/* 运营后台逻辑（v2：图表、认证驳回、任务驳回、争议仲裁） */
const TABS = [
  { id: 'dashboard', label: '数据看板' },
  { id: 'verify', label: '资质审核' },
  { id: 'taskreview', label: '任务审核' },
  { id: 'disputes', label: '争议仲裁' },
  { id: 'orders', label: '订单与风控' }
];
const STATUS_COLOR = { hired: '#f0a04b', checked_in: '#2e75b6', delivered: '#c55a11', settled: '#2e7d32', disputed: '#b3261e', refunded: '#8a8f98', cancelled: '#6b7280' };
const PIE_COLORS = ['#2e75b6', '#548235', '#c55a11', '#7030a0', '#e6a23c', '#3aa6a6', '#8a8f98'];

(async function () {
  const user = initPage({ role: 'admin', tabs: TABS, active: 'dashboard', onTab: loadTab });
  if (!user) return;
  loadTab('dashboard');
})();

function loadTab(id) {
  if (id === 'dashboard') loadDashboard();
  if (id === 'verify') loadPendingUsers();
  if (id === 'taskreview') loadPendingTasks();
  if (id === 'disputes') loadDisputes();
  if (id === 'orders') loadAllOrders();
}

/* ---------- 简易 SVG 图表 ---------- */
function donutChart(el, items) {
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const R = 72, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = items.map((it, i) => {
    const len = (it.value / total) * C;
    const seg = '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + (it.color || PIE_COLORS[i % PIE_COLORS.length]) + '" stroke-width="26" ' +
      'stroke-dasharray="' + len.toFixed(1) + ' ' + (C - len).toFixed(1) + '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 90 90)"></circle>';
    offset += len;
    return seg;
  }).join('');
  const legend = items.map((it, i) => '<div class="row" style="gap:6px;margin:2px 0;"><span style="width:10px;height:10px;border-radius:3px;background:' + (it.color || PIE_COLORS[i % PIE_COLORS.length]) + ';display:inline-block;"></span><span class="muted">' + it.label + ' ' + it.value + '</span></div>').join('');
  el.innerHTML = '<div class="row" style="align-items:center;gap:18px;"><svg viewBox="0 0 180 180" style="width:180px;flex:none;">' + arcs +
    '<text x="90" y="86" text-anchor="middle" font-size="20" font-weight="700" fill="#1f4e79">' + total + '</text>' +
    '<text x="90" y="106" text-anchor="middle" font-size="11" fill="#6b7280">订单总数</text></svg><div>' + (legend || '<span class="muted">暂无数据</span>') + '</div></div>';
}

function barChart(el, items, color) {
  const W = 320, H = 180, padL = 38, padB = 26, padT = 12;
  const max = Math.max.apply(null, items.map((x) => x.value)) || 1;
  const bw = (W - padL - 10) / items.length;
  const bars = items.map((it, i) => {
    const h = Math.max(2, (it.value / max) * (H - padT - padB));
    const x = padL + i * bw + bw * 0.2;
    const y = H - padB - h;
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.6).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" fill="' + (color || '#2e75b6') + '"></rect>' +
      '<text x="' + (x + bw * 0.3).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#445">' + (it.value || '') + '</text>' +
      '<text x="' + (x + bw * 0.3).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#6b7280">' + it.label + '</text>';
  }).join('');
  const maxLabel = max > 1 ? String(max) : '1';
  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">' +
    '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - 6) + '" y2="' + (H - padB) + '" stroke="#e4eaf2"></line>' +
    '<text x="4" y="' + (padT + 6) + '" font-size="10" fill="#6b7280">' + maxLabel + '</text>' +
    bars + '</svg>';
}

/* ---------- 看板 ---------- */
async function loadDashboard() {
  const d = await api('/api/admin/overview');
  const s = d.stats;
  document.getElementById('stat-grid').innerHTML = [
    ['注册用户', s.users], ['学生', s.students], ['企业', s.enterprises],
    ['任务总数', s.tasks], ['在招任务', s.openTasks], ['待审核任务', s.pendingTasks],
    ['订单总数', s.orders], ['已结算订单', s.settledOrders],
    ['交易额 GMV（元）', fmtMoney(s.gmv), true], ['平台服务费（元）', fmtMoney(s.platformFee), true],
    ['待认证账号', s.pendingUsers], ['待仲裁争议', s.disputes],
    ['隐私号联系次数', s.contacts || 0], ['带定位任务', s.geoTasks || 0]
  ].map((x) => '<div class="stat"><div class="k">' + x[0] + '</div><div class="v' + (x[2] ? ' orange' : '') + '">' + x[1] + '</div></div>').join('');

  const st = d.charts.byStatus || {};
  const stMap = { hired: '待打卡', checked_in: '履约中', delivered: '待验收', settled: '已结算', disputed: '争议中', refunded: '已退款' };
  donutChart(document.getElementById('chart-status'), Object.keys(st).map((k) => ({ label: stMap[k] || k, value: st[k], color: STATUS_COLOR[k] })));

  barChart(document.getElementById('chart-gmv'), (d.charts.days || []).map((x) => ({ label: x.date, value: x.amount })), '#1f4e79');
  const cat = d.charts.byCategory || {};
  barChart(document.getElementById('chart-cat'), Object.keys(cat).map((k) => ({ label: k, value: cat[k] })), '#c55a11');

  document.getElementById('recent-empty').classList.toggle('hide', d.recentOrders.length > 0);
  document.getElementById('recent-body').innerHTML = d.recentOrders.map((o) =>
    '<tr><td>#' + o.id + '</td><td>' + o.taskTitle + '</td><td>' + o.studentName + '</td><td>' + o.enterpriseName + '</td><td>￥' + fmtMoney(o.price) + '</td><td>' + statusBadge(ORDER_STATUS, o.status) + '</td></tr>'
  ).join('');
}

/* ---------- 资质审核 ---------- */
async function loadPendingUsers() {
  const d = await api('/api/admin/overview');
  const list = d.pendingUsers;
  document.getElementById('users-empty').classList.toggle('hide', list.length > 0);
  const box = document.getElementById('pending-users');
  box.innerHTML = list.map((u) => '<div class="item"><div class="grow">' +
    '<div class="name">' + u.name + ' ' + badge(ROLE_NAME[u.role]) + '</div>' +
    '<div class="sub">' + (u.role === 'student'
      ? '学校：' + ((u.certInfo && u.certInfo.school) || '-') + ' · 学号：' + ((u.certInfo && u.certInfo.studentNo) || '-')
      : '企业：' + ((u.certInfo && u.certInfo.company) || '-') + ' · 信用代码：' + ((u.certInfo && u.certInfo.creditCode) || '-') + ' · 行业：' + ((u.certInfo && u.certInfo.industry) || '-')) +
    ' · 账号：' + u.username + '</div></div>' +
    '<div class="row"><button class="btn sm primary" data-verify="' + u.id + '">通过审核</button><button class="btn sm light" data-reject="' + u.id + '">驳回</button></div></div>').join('');
  box.querySelectorAll('[data-verify]').forEach((b) => (b.onclick = async () => {
    try {
      const r = await api('/api/admin/users/' + b.getAttribute('data-verify') + '/verify', { method: 'POST' });
      toast(r.message, 'ok'); loadPendingUsers(); loadDashboard();
    } catch (e) { toast(e.message, 'err'); }
  }));
  box.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => rejectUser(b.getAttribute('data-reject'))));
}

async function rejectUser(id) {
  const d = await openModal('驳回认证', [{ name: 'reason', label: '驳回原因', type: 'textarea', value: '资料不完整，请补充后重新提交', required: true }]);
  if (!d) return;
  try {
    const r = await api('/api/admin/users/' + id + '/reject', { method: 'POST', body: { reason: d.reason } });
    toast(r.message, 'ok'); loadPendingUsers();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 任务审核 ---------- */
async function loadPendingTasks() {
  const d = await api('/api/admin/overview');
  const list = d.pendingTasks;
  document.getElementById('tasks-empty').classList.toggle('hide', list.length > 0);
  const box = document.getElementById('pending-tasks');
  box.innerHTML = list.map((t) => '<div class="item"><div class="grow">' +
    '<div class="name">' + t.title + ' ' + badge(t.category) + '</div>' +
    '<div class="sub">企业：' + (t.enterpriseName || '-') + ' · ￥' + t.price + '/人 × ' + t.headcount + ' 人 ｜ ' + t.startDate + ' ' + t.startTime + '-' + t.endTime + '</div>' +
    '<div class="sub">' + (t.desc || '') + '</div></div>' +
    '<div class="row"><button class="btn sm green" data-approve="' + t.id + '">通过上线</button><button class="btn sm light" data-reject="' + t.id + '">驳回</button></div></div>').join('');
  box.querySelectorAll('[data-approve]').forEach((b) => (b.onclick = async () => {
    try {
      const r = await api('/api/admin/tasks/' + b.getAttribute('data-approve') + '/approve', { method: 'POST' });
      toast(r.message, 'ok'); loadPendingTasks(); loadDashboard();
    } catch (e) { toast(e.message, 'err'); }
  }));
  box.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => rejectTask(b.getAttribute('data-reject'))));
}

async function rejectTask(id) {
  const d = await openModal('驳回任务', [{ name: 'reason', label: '驳回原因', type: 'textarea', value: '任务描述不清晰或不符合平台发布规范', required: true }]);
  if (!d) return;
  try {
    const r = await api('/api/admin/tasks/' + id + '/reject', { method: 'POST', body: { reason: d.reason } });
    toast(r.message, 'ok'); loadPendingTasks();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 争议仲裁 ---------- */
async function loadDisputes() {
  const d = await api('/api/admin/overview');
  const list = d.disputes || [];
  document.getElementById('dispute-empty').classList.toggle('hide', list.length > 0);
  const box = document.getElementById('dispute-list');
  box.innerHTML = list.map((o) => {
    const files = (o.deliverFiles || []).length ? '<div class="attachments">' + o.deliverFiles.map((f) => '<a href="' + f.url + '" target="_blank"><img src="' + f.url + '" alt="成果"></a>').join('') + '</div>' : '';
    return '<div class="item"><div class="grow">' +
      '<div class="name">订单 #' + o.id + ' ' + o.taskTitle + ' ' + statusBadge(ORDER_STATUS, o.status) + '</div>' +
      '<div class="sub">学生：' + o.studentName + ' · 企业：' + o.enterpriseName + ' · 成交价 ￥' + fmtMoney(o.price) + '（托管中 ￥' + fmtMoney(o.escrow) + '）</div>' +
      '<div class="sub">学生成果说明：' + (o.deliverNote || '-') + '</div>' +
      '<div class="sub">打卡定位：' + (o.checkinDistance != null ? '距任务地点 ' + fmtDistance(o.checkinDistance) + (o.checkinAbnormal ? ' ' + badge('定位异常', 'red') : ' ' + badge('定位正常', 'green')) : '未获取定位') + '</div>' +
      '<div class="sub" style="color:#b3261e;">申诉方：' + (o.complaint && o.complaint.by === o.studentId ? '学生' : '企业') + ' · ' + ((o.complaint && o.complaint.reason) || '-') + '</div>' +
      files + '</div>' +
      '<div class="row"><button class="btn sm orange" data-refund="' + o.id + '">支持学生退款</button><button class="btn sm green" data-pay="' + o.id + '">支持企业结算</button></div></div>';
  }).join('');
  box.querySelectorAll('[data-refund]').forEach((b) => (b.onclick = () => arbitrate(Number(b.getAttribute('data-refund')), 'refund')));
  box.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => arbitrate(Number(b.getAttribute('data-pay')), 'pay')));
}

async function arbitrate(id, result) {
  const label = result === 'refund' ? '退款给企业（托管款原路退回）' : '按约结算给学生（9:1 分账）';
  const d = await openModal('仲裁裁决', [
    { name: 'note', label: '裁决说明（可选）', type: 'textarea', value: '经核对打卡记录与成果附件，' + (result === 'refund' ? '交付质量未达验收标准。' : '交付符合验收标准。') }
  ], { submitText: '确认裁决' });
  if (!d) return;
  if (!await confirmBox('确认裁决', '将执行：' + label)) return;
  try {
    const r = await api('/api/admin/orders/' + id + '/arbitrate', { method: 'POST', body: { result, note: d.note } });
    toast(r.message, 'ok'); loadDisputes(); loadDashboard();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 全部订单 ---------- */
async function loadAllOrders() {
  const d = await api('/api/admin/orders');
  document.getElementById('all-empty').classList.toggle('hide', d.orders.length > 0);
  document.getElementById('all-orders').innerHTML = d.orders.map((o) =>
    '<tr><td>#' + o.id + '</td><td>' + o.taskTitle + '</td><td>' + o.studentName + '</td><td>' + o.enterpriseName + '</td>' +
    '<td>￥' + fmtMoney(o.price) + '</td><td>￥' + fmtMoney(o.platformFee) + '</td>' +
    '<td>' + (o.checkinDistance != null ? fmtDistance(o.checkinDistance) + (o.checkinAbnormal ? ' ' + badge('异常', 'red') : '') : '<span class="muted">—</span>') + '</td>' +
    '<td>' + statusBadge(ORDER_STATUS, o.status) + '</td></tr>'
  ).join('');
}
