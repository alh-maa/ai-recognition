/* ============================================================================
   1. PARTICIPANTS  ── EDIT THIS LIST ──
   ----------------------------------------------------------------------------
   Just add, remove, or change names below. One name per line, in quotes,
   separated by commas. No database, no build step — save & reload.
   Every name has an exactly equal chance of winning.
   ============================================================================ */
const PARTICIPANTS = [
  "David Yates",
  "Aliah Almazrouei",
  "Mohammed Almahri",
  "Lorenzo Cavazzana",
  "Jean-Dominique Rey",
];
/* ========================================================================== */


/* ---- Genuine randomness (crypto with graceful fallback) ---- */
function secureRandomInt(max){
  if(max <= 0) return 0;
  if(window.crypto && window.crypto.getRandomValues){
    // Rejection sampling for an unbiased result across the full range.
    const range = 0x100000000;
    const limit = range - (range % max);
    const buf = new Uint32Array(1);
    let x;
    do { window.crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}
// Fisher–Yates shuffle
function shuffle(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---- State ---- */
let names = PARTICIPANTS.slice();      // working list (session-editable)
const winnersHistory = new Set();      // names who have already won
let excludeWinners = false;            // "Draw Again" mode toggle
let phase = 'idle';                    // idle | drawing | winner
let drawFrame = 0;
let currentWinner = null;

/* ---- Elements ---- */
const body       = document.body;
const nameEl     = document.getElementById('name');
const actionsEl  = document.getElementById('actions');
const startBtn   = document.getElementById('startBtn');
const countNum   = document.getElementById('countNum');
const poolNote   = document.getElementById('poolNote');
const bgNames    = document.getElementById('bgNames');
const excludeSwitch = document.getElementById('excludeSwitch');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionPreference.matches;
motionPreference.addEventListener('change', event => {
  reduceMotion = event.matches;
  if(reduceMotion){
    stopCelebration();
  }
});

/* ---- Active pool (respects the exclude toggle) ---- */
function activePool(){
  if(excludeWinners) return names.filter(n => !winnersHistory.has(n));
  return names.slice();
}

/* ============================================================
   BACKGROUND FLOATING NAMES
   ============================================================ */
function renderBgNames(){
  bgNames.innerHTML = '';
  const pool = names.slice();
  if(!pool.length) return;
  // Show a comfortable subset so it feels alive but not crowded.
  const count = Math.min(pool.length, 14);
  const picks = shuffle(pool).slice(0, count);
  picks.forEach((nm, i) => {
    const el = document.createElement('span');
    el.className = 'bg-name';
    el.textContent = nm;
    const size = 14 + Math.random() * 20;
    el.style.fontSize = size + 'px';
    el.style.left = (4 + Math.random() * 88) + '%';
    el.style.top  = (6 + Math.random() * 84) + '%';
    el.style.animationDuration = (7 + Math.random() * 8) + 's';
    el.style.animationDelay = (-Math.random() * 8) + 's';
    el.style.opacity = '0';
    bgNames.appendChild(el);
    // fade to a subtle target opacity
    requestAnimationFrame(() => {
      el.style.opacity = String(0.06 + Math.random() * 0.12);
    });
  });
}

/* ============================================================
   COUNTS
   ============================================================ */
function updateCounts(){
  countNum.textContent = names.length;
  const pool = activePool();
  if(excludeWinners && winnersHistory.size){
    poolNote.textContent = `· ${pool.length} eligible`;
  } else {
    poolNote.textContent = '';
  }
}

/* ============================================================
   THE DRAW
   ============================================================ */
function buildReel(pool, winner){
  // Fewer, more readable name changes keep the full draw near twelve seconds.
  const ticks = pool.length <= 2 ? 26 : 40;
  let src = shuffle(pool);
  let p = 0;
  const reel = [];
  for(let i = 0; i < ticks; i++){
    if(p >= src.length) { src = shuffle(pool); p = 0; }
    let nm = src[p++];
    // avoid showing the same name twice in a row
    if(reel.length && nm === reel[reel.length - 1] && pool.length > 1){
      if(p >= src.length){ src = shuffle(pool); p = 0; }
      nm = src[p++];
    }
    reel.push(nm);
  }
  // Land precisely on the pre-chosen winner.
  reel[reel.length - 1] = winner;
  // Make sure the penultimate frame isn't also the winner (clean stop).
  if(pool.length > 1 && reel[reel.length - 2] === winner){
    const others = pool.filter(n => n !== winner);
    reel[reel.length - 2] = others[secureRandomInt(others.length)];
  }
  return reel;
}
// Ease-out delays: fast → slow, building suspense.
function buildDelays(n){
  const minD = 140, maxD = 675, power = 2.35;
  const out = [];
  for(let i = 0; i < n; i++){
    const t = n <= 1 ? 1 : i / (n - 1);
    out.push(minD + (maxD - minD) * Math.pow(t, power));
  }
  return out;
}
function draw(){
  if(phase === 'drawing') return;
  const pool = activePool();

  if(pool.length === 0){
    setPlaceholder(excludeWinners && names.length
      ? 'Everyone has already won'
      : 'Add participants to begin');
    return;
  }

  // Enter drawing phase
  phase = 'drawing';
  body.className = 'is-drawing';
  currentWinner = pool[secureRandomInt(pool.length)];   // genuine winner, chosen up front

  const reel = buildReel(pool, currentWinner);
  const delays = buildDelays(reel.length);

  stopCelebration();
  nameEl.removeAttribute('aria-label');
  let index = 0;
  let elapsed = 0;
  let previous = null;
  let nextTick = delays[0];
  setName(reel[0]);
  const tick = now => {
    // Pause the draw while hidden; do not race through missed names on return.
    if(document.hidden){ previous = null; }
    else {
      if(previous !== null) elapsed += Math.min(now - previous, 50);
      previous = now;
      const oldIndex = index;
      while(elapsed >= nextTick && index < reel.length - 1){
        index++;
        nextTick += delays[index];
      }
      if(index !== oldIndex){
        setName(reel[index]);
        document.documentElement.style.setProperty('--intensity', (index / (reel.length - 1)).toFixed(3));
      }
      if(elapsed >= nextTick){
        drawFrame = 0;
        reveal(currentWinner);
        return;
      }
    }
    drawFrame = requestAnimationFrame(tick);
  };
  drawFrame = requestAnimationFrame(tick);
}

function reveal(winner){
  phase = 'winner';
  winnersHistory.add(winner);
  setName(winner);
  document.documentElement.style.setProperty('--intensity', '1');
  body.className = 'is-winner';
  renderWinnerActions();
  updateCounts();
  celebrate();
  // Announce for screen readers
  nameEl.setAttribute('aria-label', winner + ', Top Platform User Raffle Winner');
}

/* ---- Name slot helpers ---- */
function setName(text){
  nameEl.classList.remove('placeholder');
  nameEl.textContent = text;

}
function setPlaceholder(text){
  nameEl.className = 'name placeholder';
  nameEl.textContent = text;
}

/* ============================================================
   ACTION BUTTONS PER PHASE
   ============================================================ */
function renderIdleActions(){
  actionsEl.innerHTML = '';
  const b = document.createElement('button');
  b.className = 'btn primary big';
  b.id = 'startBtn';
  b.innerHTML = '<span class="spark"></span> Start raffle';
  b.addEventListener('click', draw);
  actionsEl.appendChild(b);
  if(activePool().length === 0) b.disabled = true;
}
function renderWinnerActions(){
  actionsEl.innerHTML = '';
  const again = document.createElement('button');
  again.className = 'btn primary big';
  again.innerHTML = '<span class="spark"></span> Draw again';
  again.addEventListener('click', () => {
    body.className = 'is-idle';
    phase = 'idle';
    document.documentElement.style.setProperty('--intensity', '0');
    // brief reset of the slot, then straight into the next draw
    setPlaceholder('Drawing…');
    draw();
  });

  const reset = document.createElement('button');
  reset.className = 'btn ghost';
  reset.textContent = 'Reset raffle';
  reset.addEventListener('click', resetRaffle);

  actionsEl.appendChild(again);
  actionsEl.appendChild(reset);

  // If exclude mode would leave nobody, disable draw-again gracefully.
  if(activePool().length === 0){
    again.disabled = true;
    again.innerHTML = 'No eligible participants left';
  }
}

function resetRaffle(){
  cancelAnimationFrame(drawFrame);
  drawFrame = 0;
  stopCelebration();
  winnersHistory.clear();
  currentWinner = null;
  phase = 'idle';
  body.className = 'is-idle';
  document.documentElement.style.setProperty('--intensity', '0');
  nameEl.removeAttribute('aria-label');
  setPlaceholder(names.length ? 'Ready to draw' : 'Add participants to begin');
  renderIdleActions();
  renderBgNames();
  updateCounts();
}

/* ============================================================
   EXCLUDE-WINNERS TOGGLE
   ============================================================ */
function setExclude(on){
  excludeWinners = on;
  excludeSwitch.classList.toggle('on', on);
  excludeSwitch.setAttribute('aria-checked', String(on));
  updateCounts();
  if(phase === 'winner') renderWinnerActions();
}
excludeSwitch.addEventListener('click', () => setExclude(!excludeWinners));
excludeSwitch.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setExclude(!excludeWinners); }
});

/* ============================================================
   CONFETTI + GLOW BURST  (self-contained canvas)
   ============================================================ */
const fx = document.getElementById('fx');
const ctx = fx.getContext('2d');
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let particles = [];
let fxRunning = false;
let fxFrame = 0;
let fxPrevious = null;
let fxAccumulator = 0;
let burstTimers = [];

function stopCelebration(){
  burstTimers.forEach(clearTimeout);
  burstTimers = [];
  cancelAnimationFrame(fxFrame);
  particles = [];
  fxRunning = false;
  fxPrevious = null;
  fxAccumulator = 0;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
}

document.addEventListener('visibilitychange', () => {
  fxPrevious = null;
  document.documentElement.classList.toggle('is-hidden', document.hidden);
});

function sizeCanvas(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = innerWidth * dpr; fx.height = innerHeight * dpr;
  fx.style.width = innerWidth + 'px'; fx.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
addEventListener('resize', sizeCanvas);

// On-brand palette (greens + light sage + soft white for visibility)
const CONFETTI = ['#2D6930','#3F762A','#5BB35F','#7FC983','#86A795','#EAF1EC'];

function celebrate(){
  stopCelebration();
  if(reduceMotion) return;
  const cx = innerWidth / 2, cy = innerHeight * 0.42;
  burst(cx, cy, 150, 13);
  burstTimers.push(setTimeout(() => burst(innerWidth*0.2, innerHeight*0.5, 60, 10), 220));
  burstTimers.push(setTimeout(() => burst(innerWidth*0.8, innerHeight*0.5, 60, 10), 380));
}

function burst(x, y, n, spread){
  if(reduceMotion || document.hidden) return;
  for(let i = 0; i < n; i++){
    const ang = (Math.PI * 2) * (i / n) + Math.random() * 0.5;
    const speed = 4 + Math.random() * spread;
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed * (0.6 + Math.random()),
      vy: Math.sin(ang) * speed - (4 + Math.random() * 4),
      g: 0.16 + Math.random() * 0.12,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
      life: 1,
      decay: 0.006 + Math.random() * 0.006,
      shape: Math.random() < 0.35 ? 'circle' : 'rect',
    });
  }
  if(!fxRunning){
    fxRunning = true;
    fxPrevious = null;
    fxFrame = requestAnimationFrame(loop);
  }
}

function loop(now){
  // Fixed 120 Hz simulation keeps speed and lifetime consistent on 60–144 Hz displays.
  const delta = fxPrevious === null ? 0 : Math.min(now - fxPrevious, 50);
  fxPrevious = now;
  fxAccumulator += delta;
  const step = 1000 / 120;
  while(fxAccumulator >= step){
    for(let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      p.vy += p.g * .5;
      p.x += p.vx * .5;
      p.y += p.vy * .5;
      p.vx *= Math.pow(.99, .5);
      p.rot += p.vr * .5;
      p.life -= p.decay * .5;
      if(p.life <= 0 || p.y > innerHeight + 40) particles.splice(i, 1);
    }
    fxAccumulator -= step;
  }
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if(p.shape === 'circle'){
      ctx.beginPath(); ctx.arc(0, 0, p.w/2, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    }
    ctx.restore();
  }
  if(particles.length){ fxFrame = requestAnimationFrame(loop); }
  else { ctx.clearRect(0,0,innerWidth,innerHeight); fxRunning = false; }
}

/* ============================================================
   MANAGE PANEL
   ============================================================ */
const scrim = document.getElementById('scrim');
const panel = document.getElementById('panel');
const listEl = document.getElementById('list');
const nameInput = document.getElementById('nameInput');

function openPanel(){ scrim.classList.add('open'); panel.classList.add('open'); renderList(); nameInput.focus(); }
function closePanel(){ scrim.classList.remove('open'); panel.classList.remove('open'); }

function renderList(){
  listEl.innerHTML = '';
  if(!names.length){
    listEl.innerHTML = '<div class="empty-note">No participants yet. Add a name above to get started.</div>';
    return;
  }
  names.forEach((nm, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="idx">${String(i+1).padStart(2,'0')}</span>
                     <span class="nm"></span>
                     ${winnersHistory.has(nm) ? '<span class="won">Won</span>' : ''}
                     <button class="del" aria-label="Remove">×</button>`;
    row.querySelector('.nm').textContent = nm;
    row.querySelector('.del').addEventListener('click', () => {
      names.splice(i, 1);
      renderList(); afterListChange();
    });
    listEl.appendChild(row);
  });
}
function addName(){
  const v = nameInput.value.trim();
  if(!v) return;
  names.push(v);
  nameInput.value = '';
  renderList(); afterListChange();
  listEl.scrollTop = listEl.scrollHeight;
  nameInput.focus();
}
function afterListChange(){
  updateCounts();
  if(phase === 'idle'){
    renderBgNames();
    setPlaceholder(names.length ? 'Ready to draw' : 'Add participants to begin');
    renderIdleActions();
  }
}

document.getElementById('manageBtn').addEventListener('click', openPanel);
document.getElementById('closePanel').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
document.getElementById('addBtn').addEventListener('click', addName);
nameInput.addEventListener('keydown', e => { if(e.key === 'Enter') addName(); });
document.getElementById('resetListBtn').addEventListener('click', () => {
  names = PARTICIPANTS.slice();
  winnersHistory.clear();
  renderList(); afterListChange();
  if(phase !== 'idle') resetRaffle();
});

/* ============================================================
   PRESENTATION (FULLSCREEN) MODE
   ============================================================ */
document.getElementById('fsBtn').addEventListener('click', () => {
  if(!document.fullscreenElement && !document.webkitFullscreenElement){
    (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)?.call(document.documentElement);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
});

/* ============================================================
   KEYBOARD: Space / Enter to start when idle
   ============================================================ */
addEventListener('keydown', e => {
  if((e.key === ' ' || e.key === 'Enter') && phase === 'idle' && !panel.classList.contains('open')){
    const tag = (e.target.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'button') return;
    e.preventDefault(); draw();
  }
  if(e.key === 'Escape' && panel.classList.contains('open')) closePanel();
});

/* ============================================================
   INIT — shuffle on every load so nothing is predictable
   ============================================================ */
function init(){
  names = shuffle(PARTICIPANTS.slice());   // fresh random order every refresh
  startBtn.addEventListener('click', draw);
  renderBgNames();
  updateCounts();
  setPlaceholder(names.length ? 'Ready to draw' : 'Add participants to begin');
  if(activePool().length === 0) startBtn.disabled = true;
}
init();
