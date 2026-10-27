/* ============ ИИ-помощник: расширенный диалог расчёта ============ */

const Assistant = (() => {
  const panel = () => document.getElementById('aiPanel');
  const body = () => document.getElementById('aiBody');
  const inputRow = () => document.getElementById('aiInputRow');
  let state = null;

  const QUESTIONS = [
    {
      key: 'type',
      q: 'Привет! Я соберу техническое задание и рассчитаю стоимость. Какая задача перед нами стоит?',
      options: [
        { v: 'landing', t: 'Лендинг' },
        { v: 'corporate', t: 'Сайт компании' },
        { v: 'shop', t: 'Интернет-магазин' },
        { v: 'webapp', t: 'Веб-сервис / приложение' },
        { v: 'portfolio', t: 'Портфолио' }
      ]
    },
    {
      key: 'niche',
      input: true,
      placeholder: 'Например: кофейня, юрист, магазин одежды…',
      q: 'О чём сайт? Напишите тематику или нишу бизнеса своими словами.'
    },
    {
      key: 'products',
      input: true,
      placeholder: 'Например: авторские десерты и кофе навынос…',
      q: 'Какая у вас продукция или услуги? Перечислите главное.'
    },
    {
      key: 'pages',
      q: 'Сколько примерно страниц или экранов нужно?',
      options: [
        { v: '1', t: '1 (одностраничник)' },
        { v: '3', t: '2–5' },
        { v: '8', t: '6–10' },
        { v: '12', t: 'Больше 10' }
      ]
    },
    {
      key: 'design',
      q: 'Какой дизайн хотите?',
      options: [
        { v: 'template', t: 'Шаблонный — быстрее и дешевле' },
        { v: 'unique', t: 'Уникальный — с нуля' },
        { v: 'premium', t: 'Премиум под бренд' }
      ]
    },
    {
      key: 'colorTheme',
      q: 'Какой фон и цветовая тема ближе?',
      options: [
        { v: 'dark', t: 'Тёмная тема фона' },
        { v: 'light', t: 'Светлая тема фона' },
        { v: 'brand', t: 'Фирменные цвета бренда' },
        { v: 'mono', t: 'Чёрно-белый минимализм' }
      ]
    },
    {
      key: 'animations',
      q: 'Нужны ли анимации?',
      options: [
        { v: 'none', t: 'Без анимаций' },
        { v: 'light', t: 'Лёгкие микроанимации' },
        { v: 'parallax', t: 'Параллакс и скролл-эффекты' },
        { v: 'rich', t: 'Богатые анимации и интерактив' }
      ]
    },
    {
      key: 'features',
      multi: true,
      q: 'Какие функции нужны? Можно выбрать несколько, затем нажмите «Продолжить».',
      options: [
        { v: 'forms', t: 'Формы заявок' },
        { v: 'catalog', t: 'Каталог и корзина' },
        { v: 'payment', t: 'Онлайн-оплата' },
        { v: 'cabinet', t: 'Личный кабинет' },
        { v: 'blog', t: 'Блог / новости' },
        { v: 'multi', t: 'Мультиязычность' },
        { v: 'seo', t: 'SEO-настройка' },
        { v: 'admin', t: 'Админ-панель' }
      ]
    },
    {
      key: 'urgency',
      q: 'Насколько горят сроки?',
      options: [
        { v: 'fast', t: 'Срочно, нужно быстрее' },
        { v: 'normal', t: 'Обычные сроки' },
        { v: 'relaxed', t: 'Не спеша, важнее цена' }
      ]
    }
  ];

  function reset() {
    state = { step: 0, answers: { features: [] }, done: false, estimate: null, budgetMode: false };
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

    q.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = opt.t;
      b.onclick = () => {
        if (q.multi) {
          b.classList.toggle('selected');
          const arr = state.answers.features;
          const i = arr.indexOf(opt.v);
          if (i >= 0) arr.splice(i, 1); else arr.push(opt.v);
        } else {
          disableChoices(wrap);
          state.answers[q.key] = opt.v;
          addMsg(opt.t, 'user');
          state.step++;
          setTimeout(run, 300);
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
        const picked = state.answers.features
          .map(v => q.options.find(o => o.v === v)?.t).filter(Boolean).join(', ');
        addMsg(picked || 'Без дополнительных функций', 'user');
        state.step++;
        setTimeout(run, 300);
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
      const val = input.value.trim();
      if (val.length < 2) { input.focus(); return; }
      addMsg(escapeHtml(val), 'user');
      state.answers[q.key] = val.slice(0, 300);
      inputRow().style.display = 'none';
      input.placeholder = 'Опишите задачу своими словами…';
      state.step++;
      setTimeout(run, 300);
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
      addMsg('Не удалось рассчитать смету: ' + e.message);
      return;
    }
    t.remove();
    const est = state.estimate;
    const el = document.createElement('div');
    el.className = 'msg estimate';
    el.innerHTML = `
      <b>Смета по вашим ответам:</b>
      <div class="est-price">${fmtPrice(est.priceMin)} — ${fmtPrice(est.priceMax)}</div>
      <div class="est-meta">Примерный срок: ~${est.approxDays} раб. дней. Ниже минимальной суммы проект взять не получится.</div>
      <div class="est-list">${est.summary.map(s => `· ${escapeHtml(s)}`).join('')}</div>`;
    body().appendChild(el);
    scrollDown();
  }

  function askBudget() {
    const est = state.estimate;
    const opt = Math.round((est.priceMin + est.priceMax) / 2 / 1000) * 1000;
    addMsg(`На какую сумму вы рассчитываете? Минимальный порог по этому ТЗ — <b>${fmtPrice(est.priceMin)}</b>.`);
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    const tiers = [
      { v: est.priceMin, t: `Минимум — ${fmtPrice(est.priceMin)}` },
      { v: opt, t: `Оптимум — ${fmtPrice(opt)}` },
      { v: est.priceMax, t: `Максимум — ${fmtPrice(est.priceMax)}` },
      { v: 'custom', t: 'Своя сумма' }
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
          setTimeout(finish, 300);
        }
      };
      wrap.appendChild(b);
    });
    body().appendChild(wrap);
    scrollDown();
  }

  function customBudget() {
    addMsg('Введите сумму в рублях одним числом (например, 50000).');
    inputRow().style.display = 'flex';
    const input = document.getElementById('aiTextInput');
    input.placeholder = 'Сумма в рублях…';
    input.value = '';
    input.focus();
    const send = () => {
      const val = parseInt(input.value.replace(/\D/g, ''), 10);
      if (!val || val <= 0) { addMsg('Введите положительное число.'); input.focus(); return; }
      if (val < state.estimate.priceMin) {
        addMsg(String(val.toLocaleString('ru-RU')) + ' ₽', 'user');
        addMsg(`Не получится: минимум по вашим требованиям — ${fmtPrice(state.estimate.priceMin)}. Можно уменьшить функции или упростить дизайн, либо подтвердить минимальную сумму. Введите сумму ещё раз.`);
        input.value = '';
        input.focus();
        return;
      }
      addMsg(fmtPrice(val), 'user');
      state.answers.budget = val;
      inputRow().style.display = 'none';
      input.placeholder = 'Опишите задачу своими словами…';
      setTimeout(finish, 300);
    };
    document.getElementById('aiSendBtn').onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  async function finish() {
    if (!Auth.user) {
      addMsg('Чтобы оформить заказ, нужно войти или зарегистрироваться — это займёт минуту. После входя я сразу отправлю заказ с готовым промтом.');
      openModal('registerModal');
      sessionStorage.setItem('pendingOrder', JSON.stringify({ answers: state.answers, estimate: state.estimate }));
      return;
    }
    const t = addTyping();
    try {
      const order = await API.post('/api/orders', {
        title: 'Заказ через ИИ-помощника',
        brief: state.estimate.summary.join('; '),
        answers: state.answers,
        estimate: state.estimate
      });
      t.remove();
      state.done = true;
      addMsg(`Заказ #${order.id} оформлен. Специалист получит готовый промт и смету, подтвердит сроки. Можете сразу открыть чат по заказу и прикрепить файлы — фото, референсы, макеты.`);
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
      addMsg('Ошибка: ' + e.message);
    }
  }

  function run() {
    if (state.step < QUESTIONS.length) {
      const q = QUESTIONS[state.step];
      q.input ? askInput(q) : askChoices(q);
    } else if (!state.estimate) {
      showEstimate().then(() => askBudget());
    }
  }

  return {
    open() {
      panel().classList.add('open');
      document.getElementById('aiFab').style.display = 'none';
      if (!state || state.done) {
        reset();
        addMsg('Расскажите о проекте — или напишите «старт», и я задам несколько коротких вопросов для точного расчёта.');
        inputRow().style.display = 'flex';
        const input = document.getElementById('aiTextInput');
        input.placeholder = 'Опишите задачу своими словами…';
        input.value = '';
        input.focus();
        const send = () => {
          const val = input.value.trim();
          if (!val) return;
          addMsg(escapeHtml(val), 'user');
          inputRow().style.display = 'none';
          state.step = 0;
          setTimeout(run, 300);
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
