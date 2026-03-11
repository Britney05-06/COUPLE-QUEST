/* ═══════════════════════════════════════════
   CoupleQuest — script.js
═══════════════════════════════════════════ */

const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

// ─── State ───
let token = localStorage.getItem('cq_token') || null;
let currentUser = JSON.parse(localStorage.getItem('cq_user') || 'null');
let coupleData = null;
let currentQ = 0;
let answers = {};
let letter = '';

// ─── Reactions ───
const REACTIONS = [
  { emoji:'✨', text:'Belle réponse !' },
  { emoji:'🌸', text:'On avance !' },
  { emoji:'💖', text:'Honnêteté = ❤️' },
  { emoji:'🥰', text:'Super !' },
  { emoji:'🌟', text:'Continue !' },
  { emoji:'💫', text:'Presque fini !' },
  { emoji:'🌷', text:'Tu gères !' },
  { emoji:'💕', text:'Courage !' },
];

// ─── Gages ───
const GAGES = [
  'Raconte à l\'autre une chose que tu n\'as jamais osé dire 👀',
  'Fais un câlin de 30 secondes sans parler 🤗',
  'Écris 5 choses que tu apprécies chez l\'autre et lisez-les à voix haute 💌',
  'Prépare le prochain repas pour l\'autre — son plat préféré 🍳',
  'Planifiez ensemble une sortie pour le mois prochain 📅',
  'Offre 10 minutes de massage sans attendre rien en échange 💆',
  'Regardez ensemble vos plus vieilles photos et racontez-vous ce souvenir 📸',
  'Proposez chacun un "rituel du soir" à tester pendant une semaine 🌙',
  'Envoyez-vous un vocal de 2 minutes pour dire ce que vous aimez chez l\'autre 🎙️',
  'Préparez chacun une liste de 3 choses à améliorer — et lisez-les ensemble 📋',
];

// ══════════════════════════════════════════════
// ENNÉAGRAMME
// ══════════════════════════════════════════════
function calculateEnneagram(userAnswers) {
  const scores = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
  QUESTIONS.filter(q => q.type === 'chips-enneagram').forEach(q => {
    const val = userAnswers[q.id];
    if (val !== undefined && val !== null) {
      const idx = parseInt(val);
      if (!isNaN(idx) && q.options[idx]) {
        scores[q.options[idx].type]++;
      }
    }
  });
  return parseInt(Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0]);
}

function renderEnneagramCard(type, prenom, photoUrl, isUser1) {
  const p = ENNEAGRAM_PROFILES[type];
  if (!p) return '';
  const avatarHtml = photoUrl
    ? `<img src="${photoUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid ${p.accent}">`
    : `<div style="width:52px;height:52px;border-radius:50%;background:${p.color};border:3px solid ${p.accent};display:flex;align-items:center;justify-content:center;font-size:1.4rem">${p.emoji}</div>`;

  return `
    <div style="background:${p.color};border-radius:24px;padding:24px;margin-bottom:12px;border-left:5px solid ${p.accent}">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        ${avatarHtml}
        <div>
          <div style="font-size:0.75rem;font-weight:800;color:${p.accent};text-transform:uppercase;letter-spacing:1px">${prenom}</div>
          <div style="font-family:'Pacifico',cursive;font-size:1.3rem;color:#3D2540">${p.emoji} ${p.name}</div>
          <div style="font-size:0.8rem;color:#7A5A80;font-weight:600;font-style:italic">${p.quote}</div>
        </div>
      </div>
      <div style="display:grid;gap:10px">
        <div style="background:rgba(255,255,255,0.7);border-radius:14px;padding:12px 16px">
          <div style="font-size:0.7rem;font-weight:800;color:${p.accent};margin-bottom:4px">✨ CÔTÉ LUMINEUX</div>
          <div style="font-size:0.85rem;font-weight:600;color:#3D2540">${p.light}</div>
        </div>
        <div style="background:rgba(255,255,255,0.7);border-radius:14px;padding:12px 16px">
          <div style="font-size:0.7rem;font-weight:800;color:#e64a19;margin-bottom:4px">🌑 CÔTÉ SOMBRE</div>
          <div style="font-size:0.85rem;font-weight:600;color:#3D2540">${p.shadow}</div>
        </div>
        <div style="background:rgba(255,255,255,0.7);border-radius:14px;padding:12px 16px">
          <div style="font-size:0.7rem;font-weight:800;color:#e91e63;margin-bottom:4px">💕 EN AMOUR</div>
          <div style="font-size:0.85rem;font-weight:600;color:#3D2540">${p.love}</div>
        </div>
      </div>
    </div>`;
}

function renderCompatibility(type1, type2, name1, name2) {
  const same = type1 === type2;
  const p1 = ENNEAGRAM_PROFILES[type1];
  const p2 = ENNEAGRAM_PROFILES[type2];

  const combos = {
    '1-9': { score:'💚 Très compatible', text:'Le Perfectionniste et le Médiateur se complètent naturellement — l\'un apporte la structure, l\'autre l\'harmonie.' },
    '2-8': { score:'💚 Très compatible', text:'L\'Altruiste et le Chef forment un duo puissant — l\'un donne, l\'autre protège.' },
    '3-6': { score:'💛 Compatible', text:'Le Battant et le Loyal peuvent avancer ensemble si la confiance est bien établie.' },
    '4-5': { score:'💛 Compatible', text:'Le Romantique et l\'Observateur se comprennent en profondeur — deux grands introvertis émotionnels.' },
    '7-2': { score:'💚 Très compatible', text:'L\'Optimiste et l\'Altruiste apportent joie et chaleur — attention à ne pas éviter les sujets difficiles.' },
    '1-7': { score:'🔶 Complémentaires', text:'Le Perfectionniste et l\'Optimiste peuvent s\'énerver mutuellement — mais aussi s\'équilibrer parfaitement.' },
    '8-2': { score:'💚 Très compatible', text:'Le Chef et l\'Altruiste forment un couple intense et passionné.' },
    '6-9': { score:'💚 Très compatible', text:'Le Loyal et le Médiateur partagent un besoin de stabilité et de sécurité.' },
    '3-9': { score:'🔶 Complémentaires', text:'Le Battant et le Médiateur — l\'un pousse, l\'autre apaise. Équilibre délicat mais possible.' },
  };

  const key1 = `${Math.min(type1,type2)}-${Math.max(type1,type2)}`;
  const combo = combos[key1];

  let compatText, compatScore;
  if (same) {
    compatScore = '🔶 Miroir';
    compatText = `Deux ${p1.name}s ensemble — vous vous comprenez instinctivement mais risquez de partager les mêmes angles morts. Attention à ne pas vous renforcer mutuellement dans vos défauts.`;
  } else if (combo) {
    compatScore = combo.score;
    compatText = combo.text;
  } else {
    compatScore = '💛 À découvrir';
    compatText = `${p1.name} × ${p2.name} — une combinaison unique. Vos différences peuvent être une richesse si vous apprenez à vous comprendre mutuellement.`;
  }

  return `
    <div style="background:linear-gradient(135deg,#fff0f8,#f0ecff);border-radius:24px;padding:24px;margin-bottom:16px;text-align:center">
      <div style="font-family:'Pacifico',cursive;font-size:1.1rem;color:var(--pink);margin-bottom:8px">
        ${p1.emoji} ${p1.name} × ${p2.emoji} ${p2.name}
      </div>
      <div style="font-size:1rem;font-weight:800;margin-bottom:10px">${compatScore}</div>
      <div style="font-size:0.88rem;font-weight:600;color:#7A5A80;line-height:1.6">${compatText}</div>
    </div>`;
}

// ══════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════
async function apiFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

async function apiUpload(endpoint, formData) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  spawnStars();
  if (token && currentUser) {
    await loadCouple();
  } else {
    showScreen('screen-auth');
  }
});

// ══════════════════════════════════════════════
// STARS & PARTICLES
// ══════════════════════════════════════════════
function spawnStars() {
  const c = document.getElementById('stars');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 3 + 1;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*4}s;animation-duration:${2+Math.random()*3}s`;
    c.appendChild(s);
  }
}

function spawnParticles(emojis, count) {
  const container = document.getElementById('particles');
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.cssText = `left:${Math.random()*95}%;font-size:${1+Math.random()*1.5}rem;animation-duration:${2+Math.random()*2}s;animation-delay:${Math.random()*0.5}s`;
      container.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }, i * 60);
  }
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showLoading(msg) {
  document.getElementById('loadingText').textContent = msg || 'Chargement…';
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}

function showError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearError() {
  const el = document.getElementById('authError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
function switchAuthTab(tab) {
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
  clearError();
}

function previewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('photoPreview');
    const placeholder = document.getElementById('photoPlaceholder');
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function register() {
  clearError();
  const prenom = document.getElementById('reg-prenom').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const photoFile = document.getElementById('reg-photo').files[0];

  if (!prenom || !email || !password) return showError('Tous les champs sont requis');
  if (password.length < 6) return showError('Mot de passe trop court (6 caractères min)');

  showLoading('Création du compte…');
  try {
    const formData = new FormData();
    formData.append('prenom', prenom);
    formData.append('email', email);
    formData.append('password', password);
    if (photoFile) formData.append('photo', photoFile);

    const data = await apiUpload('/auth/register', formData);
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cq_token', token);
    localStorage.setItem('cq_user', JSON.stringify(currentUser));
    await loadCouple();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

async function login() {
  clearError();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showError('Email et mot de passe requis');

  showLoading('Connexion…');
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cq_token', token);
    localStorage.setItem('cq_user', JSON.stringify(currentUser));
    await loadCouple();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

function logout() {
  token = null;
  currentUser = null;
  coupleData = null;
  localStorage.removeItem('cq_token');
  localStorage.removeItem('cq_user');
  showScreen('screen-auth');
}

// ══════════════════════════════════════════════
// COUPLE
// ══════════════════════════════════════════════
async function loadCouple() {
  showLoading('Chargement…');
  try {
    const data = await apiFetch('/couples/me');
    coupleData = data;
    renderWelcome();
    showScreen('screen-welcome');
  } catch (err) {
    renderCoupleSetup();
    showScreen('screen-couple-setup');
  } finally {
    hideLoading();
  }
}

function renderCoupleSetup() {
  document.getElementById('setupGreeting').textContent =
    `Bienvenue ${currentUser?.prenom || ''} 👋`;
}

async function createCouple() {
  showLoading('Création du couple…');
  try {
    const data = await apiFetch('/couples/create', { method: 'POST' });
    document.getElementById('generatedCode').textContent = data.couple.code;
    document.getElementById('codeDisplay').style.display = 'block';
    document.getElementById('createBtn').style.display = 'none';
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
}

async function joinCouple() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code) return alert('Entre un code');
  showLoading('Connexion au couple…');
  try {
    await apiFetch('/couples/join', { method: 'POST', body: JSON.stringify({ code }) });
    await loadCouple();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
}

// ══════════════════════════════════════════════
// WELCOME
// ══════════════════════════════════════════════
function renderWelcome() {
  if (!coupleData) return;
  const { couple, status } = coupleData;
  const u1 = couple.user1;
  const u2 = couple.user2;

  const setAvatar = (elId, user) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (user?.photo_url) {
      el.innerHTML = `<img src="${user.photo_url}" alt="${user.prenom}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      el.innerHTML = user?.prenom?.[0]?.toUpperCase() || '?';
    }
  };

  setAvatar('avatar-user1', u1);
  setAvatar('avatar-user2', u2);

  document.getElementById('name-user1').textContent = u1?.prenom || '—';
  document.getElementById('name-user2').textContent = u2?.prenom || 'En attente…';
  document.getElementById('status-user1').textContent = status?.user1Done ? '✅ Complété' : '⏳ En attente';
  document.getElementById('status-user2').textContent = !u2 ? '🔗 Pas encore rejoint' : status?.user2Done ? '✅ Complété' : '⏳ En attente';
  document.getElementById('coupleCode').textContent = couple.code;

  const revealBtn = document.getElementById('revealBtn');
  if (revealBtn) revealBtn.style.display = status?.bothDone ? 'inline-block' : 'none';

  const myDone = u1?.id === currentUser?.id ? status?.user1Done : status?.user2Done;
  document.getElementById('startQuizBtn').textContent = myDone
    ? '✏️ Modifier mes réponses'
    : 'Commencer mon questionnaire ✨';
}

// ══════════════════════════════════════════════
// QUIZ
// ══════════════════════════════════════════════
function startQuiz() {
  currentQ = 0;
  answers = {};
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[currentQ];

  document.getElementById('quizPill').textContent = `${currentUser?.prenom || 'Toi'} 💕`;
  document.getElementById('qCounter').textContent = `${currentQ + 1} / ${QUESTIONS.length}`;

  const dots = document.getElementById('progressDots');
  dots.innerHTML = '';
  QUESTIONS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot';
    if (answers[QUESTIONS[i].id] !== undefined) d.classList.add('done');
    if (i === currentQ) d.classList.add('current');
    dots.appendChild(d);
  });

  document.getElementById('qCard').innerHTML = renderQHtml(q);

  const saved = answers[q.id];
  if (saved !== undefined) {
    if (q.type === 'text' || q.type === 'textarea') {
      const el = document.querySelector('.ans-field');
      if (el) el.value = saved;
    } else if (q.type === 'scale') {
      const el = document.querySelector('input[type=range]');
      if (el) { el.value = saved; updateSlider(el); }
    } else if (q.type === 'chips') {
      document.querySelectorAll('.chip').forEach(c => {
        if (c.dataset.val === saved) c.classList.add('sel');
      });
    } else if (q.type === 'chips-enneagram') {
      document.querySelectorAll('.chip').forEach((c, i) => {
        if (String(i) === String(saved)) c.classList.add('sel');
      });
    }
  }

  document.getElementById('btnPrev').style.visibility = currentQ === 0 ? 'hidden' : 'visible';
  document.getElementById('btnNext').textContent = currentQ === QUESTIONS.length - 1 ? '✅ Terminer' : 'Suivant →';
}

function renderQHtml(q) {
  const catHtml = `<div class="q-category">${q.cat}</div>`;

  if (q.type === 'official') {
    return `${catHtml}
    <div class="official-card">
      <div class="official-q">Est-ce que tu veux être avec moi ? 💕</div>
      <div class="yn-row">
        <button class="yn yn-y" onclick="answerOfficial('oui')">Oui, je le veux ! 💖</button>
        <button class="yn yn-n" onclick="answerOfficial('non')">Je réfléchis… 😅</button>
      </div>
      <div class="official-reply" id="officialReply"></div>
    </div>`;
  }

  if (q.type === 'chips-enneagram') {
    const chipsHtml = q.options.map((o, i) =>
      `<div class="chip" data-idx="${i}" onclick="selectEnneagramChip(this,${i})">${o.text}</div>`
    ).join('');
    return `${catHtml}<div class="q-text">${q.text}</div><div class="chips">${chipsHtml}</div>`;
  }

  let inputHtml = '';
  if (q.type === 'text') {
    inputHtml = `<input class="ans-text ans-field" type="text" placeholder="${q.placeholder||''}" oninput="saveAns(this.value)">`;
  } else if (q.type === 'textarea') {
    inputHtml = `<textarea class="ans-area ans-field" placeholder="${q.placeholder||''}" oninput="saveAns(this.value)"></textarea>`;
  } else if (q.type === 'scale') {
    inputHtml = `
      <div class="scale-row">
        <span style="font-size:1.3rem">${(q.labels[0]||'').split(' ')[0]}</span>
        <input type="range" min="${q.min}" max="${q.max}" value="5"
          oninput="updateSlider(this);saveAns(this.value)" style="--val:50%">
        <span style="font-size:1.3rem">${(q.labels[1]||'').split(' ')[0]}</span>
        <span class="scale-num">5</span>
      </div>
      <div class="scale-labels"><span>${q.labels[0]}</span><span>${q.labels[1]}</span></div>`;
  } else if (q.type === 'chips') {
    inputHtml = `<div class="chips">${q.options.map(o =>
      `<div class="chip" data-val="${o}" onclick="selectChip(this)">${o}</div>`
    ).join('')}</div>`;
  }

  return `${catHtml}<div class="q-text">${q.text}</div>${inputHtml}`;
}

function saveAns(val) { answers[QUESTIONS[currentQ].id] = val; }

function selectChip(el) {
  el.closest('.chips').querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  saveAns(el.dataset.val);
}

function selectEnneagramChip(el, idx) {
  el.closest('.chips').querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  answers[QUESTIONS[currentQ].id] = idx;
}

function answerOfficial(choice) {
  answers['official'] = choice;
  const reply = document.getElementById('officialReply');
  reply.style.display = 'block';
  reply.textContent = choice === 'oui'
    ? 'Moi aussi, depuis le début 💖'
    : '😅 On en reparle autour d\'un chocolat chaud ?';
  if (choice === 'oui') spawnParticles(['💖','🌸','✨','💕'], 30);
}

function updateSlider(el) {
  const v = el.value;
  el.style.setProperty('--val', ((v-1)/9*100).toFixed(0)+'%');
  const num = el.closest('.scale-row')?.querySelector('.scale-num');
  if (num) num.textContent = v;
}

async function navQ(dir) {
  const q = QUESTIONS[currentQ];
  if (q.type === 'text' || q.type === 'textarea') {
    const el = document.querySelector('.ans-field');
    if (el) answers[q.id] = el.value;
  } else if (q.type === 'scale') {
    const el = document.querySelector('input[type=range]');
    if (el) answers[q.id] = el.value;
  }

  if (dir === 1 && currentQ === QUESTIONS.length - 1) {
    showReaction(null);
    setTimeout(() => {
      showScreen('screen-letter');
      renderLetterScreen();
    }, 1100);
    return;
  }

  currentQ = Math.max(0, Math.min(QUESTIONS.length - 1, currentQ + dir));
  renderQuestion();
  if (dir === 1) showReaction(null);
}

// ══════════════════════════════════════════════
// LETTER
// ══════════════════════════════════════════════
function renderLetterScreen() {
  const { couple } = coupleData || {};
  const partner = couple?.user1?.id === currentUser?.id
    ? couple?.user2?.prenom
    : couple?.user1?.prenom;
  document.getElementById('letterLabel').textContent =
    `📝 Ton message pour ${partner || 'ton·ta partenaire'} — il·elle ne le lira qu'à la révélation`;
}

async function saveLetter() {
  letter = document.getElementById('letterArea').value;
  showLoading('Sauvegarde en cours…');
  try {
    await apiFetch('/answers', {
      method: 'POST',
      body: JSON.stringify({ answers, letter })
    });
    await loadCouple();
    showScreen('screen-wait');
    renderWaitScreen();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
}

// ══════════════════════════════════════════════
// WAIT
// ══════════════════════════════════════════════
function renderWaitScreen() {
  const { status, couple } = coupleData || {};
  const partner = couple?.user1?.id === currentUser?.id
    ? couple?.user2
    : couple?.user1;

  document.getElementById('waitText').innerHTML =
      `Tes réponses sont sauvegardées 🔒<br><br>
      <strong style="color:var(--pink)">${partner?.prenom || 'Ton·ta partenaire'}</strong> peut maintenant faire le quiz de son côté sur son appareil.<br><br>
      Quand vous avez <strong>tous les deux terminé</strong>, revenez ici et cliquez sur le bouton ci-dessous 💥`;
      
  document.getElementById('waitBtn').textContent = status?.bothDone
    ? '💥 On est prêt·e·s — Révélation !'
    : '💥 Révélation (quand vous êtes tous les deux prêt·e·s)';
}

// ══════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════
async function goToResults() {
  showLoading('Chargement de la révélation…');
  try {
    const data = await apiFetch('/answers');
    hideLoading();
    spawnParticles(['💕','✨','🌸','💖','🌟','💫'], 50);
    showScreen('screen-results');
    renderResults(data);
  } catch (err) {
    hideLoading();
    alert(err.message);
  }
}

function renderResults(data) {
  const cont = document.getElementById('resultsContent');
  cont.innerHTML = '';
  const { user1, user2 } = data;

  // ─── Ennéagramme ───
  const type1 = calculateEnneagram(user1.answers);
  const type2 = calculateEnneagram(user2.answers);
  const p1 = ENNEAGRAM_PROFILES[type1];
  const p2 = ENNEAGRAM_PROFILES[type2];

  const ennSection = document.createElement('div');
  ennSection.style.cssText = 'width:100%;margin-bottom:24px';
  ennSection.innerHTML = `
    <div style="font-family:'Pacifico',cursive;font-size:1.6rem;color:var(--pink);text-align:center;margin-bottom:6px">🧠 Vos profils</div>
    <div style="color:rgba(255,255,255,0.5);font-size:0.85rem;text-align:center;margin-bottom:20px;font-weight:600">Découvrez qui vous êtes vraiment</div>
    ${renderEnneagramCard(type1, user1.prenom, user1.photo_url, true)}
    ${renderEnneagramCard(type2, user2.prenom, user2.photo_url, false)}
    <div style="font-family:'Pacifico',cursive;font-size:1.1rem;color:var(--pink);text-align:center;margin:16px 0 10px">🔮 Votre compatibilité</div>
    ${renderCompatibility(type1, type2, user1.prenom, user2.prenom)}
  `;
  cont.appendChild(ennSection);

  // ─── Official ───
  const o1 = user1.answers['official'], o2 = user2.answers['official'];
  if (o1 || o2) {
    const bothYes = o1 === 'oui' && o2 === 'oui';
    const el = document.createElement('div');
    el.style.cssText = 'background:linear-gradient(135deg,#fff0f8,#f0ecff);border-radius:24px;padding:24px;text-align:center;margin-bottom:20px;box-shadow:0 8px 32px rgba(255,123,172,0.2)';
    el.innerHTML = `
      <div style="font-family:'Pacifico',cursive;font-size:1.5rem;color:var(--pink);margin-bottom:12px">💍 La question</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
        <div style="background:var(--pink-light);padding:10px 18px;border-radius:14px;font-weight:800">
          ${user1.photo_url ? `<img src="${user1.photo_url}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:6px">` : ''}
          ${user1.prenom} : ${o1 === 'oui' ? '💖 Oui !' : '😅 En réflexion'}
        </div>
        <div style="background:#e8e4ff;padding:10px 18px;border-radius:14px;font-weight:800">
          ${user2.photo_url ? `<img src="${user2.photo_url}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:6px">` : ''}
          ${user2.prenom} : ${o2 === 'oui' ? '💖 Oui !' : '😅 En réflexion'}
        </div>
      </div>
      ${bothYes ? '<div style="font-family:\'Pacifico\',cursive;font-size:1.1rem;color:var(--pink)">Vous vous êtes dit oui 💕</div>' : ''}
    `;
    cont.appendChild(el);
    if (bothYes) spawnParticles(['💕','💖','🌸','✨'], 40);
  }

  // ─── Analyse convergences / divergences ───
  const aligned = [], watch = [], talk = [];
  QUESTIONS.forEach(q => {
    if (q.type === 'official' || q.type === 'chips-enneagram') return;
    const bv = user1.answers[q.id] || '—';
    const kv = user2.answers[q.id] || '—';
    if (bv === '—' || kv === '—') return;
    let isDiverged = false;
    if (q.type === 'scale') isDiverged = Math.abs(parseInt(bv) - parseInt(kv)) >= 4;
    else if (q.type === 'chips') isDiverged = bv !== kv;
    const same = bv.toLowerCase().trim() === kv.toLowerCase().trim();
    const item = { q, bv, kv, u1: user1, u2: user2 };
    if (same || (!isDiverged && q.type !== 'textarea')) aligned.push(item);
    else if (q.type === 'textarea' || (isDiverged && Math.abs(parseInt(bv||5)-parseInt(kv||5)) < 6)) watch.push(item);
    else talk.push(item);
  });

  if (aligned.length) { const s = makeSection('✅ Vous convergez sur…','badge-ok','Super aligné·e·s !'); aligned.forEach(i => s.appendChild(makeCompareItem(i))); cont.appendChild(s); }
  if (watch.length)   { const s = makeSection('👀 À surveiller','badge-watch','Quelques nuances'); watch.forEach(i => s.appendChild(makeCompareItem(i))); cont.appendChild(s); }
  if (talk.length)    { const s = makeSection('🔥 À discuter sérieusement','badge-talk','Divergences importantes'); talk.forEach(i => s.appendChild(makeCompareItem(i))); cont.appendChild(s); }

  // ─── Gages ───
  const div = watch.length + talk.length;
  if (div > 0) {
    const gs = document.createElement('div'); gs.className = 'gages-section';
    gs.innerHTML = `<div class="big-label">🎲 Vos gages — ${Math.min(div,3)} gage${Math.min(div,3)>1?'s':''}</div>`;
    [...GAGES].sort(() => Math.random()-0.5).slice(0, Math.min(div,3)).forEach((g,i) => {
      const el = document.createElement('div'); el.className = 'gage-card';
      el.innerHTML = `<div class="gage-title">GAGE #${i+1}</div><div class="gage-text">${g}</div>`;
      gs.appendChild(el);
    });
    cont.appendChild(gs);
  }

  // ─── Lettres secrètes ───
  if (user1.letter || user2.letter) {
    const ls = document.createElement('div'); ls.className = 'letters-reveal';
    ls.innerHTML = '<div class="big-label">💌 Lettres secrètes</div>';
    [[user1, user2], [user2, user1]].forEach(([from, to]) => {
      if (!from.letter) return;
      const env = document.createElement('div'); env.className = 'letter-envelope';
      const avatar = from.photo_url
        ? `<img src="${from.photo_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">`
        : '💌';
      env.innerHTML = `
        <div class="le-header">${avatar} De ${from.prenom} — pour ${to.prenom}</div>
        <div class="le-from">Cliquez pour ouvrir 💌</div>
        <div class="le-text" id="letter-${from.id}">${from.letter.replace(/\n/g,'<br>')}</div>`;
      env.addEventListener('click', () => {
        const t = document.getElementById(`letter-${from.id}`);
        t.classList.toggle('open');
        env.querySelector('.le-from').textContent = t.classList.contains('open')
          ? '📖 Ouvert'
          : 'Cliquez pour ouvrir 💌';
      });
      ls.appendChild(env);
    });
    cont.appendChild(ls);
  }

  // ─── Promesses ───
  const p1ans = user1.answers['o5'], p2ans = user2.answers['o5'];
  if (p1ans || p2ans) {
    const ps = document.createElement('div');
    ps.style.cssText = 'background:var(--card);border-radius:24px;padding:24px;margin-bottom:16px;width:100%';
    ps.innerHTML = `
      <div style="font-family:'Pacifico',cursive;font-size:1.2rem;color:var(--pink);text-align:center;margin-bottom:14px">🤍 Vos promesses</div>
      ${p1ans ? `<div style="background:var(--pink-light);border-radius:14px;padding:12px 16px;margin-bottom:10px">
        <div style="font-size:0.7rem;font-weight:800;color:var(--text-light);margin-bottom:4px">${user1.prenom}</div>
        <div style="font-weight:700">${p1ans}</div></div>` : ''}
      ${p2ans ? `<div style="background:#e8e4ff;border-radius:14px;padding:12px 16px">
        <div style="font-size:0.7rem;font-weight:800;color:var(--text-light);margin-bottom:4px">${user2.prenom}</div>
        <div style="font-weight:700">${p2ans}</div></div>` : ''}`;
    cont.appendChild(ps);
  }
}

function makeSection(title, badgeCls, badgeText) {
  const s = document.createElement('div'); s.className = 'recap-section';
  s.innerHTML = `<div class="recap-section-title">${title} <span class="recap-badge ${badgeCls}">${badgeText}</span></div>`;
  return s;
}

function makeCompareItem({ q, bv, kv, u1, u2 }) {
  const div = document.createElement('div'); div.className = 'recap-item';
  div.innerHTML = `
    <div class="ri-q">${q.text}</div>
    <div class="ri-answers">
      <div class="ri-a ri-a-user1"><div class="ri-who">${u1.prenom}</div>${bv}</div>
      <div class="ri-a ri-a-user2"><div class="ri-who">${u2.prenom}</div>${kv}</div>
    </div>`;
  return div;
}

// ══════════════════════════════════════════════
// REACTION POPUP
// ══════════════════════════════════════════════
function showReaction(cb) {
  const r = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
  const popup = document.getElementById('reactionPopup');
  document.getElementById('reactionEmoji').textContent = r.emoji;
  document.getElementById('reactionText').textContent = r.text;
  popup.classList.add('show');
  setTimeout(() => { popup.classList.remove('show'); if (cb) cb(); }, 1000);
}
