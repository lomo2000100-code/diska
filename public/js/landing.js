/* ============ Лендинг: статистика, отзывы, формы входа ============ */

async function loadStats() {
  try {
    const s = await API.get('/api/stats');
    animateNum('statClients', s.clients);
    animateNum('statProjects', s.completedOrders);
    animateNum('statReviews', s.reviews);
    document.getElementById('statRating').textContent = s.avgRating.toFixed(1);
  } catch (e) { /* тихо */ }
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 900, start = performance.now();
  function tick(t) {
    const p = Math.min(1, (t - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadReviews() {
  const grid = document.getElementById('reviewsGrid');
  try {
    const list = await API.get('/api/reviews');
    if (!list.length) {
      grid.innerHTML = `
        <div class="reviews-empty">
          <span data-icon="star" data-size="36"></span>
          <p>Здесь появятся отзывы реальных клиентов — после завершения проектов и проверки.</p>
        </div>`;
      iconify(grid);
      return;
    }
    grid.innerHTML = list.map((r, i) => `
      <div class="review-card pop-in" style="animation-delay:${i * 0.09}s">
        <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <p class="review-text">${escapeHtml(r.text)}</p>
        <div class="review-author">
          <span class="avatar">${escapeHtml(r.authorName.charAt(0).toUpperCase())}</span>
          <div>
            <div class="review-name">${escapeHtml(r.authorName)}</div>
            <div class="review-date">${fmtDate(r.createdAt)}</div>
          </div>
        </div>
      </div>`).join('');
    iconify(grid);
  } catch (e) { /* тихо */ }
}

function bindAuthForms() {
  const showErr = (id, msg) => {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
  };

  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    document.getElementById('regError').classList.remove('show');
    try {
      const data = await API.post('/api/register', {
        name: f.name.value, email: f.email.value, password: f.password.value
      });
      Auth.session = data;
      closeModal('registerModal');
      toast('Аккаунт создан. Добро пожаловать, ' + data.user.name + '!');
      renderNav();
      f.reset();
      if (sessionStorage.getItem('pendingOrder')) Assistant.continueAfterLogin();
    } catch (err) {
      showErr('regError', err.message);
    }
  });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    document.getElementById('loginError').classList.remove('show');
    try {
      const data = await API.post('/api/login', {
        email: f.email.value, password: f.password.value
      });
      Auth.session = data;
      closeModal('loginModal');
      toast('С возвращением, ' + data.user.name + '!');
      renderNav();
      f.reset();
      if (data.user.role === 'admin') {
        setTimeout(() => location.href = '/admin.html', 600);
      } else if (sessionStorage.getItem('pendingOrder')) {
        Assistant.continueAfterLogin();
      }
    } catch (err) {
      showErr('loginError', err.message);
    }
  });
}

function fillMarquee() {
  const items = ['Лендинги', 'Интернет-магазины', 'Веб-сервисы', 'Уникальный дизайн', 'SEO-настройка', 'Личные кабинеты', 'Онлайн-оплата', 'Поддержка 24/7'];
  const track = document.getElementById('marqueeTrack');
  if (!track) return;
  const chunk = items.map(t => `<span>${t}</span>`).join('');
  track.innerHTML = chunk + chunk; // дубль для бесшовной анимации
}

document.addEventListener('DOMContentLoaded', () => {
  fillMarquee();
  loadStats();
  loadReviews();
  bindAuthForms();
  if (location.hash === '#assistant') setTimeout(() => Assistant.open(), 400);
});
