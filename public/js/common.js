/* ============ Общий модуль: API, авторизация, тема ============ */

const API = {
  token: localStorage.getItem('token') || null,
  async call(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.token) opts.headers.Authorization = 'Bearer ' + this.token;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
  },
  get(u) { return this.call('GET', u); },
  post(u, b) { return this.call('POST', u, b); },
  patch(u, b) { return this.call('PATCH', u, b); },
  del(u) { return this.call('DELETE', u); }
};

const Auth = {
  get user() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  },
  set session({ token, user }) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    API.token = token;
  },
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    API.token = null;
    location.href = '/';
  },
  require(role) {
    const u = this.user;
    if (!u) { location.href = '/'; return null; }
    if (role === 'admin' && u.role !== 'admin') { location.href = '/dashboard.html'; return null; }
    if (role === 'client' && u.role === 'admin') { location.href = '/admin.html'; return null; }
    return u;
  }
};

/* ---- Тема ---- */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}
initTheme();

/* ---- Тосты ---- */
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---- Модалки ---- */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}
document.addEventListener('click', e => {
  if (e.target.classList?.contains('modal-overlay')) e.target.classList.remove('open');
  if (e.target.classList?.contains('modal-close')) e.target.closest('.modal-overlay').classList.remove('open');
});

/* ---- Шапка: состояние пользователя ---- */
function renderNav() {
  const slot = document.getElementById('navSlot');
  if (!slot) return;
  const u = Auth.user;
  const themeBtn = `<button class="icon-btn" id="themeToggle" title="Сменить тему" onclick="toggleTheme()">${
    document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'
  }</button>`;
  if (u) {
    const link = u.role === 'admin' ? '/admin.html' : '/dashboard.html';
    const label = u.role === 'admin' ? 'Админ-панель' : 'Мои заказы';
    slot.innerHTML = `
      ${themeBtn}
      <a class="btn btn-sm" href="${link}">${label}</a>
      <div class="avatar-chip" onclick="Auth.logout()" title="Выйти">
        <span class="avatar">${u.name.charAt(0).toUpperCase()}</span>
        ${escapeHtml(u.name)}
      </div>`;
  } else {
    slot.innerHTML = `
      ${themeBtn}
      <button class="btn btn-sm" onclick="openModal('loginModal')">Войти</button>
      <button class="btn btn-sm btn-primary" onclick="openModal('registerModal')">Регистрация</button>`;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function fmtPrice(n) {
  return n ? Number(n).toLocaleString('ru-RU') + ' ₽' : '—';
}
const STATUS_LABELS = {
  new: 'Новый', accepted: 'В работе', rejected: 'Отклонён', completed: 'Завершён'
};

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function isImage(mime, name) {
  return String(mime || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(name || '');
}

function attachmentHtml(att, orderId, msgId) {
  const url = `/api/orders/${orderId}/messages/${msgId}/download?token=${encodeURIComponent(API.token || '')}`;
  if (isImage(att.mime, att.originalName)) {
    return `<a class="att-image" href="${url}" target="_blank" rel="noopener">
      <img src="${url}" alt="${escapeHtml(att.originalName)}" loading="lazy"></a>`;
  }
  return `<a class="att-file" href="${url}" target="_blank" rel="noopener">
    <span data-icon="file" data-size="18"></span>
    <span class="att-meta"><b>${escapeHtml(att.originalName)}</b><small>${fmtSize(att.size)}</small></span>
    <span data-icon="download" data-size="16"></span></a>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано в буфер обмена');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Скопировано');
  }
}

/* ---- Минималистичные SVG-иконки (монохром, currentColor) ---- */
const ICON_PATHS = {
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'
};

function icon(name, size = 18, solid = false) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${solid ? 'currentColor' : 'none'}" stroke="${solid ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

function iconify(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18, el.dataset.solid === '1');
  });
}

/* ---- Анимация появления при скролле ---- */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  initReveal();
  iconify();
});
