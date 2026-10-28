/* 学生端逻辑（v4：真实地图 Leaflet + OSM，GPS 当前位置，距离筛选，定位打卡，隐私号联系） */
const TABS = [
  { id: 'tasks', label: '任务大厅' },
  { id: 'applications', label: '我的报名' },
  { id: 'orders', label: '我的订单' },
  { id: 'wallet', label: '我的钱包' }
];
const CAT_COLORS = { '门店兼职': '#2e75b6', '校园推广': '#548235', '展会协助': '#c55a11', '问卷调研': '#7030a0', '数据标注': '#3aa6a6', '跑腿配送': '#e6a23c' };
const DEFAULT_CENTER = { lat: 28.1955, lng: 112.977, label: '默认位置：长沙五一广场' };
const MAP_BOUNDS = { latMin: 28.13, latMax: 28.255, lngMin: 112.905, lngMax: 113.1 };

const page = {
  user: null, tasks: [], view: 'list',
  userLoc: null, locLabel: '', accuracy: null,
  map: null, markerLayer: null, userMarker: null, radiusCircle: null,
  pickMode: false, leafletReady: false
};

(async function () {
  page.user = initPage({ role: 'student', tabs: TABS, active: 'tasks', onTab: (id) => loadTab(id) });
  if (!page.user) return;
  showCertBanner('cert-banner', page.user, (u) => { page.user = u; loadTasks(); });

  // 优先使用上次保存的位置；没有则尝试浏览器定位；失败用默认中心
  const saved = readSavedLoc();
  if (saved) { page.userLoc = { lat: saved.lat, lng: saved.lng }; page.locLabel = saved.label || ''; updateLocHint(); }
  await loadTasks();
  bindControls();
  if (!saved) autoLocate();
})();

function readSavedLoc() {
  try {
    const v = JSON.parse(localStorage.getItem('jb_myloc') || 'null');
    if (v && typeof v.lat === 'number' && typeof v.lng === 'number') return v;
  } catch (e) {}
  return null;
}
function saveLoc(lat, lng, label) {
  localStorage.setItem('jb_myloc', JSON.stringify({ lat, lng, label: label || '' }));
}
function bindControls() {
  document.getElementById('btn-search').onclick = loadTasks;
  document.getElementById('filter-sort').onchange = loadTasks;
  document.getElementById('filter-keyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadTasks(); });
  document.getElementById('filter-category').onchange = loadTasks;
  document.getElementById('btn-withdraw').onclick = withdraw;
  document.getElementById('btn-locate').onclick = () => locateMe(true);
  document.getElementById('btn-pickloc').onclick = enterPickMode;
  document.getElementById('radius').onchange = loadTasks;
  document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(b.getAttribute('data-view'))));
}

async function autoLocate() {
  const loc = await getUserLocation(8000);
  if (!loc) { page.locLabel = ''; updateLocHint(); if (page.view === 'map') renderMap(); return; }
  page.userLoc = { lat: loc.lat, lng: loc.lng };
  page.accuracy = loc.accuracy;
  updateLocHint();
  const label = await reverseGeocode(loc.lat, loc.lng);
  if (label) { page.locLabel = label; saveLoc(loc.lat, loc.lng, label); }
  else saveLoc(loc.lat, loc.lng, '');
  updateLocHint();
  await loadTasks();
  if (page.view === 'map') renderMap();
}

async function locateMe(verbose) {
  if (verbose) toast('正在获取我的位置…');
  const loc = await getUserLocation(10000);
  if (!loc) { toast('未获取到定位权限或超时，可改用「在地图上选位置」', 'err'); return; }
  page.userLoc = { lat: loc.lat, lng: loc.lng };
  page.accuracy = loc.accuracy;
  updateLocHint();
  const label = await reverseGeocode(loc.lat, loc.lng);
  page.locLabel = label || '';
  saveLoc(loc.lat, loc.lng, page.locLabel);
  updateLocHint();
  await loadTasks();
  if (page.view === 'map') renderMap();
  if (verbose) toast(page.locLabel ? '已定位：' + page.locLabel : '已使用当前定位', 'ok');
}

async function reverseGeocode(lat, lng) {
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&accept-language=zh-CN&zoom=16';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const d = await res.json();
    return d.display_name ? String(d.display_name).slice(0, 80) : '';
  } catch (e) {
    return '';
  }
}

function updateLocHint() {
  const hint = document.getElementById('loc-hint');
  if (!hint) return;
  if (page.userLoc) hint.textContent = '我的位置：' + (page.locLabel || (page.userLoc.lat.toFixed(4) + ', ' + page.userLoc.lng.toFixed(4)));
  else hint.textContent = '未定位，地图默认显示长沙五一广场；可点「使用我的位置」';
}

function enterPickMode() {
  if (page.view !== 'map') setView('map');
  page.pickMode = true;
  toast('请在地图上点击你的位置');
  if (page.map) ensureMap();
}

function setView(v) {
  page.view = v;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === v));
  document.getElementById('task-list').classList.toggle('hide', v !== 'list');
  document.getElementById('task-map').classList.toggle('hide', v !== 'map');
  if (v === 'map') {
    ensureMap();
    renderMap();
    setTimeout(() => { if (page.map) page.map.invalidateSize(); }, 120);
  }
}

function distanceOf(t) {
  if (!page.userLoc || !t.lat || !t.lng) return null;
  return havMeters(page.userLoc.lat, page.userLoc.lng, t.lat, t.lng);
}

function loadTab(id) {
  if (id === 'tasks') loadTasks();
  if (id === 'applications') loadApplications();
  if (id === 'orders') loadOrders();
  if (id === 'wallet') loadWallet();
}

function stars(avg) {
  if (!avg) return '<span class="muted">暂无评价</span>';
  const full = Math.round(avg);
  return '<span class="stars rating">' + '★'.repeat(full) + '☆'.repeat(5 - full) + '</span> <span class="muted">' + avg + '</span>';
}

/* ---------- 任务大厅 ---------- */
async function loadTasks() {
  const q = new URLSearchParams();
  const cat = document.getElementById('filter-category').value;
  const kw = document.getElementById('filter-keyword').value.trim();
  const sort = document.getElementById('filter-sort').value;
  if (cat && cat !== '全部') q.set('category', cat);
  if (kw) q.set('keyword', kw);
  q.set('sort', sort === 'dist' ? 'new' : sort);
  const d = await api('/api/tasks?' + q.toString());
  page.tasks = d.tasks.map((t) => Object.assign({}, t, { distance: distanceOf(t) }));
  const radius = Number(document.getElementById('radius').value || 0);
  if (radius > 0 && page.userLoc) {
    page.tasks = page.tasks.filter((t) => t.distance == null ? false : t.distance <= radius);
  }
  if (sort === 'dist') page.tasks.sort((a, b) => (a.distance == null ? 1e9 : a.distance) - (b.distance == null ? 1e9 : b.distance));
  document.getElementById('task-count').textContent = '共 ' + page.tasks.length + ' 个在招任务' + (sort === 'dist' ? ' · 按距离排序' : '') + (radius > 0 ? ' · ' + (radius / 1000) + ' 公里内' : '');
  renderList();
  if (page.view === 'map') renderMap();
}

function renderList() {
  const box = document.getElementById('task-list');
  if (!page.tasks.length) { box.innerHTML = '<div class="empty">没有符合条件的任务，试试放大距离或切换类目</div>'; return; }
  box.innerHTML = page.tasks.map((t) => {
    const pct = Math.min(100, Math.round((t.hiredCount / t.headcount) * 100));
    const full = t.hiredCount >= t.headcount;
    const dist = t.distance != null ? '<span class="badge gray">距我 ' + fmtDistance(t.distance) + '</span>' : '<span class="muted">线上任务</span>';
    return '<div class="card">' +
      '<div class="row"><span class="tag">' + t.category + '</span>' + dist + '<span class="muted" style="margin-left:auto;">' + t.settleType + '</span></div>' +
      '<div class="title">' + t.title + '</div>' +
      '<div class="price">￥' + t.price + '<small> / ' + (t.settleType === '按件结' ? '件' : '人') + '</small></div>' +
      '<div class="line"><span>' + t.startDate + ' ' + t.startTime + ' - ' + t.endTime + '</span><span>' + t.address + '</span></div>' +
      '<div class="line"><span>已录用 ' + t.hiredCount + '/' + t.headcount + '</span><span>' + t.enterpriseName + ' ' + stars(t.rating && t.rating.avg) + '</span></div>' +
      '<div style="background:#eef3fa;border-radius:999px;height:6px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#2e75b6,#7ec8ff);"></div></div>' +
      '<div class="actions">' +
      '<button class="btn sm light" data-detail="' + t.id + '">查看详情</button>' +
      (t.lat ? '<a class="btn sm light" target="_blank" href="' + externalMapUrl(t.lat, t.lng, t.title) + '">导航</a>' : '') +
      '<button class="btn sm ' + (t.applied || full ? '' : 'primary') + '" data-apply="' + t.id + '" ' + (t.applied || full ? 'disabled' : '') + '>' + (t.applied ? '已报名' : full ? '已满员' : '立即报名') + '</button>' +
      '</div></div>';
  }).join('');
  box.querySelectorAll('[data-detail]').forEach((b) => (b.onclick = () => showTask(Number(b.getAttribute('data-detail')))));
  box.querySelectorAll('[data-apply]').forEach((b) => (b.onclick = () => applyTask(Number(b.getAttribute('data-apply')))));
}

/* ---------- 真实地图（Leaflet + OpenStreetMap） ---------- */
function ensureMap() {
  if (page.leafletReady) return true;
  if (!window.L) { page.leafletReady = false; return false; }
  const el = document.getElementById('leaflet-map');
  el.style.display = 'block';
  document.getElementById('map-svg').style.display = 'none';
  const center = page.userLoc ? [page.userLoc.lat, page.userLoc.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  page.map = L.map('leaflet-map', { zoomControl: true, scrollWheelZoom: true }).setView(center, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(page.map);
  page.markerLayer = L.layerGroup().addTo(page.map);
  page.map.on('click', async (e) => {
    if (!page.pickMode) return;
    page.pickMode = false;
    page.userLoc = { lat: e.latlng.lat, lng: e.latlng.lng };
    page.accuracy = null;
    updateLocHint();
    const label = await reverseGeocode(e.latlng.lat, e.latlng.lng);
    page.locLabel = label || '';
    saveLoc(e.latlng.lat, e.latlng.lng, page.locLabel);
    updateLocHint();
    await loadTasks();
    renderMap();
    toast(page.locLabel ? '已设置位置：' + page.locLabel : '已设置位置', 'ok');
  });
  page.leafletReady = true;
  return true;
}

function renderMap() {
  if (!ensureMap()) { renderMapSVG(); return; }
  const map = page.map;
  page.markerLayer.clearLayers();
  if (page.userMarker) { map.removeLayer(page.userMarker); page.userMarker = null; }
  if (page.radiusCircle) { map.removeLayer(page.radiusCircle); page.radiusCircle = null; }

  const userLatLng = page.userLoc ? [page.userLoc.lat, page.userLoc.lng] : null;
  if (userLatLng) {
    page.userMarker = L.circleMarker(userLatLng, { radius: 9, color: '#fff', weight: 2, fillColor: '#2e75b6', fillOpacity: 1 })
      .addTo(map).bindPopup('<b>我的位置</b><br>' + (page.locLabel || (page.userLoc.lat.toFixed(5) + ', ' + page.userLoc.lng.toFixed(5))));
    const radius = Number(document.getElementById('radius').value || 0);
    if (radius > 0) {
      page.radiusCircle = L.circle(userLatLng, { radius, color: '#2e75b6', weight: 1, fillOpacity: 0.06 }).addTo(map);
    }
  }

  const pts = [];
  page.tasks.filter((t) => t.lat && t.lng).forEach((t) => {
    const color = CAT_COLORS[t.category] || '#1f4e79';
    const dist = t.distance != null ? ' · 距我 ' + fmtDistance(t.distance) : '';
    const html = '<div class="map-pop"><div class="map-pop-title">' + t.title + '</div>' +
      '<div class="muted">￥' + t.price + ' · ' + t.category + dist + '</div>' +
      '<div class="muted">' + t.address + '</div>' +
      '<div class="row" style="margin-top:6px;"><button class="btn sm primary" onclick="window.__jbOpenTask(' + t.id + ')">查看并报名</button>' +
      '<a class="btn sm light" target="_blank" href="' + externalMapUrl(t.lat, t.lng, t.title) + '">导航</a></div></div>';
    const label = '￥' + t.price;
    const icon = L.divIcon({
      className: 'price-pin-wrap',
      html: '<div class="price-pin" style="background:' + color + '">' + label + '<i style="border-top-color:' + color + '"></i></div>',
      iconSize: [64, 30], iconAnchor: [32, 30], popupAnchor: [0, -28]
    });
    const m = L.marker([t.lat, t.lng], { icon }).addTo(map).bindPopup(html, { minWidth: 220 });
    page.markerLayer.addLayer(m);
    pts.push([t.lat, t.lng]);
  });

  if (pts.length) {
    const bounds = L.latLngBounds(pts);
    if (userLatLng) bounds.extend(userLatLng);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  } else if (userLatLng) {
    map.setView(userLatLng, 14);
  } else {
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14);
  }
  document.getElementById('map-legend').innerHTML = '<span class="muted">地图数据 © OpenStreetMap 贡献者 · 点击标记查看任务，点「使用我的位置」定位</span>';
}

/* SVG 兜底（Leaflet CDN 加载失败时） */
function project(lat, lng) {
  const x = 30 + ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * 840;
  const y = 30 + ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * 500;
  return { x, y };
}
const LANDMARKS = [
  { name: '五一广场', lat: 28.1955, lng: 112.977 },
  { name: '湖南大学', lat: 28.18, lng: 112.94 },
  { name: '中南大学', lat: 28.15, lng: 112.93 },
  { name: '湖南师范大学', lat: 28.19, lng: 112.95 },
  { name: '湖南国际会展中心', lat: 28.232, lng: 113.083 }
];
function renderMapSVG() {
  const svg = document.getElementById('map-svg');
  svg.style.display = 'block';
  const geo = page.tasks.filter((t) => t.lat && t.lng);
  const parts = [];
  parts.push('<rect x="0" y="0" width="900" height="560" fill="#f2f7fc"/>');
  for (let x = 60; x < 900; x += 60) parts.push('<line x1="' + x + '" y1="0" x2="' + x + '" y2="560" stroke="#e3edf7" stroke-width="1"/>');
  for (let y = 60; y < 560; y += 60) parts.push('<line x1="0" y1="' + y + '" x2="900" y2="' + y + '" stroke="#e3edf7" stroke-width="1"/>');
  parts.push('<path d="M300 0 C 260 120, 330 220, 290 330 C 255 430, 300 500, 280 560" fill="none" stroke="#b9d7f2" stroke-width="26" opacity="0.75"/>');
  LANDMARKS.forEach((l) => {
    const p = project(l.lat, l.lng);
    parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#9aa7b5"/>');
    parts.push('<text x="' + (p.x + 8) + '" y="' + (p.y + 4) + '" font-size="12" fill="#6b7280">' + l.name + '</text>');
  });
  if (page.userLoc) {
    const u = project(page.userLoc.lat, page.userLoc.lng);
    parts.push('<circle cx="' + u.x + '" cy="' + u.y + '" r="16" fill="#2e75b6" opacity="0.18"/>');
    parts.push('<circle cx="' + u.x + '" cy="' + u.y + '" r="6" fill="#2e75b6" stroke="#fff" stroke-width="2"/>');
    parts.push('<text x="' + (u.x + 12) + '" y="' + (u.y - 10) + '" font-size="12" fill="#1f4e79">我的位置</text>');
  }
  geo.forEach((t) => {
    const p = project(t.lat, t.lng);
    const color = CAT_COLORS[t.category] || '#1f4e79';
    const d = t.distance != null ? fmtDistance(t.distance) : '';
    parts.push('<g class="map-marker" style="cursor:pointer" onclick="window.__jbOpenTask(' + t.id + ')">' +
      '<circle cx="' + p.x + '" cy="' + p.y + '" r="15" fill="' + color + '" opacity="0.18"/>' +
      '<circle cx="' + p.x + '" cy="' + p.y + '" r="8" fill="' + color + '" stroke="#fff" stroke-width="2"/>' +
      '<text x="' + p.x + '" y="' + (p.y - 16) + '" font-size="12" font-weight="700" fill="#16375c" text-anchor="middle">￥' + t.price + '</text>' +
      (d ? '<text x="' + p.x + '" y="' + (p.y + 26) + '" font-size="10" fill="#6b7280" text-anchor="middle">' + d + '</text>' : '') +
      '</g>');
  });
  if (!geo.length) parts.push('<text x="450" y="300" font-size="14" fill="#6b7280" text-anchor="middle">暂无带位置的在招任务</text>');
  svg.innerHTML = parts.join('');
  document.getElementById('map-legend').innerHTML = '<span class="muted">地图 CDN 未加载，当前为示意图；联网后自动切换真实地图</span>' +
    Object.keys(CAT_COLORS).map((c) => '<span><i style="background:' + CAT_COLORS[c] + '"></i>' + c + '</span>').join('');
}

window.__jbOpenTask = function (id) {
  showTask(id);
};

/* ---------- 任务详情与联系 ---------- */
async function showTask(id) {
  const d = await api('/api/tasks/' + id);
  const t = d.task;
  const reviews = d.reviews || [];
  const dist = t.lat && t.lng && page.userLoc ? fmtDistance(havMeters(page.userLoc.lat, page.userLoc.lng, t.lat, t.lng)) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-mask';
  modal.innerHTML = '<div class="modal" style="max-width:560px;"><div class="m-head">' + t.title + '</div><div class="m-body">' +
    '<div class="row">' + statusBadge(TASK_STATUS, t.status) + '<span class="tag">' + t.category + '</span><span class="tag">' + t.city + '</span>' +
    (dist ? '<span class="badge gray">距我 ' + dist + '</span>' : '') + '</div>' +
    '<div><b>报酬：</b>￥' + t.price + ' / ' + (t.settleType === '按件结' ? '件' : '人') + '　<b>结算：</b>' + t.settleType + '</div>' +
    '<div><b>时间：</b>' + t.startDate + ' ~ ' + t.endDate + '　' + t.startTime + '-' + t.endTime + '</div>' +
    '<div><b>地点：</b>' + t.address + '　' + (t.lat ? '<a href="' + externalMapUrl(t.lat, t.lng, t.title) + '" target="_blank">高德地图 ↗</a>' : '') + '</div>' +
    '<div><b>已录用：</b>' + t.hiredCount + '/' + t.headcount + ' 人</div>' +
    '<div><b>发布企业：</b>' + t.enterpriseName + '　' + stars(t.rating && t.rating.avg) + '</div>' +
    '<div style="background:#f8fafd;border:1px solid #e4eaf2;border-radius:10px;padding:12px;">' + (t.desc || '暂无描述') + '</div>' +
    (reviews.length ? '<div class="muted">最近评价</div>' + reviews.map((r) => '<div class="notify-item"><div class="notify-title">' + '★'.repeat(r.score) + '</div><div class="notify-body">' + (r.content || '（未填写评价内容）') + '</div></div>').join('') : '') +
    '</div><div class="m-foot"><button class="btn light" data-act="close">关闭</button>' +
    '<button class="btn light" data-act="contact">联系企业</button>' +
    (!t.applied && t.status === 'open' && t.hiredCount < t.headcount ? '<button class="btn primary" data-act="apply">立即报名</button>' : '') +
    '</div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-act="close"]').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const applyBtn = modal.querySelector('[data-act="apply"]');
  if (applyBtn) applyBtn.onclick = () => { modal.remove(); applyTask(t.id); };
  modal.querySelector('[data-act="contact"]').onclick = () => { modal.remove(); contact(t.id); };
}

async function contact(taskId) {
  try {
    const d = await api('/api/tasks/' + taskId + '/contact', { method: 'POST' });
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    modal.innerHTML = '<div class="modal"><div class="m-head">联系企业 · 平台隐私号</div><div class="m-body">' +
      '<div class="call-card"><div class="muted">虚拟号码（拨打自动转接企业）</div><div class="call-number">' + d.virtual + '</div>' +
      '<a class="btn primary" href="tel:' + d.virtual.replace(/[^0-9]/g, '') + '">一键拨打</a></div>' +
      '<div class="sub">企业电话（脱敏）：' + d.phone + '</div>' +
      '<div class="sub">平台客服：<a href="tel:4008001234">' + d.hotline + '</a></div>' +
      '<div class="muted">' + d.note + '</div></div>' +
      '<div class="m-foot"><button class="btn light" data-act="close">关闭</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-act="close"]').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  } catch (e) { toast(e.message, 'err'); }
}

async function applyTask(id) {
  try {
    const r = await api('/api/tasks/' + id + '/apply', { method: 'POST' });
    toast(r.message || '报名成功', 'ok');
    loadTasks();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 我的报名 ---------- */
async function loadApplications() {
  const d = await api('/api/my/applications');
  const rows = d.applications;
  document.getElementById('app-empty').classList.toggle('hide', rows.length > 0);
  document.getElementById('app-body').innerHTML = rows.map((a) =>
    '<tr><td>' + a.taskTitle + '</td><td>' + a.category + '</td><td>￥' + a.price + '</td><td>' + fmtDate(a.createdAt) + '</td>' +
    '<td>' + statusBadge(APP_STATUS, a.status) + (a.orderStatus ? ' ' + statusBadge(ORDER_STATUS, a.orderStatus) : '') + '</td>' +
    '<td>' + (a.orderId ? '<button class="btn sm light" data-go>查看订单</button>' : '<span class="muted">等待企业处理</span>') + '</td></tr>'
  ).join('');
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => document.querySelector('[data-tab="orders"]').click()));
}

/* ---------- 我的订单 ---------- */
async function loadOrders() {
  const d = await api('/api/my/orders');
  const box = document.getElementById('order-list');
  document.getElementById('order-empty').classList.toggle('hide', d.orders.length > 0);
  box.innerHTML = d.orders.map((o) => {
    const actions = [];
    if (o.status === 'hired') actions.push('<button class="btn sm primary" data-checkin="' + o.id + '">打卡到岗</button>');
    if (o.status === 'checked_in') actions.push('<button class="btn sm orange" data-deliver="' + o.id + '">提交成果</button>');
    if (o.status === 'delivered') actions.push('<span class="muted">等待企业验收</span>', '<button class="btn sm light" data-complaint="' + o.id + '">发起申诉</button>');
    if (o.status === 'settled') actions.push('<span class="badge green">已到账 ￥' + fmtMoney(o.netPay) + '</span>', '<button class="btn sm light" data-review="' + o.id + '">评价</button>');
    if (o.status === 'disputed') actions.push('<span class="badge red">平台仲裁中</span>');
    if (o.status === 'refunded') actions.push('<span class="badge gray">已退款</span>');
    const photo = o.checkinPhoto ? '<div class="attachments"><a href="' + o.checkinPhoto.url + '" target="_blank"><img src="' + o.checkinPhoto.url + '" alt="打卡照片"></a></div>' : '';
    const files = (o.deliverFiles || []).length ? '<div class="attachments">' + o.deliverFiles.map((f) => '<a href="' + f.url + '" target="_blank" title="' + f.name + '"><img src="' + f.url + '" alt="成果附件"></a>').join('') + '</div>' : '';
    const loc = o.checkinDistance != null ? '<div class="sub">打卡定位：距任务地点 ' + fmtDistance(o.checkinDistance) + (o.checkinAbnormal ? ' ' + badge('定位异常', 'red') : ' ' + badge('定位正常', 'green')) + '</div>' : '';
    return '<div class="item"><div class="grow"><div class="name">' + o.taskTitle + ' ' + statusBadge(ORDER_STATUS, o.status) + '</div>' +
      '<div class="sub">订单号 #' + o.id + ' · ' + o.enterpriseName + ' · ' + o.address + ' · ' + fmtDate(o.createdAt) + '</div>' +
      (o.deliverNote ? '<div class="sub">成果说明：' + o.deliverNote + '</div>' : '') +
      (o.rejectReason ? '<div class="sub" style="color:#b3261e;">驳回原因：' + o.rejectReason + '</div>' : '') +
      (o.complaint ? '<div class="sub" style="color:#b3261e;">申诉：' + o.complaint.reason + '</div>' : '') + loc + photo + files +
      '</div><div style="text-align:right;"><div class="price">￥' + fmtMoney(o.price) + '</div><div class="sub">实得 ￥' + fmtMoney(o.netPay) + '</div></div>' +
      '<div class="row">' + actions.join('') + '</div></div>';
  }).join('');
  box.querySelectorAll('[data-checkin]').forEach((b) => (b.onclick = () => checkin(Number(b.getAttribute('data-checkin')))));
  box.querySelectorAll('[data-deliver]').forEach((b) => (b.onclick = () => deliver(Number(b.getAttribute('data-deliver')))));
  box.querySelectorAll('[data-complaint]').forEach((b) => (b.onclick = () => complaint(Number(b.getAttribute('data-complaint')))));
  box.querySelectorAll('[data-review]').forEach((b) => (b.onclick = () => review(Number(b.getAttribute('data-review')))));
}

async function checkin(id) {
  const loc = await getUserLocation(8000);
  if (!loc) {
    const go = await confirmBox('未获取到定位', '浏览器未授权定位，将仅用现场照片打卡（不校验距离）。是否继续？');
    if (!go) return;
  }
  const d = await openModal('打卡到岗', [
    { name: 'photo', label: '现场照片（可选，用于履约留痕）', type: 'file', full: true },
    { name: 'loc', label: '打卡定位', type: 'text', value: loc ? ('已获取：' + loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) + (loc.accuracy ? '（精度约 ' + loc.accuracy + ' 米）' : '')) : '未获取（仅照片留痕）', full: true }
  ], { submitText: '确认打卡' });
  if (!d) return;
  try {
    const r = await api('/api/orders/' + id + '/checkin', { method: 'POST', body: { photoId: d.photo ? d.photo.id : null, lat: loc ? loc.lat : null, lng: loc ? loc.lng : null } });
    toast(r.message || '打卡成功', 'ok');
    loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function deliver(id) {
  const d = await openModal('提交成果', [
    { name: 'note', label: '成果说明', type: 'textarea', placeholder: '例如：已完成 20 份问卷，截图如下', required: true },
    { name: 'file1', label: '成果附件 1（可选）', type: 'file' },
    { name: 'file2', label: '成果附件 2（可选）', type: 'file' },
    { name: 'file3', label: '成果附件 3（可选）', type: 'file' }
  ], { submitText: '提交' });
  if (!d) return;
  const fileIds = ['file1', 'file2', 'file3'].map((k) => d[k] && d[k].id).filter(Boolean);
  try {
    const r = await api('/api/orders/' + id + '/deliver', { method: 'POST', body: { note: d.note, fileIds } });
    toast(r.message || '提交成功', 'ok');
    loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function complaint(id) {
  const d = await openModal('发起申诉', [
    { name: 'reason', label: '申诉理由', type: 'textarea', placeholder: '请描述问题，平台将在 48 小时内仲裁', required: true }
  ], { submitText: '提交申诉' });
  if (!d) return;
  try {
    const r = await api('/api/orders/' + id + '/complaint', { method: 'POST', body: { reason: d.reason } });
    toast(r.message, 'ok');
    loadOrders();
  } catch (e) { toast(e.message, 'err'); }
}

async function review(id) {
  const d = await openModal('评价订单', [
    { name: 'score', label: '评分', type: 'select', value: '5', options: [{ value: '5', label: '★★★★★ 5 分' }, { value: '4', label: '★★★★☆ 4 分' }, { value: '3', label: '★★★☆☆ 3 分' }, { value: '2', label: '★★☆☆☆ 2 分' }, { value: '1', label: '★☆☆☆☆ 1 分' }] },
    { name: 'content', label: '评价内容（可选）', type: 'textarea', placeholder: '说说这次兼职体验' }
  ], { submitText: '提交评价' });
  if (!d) return;
  try {
    const r = await api('/api/orders/' + id + '/review', { method: 'POST', body: { score: Number(d.score), content: d.content } });
    toast(r.message, 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- 钱包 ---------- */
async function loadWallet() {
  const [me, orders] = await Promise.all([api('/api/me'), api('/api/my/orders')]);
  const u = me.user;
  const settled = orders.orders.filter((o) => o.status === 'settled');
  document.getElementById('wallet-balance').textContent = fmtMoney(u.balance);
  document.getElementById('wallet-orders').textContent = settled.length;
  document.getElementById('wallet-income').textContent = fmtMoney(settled.reduce((s, o) => s + o.netPay, 0));
  document.getElementById('wallet-credit').textContent = u.credit;
  document.getElementById('wallet-empty').classList.toggle('hide', settled.length > 0);
  document.getElementById('wallet-body').innerHTML = settled.map((o) =>
    '<tr><td>' + o.taskTitle + '</td><td>' + fmtDate(o.settledAt) + '</td><td>￥' + fmtMoney(o.price) + '</td><td>￥' + fmtMoney(o.platformFee) + '</td><td><b>￥' + fmtMoney(o.netPay) + '</b></td></tr>'
  ).join('');
}

async function withdraw() {
  const input = document.getElementById('withdraw-amount');
  const amount = Number(input.value);
  if (!(amount > 0)) { toast('请输入正确的提现金额', 'err'); return; }
  try {
    const r = await api('/api/wallet/withdraw', { method: 'POST', body: { amount } });
    toast(r.message || '提现申请已提交', 'ok');
    input.value = '';
    loadWallet();
  } catch (e) { toast(e.message, 'err'); }
}
