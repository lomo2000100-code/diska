/* ============ ИИ-помощник diska: бриф по-человечески ============ */

const Assistant = (() => {
  const panel = () => document.getElementById('aiPanel');
  const body = () => document.getElementById('aiBody');
  const inputRow = () => document.getElementById('aiInputRow');
  let state = null;

  const QUESTIONS = [
    {
      key: 'type',
      q: 'Привет! Я помогу собрать бриф и сразу посчитаю стоимость. Для начала — какой сайт нужен?',
      options: [
        { v: 'landing', t: 'Лендинг — одна продающая страница' },
        { v: 'corporate', t: 'Сайт компании' },
        { v: 'shop', t: 'Интернет-магазин' },
        { v: 'webapp', t: 'Веб-сервис или приложение' },
        { v: 'portfolio', t: 'Портфолио' }
      ]
    },
    {
      key: 'brand', input: true,
      placeholder: 'Например: кофейня «Зерно»',
      q: 'Как называется компания или проект? Если названия пока нет — напишите рабочее, потом поменяем.'
    },
    {
      key: 'niche', input: true,
      placeholder: 'Например: небольшая кофейня в спальном районе',
      q: 'Расскажите в двух словах, чем вы занимаетесь. Своими словами, как объяснили бы знакомому.'
    },
    {
      key: 'products', input: true,
      placeholder: 'Например: кофе с собой, десерты, завтраки',
      q: 'Что именно продаёте или какие услуги оказываете? Перечислите главное.'
    },
    {
      key: 'audience', input: true,
      placeholder: 'Например: жители района 25–40 лет, заходят по пути на работу',
      q: 'Кто ваш клиент? Кого хотите видеть на сайте — возраст, интересы, за чем обычно приходят.'
    },
    {
      key: 'pages',
      q: 'Сколько примерно страниц нужно? Если сомневаетесь — берите вариант поближе, потом расширим.',
      options: [
        { v: '1', t: 'Одна страница (одностраничник)' },
        { v: '3', t: '2–5 страниц' },
        { v: '8', t: '6–10 страниц' },
        { v: '12', t: 'Больше 10' }
      ]
    },
    {
      key: 'design',
      q: 'Какой дизайн ближе? От этого сильно зависит цена и срок.',
      options: [
        { v: 'template', t: 'На основе шаблона — бюджетно и быстро' },
        { v: 'unique', t: 'Уникальный, нарисуем с нуля' },
        { v: 'premium', t: 'Премиум-уровень под бренд' }
      ]
    },
    {
      key: 'style',
      q: 'Какое настроение у сайта? Выберите характер, который подходит бизнесу.',
      options: [
        { v: 'minimal', t: 'Минимализм, много воздуха' },
        { v: 'premium', t: 'Дорого и солидно' },
        { v: 'friendly', t: 'Тепло и дружелюбно' },
        { v: 'bold', t: 'Ярко и смело' },
        { v: 'classic', t: 'Классика, корпоративный стиль' }
      ]
    },
    {
      key: 'colorTheme',
      q: 'Что с фоном и цветами?',
      options: [
        { v: 'dark', t: 'Тёмный фон' },
        { v: 'light', t: 'Светлый фон' },
        { v: 'brand', t: 'Фирменные цвета бренда' },
        { v: 'mono', t: 'Чёрно-белый минимализм' }
      ]
    },
    {
      key: 'animations',
      q: 'Нужны ли анимации? Они оживляют сайт, но добавляют работу.',
      options: [
        { v: 'none', t: 'Без анимаций, только самое нужное' },
        { v: 'light', t: 'Лёгкие микроанимации' },
        { v: 'parallax', t: 'Параллакс и эффекты при скролле' },
        { v: 'rich', t: 'Богатый интерактив' }
      ]
    },
    {
      key: 'blocks', multi: true,
      q: 'Какие блоки должны быть на сайте? Отметьте всё нужное, потом нажмите «Продолжить».'
    },
    {
      key: 'features', multi: true,
      q: 'Теперь про функции — что сайт должен уметь делать? Тоже можно несколько вариантов.'
    },
    {
      key: 'content',
      q: 'Что с текстами?',
      options: [
        { v: 'ready', t: 'Тексты уже написаны' },
        { v: 'partial', t: 'Что-то есть, остальное допишите вы' },
        { v: 'copy', t: 'Напишите все тексты за меня' }
      ]
    },
    {
      key: 'assets',
      q: 'Есть ли логотип и фирменные цвета?',
      options: [
        { v: 'full', t: 'Да, есть логотип и цвета' },
        { v: 'logo', t: 'Только логотип' },
        { v: 'none', t: 'Ничего нет, сделайте с нуля' }
      ]
    },
    {
      key: 'refs', input: true, optional: true,
      placeholder: 'Ссылки через запятую, либо напишите «нет»',
      q: 'Может, есть сайты, которые нравятся? Киньте ссылки — это поможет попасть в ожидание. Если нет — напишите «нет».'
    },
    {
      key: 'urgency',
      q: 'Последний вопрос про сроки: насколько горит?',
      options: [
        { v: 'fast', t: 'Срочно, нужно быстрее' },
        { v: 'normal', t: 'Обычные сроки' },
        { v: 'relaxed', t: 'Не спешу, важнее цена' }
      ]
    }
  ];

  // Динамические опции для мультивопросов (общие справочники с сервером)
  const BLOCK_OPTIONS = [
    ['hero', 'Первый экран с оффером'], ['about', 'О компании / о себе'],
    ['services', 'Услуги или товары'], ['pricing', 'Цены и тарифы'],
    ['portfolio', 'Портфолио / кейсы'], ['reviews', 'Отзывы'],
    ['team', 'Команда'], ['faq', 'Вопросы и ответы'],
    ['contacts', 'Контакты и карта'], ['blog', 'Блог / новости']
  ];
  const FEATURE_OPTIONS = [
    ['forms', 'Формы заявок'], ['catalog', 'Каталог и корзина'],
    ['payment', 'Онлайн-оплата'], ['cabinet', 'Личный кабинет'],
    ['blog', 'Блог / новости'], ['multi', 'Мультиязычность'],
    ['seo', 'SEO-настройка'], ['admin', 'Админ-панель']
  ];

  function reset() {
    state = { step: 0, answers: { features: [], blocks: [] }, done: false, estimate: null };
    body().innerHTML = '';
    inputRow().style.display = 'none';
  }

  const scrollDown = () => { body().scrollTop = body().scrollHeight; };

  function addMsg(html, cls = 'bot') {
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.innerHTML = html;
    body().appendChild(el);
    scrollDown();
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    body().appendChild(el);
    scrollDown();
    return el;
  }

  function disableChoices(wrap) {
    wrap.querySelectorAll('.choice').forEach(c => { c.disabled = true; c.style.opacity = '.55'; });
  }

  function askChoices(q) {
    addMsg(escapeHtml(q.q));
    const wrap = document.createElement('div');
    wrap.className = 'choices';

    let options = q.options;
    if (q.key === 'blocks') options = BLOCK_OPTIONS.map(([v, t]) => ({ v, t }));
    if (q.key === 'features') options = FEATURE_OPTIONS.map(([v, t]) => ({ v, t }));

    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = opt.t;
      b.onclick = () => {
        if (q.multi) {
          b.classList.toggle('selected');
          const arr = state.answers[q.key];
          const i = arr.indexOf(opt.v);
          if (i >= 0) arr.splice(i, 1); else arr.push(opt.v);
        } else {
          disableChoices(wrap);
          state.answers[q.key] = opt.v;
          addMsg(opt.t, 'user');
          state.step++;
          setTimeout(run, 280);
        }
      };
      wrap.appendChild(b);
    });

    if (q.multi) {
      const next = document.createElement('button');
      next.className = 'choice';
      next.style.borderStyle = 'dashed';
      next.textContent = 'Продолжить →';
      next.onclick = () => {
        disableChoices(wrap);
        const dict = q.key === 'blocks' ? BLOCK_OPTIONS : FEATURE_OPTIONS;
        const picked = state.answers[q.key]
          .map(v => dict.find(o => o[0] === v)?.[1]).filter(Boolean).join(', ');
        addMsg(picked || 'Ничего не выбрано', 'user');
        state.step++;
        setTimeout(run, 280);
      };
      wrap.appendChild(next);
    }
    body().appendChild(wrap);
    scrollDown();
  }

  function askInput(q) {
    addMsg(escapeHtml(q.q));
    inputRow().style.display = 'flex';
    const input = document.getElementById('aiTextInput');
    input.placeholder = q.placeholder || 'Ваш ответ…';
    input.value = '';
    input.focus();
    const send = () => {
      let val = input.value.trim();
      if (val.length < 2) { input.focus(); return; }
      if (q.optional && /^(нет|нету|пропустить|no)$/i.test(val)) val = '';
      addMsg(escapeHtml(input.value.trim() || '—'), 'user');
      state.answers[q.key] = val.slice(0, 400);
      inputRow().style.display = 'none';
      input.placeholder = 'Опишите задачу своими словами…';
      state.step++;
      setTimeout(run, 280);
    };
    document.getElementById('aiSendBtn').onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  async function showEstimate() {
    const t = addTyping();
    try {
      state.estimate = await API.post('/api/assistant/estimate', state.answers);
    } catch (e) {
      t.remove();
      addMsg('Техническая заминка со сметой: ' + e.message + '. Попробуйте ещё раз чуть позже.');
      throw e;
    }
    t.remove();
    const est = state.estimate;
    const el = document.createElement('div');
    el.className = 'msg estimate';
    el.innerHTML = `
      <b>Посчитал. Вот честная смета по вашим ответам:</b>
      <div class="est-price">${fmtPrice(est.priceMin)} — ${fmtPrice(est.priceMax)}</div>
      <div class="est-meta">Примерно ${est.approxDays} рабочих дней. Дешевле минимума этот проект не собрать — но в эту сумму уже входит всё перечисленное.</div>
      <div class="est-list">${est.summary.map(s => `· ${escapeHtml(s)}`).join('')}</div>`;
    body().appendChild(el);
    scrollDown();
  }

  function askBudget() {
    const est = state.estimate;
    const opt = Math.round((est.priceMin + est.priceMax) / 2 / 1000) * 1000;
    addMsg(`На какую сумму рассчитываете? Меньше <b>${fmtPrice(est.priceMin)}</b> взять не получится, а выше ${fmtPrice(est.priceMax)} смысла нет — потолок студии 100 000 ₽.`);
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    const tiers = [
      { v: est.priceMin, t: `Минимум — ${fmtPrice(est.priceMin)}` },
      { v: opt, t: `Оптимум — ${fmtPrice(opt)}` },
      { v: est.priceMax, t: `Верхняя граница — ${fmtPrice(est.priceMax)}` },
      { v: 'custom', t: 'Введу свою сумму' }
    ];
    tiers.forEach(o => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = o.t;
      b.onclick = () => {
        if (o.v === 'custom') {
          disableChoices(wrap);
          customBudget();
        } else {
          disableChoices(wrap);
          state.answers.budget = o.v;
          addMsg(o.t, 'user');
          setTimeout(finish, 280);
        }
      };
      wrap.appendChild(b);
    });
    body().appendChild(wrap);
    scrollDown();
  }

  function customBudget() {
    addMsg('Напишите сумму в рублях одним числом, например 50000.');
    inputRow().style.display = 'flex';
    const input = document.getElementById('aiTextInput');
    input.placeholder = 'Сумма в рублях…';
    input.value = '';
    input.focus();
    const send = () => {
      const val = parseInt(input.value.replace(/\D/g, ''), 10);
      if (!val || val <= 0) { addMsg('Похоже, это не число. Напишите сумму цифрами, например 50000.'); input.focus(); return; }
      if (val < state.estimate.priceMin) {
        addMsg(fmtPrice(val), 'user');
        addMsg(`Столько не выйдет: минимум под ваши требования — ${fmtPrice(state.estimate.priceMin)}. Можно убрать часть функций или упростить дизайн, либо ввести сумму от минимума.`);
        input.value = '';
        input.focus();
        return;
      }
      if (val > 100000) {
        addMsg(fmtPrice(val), 'user');
        addMsg('Выше 100 000 ₽ мы не берём — назовите сумму в пределах сметы.');
        input.value = '';
        input.focus();
        return;
      }
      addMsg(fmtPrice(val), 'user');
      state.answers.budget = val;
      inputRow().style.display = 'none';
      input.placeholder = 'Опишите задачу своими словами…';
      setTimeout(finish, 280);
    };
    document.getElementById('aiSendBtn').onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  async function finish() {
    if (!Auth.user) {
      addMsg('Почти всё. Чтобы оформить заказ, нужен аккаунт — регистрация займёт минуту. После входа бриф и смета никуда не денутся, я сразу отправлю заказ.');
      openModal('registerModal');
      sessionStorage.setItem('pendingOrder', JSON.stringify({ answers: state.answers, estimate: state.estimate }));
      return;
    }
    const t = addTyping();
    try {
      const order = await API.post('/api/orders', {
        title: 'Бриф из ИИ-помощника',
        brief: state.estimate.summary.join('; '),
        answers: state.answers,
        estimate: state.estimate
      });
      t.remove();
      state.done = true;
      addMsg(`Готово, заказ №${order.id} у меня. Я уже собрал по вашим ответам техническое задание для разработки — посмотрю его, подтвержу сроки и цену. Если есть фото, референсы или документы — прикрепите их в чате заказа, так результат будет точнее.`);
      const el = document.createElement('div');
      el.className = 'choices';
      el.innerHTML = `
        <a class="choice selected" href="/dashboard.html?order=${order.id}&chat=1">Перейти в чат заказа</a>
        <a class="choice" href="/dashboard.html">Мои заказы</a>`;
      body().appendChild(el);
      inputRow().style.display = 'none';
      scrollDown();
    } catch (e) {
      t.remove();
      addMsg('Не получилось оформить: ' + e.message);
    }
  }

  function run() {
    if (state.step < QUESTIONS.length) {
      const q = QUESTIONS[state.step];
      q.input ? askInput(q) : askChoices(q);
    } else if (!state.estimate) {
      showEstimate().then(askBudget).catch(() => {});
    }
  }

  return {
    open() {
      panel().classList.add('open');
      document.getElementById('aiFab').style.display = 'none';
      if (!state || state.done) {
        reset();
        addMsg('Расскажите, какой сайт нужен — или просто напишите «старт», и я проведу вас по коротким вопросам, а в конце назову точную цену.');
        inputRow().style.display = 'flex';
        const input = document.getElementById('aiTextInput');
        input.placeholder = 'Пара слов о проекте…';
        input.value = '';
        input.focus();
        const send = () => {
          const val = input.value.trim();
          if (!val) return;
          addMsg(escapeHtml(val), 'user');
          inputRow().style.display = 'none';
          state.step = 0;
          setTimeout(run, 280);
        };
        document.getElementById('aiSendBtn').onclick = send;
        input.onkeydown = e => { if (e.key === 'Enter') send(); };
      }
    },
    close() {
      panel().classList.remove('open');
      document.getElementById('aiFab').style.display = 'flex';
    },
    async continueAfterLogin() {
      const pending = sessionStorage.getItem('pendingOrder');
      if (!pending) return;
      sessionStorage.removeItem('pendingOrder');
      const { answers, estimate } = JSON.parse(pending);
      this.open();
      inputRow().style.display = 'none';
      state = { step: QUESTIONS.length, answers, estimate, done: false, estimate };
      await finish();
    }
  };
})();
