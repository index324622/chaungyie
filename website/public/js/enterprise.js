/* 企业端逻辑（v2：认证、附件验收、申诉、演示充值） */
const TABS = [
  { id: 'tasks', label: '任务管理' },
  { id: 'publish', label: '发布任务' },
  { id: 'orders', label: '订单验收' },
  { id: 'account', label: '账户与账单' }
];

const page = { user: null, publishMap: null, publishMarker: null };

(async function () {
  page.user = initPage({ role: 'enterprise', tabs: TABS, active: 'tasks', onTab: loadTab });
  if (!page.user) return;
  showCertBanner('cert-banner', page.user, (u) => { page.user = u; loadTasks(); });
  await loadTab('tasks');
  document.getElementById('publish-form').onsubmit = publish;
  document.getElementById('btn-recharge').onclick = recharge;
  const preset = document.getElementById('place-preset');
  if (preset) preset.onchange = () => {
    if (!preset.value) return;
    const parts = preset.value.split(',');
    const form = document.getElementById('publish-form');
    form.lat.value = parts[0];
    form.lng.value = parts[1];
    form.district.value = parts[2] || '';
    if (!form.address.value) form.address.value = parts[3] || '';
    movePublishMarker(Number(parts[0]), Number(parts[1]));
  };
})();

function loadTab(id) {
  if (id === 'tasks') loadTasks();
  if (id === 'publish') ensurePublishMap();
  if (id === 'orders') loadOrders();
  if (id === 'account') loadAccount();
}

/* ---------- 发布任务：真实地图选点 ---------- */
function ensurePublishMap() {
  if (page.publishMap || !window.L) {
    if (!window.L) {
      const hint = document.getElementById('publish-map-hint');
      if (hint) hint.textContent = '地图 CDN 未加载（离线环境），可改用上方「地图位置」下拉选择。';
    }
    return;
  }
  const el = document.getElementById('publish-map');
  if (!el) return;
  const form = document.getElementById('publish-form');
  const lat = Number(form.lat.value) || 28.1955;
  const lng = Number(form.lng.value) || 112.977;
  page.publishMap = L.map('publish-map').setView([lat, lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(page.publishMap);
  page.publishMap.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    form.lat.value = lat.toFixed(6);
    form.lng.value = lng.toFixed(6);
    movePublishMarker(lat, lng);
    const hint = document.getElementById('publish-map-hint');
    if (hint) hint.textContent = '已选取坐标：' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '，正在解析地址…';
    const addr = await reverseGeocode(lat, lng);
    if (addr) {
      form.address.value = addr;
      if (hint) hint.textContent = '已填入地址：' + addr;
    } else if (hint) {
      hint.textContent = '已选取坐标：' + lat.toFixed(5) + ', ' + lng.toFixed(5);
    }
  });
  if (form.lat.value && form.lng.value) movePublishMarker(lat, lng);
  setTimeout(() => page.publishMap.invalidateSize(), 120);
}

function movePublishMarker(lat, lng) {
  if (!page.publishMap || !window.L) return;
  if (page.publishMarker) page.publishMarker.setLatLng([lat, lng]);
  else page.publishMarker = L.marker([lat, lng]).addTo(page.publishMap).bindPopup('工作地点');
  page.publishMap.setView([lat, lng], 15);
}

async function reverseGeocode(lat, lng) {
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=zh-CN&zoom=18';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const d = await res.json();
    return d.display_name ? String(d.display_name).slice(0, 80) : '';
  } catch (e) { return ''; }
}

function stars(avg) {
  if (!avg) return '<span class="muted">暂无评价</span>';
  const full = Math.round(avg);
  return '<span class="stars rating">' + '★'.repeat(full) + '☆'.repeat(5 - full) + '</span> <span class="muted">' + avg + '</span>';
}

/* ---------- 任务管理 ---------- */
async function loadTasks() {
  const d = await api('/api/my/tasks');
  document.getElementById('my-task-empty').classList.toggle('hide', d.tasks.length > 0);
  const box = document.getElementById('my-task-list');
  box.innerHTML = d.tasks.map((t) => '<div class="item"><div class="grow">' +
    '<div class="name">' + t.title + ' ' + statusBadge(TASK_STATUS, t.status) + '</div>' +
    '<div class="sub">' + t.category + ' · ￥' + t.price + '/人 · ' + t.startDate + ' ' + t.startTime + ' · ' + t.address + '</div>' +
    '<div class="sub">已录用 ' + t.hiredCount + '/' + t.headcount + ' · 待处理报名 ' + t.applyCount + '</div>' +
    '</div><div class="row">' +
    (t.applyCount > 0 ? '<button class="btn sm orange" data-apps="' + t.id + '">处理报名（' + t.applyCount + '）</button>' : '') +
    '<button class="btn sm light" data-plain="' + t.id + '">任务详情</button>' +
    '</div></div>').join('');
  box.querySelectorAll('[data-apps]').forEach((b) => (b.onclick = () => showApplications(Number(b.getAttribute('data-apps')))));
  box.querySelectorAll('[data-plain]').forEach((b) => (b.onclick = () => showTask(Number(b.getAttribute('data-plain')))));
}

async function showTask(id) {
  const d = await api('/api/tasks/' + id);
  const t = d.task;
  const reviews = d.reviews || [];
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = '<div class="modal" style="max-width:560px;"><div class="m-head">' + t.title + '</div><div class="m-body">' +
    '<div class="row">' + statusBadge(TASK_STATUS, t.status) + '<span class="tag">' + t.category + '</span></div>' +
    '<div><b>报酬：</b>￥' + t.price + '/人　<b>人数：</b>' + t.headcount + ' 人　<b>已录用：</b>' + t.hiredCount + '</div>' +
    '<div><b>时间：</b>' + t.startDate + ' ~ ' + t.endDate + ' ' + t.startTime + '-' + t.endTime + '</div>' +
    '<div><b>地点：</b>' + t.address + (t.lat ? '　<a href="' + externalMapUrl(t.lat, t.lng, t.title) + '" target="_blank">高德地图 ↗</a>' : '') + '</div>' +
    '<div style="background:#f8fafd;border:1px solid #e4eaf2;border-radius:10px;padding:12px;">' + (t.desc || '暂无描述') + '</div>' +
    (reviews.length ? '<div class="muted">学生评价</div>' + reviews.map((r) => '<div class="notify-item"><div class="notify-title">' + '★'.repeat(r.score) + '</div><div class="notify-body">' + (r.content || '（未填写评价内容）') + '</div></div>').join('') : '') +
    '</div><div class="m-foot"><button class="btn light" data-act="close">关闭</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-act="close"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function showApplications(taskId) {
  const d = await api('/api/tasks/' + taskId);
  const apps = d.applications || [];
  const rows = apps.map((a) => '<div class="item" style="padding:10px 12px;"><div class="grow">' +
    '<div class="name">' + a.studentName + ' ' + statusBadge(APP_STATUS, a.status) + '</div>' +
    '<div class="sub">' + (a.school || '') + ' · 信用分 ' + (a.credit || '-') + ' · ' + (a.verified ? '已认证' : '未认证') + '</div></div>' +
    (a.status === 'applied' ? '<div class="row"><button class="btn sm primary" data-hire="' + a.id + '">录用</button><button class="btn sm light" data-reject="' + a.id + '">不录用</button></div>' : '') +
    '</div>').join('');
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = '<div class="modal" style="max-width:560px;"><div class="m-head">报名处理 · ' + d.task.title + '</div><div class="m-body">' +
    (rows || '<div class="empty">暂无报名</div>') + '</div><div class="m-foot"><button class="btn light" data-act="close">关闭</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-act="close"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = async () => {
    try {
      const r = await api('/api/applications/' + b.getAttribute('data-hire') + '/hire', { method: 'POST' });
      toast(r.message, 'ok'); modal.remove(); loadTasks(); refreshUser();
    } catch (e) { toast(e.message, 'err'); }
  }));
  modal.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = async () => {
    try {
      await api('/api/applications/' + b.getAttribute('data-reject') + '/reject', { method: 'POST' });
      toast('已标记为不录用', 'ok'); modal.remove(); loadTasks();
    } catch (e) { toast(e.message, 'err'); }
  }));
}

/* ---------- 发布任务 ---------- */
async function publish(ev) {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const body = {};
  f.forEach((v, k) => (body[k] = v));
  try {
    const r = await api('/api/tasks', { method: 'POST', body });
    toast(r.message || '已提交审核', 'ok');
    ev.target.reset();
    document.querySelector('[data-tab="tasks"]').click();
    refreshUser();
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ---------- 订单验收 ---------- */
async function loadOrders() {
  const d = await api('/api/my/orders');
  document.getElementById('order-empty').classList.toggle('hide', d.orders.length > 0);
  const box = document.getElementById('order-list');
  box.innerHTML = d.orders.map((o) => {
    let actions = '';
    if (o.status === 'delivered') {
      actions = '<button class="btn sm green" data-accept="' + o.id + '">验收通过</button><button class="btn sm light" data-reject="' + o.id + '">驳回整改</button><button class="btn sm light" data-complaint="' + o.id + '">申诉</button>';
    } else if (o.status === 'settled') {
      actions = '<span class="badge green">已结算</span>';
    } else if (o.status === 'disputed') {
      actions = '<span class="badge red">平台仲裁中</span>';
    } else if (o.status === 'refunded') {
      actions = '<span class="badge gray">已退款</span>';
    } else if (o.status === 'hired' || o.status === 'checked_in') {
      actions = '<span class="muted">履约中</span>';
    }
    const photo = o.checkinPhoto ? '<div class="attachments"><a href="' + o.checkinPhoto.url + '" target="_blank" title="打卡照片"><img src="' + o.checkinPhoto.url + '" alt="打卡照片"></a></div>' : '';
    const files = (o.deliverFiles || []).length ? '<div class="attachments">' + o.deliverFiles.map((f) => '<a href="' + f.url + '" target="_blank" title="' + f.name + '"><img src="' + f.url + '" alt="成果附件"></a>').join('') + '</div>' : '';
    return '<div class="item"><div class="grow"><div class="name">' + o.taskTitle + ' ' + statusBadge(ORDER_STATUS, o.status) + '</div>' +
      '<div class="sub">学生：' + o.studentName + ' · 订单 #' + o.id + ' · ' + fmtDate(o.createdAt) + '</div>' +
      (o.deliverNote ? '<div class="sub">成果说明：' + o.deliverNote + '</div>' : '') +
      (o.checkinDistance != null ? '<div class="sub">打卡定位：距任务地点 ' + fmtDistance(o.checkinDistance) + (o.checkinAbnormal ? ' ' + badge('定位异常', 'red') : ' ' + badge('定位正常', 'green')) + '</div>' : '') +
      (o.complaint ? '<div class="sub" style="color:#b3261e;">申诉：' + o.complaint.reason + '</div>' : '') + photo + files +
      '</div><div style="text-align:right;"><div class="price">￥' + fmtMoney(o.price) + '</div><div class="sub">平台服务费 ￥' + fmtMoney(o.platformFee) + '</div></div>' +
      '<div class="row">' + actions + '</div></div>';
  }).join('');
  box.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = () => accept(Number(b.getAttribute('data-accept')))));
  box.querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => reject(Number(b.getAttribute('data-reject')))));
  box.querySelectorAll('[data-complaint]').forEach((b) => (b.onclick = () => complaint(Number(b.getAttribute('data-complaint')))));
}

async function accept(id) {
  if (!await confirmBox('确认验收', '验收通过后将立即按 9:1 分账给学生，任务款不会退回企业账户。')) return;
  try {
    const r = await api('/api/orders/' + id + '/accept', { method: 'POST' });
    toast(r.message, 'ok'); loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function reject(id) {
  const d = await openModal('驳回整改', [{ name: 'reason', label: '驳回原因', type: 'textarea', value: '成果不符合验收标准，请补充完善', required: true }]);
  if (!d) return;
  try {
    const r = await api('/api/orders/' + id + '/reject', { method: 'POST', body: { reason: d.reason } });
    toast(r.message, 'ok'); loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function complaint(id) {
  const d = await openModal('发起申诉', [{ name: 'reason', label: '申诉理由', type: 'textarea', placeholder: '例如：交付成果与要求不符，申请部分结算或退款', required: true }], { submitText: '提交申诉' });
  if (!d) return;
  try {
    const r = await api('/api/orders/' + id + '/complaint', { method: 'POST', body: { reason: d.reason } });
    toast(r.message, 'ok'); loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 账户 ---------- */
async function loadAccount() {
  const [me, tasks, orders] = await Promise.all([api('/api/me'), api('/api/my/tasks'), api('/api/my/orders')]);
  const u = me.user;
  document.getElementById('acc-balance').textContent = fmtMoney(u.balance);
  document.getElementById('acc-tasks').textContent = tasks.tasks.length;
  document.getElementById('acc-open').textContent = tasks.tasks.filter((t) => t.status === 'open').length;
  document.getElementById('acc-credit').textContent = u.credit || 600;
  const settled = orders.orders.filter((o) => o.status === 'settled');
  document.getElementById('bill-empty').classList.toggle('hide', settled.length > 0);
  document.getElementById('bill-body').innerHTML = settled.map((o) =>
    '<tr><td>#' + o.id + ' ' + o.taskTitle + '</td><td>' + o.studentName + '</td><td>' + fmtDate(o.settledAt) + '</td><td>￥' + fmtMoney(o.price) + '</td><td>￥' + fmtMoney(o.platformFee) + '</td><td>￥' + fmtMoney(o.price) + '</td></tr>'
  ).join('');
}

async function recharge() {
  const d = await openModal('演示充值', [{ name: 'amount', label: '充值金额（元）', type: 'number', value: '1000', required: true }], { submitText: '确认充值' });
  if (!d) return;
  try {
    const r = await api('/api/wallet/recharge', { method: 'POST', body: { amount: Number(d.amount) } });
    toast(r.message, 'ok');
    loadAccount();
    refreshUser();
  } catch (e) { toast(e.message, 'err'); }
}
