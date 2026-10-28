/* ============ Админ-панель ============ */

const me = Auth.require('admin');
if (me) {
  let orders = [], clients = [], reviews = [];
  let tab = 'orders', filter = 'all';
  const openChats = new Set();
  let activeOrderId = null;

  /* ---- Вкладки ---- */
  document.getElementById('mainTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    tab = btn.dataset.t;
    document.querySelectorAll('#mainTabs .tab').forEach(t => t.classList.toggle('active', t === btn));
    ['orders', 'clients', 'reviews'].forEach(t => {
      document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
    });
  });

  document.getElementById('orderFilters').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    filter = btn.dataset.f;
    document.querySelectorAll('#orderFilters .tab').forEach(t => t.classList.toggle('active', t === btn));
    renderOrders();
  });

  /* ---- Загрузка данных ---- */
  async function loadAll() {
    try {
      [orders, clients, reviews, stats] = await Promise.all([
        API.get('/api/orders'),
        API.get('/api/admin/clients'),
        API.get('/api/admin/reviews'),
        API.get('/api/stats')
      ]);
      renderStats(stats);
      renderOrders();
      renderClients();
      renderReviews();
    } catch (e) {
      toast(e.message);
    }
  }
  let stats = null;

  function renderStats(s) {
    const newCnt = orders.filter(o => o.status === 'new').length;
    const workCnt = orders.filter(o => o.status === 'accepted').length;
    document.getElementById('adminStats').innerHTML = [
      [s.clients, 'Клиентов зарегистрировано'],
      [newCnt, 'Новых заказов'],
      [workCnt, 'Заказов в работе'],
      [s.completedOrders, 'Проектов сдано']
    ].map(([n, l]) => `<div class="admin-stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  }

  /* ---- Заказы ---- */
  function renderOrders() {
    const list = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    const root = document.getElementById('ordersList');
    if (!list.length) {
      root.innerHTML = `<div class="empty-state"><div class="big" data-icon="package" data-size="40"></div><p>Заказов в этой категории нет</p></div>`;
      iconify(root);
      return;
    }
    root.innerHTML = list.map(o => orderCard(o)).join('');
    iconify(root);
  }

  function orderCard(o) {
    const est = o.estimate ? `${fmtPrice(o.estimate.priceMin)} — ${fmtPrice(o.estimate.priceMax)}` : '—';
    const days = o.estimate?.approxDays ? `~${o.estimate.approxDays} раб. дней` : '—';
    const summary = o.estimate?.summary?.map(s => `<div>· ${escapeHtml(s)}</div>`).join('') || escapeHtml(o.brief || '—');

    let actions = '';
    if (o.status === 'new') {
      actions = `
        <button class="btn btn-sm btn-success" onclick="openAccept(${o.id})"><span data-icon="check" data-size="15"></span>Принять в работу</button>
        <button class="btn btn-sm btn-danger" onclick="openReject(${o.id})"><span data-icon="x" data-size="15"></span>Отклонить</button>`;
    } else if (o.status === 'accepted') {
      actions = `
        <button class="btn btn-sm btn-success" onclick="completeOrder(${o.id})"><span data-icon="check" data-size="15"></span>Завершить проект</button>
        <button class="btn btn-sm btn-danger" onclick="openReject(${o.id})"><span data-icon="x" data-size="15"></span>Отменить</button>`;
    }

    return `
    <div class="order-card" data-id="${o.id}">
      <div class="order-top">
        <div>
          <div class="order-title">Заказ #${o.id} · ${escapeHtml(o.title)}</div>
          <div class="order-meta">
            ${escapeHtml(o.client?.name || '—')} · ${escapeHtml(o.client?.email || '')} · создан ${fmtDateTime(o.createdAt)}
          </div>
        </div>
        <span class="status status-${o.status}">${STATUS_LABELS[o.status]}</span>
      </div>

      <div class="order-info">
        <div class="info-block"><div class="k">Смета ИИ</div><div class="v">${est}</div></div>
        <div class="info-block"><div class="k">Бюджет клиента</div><div class="v">${fmtPrice(o.answers?.budget)}</div></div>
        <div class="info-block"><div class="k">Оценка срока ИИ</div><div class="v">${days}</div></div>
        <div class="info-block"><div class="k">Цена для клиента</div><div class="v">${fmtPrice(o.priceFinal)}</div></div>
        <div class="info-block"><div class="k">Старт / дедлайн</div><div class="v">${fmtDate(o.startDate)} / ${fmtDate(o.deadline)}</div></div>
      </div>

      <div class="admin-note"><b>Параметры заказа</b><div style="display:grid;gap:2px;font-size:13.5px">${summary}</div></div>

      ${o.prompt ? `
      <div class="prompt-block">
        <div class="prompt-head">
          <b>Промт для генерации сайта в ИИ</b>
          <button class="btn btn-sm" onclick='copyPrompt(this)' data-prompt="${escapeHtml(o.prompt).replace(/"/g, '&quot;')}">
            <span data-icon="copy" data-size="14"></span>Копировать
          </button>
        </div>
        <pre class="prompt-text">${escapeHtml(o.prompt)}</pre>
      </div>` : ''}

      ${o.adminComment ? `<div class="admin-note"><b>Ваш комментарий</b>${escapeHtml(o.adminComment)}</div>` : ''}
      ${o.rejectReason ? `<div class="admin-note" style="border-left-color:#e5484d"><b>Причина отказа</b>${escapeHtml(o.rejectReason)}</div>` : ''}

      <div class="deliverable-block">
        ${o.deliverable ? `
          <div class="deliverable-card">
            <span data-icon="archive" data-size="20"></span>
            <div class="att-meta"><b>${escapeHtml(o.deliverable.originalName)}</b><small>${fmtSize(o.deliverable.size)} · загружен ${fmtDateTime(o.deliverable.createdAt)}</small></div>
            <a class="btn btn-sm" href="/api/orders/${o.id}/deliverable?token=${encodeURIComponent(API.token || '')}" target="_blank"><span data-icon="download" data-size="14"></span>Скачать</a>
            <button class="btn btn-sm btn-danger" onclick="removeDeliverable(${o.id})"><span data-icon="x" data-size="14"></span></button>
          </div>` : ''}
        <button class="btn btn-sm btn-primary" onclick="document.getElementById('dlFile-${o.id}').click()">
          <span data-icon="archive" data-size="15"></span>${o.deliverable ? 'Заменить ZIP с сайтом' : 'Прикрепить готовый сайт (ZIP)'}
        </button>
        <input type="file" id="dlFile-${o.id}" style="display:none" onchange="uploadDeliverable(event, ${o.id})">
      </div>

      <div class="order-actions">
        ${actions}
        <button class="btn btn-sm" onclick="toggleChat(${o.id})"><span data-icon="chat" data-size="15"></span>Чат с клиентом</button>
      </div>
      <div id="chatWrap-${o.id}" style="display:none;margin-top:14px"></div>
    </div>`;
  }

  /* ---- Промт: копирование ---- */
  window.copyPrompt = function (btn) {
    copyText(btn.dataset.prompt);
  };

  /* ---- Выдача готового ZIP ---- */
  window.uploadDeliverable = async function (e, id) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast('Файл больше 25 МБ');
    try {
      const dataUrl = await readFileAsDataURL(file);
      await API.post(`/api/orders/${id}/deliverable`, { file: { name: file.name, dataUrl } });
      toast('ZIP прикреплён — клиент может скачать его в заказе');
      loadAll();
    } catch (err) {
      toast(err.message);
    }
  };

  window.removeDeliverable = async function (id) {
    if (!confirm('Убрать файл выдачи? Клиент перестанет его видеть.')) return;
    try {
      await API.del(`/api/orders/${id}/deliverable`);
      toast('Файл удалён');
      loadAll();
    } catch (err) {
      toast(err.message);
    }
  };

  /* ---- Принятие заказа ---- */
  window.openAccept = function (id) {
    const o = orders.find(x => x.id === id);
    if (!o) return toast('Заказ не найден');
    activeOrderId = o.id;
    document.getElementById('acPrice').value = o.estimate?.priceMin || '';
    const today = new Date();
    document.getElementById('acStart').value = today.toISOString().slice(0, 10);
    const dl = new Date(today);
    dl.setDate(dl.getDate() + (o.estimate?.approxDays || 14));
    document.getElementById('acDeadline').value = dl.toISOString().slice(0, 10);
    document.getElementById('acComment').value = '';
    document.getElementById('acceptError').classList.remove('show');
    openModal('acceptModal');
  };

  document.getElementById('acceptSubmit').onclick = async () => {
    const price = Number(document.getElementById('acPrice').value);
    const startDate = document.getElementById('acStart').value;
    const deadline = document.getElementById('acDeadline').value;
    const adminComment = document.getElementById('acComment').value.trim();
    const err = document.getElementById('acceptError');
    if (!price || price <= 0) { err.textContent = 'Укажите корректную стоимость'; err.classList.add('show'); return; }
    if (!startDate || !deadline) { err.textContent = 'Укажите дату старта и дедлайн'; err.classList.add('show'); return; }
    try {
      await API.patch('/api/orders/' + activeOrderId, { action: 'accept', priceFinal: price, startDate, deadline, adminComment });
      closeModal('acceptModal');
      toast('Заказ принят — клиент получил уведомление в кабинете');
      loadAll();
    } catch (e) {
      err.textContent = e.message; err.classList.add('show');
    }
  };

  /* ---- Отклонение ---- */
  window.openReject = function (id) {
    activeOrderId = id;
    document.getElementById('rjReason').value = '';
    openModal('rejectModal');
  };

  document.getElementById('rejectSubmit').onclick = async () => {
    const rejectReason = document.getElementById('rjReason').value.trim();
    if (!rejectReason) return toast('Укажите причину отказа');
    try {
      await API.patch('/api/orders/' + activeOrderId, { action: 'reject', rejectReason });
      closeModal('rejectModal');
      toast('Заказ отклонён');
      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  /* ---- Завершение ---- */
  window.completeOrder = async function (id) {
    if (!confirm('Завершить проект? Клиент сможет оставить отзыв.')) return;
    try {
      await API.patch('/api/orders/' + id, { action: 'complete' });
      toast('Проект завершён — клиент может оставить отзыв');
      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  /* ---- Чат ---- */
  window.toggleChat = function (id) {
    const wrap = document.getElementById('chatWrap-' + id);
    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      openChats.add(id);
      wrap.innerHTML = `
        <div class="chat">
          <div class="chat-box" id="chatBox"><div class="chat-empty">Загрузка…</div></div>
          <form class="chat-form" onsubmit="sendMessage(event)">
            <button type="button" class="icon-btn chat-attach" title="Прикрепить файл" onclick="document.getElementById('chatFile').click()">
              <span data-icon="paperclip" data-size="17"></span>
            </button>
            <input type="file" id="chatFile" style="display:none" onchange="sendFile(event)">
            <input class="input" id="chatInput" placeholder="Ответить клиенту или прикрепить файл…" autocomplete="off">
            <button class="btn btn-primary btn-sm" type="submit">Отправить</button>
          </form>
          <div class="chat-hint">Файлы любого типа до 25 МБ: фото, макеты, архивы, ТЗ</div>
        </div>`;
      iconify(wrap);
      loadMessages(id);
    } else {
      wrap.style.display = 'none';
      openChats.delete(id);
    }
  };

  window.sendMessage = async function (e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const id = Number(input.closest('.order-card').dataset.id);
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

  window.sendFile = async function (e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast('Файл больше 25 МБ');
    const id = Number(e.target.closest('.order-card').dataset.id);
    try {
      const dataUrl = await readFileAsDataURL(file);
      await API.post(`/api/orders/${id}/messages`, { text: '', attachment: { name: file.name, dataUrl } });
      toast('Файл отправлен клиенту');
      loadMessages(id);
    } catch (err) {
      toast(err.message);
    }
  };

  const chatSignatures = {};
  async function loadMessages(id) {
    if (!openChats.has(id)) return;
    try {
      const msgs = await API.get(`/api/orders/${id}/messages`);
      const box = document.querySelector(`.order-card[data-id="${id}"] #chatBox`);
      if (!box) return;
      if (!msgs.length) {
        box.innerHTML = '<div class="chat-empty">Сообщений пока нет — напишите первым или прикрепите файл</div>';
        chatSignatures[id] = '';
        return;
      }
      const signature = msgs.map(m => m.id + (m.attachment ? m.attachment.storedName : '')).join('|');
      if (signature === chatSignatures[id]) return; // новых сообщений нет
      chatSignatures[id] = signature;
      box.innerHTML = msgs.map(m => {
        const mine = m.senderRole === 'admin';
        return `<div class="chat-msg ${mine ? 'out' : 'in'}">
          ${mine ? '' : `<div class="who">${escapeHtml(m.senderName)}</div>`}
          ${m.text ? `<div class="msg-text">${escapeHtml(m.text)}</div>` : ''}
          ${m.attachment ? attachmentHtml(m.attachment, id, m.id) : ''}
          <div class="time">${fmtDateTime(m.createdAt)}</div>
        </div>`;
      }).join('');
      iconify(box);
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
        setTimeout(() => { box.scrollTop = box.scrollHeight; }, 300);
      });
    } catch (e) { /* тихо */ }
  }

  setInterval(() => openChats.forEach(id => loadMessages(id)), 4000);
  setInterval(loadAll, 15000);

  /* ---- Клиенты ---- */
  function renderClients() {
    const body = document.getElementById('clientsBody');
    if (!clients.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Пока нет клиентов</td></tr>';
      return;
    }
    body.innerHTML = clients.map(c => {
      const cnt = orders.filter(o => o.userId === c.id).length;
      return `<tr>
        <td>#${c.id}</td>
        <td><b>${escapeHtml(c.name)}</b></td>
        <td>${escapeHtml(c.email)}</td>
        <td>${cnt}</td>
        <td>${fmtDate(c.createdAt)}</td>
      </tr>`;
    }).join('');
  }

  /* ---- Отзывы: модерация витрины ---- */
  function renderReviews() {
    const root = document.getElementById('reviewsList');
    if (!reviews.length) {
      root.innerHTML = `<div class="empty-state">
        <div class="big" data-icon="star" data-size="40"></div>
        <p>Отзывов пока нет. Они появятся здесь, когда клиенты завершат проекты и оставят оценку.</p>
      </div>`;
      iconify(root);
      return;
    }
    const pending = reviews.filter(r => !r.approved).length;
    root.innerHTML = (pending ? `
      <div class="review-banner" style="border-style:solid">
        <div>
          <h4>Отзывов на модерации: ${pending}</h4>
          <p>Одобренные отзывы отображаются на главной странице, остальные видите только вы.</p>
        </div>
      </div>` : '') +
      reviews.map(r => `
      <div class="order-card" style="margin-bottom:14px;${r.approved ? '' : 'border-style:dashed'}">
        <div class="order-top">
          <div>
            <div class="order-title">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} · ${escapeHtml(r.authorName || 'Клиент')}</div>
            <div class="order-meta">${fmtDateTime(r.createdAt)}${r.orderId ? ` · заказ #${r.orderId}` : ''}</div>
          </div>
          <span class="status ${r.approved ? 'status-completed' : 'status-moderation'}">${r.approved ? 'На витрине' : 'На модерации'}</span>
        </div>
        <p style="font-size:14.5px">${escapeHtml(r.text)}</p>
        <div class="review-tools">
          ${r.approved
            ? `<button class="btn btn-sm" onclick="setReviewApproval(${r.id}, false)"><span data-icon="eye-off" data-size="15"></span>Скрыть с витрины</button>`
            : `<button class="btn btn-sm btn-success" onclick="setReviewApproval(${r.id}, true)"><span data-icon="check" data-size="15"></span>Одобрить на витрину</button>`}
          <button class="btn btn-sm btn-danger" onclick="deleteReview(${r.id})"><span data-icon="x" data-size="15"></span>Удалить</button>
        </div>
      </div>`).join('');
    iconify(root);
  }

  window.setReviewApproval = async function (id, approved) {
    try {
      await API.patch('/api/admin/reviews/' + id, { approved });
      toast(approved ? 'Отзыв опубликован на витрине' : 'Отзыв скрыт с витрины');
      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  window.deleteReview = async function (id) {
    if (!confirm('Удалить этот отзыв?')) return;
    try {
      await API.del('/api/admin/reviews/' + id);
      toast('Отзыв удалён');
      loadAll();
    } catch (e) {
      toast(e.message);
    }
  };

  loadAll();
}
