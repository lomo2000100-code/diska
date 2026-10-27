const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'diska-secret-key-change-me-2026';
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 МБ — файлы любого типа
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '40mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health-check для хостинга (Render и аналоги)
app.get('/healthz', (req, res) => res.json({ ok: true, app: 'diska' }));

/* ---------------- Хранилище (JSON) ---------------- */

function defaultDB() {
  return {
    users: [],
    orders: [],
    messages: [],
    reviews: [],
    counters: { user: 0, order: 0, message: 0, review: 0 }
  };
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return defaultDB();
  }
}

function saveDB(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

let db = loadDB();

/* ---------------- Утилиты ---------------- */

const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(pw, salt, 64).toString('hex')
});

function verifyPassword(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

function signToken(user) {
  const body = Buffer.from(JSON.stringify({
    uid: user.id, role: user.role, iat: Date.now()
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  // токен из query — для прямых ссылок на скачивание файлов (<a href>)
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  const [body, sig] = token.split('.');
  if (!body || !sig) return res.status(401).json({ error: 'Неверный токен' });
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== expected) return res.status(401).json({ error: 'Неверный токен' });
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const user = db.users.find(u => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Неверный токен' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
const now = () => new Date().toISOString();
const round1000 = n => Math.round(n / 1000) * 1000;

/* ---------------- Сиды ---------------- */

function seed() {
  if (db.users.length === 0) {
    const adminCred = hashPassword('admin123');
    db.users.push({
      id: ++db.counters.user,
      name: 'Администратор',
      email: 'admin@diska.ru',
      role: 'admin',
      salt: adminCred.salt,
      hash: adminCred.hash,
      createdAt: now()
    });
  }
  // Отзывы и клиенты не сидируются — витрина наполняется только реальными данными
  saveDB(db);
}
seed();

/* ---------------- Авторизация ---------------- */

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  const mail = String(email).trim().toLowerCase();
  if (db.users.some(u => u.email === mail)) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
  const c = hashPassword(password);
  const user = {
    id: ++db.counters.user,
    name: String(name).trim(),
    email: mail,
    role: 'client',
    salt: c.salt,
    hash: c.hash,
    createdAt: now()
  };
  db.users.push(user);
  saveDB(db);
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find(u => u.email === String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.salt, user.hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------------- Статистика и отзывы ---------------- */

app.get('/api/stats', (req, res) => {
  const clients = db.users.filter(u => u.role === 'client').length;
  const completed = db.orders.filter(o => o.status === 'completed').length;
  const reviews = db.reviews.filter(r => r.approved);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
  res.json({
    clients,
    completedOrders: completed,
    reviews: reviews.length,
    avgRating: Math.round(avg * 10) / 10
  });
});

app.get('/api/reviews', (req, res) => {
  const list = db.reviews.filter(r => r.approved)
    .map(r => ({ id: r.id, authorName: r.authorName, rating: r.rating, text: r.text, createdAt: r.createdAt }));
  res.json(list);
});

app.post('/api/reviews', auth, (req, res) => {
  const { orderId, rating, text } = req.body || {};
  const order = db.orders.find(o => o.id === Number(orderId));
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.status !== 'completed') return res.status(400).json({ error: 'Отзыв можно оставить после завершения заказа' });
  if (db.reviews.some(r => r.orderId === order.id && r.userId === req.user.id)) {
    return res.status(400).json({ error: 'Вы уже оставили отзыв на этот заказ' });
  }
  const r = Math.max(1, Math.min(5, Number(rating) || 5));
  if (!text || String(text).trim().length < 5) return res.status(400).json({ error: 'Напишите текст отзыва' });
  const review = {
    id: ++db.counters.review,
    userId: req.user.id,
    authorName: req.user.name,
    orderId: order.id,
    rating: r,
    text: String(text).trim(),
    approved: false, // попадает на витрину только после одобрения администратором
    createdAt: now()
  };
  db.reviews.push(review);
  saveDB(db);
  res.json(review);
});

// Отзывы текущего пользователя (включая ожидающие модерации)
app.get('/api/my-reviews', auth, (req, res) => {
  res.json(db.reviews.filter(r => r.userId === req.user.id));
});

/* ---------------- ИИ-помощник: расчёт стоимости ---------------- */

const PRICING = {
  type: {
    landing: { label: 'Лендинг', base: 12000, days: 5 },
    corporate: { label: 'Корпоративный сайт', base: 39000, days: 14 },
    shop: { label: 'Интернет-магазин', base: 69000, days: 21 },
    webapp: { label: 'Веб-приложение / сервис', base: 120000, days: 35 },
    portfolio: { label: 'Портфолио', base: 20000, days: 7 }
  },
  pages: { '1': 1, '3': 3, '8': 8, '12': 12 },
  design: {
    template: { label: 'Шаблонный дизайн', add: 0, days: 0 },
    unique: { label: 'Уникальный дизайн', add: 20000, days: 5 },
    premium: { label: 'Премиум-дизайн под бренд', add: 45000, days: 10 }
  },
  features: {
    forms: { label: 'Формы заявок и обратной связи', add: 4000, days: 1 },
    catalog: { label: 'Каталог и корзина', add: 25000, days: 6 },
    payment: { label: 'Онлайн-оплата', add: 12000, days: 3 },
    cabinet: { label: 'Личный кабинет', add: 30000, days: 7 },
    blog: { label: 'Блог / новости', add: 8000, days: 2 },
    multi: { label: 'Мультиязычность', add: 10000, days: 3 },
    seo: { label: 'SEO-настройка', add: 15000, days: 3 },
    admin: { label: 'Админ-панель', add: 25000, days: 5 }
  },
  urgency: {
    fast: { label: 'Срочно (быстрее обычного)', multiplier: 1.5, daysMult: 0.6 },
    normal: { label: 'Обычные сроки', multiplier: 1, daysMult: 1 },
    relaxed: { label: 'Не спеша', multiplier: 0.85, daysMult: 1.3 }
  },
  animations: {
    none: { label: 'Без анимаций', add: 0, days: 0 },
    light: { label: 'Лёгкие микроанимации', add: 5000, days: 1 },
    parallax: { label: 'Параллакс и скролл-эффекты', add: 12000, days: 3 },
    rich: { label: 'Богатые анимации и интерактив', add: 25000, days: 7 }
  },
  colorTheme: {
    dark: 'Тёмная тема фона',
    light: 'Светлая тема фона',
    brand: 'Фирменные цвета бренда',
    mono: 'Чёрно-белый минимализм'
  }
};

app.post('/api/assistant/estimate', (req, res) => {
  const a = req.body || {};
  const t = PRICING.type[a.type];
  if (!t) return res.status(400).json({ error: 'Не выбран тип сайта' });
  const pages = PRICING.pages[a.pages] || 1;
  const design = PRICING.design[a.design] || PRICING.design.template;
  const urgency = PRICING.urgency[a.urgency] || PRICING.urgency.normal;
  const feats = Array.isArray(a.features) ? a.features.filter(f => PRICING.features[f]) : [];
  const anim = PRICING.animations[a.animations] || PRICING.animations.none;

  let price = t.base;
  let days = t.days;
  price += Math.max(0, pages - 1) * 3000;
  days += Math.max(0, pages - 1);
  price += design.add;
  days += design.days;
  price += anim.add;
  days += anim.days;
  feats.forEach(f => { price += PRICING.features[f].add; days += PRICING.features[f].days; });
  price = price * urgency.multiplier;
  days = Math.max(3, Math.round(days * urgency.daysMult));

  const min = round1000(price * 0.9);
  const max = round1000(price * 1.15);
  const summary = [
    `Тип: ${t.label}`,
    a.niche ? `Тематика: ${String(a.niche).slice(0, 120)}` : null,
    a.products ? `Продукция/услуги: ${String(a.products).slice(0, 120)}` : null,
    `Страниц: ~${pages}`,
    `Дизайн: ${design.label}`,
    `Фон/тема: ${PRICING.colorTheme[a.colorTheme] || 'Не указано'}`,
    `Анимации: ${anim.label}`,
    feats.length ? `Функции: ${feats.map(f => PRICING.features[f].label).join(', ')}` : 'Без доп. функций',
    `Сроки: ${urgency.label}`,
    a.budget ? `Бюджет клиента: ${Number(a.budget).toLocaleString('ru-RU')} ₽` : null
  ].filter(Boolean);
  res.json({ priceMin: min, priceMax: max, approxDays: days, summary });
});

/* ---------------- Промт для генерации сайта в ИИ ---------------- */

function buildPrompt(answers, estimate) {
  const t = PRICING.type[answers.type]?.label || 'Сайт';
  const lines = [
    `ЗАДАЧА: разработать веб-сайт — ${t}.`,
    answers.niche ? `ТЕМАТИКА/НИША: ${answers.niche}.` : null,
    answers.products ? `ПРОДУКЦИЯ И УСЛУГИ: ${answers.products}.` : null,
    `ОБЪЁМ: ориентировочно ${PRICING.pages[answers.pages] || 1} страниц(ы).`,
    `ДИЗАЙН: ${PRICING.design[answers.design]?.label || 'шаблонный'}.`,
    `ФОН И ЦВЕТОВАЯ ТЕМА: ${PRICING.colorTheme[answers.colorTheme] || 'на усмотрение дизайнера'}.`,
    `АНИМАЦИИ: ${PRICING.animations[answers.animations]?.label || 'без анимаций'}.`,
    Array.isArray(answers.features) && answers.features.length
      ? `НУЖНЫЙ ФУНКЦИОНАЛ: ${answers.features.map(f => PRICING.features[f]?.label).filter(Boolean).join('; ')}.`
      : 'ДОПОЛНИТЕЛЬНЫЙ ФУНКЦИОНАЛ: не требуется.',
    estimate ? `ОРИЕНТИР ПО СРОКУ: ${estimate.approxDays} рабочих дней.` : null,
    answers.budget ? `БЮДЖЕТ КЛИЕНТА: ${Number(answers.budget).toLocaleString('ru-RU')} ₽ (нижняя граница по смете: ${estimate?.priceMin?.toLocaleString('ru-RU')} ₽).` : null,
    '',
    'ТРЕБОВАНИЯ К РЕЗУЛЬТАТУ: адаптивная вёрстка под мобильные и десктоп, современный минималистичный UI, чёткая структура и призывы к действию, чистый HTML/CSS/JS, готовый к размещению на хостинге. Отдай результат набором файлов для упаковки в ZIP.'
  ].filter(Boolean);
  return lines.join('\n');
}

/* ---------------- Заказы ---------------- */

app.post('/api/orders', auth, (req, res) => {
  const { title, brief, answers, estimate } = req.body || {};
  if (!answers || !answers.type) return res.status(400).json({ error: 'Не заполнен бриф ИИ-помощника' });
  // Бюджет не может быть ниже рассчитанного минимума
  if (answers.budget && estimate?.priceMin && Number(answers.budget) < estimate.priceMin) {
    return res.status(400).json({ error: `Бюджет ниже минимальной стоимости: ${estimate.priceMin.toLocaleString('ru-RU')} ₽` });
  }
  const prompt = buildPrompt(answers, estimate || null);
  const order = {
    id: ++db.counters.order,
    userId: req.user.id,
    title: String(title || PRICING.type[answers.type]?.label || 'Новый сайт').slice(0, 120),
    brief: String(brief || '').slice(0, 2000),
    answers,
    estimate: estimate || null,
    prompt,
    deliverable: null, // готовый сайт: { storedName, originalName, size, mime, createdAt }
    status: 'new', // new | accepted | rejected | completed
    priceFinal: null,
    startDate: null,
    deadline: null,
    adminComment: '',
    rejectReason: '',
    createdAt: now()
  };
  db.orders.push(order);
  saveDB(db);
  res.json(order);
});

app.get('/api/orders', auth, (req, res) => {
  let list;
  if (req.user.role === 'admin') {
    list = db.orders.map(o => ({ ...o, client: publicUser(db.users.find(u => u.id === o.userId)) }));
  } else {
    list = db.orders.filter(o => o.userId === req.user.id);
  }
  list.sort((a, b) => b.id - a.id);
  res.json(list);
});

app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (req.user.role !== 'admin' && order.userId !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
  res.json({ ...order, client: publicUser(db.users.find(u => u.id === order.userId)) });
});

app.patch('/api/orders/:id', auth, adminOnly, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  const { action, priceFinal, startDate, deadline, adminComment, rejectReason } = req.body || {};

  if (action === 'accept') {
    order.status = 'accepted';
    order.priceFinal = Number(priceFinal) || order.estimate?.priceMin || null;
    order.startDate = startDate || null;
    order.deadline = deadline || null;
    order.adminComment = String(adminComment || '').slice(0, 1000);
    order.rejectReason = '';
  } else if (action === 'reject') {
    order.status = 'rejected';
    order.rejectReason = String(rejectReason || 'Не указана').slice(0, 1000);
  } else if (action === 'complete') {
    order.status = 'completed';
  } else {
    return res.status(400).json({ error: 'Неизвестное действие' });
  }
  saveDB(db);
  res.json(order);
});

/* ---------------- Файлы (любого типа) ---------------- */

function saveBase64File(dataUrl, originalName) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!m) throw new Error('Некорректный файл');
  const mime = m[1].slice(0, 100);
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0) throw new Error('Пустой файл');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Файл больше 25 МБ');
  const safeName = String(originalName || 'file').replace(/[^\w.\-а-яё ]+/gi, '_').slice(-90) || 'file';
  const ext = path.extname(safeName) || '';
  const stored = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  return { storedName: stored, originalName: safeName, size: buffer.length, mime };
}

function orderAccess(order, user) {
  return user.role === 'admin' || order.userId === user.id;
}

/* ---------------- Чат по заказу ---------------- */

app.get('/api/orders/:id/messages', auth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!orderAccess(order, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  const msgs = db.messages.filter(m => m.orderId === order.id).sort((a, b) => a.id - b.id);
  res.json(msgs);
});

app.post('/api/orders/:id/messages', auth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!orderAccess(order, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  const text = String(req.body?.text || '').trim();
  const attachmentSrc = req.body?.attachment;
  let attachment = null;
  if (attachmentSrc?.dataUrl) {
    try {
      attachment = saveBase64File(attachmentSrc.dataUrl, attachmentSrc.name);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
  if (!text && !attachment) return res.status(400).json({ error: 'Пустое сообщение' });
  const msg = {
    id: ++db.counters.message,
    orderId: order.id,
    senderId: req.user.id,
    senderRole: req.user.role,
    senderName: req.user.name,
    text: text.slice(0, 2000),
    attachment,
    createdAt: now()
  };
  db.messages.push(msg);
  saveDB(db);
  res.json(msg);
});

// Скачивание вложения из чата (доступ только участникам заказа)
app.get('/api/orders/:id/messages/:msgId/download', auth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!orderAccess(order, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  const msg = db.messages.find(m => m.id === Number(req.params.msgId) && m.orderId === order.id);
  if (!msg?.attachment) return res.status(404).json({ error: 'Файл не найден' });
  const fp = path.join(UPLOAD_DIR, msg.attachment.storedName);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на сервере' });
  res.download(fp, msg.attachment.originalName);
});

/* ---------------- Выдача готового сайта (ZIP) ---------------- */

app.post('/api/orders/:id/deliverable', auth, adminOnly, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  const src = req.body?.file;
  if (!src?.dataUrl) return res.status(400).json({ error: 'Файл не передан' });
  try {
    order.deliverable = { ...saveBase64File(src.dataUrl, src.name || 'site.zip'), createdAt: now() };
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  saveDB(db);
  res.json(order.deliverable);
});

app.get('/api/orders/:id/deliverable', auth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (!orderAccess(order, req.user)) return res.status(403).json({ error: 'Нет доступа' });
  if (!order.deliverable) return res.status(404).json({ error: 'Готовый файл ещё не загружен' });
  const fp = path.join(UPLOAD_DIR, order.deliverable.storedName);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Файл отсутствует на сервере' });
  res.download(fp, order.deliverable.originalName);
});

app.delete('/api/orders/:id/deliverable', auth, adminOnly, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  order.deliverable = null;
  saveDB(db);
  res.json({ ok: true });
});

/* ---------------- Админ: клиенты и модерация ---------------- */

app.get('/api/admin/clients', auth, adminOnly, (req, res) => {
  res.json(db.users.filter(u => u.role === 'client').map(publicUser));
});

app.get('/api/admin/reviews', auth, adminOnly, (req, res) => {
  res.json(db.reviews);
});

app.patch('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  const review = db.reviews.find(r => r.id === Number(req.params.id));
  if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
  if (typeof req.body?.approved !== 'boolean') {
    return res.status(400).json({ error: 'Параметр approved должен быть true или false' });
  }
  review.approved = req.body.approved;
  saveDB(db);
  res.json(review);
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  const before = db.reviews.length;
  db.reviews = db.reviews.filter(r => r.id !== Number(req.params.id));
  if (db.reviews.length === before) return res.status(404).json({ error: 'Отзыв не найден' });
  saveDB(db);
  res.json({ ok: true });
});

/* ---------------- SPA fallback ---------------- */

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const file = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Единый JSON-обработчик ошибок (в т.ч. превышение размера файла)
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Файл слишком большой. Максимум — 25 МБ.' });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Некорректный формат запроса' });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`diska запущен на http://0.0.0.0:${PORT}`);
});
