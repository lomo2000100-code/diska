/* ============ ИИ-помощник: диалог расчёта стоимости ============ */

const Assistant = (() => {
  const panel = () => document.getElementById('aiPanel');
  const body = () => document.getElementById('aiBody');
  const inputRow = () => document.getElementById('aiInputRow');
  let state = null;

  const QUESTIONS = [
    {
      key: 'type',
      q: 'Привет! Я помогу рассчитать стоимость сайта. Какая задача перед нами стоит?',
      options: [
        { v: 'landing', t: 'Лендинг' },
        { v: 'corporate', t: 'Сайт компании' },
        { v: 'shop', t: 'Интернет-магазин' },
        { v: 'webapp', t: 'Веб-сервис / приложение' },
        { v: 'portfolio', t: 'Портфолио' }
      ]
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
      key: 'features',
      q: 'Какие функции нужны? Можно выбрать несколько, затем нажмите «Продолжить».',
      multi: true,
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
    state = { step: 0, answers: { features: [] }, done: false };
    body().innerHTML = '';
    inputRow().style.display = 'none';
  }

  function scrollDown() {
    const b = body();
    b.scrollTop = b.scrollHeight;
  }

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

  function askQuestion() {
    const q = QUESTIONS[state.step];
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
          state.answers[q.key] = opt.v;
          wrap.querySelectorAll('.choice').forEach(c => c.disabled = true);
          addMsg(opt.t, 'user');
          state.step++;
          setTimeout(run, 350);
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
        wrap.querySelectorAll('.choice').forEach(c => c.disabled = true);
        const picked = state.answers.features.map(v => q.options.find(o => o.v === v).t).join(', ');
        addMsg(picked || 'Без дополнительных функций', 'user');
        state.step++;
        setTimeout(run, 350);
      };
      wrap.appendChild(next);
    }
    body().appendChild(wrap);
    scrollDown();
  }

  async function showEstimate() {
    const t = addTyping();
    let est;
    try {
      est = await API.post('/api/assistant/estimate', state.answers);
    } catch (e) {
      t.remove();
      addMsg('Не удалось рассчитать смету: ' + e.message);
      return;
    }
    t.remove();
    state.estimate = est;
    const el = document.createElement('div');
    el.className = 'msg estimate';
    el.innerHTML = `
      <b>Готово! Ориентировочная смета:</b>
      <div class="est-price">${fmtPrice(est.priceMin)} — ${fmtPrice(est.priceMax)}</div>
      <div class="est-meta">Примерный срок разработки: ~${est.approxDays} раб. дней. Точную цену и даты подтвердит специалист после оформления.</div>
      <div class="est-list">${est.summary.map(s => `· ${escapeHtml(s)}`).join('')}</div>
      <button class="btn btn-primary btn-block btn-sm" id="createOrderBtn">Оформить заказ</button>
      <button class="btn btn-block btn-sm" style="margin-top:8px" id="restartBtn">Пройти заново</button>`;
    body().appendChild(el);
    el.querySelector('#restartBtn').onclick = () => { reset(); run(); };
    el.querySelector('#createOrderBtn').onclick = createOrder;
    scrollDown();
  }

  async function createOrder() {
    if (!Auth.user) {
      addMsg('Чтобы оформить заказ, нужно войти или зарегистрироваться — это займёт минуту. После входа я сразу отправлю заказ.');
      openModal('registerModal');
      sessionStorage.setItem('pendingOrder', JSON.stringify(state.answers));
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
      addMsg(`Заказ #${order.id} оформлен и отправлен специалисту. Можете сразу открыть чат по заказу и написать детали — я отвечу в этом же диалоге.`);
      const el = document.createElement('div');
      el.className = 'choices';
      el.innerHTML = `
        <a class="choice selected" href="/dashboard.html?order=${order.id}&chat=1">Перейти в чат заказа</a>
        <a class="choice" href="/dashboard.html">Мои заказы</a>`;
      body().appendChild(el);
      state.done = true;
      inputRow().style.display = 'none';
      scrollDown();
    } catch (e) {
      t.remove();
      addMsg('Ошибка: ' + e.message);
    }
  }

  function askFreeText() {
    addMsg('Расскажите в двух словах о проекте — или просто напишите «старт», и я задам несколько коротких вопросов для точного расчёта.');
    inputRow().style.display = 'flex';
    const input = document.getElementById('aiTextInput');
    input.focus();
    const send = () => {
      const val = input.value.trim();
      if (!val) return;
      addMsg(escapeHtml(val), 'user');
      input.value = '';
      inputRow().style.display = 'none';
      state.step = 0;
      setTimeout(run, 350);
    };
    document.getElementById('aiSendBtn').onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };
  }

  function run() {
    if (state.step < QUESTIONS.length) {
      askQuestion();
    } else {
      showEstimate();
    }
  }

  return {
    open() {
      panel().classList.add('open');
      document.getElementById('aiFab').style.display = 'none';
      if (!state || state.done) {
        reset();
        askFreeText();
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
      this.open();
      inputRow().style.display = 'none';
      state = { step: QUESTIONS.length, answers: JSON.parse(pending), done: false };
      await showEstimate();
    }
  };
})();
