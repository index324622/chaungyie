/* 前端公共逻辑：鉴权、请求、上传、通知、弹窗、状态映射、页面骨架 */
const TOKEN_KEY = 'jb_token';
const USER_KEY = 'jb_user';

const ROLE_NAME = { student: '学生', enterprise: '企业', admin: '平台运营' };
const TASK_STATUS = { pending: ['待审核', 'orange'], open: ['招募中', 'green'], full: ['已满员', 'gray'], rejected: ['已驳回', 'red'], closed: ['已关闭', 'gray'] };
const APP_STATUS = { applied: ['待处理', 'orange'], hired: ['已录用', 'green'], rejected: ['未录用', 'gray'] };
const ORDER_STATUS = {
  hired: ['已录用 · 待打卡', 'orange'], checked_in: ['履约中', 'blue'], delivered: ['待验收', 'orange'],
  settled: ['已结算', 'green'], disputed: ['争议中', 'red'], refunded: ['已退款', 'gray'], cancelled: ['已取消', 'gray']
};

function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
function currentUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } }
function setAuth(t, u) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); }
function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token() ? { Authorization: 'Bearer ' + token() } : {}, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) {
    clearAuth();
    if (!location.pathname.endsWith('index.html') && location.pathname !== '/') location.href = 'index.html';
    throw new Error(data.error || '请先登录');
  }
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function fmtMoney(n) { return Number(n || 0).toFixed(2); }
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function badge(text, tone) { return '<span class="badge ' + (tone || '') + '">' + text + '</span>'; }
function statusBadge(map, key) {
  const v = map[key];
  return v ? badge(v[0], v[1]) : badge(key || '-', 'gray');
}

/* 图片选择 + 上传，返回 {id, url} 或 null */
function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      if (file.size > 3 * 1024 * 1024) { toast('图片不能超过 3MB', 'err'); return resolve(null); }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const d = await api('/api/upload', { method: 'POST', body: { name: file.name, data: reader.result } });
          resolve(d.file);
        } catch (e) { toast(e.message, 'err'); resolve(null); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

function toast(msg, type) {
  let wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, 2800);
}

/* 通用弹窗：fields = [{name,label,type,value,placeholder,options,required,full}] */
function openModal(title, fields, opts = {}) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const body = fields.map((f) => {
      if (f.type === 'file') {
        return '<div class="field ' + (f.full ? 'full' : '') + '"><label>' + f.label + '</label>' +
          '<div class="upload-box" id="upload-' + f.name + '"><span class="muted">点击选择图片（≤3MB，PNG/JPG/WebP）</span></div>' +
          '<input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" id="file-' + f.name + '"></div>';
      }
      if (f.type === 'select') {
        const options = (f.options || []).map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const label = typeof o === 'string' ? o : o.label;
          const sel = String(f.value) === String(val) ? ' selected' : '';
          return '<option value="' + val + '"' + sel + '>' + label + '</option>';
        }).join('');
        return '<div class="field ' + (f.full ? 'full' : '') + '"><label>' + f.label + '</label><select name="' + f.name + '">' + options + '</select></div>';
      }
      if (f.type === 'textarea') {
        return '<div class="field ' + (f.full ? 'full' : '') + '"><label>' + f.label + '</label><textarea name="' + f.name + '" placeholder="' + (f.placeholder || '') + '">' + (f.value || '') + '</textarea></div>';
      }
      return '<div class="field ' + (f.full ? 'full' : '') + '"><label>' + f.label + '</label><input name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + (f.value == null ? '' : f.value) + '" placeholder="' + (f.placeholder || '') + '"></div>';
    }).join('');
    mask.innerHTML = '<div class="modal"><div class="m-head">' + title + '</div><div class="m-body">' + body + '</div>' +
      '<div class="m-foot"><button class="btn light" data-act="cancel">取消</button><button class="btn primary" data-act="ok">' + (opts.submitText || '确定') + '</button></div></div>';
    document.body.appendChild(mask);
    const selected = {};
    const close = (val) => { mask.remove(); resolve(val); };
    mask.querySelector('[data-act="cancel"]').onclick = () => close(null);
    mask.onclick = (e) => { if (e.target === mask) close(null); };
    fields.filter((f) => f.type === 'file').forEach((f) => {
      const box = mask.querySelector('#upload-' + f.name);
      const input = mask.querySelector('#file-' + f.name);
      box.onclick = () => input.click();
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { toast('图片不能超过 3MB', 'err'); return; }
        box.innerHTML = '<span class="muted">上传中…</span>';
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const d = await api('/api/upload', { method: 'POST', body: { name: file.name, data: reader.result } });
            selected[f.name] = d.file;
            box.innerHTML = '<img src="' + d.file.url + '" style="height:64px;border-radius:8px;"><span class="muted" style="margin-left:8px;">已上传，点击可重选</span>';
          } catch (e) {
            toast(e.message, 'err');
            box.innerHTML = '<span class="muted">点击选择图片</span>';
          }
        };
        reader.readAsDataURL(file);
      };
    });
    mask.querySelector('[data-act="ok"]').onclick = () => {
      const data = {};
      fields.forEach((f) => {
        if (f.type === 'file') { data[f.name] = selected[f.name] || null; return; }
        const el = mask.querySelector('[name="' + f.name + '"]');
        data[f.name] = el ? el.value.trim() : '';
      });
      for (const f of fields) {
        if (f.required && !data[f.name]) { toast('请填写：' + f.label, 'err'); return; }
      }
      close(data);
    };
  });
}
function confirmBox(title, message) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal"><div class="m-head">' + title + '</div><div class="m-body"><div>' + message + '</div></div>' +
      '<div class="m-foot"><button class="btn light" data-act="cancel">取消</button><button class="btn orange" data-act="ok">确认</button></div></div>';
    document.body.appendChild(mask);
    const close = (v) => { mask.remove(); resolve(v); };
    mask.querySelector('[data-act="cancel"]').onclick = () => close(false);
    mask.querySelector('[data-act="ok"]').onclick = () => close(true);
    mask.onclick = (e) => { if (e.target === mask) close(false); };
  });
}

/* 认证提示条：未认证时显示，支持学生/企业自助提交 */
function showCertBanner(containerId, user, onDone) {
  const box = document.getElementById(containerId);
  if (!box) return;
  if (user && user.verified) { box.classList.add('hide'); return; }
  const pending = user && user.certStatus === 'pending';
  const rejected = user && user.certStatus === 'rejected';
  box.classList.remove('hide');
  box.innerHTML = '<div class="banner">' +
    '<div class="banner-text"><b>' + (pending ? '认证审核中' : rejected ? '认证被驳回' : '完成认证后才能' + (user && user.role === 'student' ? '报名任务' : '发布任务')) + '</b>' +
    '<span class="muted">' + (pending ? '平台会尽快审核，请耐心等待。' : rejected ? (user.certNote || '资料不完整，请补充后重新提交。') : (user && user.role === 'student' ? '需提交学校与学号，由平台人工核验。' : '需提交企业名称与统一社会信用代码。')) + '</span></div>' +
    (pending ? '' : '<button class="btn sm primary" id="cert-btn">' + (rejected ? '重新提交认证' : '去认证') + '</button>') +
    '</div>';
  const btn = document.getElementById('cert-btn');
  if (!btn) return;
  btn.onclick = async () => {
    let fields;
    if (user.role === 'student') {
      fields = [
        { name: 'school', label: '学校', value: (user.certInfo && user.certInfo.school) || user.school || '', required: true },
        { name: 'studentNo', label: '学号', value: (user.certInfo && user.certInfo.studentNo) || '', required: true }
      ];
    } else {
      fields = [
        { name: 'company', label: '企业名称', value: (user.certInfo && user.certInfo.company) || user.company || '', required: true },
        { name: 'creditCode', label: '统一社会信用代码', value: (user.certInfo && user.certInfo.creditCode) || user.creditCode || '', required: true },
        { name: 'industry', label: '所属行业', value: (user.certInfo && user.certInfo.industry) || '', placeholder: '如：餐饮零售 / 会展服务' }
      ];
    }
    const d = await openModal('提交认证资料', fields, { submitText: '提交审核' });
    if (!d) return;
    try {
      const r = await api('/api/cert/' + user.role, { method: 'POST', body: d });
      toast(r.message || '已提交', 'ok');
      const me = await refreshUser();
      showCertBanner(containerId, me, onDone);
      if (onDone) onDone(me);
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* 通知铃铛 */
function initNotifications() {
  const ub = document.getElementById('userbox');
  if (!ub) return;
  const bell = document.createElement('button');
  bell.className = 'bell';
  bell.title = '消息通知';
  bell.innerHTML = '🔔<span class="bell-dot hide" id="bell-dot"></span>';
  ub.insertBefore(bell, ub.querySelector('.btn-ghost'));
  bell.onclick = openNotifications;
  async function poll() {
    try {
      const d = await api('/api/notifications');
      const dot = document.getElementById('bell-dot');
      if (dot) dot.classList.toggle('hide', d.unread === 0);
    } catch (e) {}
  }
  poll();
  setInterval(poll, 20000);
  async function openNotifications() {
    const d = await api('/api/notifications');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const list = d.notifications.length
      ? d.notifications.map((n) => '<div class="notify-item ' + (n.read ? '' : 'unread') + '"><div class="notify-title">' + n.title + (n.read ? '' : ' ' + badge('新', 'orange')) + '</div>' +
        '<div class="notify-body">' + n.body + '</div><div class="muted">' + fmtDate(n.createdAt) + '</div></div>').join('')
      : '<div class="empty">暂无消息</div>';
    mask.innerHTML = '<div class="modal" style="max-width:520px;"><div class="m-head">消息中心 ' + (d.unread ? badge(d.unread + ' 条未读', 'orange') : '') + '</div>' +
      '<div class="m-body" style="gap:8px;max-height:60vh;">' + list + '</div>' +
      '<div class="m-foot"><button class="btn light" data-act="readall">全部标为已读</button><button class="btn primary" data-act="close">关闭</button></div></div>';
    document.body.appendChild(mask);
    mask.querySelector('[data-act="close"]').onclick = () => mask.remove();
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    mask.querySelector('[data-act="readall"]').onclick = async () => {
      await api('/api/notifications/read', { method: 'POST', body: {} });
      mask.remove();
      poll();
      toast('已全部标为已读', 'ok');
    };
    poll();
  }
}

/* 距离与地图辅助 */
function havMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
function fmtDistance(m) {
  if (m == null) return '';
  return m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km';
}
function externalMapUrl(lat, lng, name) {
  return 'https://uri.amap.com/marker?position=' + lng + ',' + lat + '&name=' + encodeURIComponent(name || '任务地点') + '&src=webapp';
}
function getUserLocation(timeout) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeout || 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (!done) { done = true; clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); } },
      () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } },
      { enableHighAccuracy: true, timeout: timeout || 6000, maximumAge: 60000 }
    );
  });
}

/* 页面骨架：角色校验 + 顶栏 + 标签页 */
function initPage(opts) {
  const user = currentUser();
  if (!user) { location.href = 'index.html'; return null; }
  if (opts.role && user.role !== opts.role) { location.href = 'index.html'; return null; }
  const nav = document.getElementById('nav');
  const ub = document.getElementById('userbox');
  if (!nav || !ub) return user;
  const navHtml = (opts.tabs || []).map((t) => '<button data-tab="' + t.id + '" class="' + (t.id === opts.active ? 'active' : '') + '">' + t.label + '</button>').join('');
  nav.innerHTML = navHtml;
  nav.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => {
      nav.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hide', p.getAttribute('data-pane') !== b.getAttribute('data-tab')));
      if (opts.onTab) opts.onTab(b.getAttribute('data-tab'));
    };
  });
  ub.innerHTML = '<div class="avatar">' + (user.name || '?').slice(0, 1) + '</div>' +
    '<div class="meta"><b>' + user.name + '</b>' + (user.school || user.company || '') + ' · ' + (user.verified ? '已认证' : user.certStatus === 'pending' ? '认证审核中' : '待认证') + '</div>' + badge(ROLE_NAME[user.role] || user.role);
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-ghost';
  logoutBtn.textContent = '退出';
  logoutBtn.onclick = async () => { try { await api('/api/logout', { method: 'POST' }); } catch (e) {} clearAuth(); location.href = 'index.html'; };
  ub.appendChild(logoutBtn);
  const safety = document.createElement('a');
  safety.className = 'btn-ghost';
  safety.href = 'safety.html';
  safety.textContent = '安全';
  ub.appendChild(safety);
  initNotifications();
  return user;
}

function refreshUser() {
  return api('/api/me').then((d) => { setAuth(token(), d.user); return d.user; }).catch(() => null);
}
