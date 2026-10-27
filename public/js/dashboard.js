/* ============ Кабинет клиента ============ */

const me = Auth.require('client');
if (me) {
  let orders = [];
  let reviews = [];
  let filter = 'all';
  let reviewedMap = {};          // orderId -> review
  const openChats = new Set();
  const RATING_LABELS = {
    1: 'Совсем не понравилось',
    2: 'Ниже ожиданий',
    3: 'Нормально, рабочий вариант',
    4: 'Понравилось',
    5: 'Отлично — очень доволен!'
  };

  document.getElementById('welcomeLine').textContent =
    `Здравствуйте, ${me.name}! Здесь статусы ваших проектов и чат со специалистом.`;

  document.getElementById('filterTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll('#filterTabs .tab').forEach(t => t.classList.toggle('active', t === btn));
    render();
  });

  async function load() {
    try {
      [orders, reviews] = await Promise.all([
        API.get('/api/orders'),
        API.get('/api/my-reviews')
      ]);
      reviewedMap = {};
      reviews.forEach(r => { if (r.orderId) reviewedMap[r.orderId] = r; });
      render();
    } catch (e) {
      toast(e.message);
    }
  }

  function render() {
    const counts = { all: orders.length, new: 0, accepted: 0, completed: 0, rejected: 0 };
    orders.forEach(o => counts[o.status]++);
    Object.keys(counts).forEach(k => {
      const el = document.getElementById('cnt-' + k);
      if (el) el.textContent = counts[k];
    });

    renderReviewBanner();

    const list = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    const root = document.getElementById('ordersList');

    if (!list.length) {
      root.innerHTML = `<div class="empty-state">
        <div class="big" data-icon="inbox" data-size="40"></div>
        <p>Заказов пока нет. Запустите ИИ-помощника — он задаст несколько вопросов и рассчитает смету.</p>
        <a class="btn btn-primary" style="margin-top:18px" href="/#assistant"><span data-icon="spark" data-size="16"></span>Рассчитать проект</a>
      </div>`;
      iconify(root);
      return;
    }

    root.innerHTML = list.map(o => orderCard(o)).join('');
    iconify(root);
  }

  /* ---- Баннер: есть завершённые заказы без отзыва ---- */
  function renderReviewBanner() {
    const slot = document.getElementById('reviewBannerSlot');
    const pending = orders.filter(o => o.status === 'completed' && !reviewedMap[o.id]);
    if (!pending.length) { slot.innerHTML = ''; return; }
    const o = pending[0];
    slot.innerHTML = `
      <div class="review-banner">
        <div>
          <h4>Проект #${o.id} завершён — как всё прошло?</h4>
          <p>Поделитесь впечатлениями: отзыв займёт минуту и появится на главной странице diska.</p>
        </div>
        <button class="btn btn-primary btn-review" onclick="openReviewModal(${o.id})"><span data-icon="star" data-size="15" data-solid="1"></span>Оставить отзыв</button>
      </div>`;
    iconify(slot);
  }

  function orderCard(o) {
    const est = o.estimate ? `${fmtPrice(o.estimate.priceMin)} — ${fmtPrice(o.estimate.priceMax)}` : '—';
    const myReview = reviewedMap[o.id];
    return `
    <div class="order-card pop-in" data-id="${o.id}">
      <div class="order-top">
        <div>
          <div class="order-title">Заказ #${o.id} · ${escapeHtml(o.title)}</div>
          <div class="order-meta">Создан ${fmtDateTime(o.createdAt)}</div>
        </div>
        <span class="status status-${o.status}">${STATUS_LABELS[o.status]}</span>
      </div>

      <div class="order-info">
        <div class="info-block"><div class="k">Оценка ИИ</div><div class="v">${est}</div></div>
        <div class="info-block"><div class="k">Итоговая цена</div><div class="v">${fmtPrice(o.priceFinal)}</div></div>
        <div class="info-block"><div class="k">Старт работ</div><div class="v">${fmtDate(o.startDate)}</div></div>
        <div class="info-block"><div class="k">Дедлайн</div><div class="v">${fmtDate(o.deadline)}</div></div>
      </div>

      ${o.adminComment ? `<div class="admin-note"><b>Сообщение специалиста</b>${escapeHtml(o.adminComment)}</div>` : ''}
      ${o.status === 'rejected' ? `<div class="admin-note" style="border-left-color:#e5484d"><b>Причина отказа</b>${escapeHtml(o.rejectReason)}</div>` : ''}
      ${o.brief ? `<div class="admin-note"><b>Бриф</b>${escapeHtml(o.brief)}</div>` : ''}

      ${myReview ? `
        <div class="my-review">
          <div class="who">Ваш отзыв · ${fmtDate(myReview.createdAt)}${myReview.approved ? '' : '<span class="pending-note">на модерации</span>'}</div>
          <div class="stars" style="margin-bottom:6px">${'★'.repeat(myReview.rating)}${'☆'.repeat(5 - myReview.rating)}</div>
          <p style="font-size:14px">${escapeHtml(myReview.text)}</p>
        </div>` : ''}

      <div class="order-actions">
        <button class="btn btn-sm" onclick="toggleChat(${o.id})"><span data-icon="chat" data-size="15"></span>Чат по заказу</button>
        ${o.status === 'completed' && !myReview ? `<button class="btn btn-sm btn-primary btn-review" onclick="openReviewModal(${o.id})"><span data-icon="star" data-size="14" data-solid="1"></span>Оставить отзыв</button>` : ''}
        ${o.status === 'completed' && myReview ? `<span style="font-size:13px;color:var(--muted);align-self:center;display:inline-flex;align-items:center;gap:6px"><span data-icon="check" data-size="14"></span>Спасибо за отзыв!</span>` : ''}
      </div>

      <div id="chatWrap-${o.id}" style="display:none;margin-top:14px"></div>
    </div>`;
  }

  /* ============ Отзыв: модалка со звёздами ============ */
  let reviewOrderId = null;
  let reviewRating = 5;

  window.openReviewModal = function (orderId) {
    reviewOrderId = orderId;
    reviewRating = 5;
    document.getElementById('reviewText').value = '';
    document.getElementById('reviewError').classList.remove('show');
    paintStars(5);
    document.getElementById('ratingLabel').textContent = RATING_LABELS[5];
    openModal('reviewModal');
  };

  function paintStars(v) {
    document.querySelectorAll('#starsPick span').forEach(s => {
      s.classList.toggle('on', Number(s.dataset.v) <= v);
    });
  }

  document.getElementById('starsPick').addEventListener('click', e => {
    const star = e.target.closest('span');
    if (!star) return;
    reviewRating = Number(star.dataset.v);
    paintStars(reviewRating);
    document.getElementById('ratingLabel').textContent = RATING_LABELS[reviewRating];
  });
  document.getElementById('starsPick').addEventListener('mouseover', e => {
    const star = e.target.closest('span');
    if (star) paintStars(Number(star.dataset.v));
  });
  document.getElementById('starsPick').addEventListener('mouseleave', () => paintStars(reviewRating));

  document.getElementById('reviewSubmit').onclick = async () => {
    const text = document.getElementById('reviewText').value.trim();
    const err = document.getElementById('reviewError');
    if (text.length < 5) {
      err.textContent = 'Напишите хотя бы пару слов о проекте';
      err.classList.add('show');
      return;
    }
    try {
      await API.post('/api/reviews', { orderId: reviewOrderId, rating: reviewRating, text });
      closeModal('reviewModal');
      toast('Спасибо! Отзыв отправлен на модерацию — после проверки он появится на витрине');
      await load();
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('show');
    }
  };

  /* ============ Чат ============ */
  window.toggleChat = async function (id) {
    const wrap = document.getElementById('chatWrap-' + id);
    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      openChats.add(id);
      wrap.innerHTML = chatTemplate();
      loadMessages(id);
    } else {
      wrap.style.display = 'none';
      openChats.delete(id);
    }
  };

  function chatTemplate() {
    return `
      <div class="chat">
        <div class="chat-box" id="chatBox"><div class="chat-empty">Сообщений пока нет — напишите первым</div></div>
        <form class="chat-form" onsubmit="sendMessage(event)">
          <input class="input" id="chatInput" placeholder="Ваше сообщение…" autocomplete="off">
          <button class="btn btn-primary btn-sm" type="submit">Отправить</button>
        </form>
      </div>`;
  }

  window.sendMessage = async function (e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const card = input.closest('.order-card');
    const id = Number(card.dataset.id);
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await API.post(`/api/orders/${id}/messages`, { text });
      loadMessages(id);
    } catch (err) {
      toast(err.message);
    }
  };

  async function loadMessages(id) {
    if (!openChats.has(id)) return;
    try {
      const msgs = await API.get(`/api/orders/${id}/messages`);
      const box = document.querySelector(`.order-card[data-id="${id}"] #chatBox`);
      if (!box) return;
      if (!msgs.length) {
        box.innerHTML = '<div class="chat-empty">Сообщений пока нет — напишите первым</div>';
        return;
      }
      box.innerHTML = msgs.map(m => {
        const mine = m.senderRole === 'client';
        return `<div class="chat-msg ${mine ? 'out' : 'in'}">
          ${mine ? '' : `<div class="who">${escapeHtml(m.senderName)}</div>`}
          ${escapeHtml(m.text)}
          <div class="time">${fmtDateTime(m.createdAt)}</div>
        </div>`;
      }).join('');
      box.scrollTop = box.scrollHeight;
    } catch (e) { /* тихо */ }
  }

  setInterval(() => openChats.forEach(id => loadMessages(id)), 4000);

  // Тихое обновление статусов: завершение заказа админом появляется без перезагрузки
  setInterval(async () => {
    try {
      const fresh = await API.get('/api/orders');
      const before = orders.map(o => `${o.id}:${o.status}`).join('|');
      const after = fresh.map(o => `${o.id}:${o.status}`).join('|');
      if (before === after) return;
      const reopen = [...openChats];
      await load();
      reopen.forEach(id => toggleChat(id));
      const needReview = orders.find(o => o.status === 'completed' && !reviewedMap[o.id]);
      if (needReview && !sessionStorage.getItem('reviewPromptShown')) {
        sessionStorage.setItem('reviewPromptShown', '1');
        setTimeout(() => openReviewModal(needReview.id), 600);
      }
    } catch (e) { /* тихо */ }
  }, 10000);

  /* ---- Глубокая ссылка из ИИ-помощника: ?order=ID&chat=1 ---- */
  async function init() {
    await load();
    const params = new URLSearchParams(location.search);
    const orderId = Number(params.get('order'));
    if (orderId && orders.some(o => o.id === orderId)) {
      filter = 'all';
      document.querySelectorAll('#filterTabs .tab').forEach(t =>
        t.classList.toggle('active', t.dataset.f === 'all'));
      render();
      if (params.get('chat') === '1') {
        setTimeout(() => toggleChat(orderId), 180);
      }
      setTimeout(() => {
        document.querySelector(`.order-card[data-id="${orderId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 280);
      history.replaceState({}, '', '/dashboard.html');
    }

    // После завершения заказа админом — сразу просим отзыв (один раз за сессию)
    const needReview = orders.find(o => o.status === 'completed' && !reviewedMap[o.id]);
    if (needReview && !sessionStorage.getItem('reviewPromptShown')) {
      sessionStorage.setItem('reviewPromptShown', '1');
      setTimeout(() => openReviewModal(needReview.id), 700);
    }
  }

  init();
}
