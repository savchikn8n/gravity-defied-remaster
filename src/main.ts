import './styles.css';
import { Game } from './game/Game';
import type { LevelDef } from './game/types';
import { LEVELS } from './levels/levels';

type ScreenName = 'menu' | 'tracks' | 'pause' | 'leaderboard' | 'finish';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLDivElement;
const screens: Record<ScreenName, HTMLDivElement> = {
  menu: document.getElementById('menu') as HTMLDivElement,
  tracks: document.getElementById('tracks') as HTMLDivElement,
  pause: document.getElementById('pause') as HTMLDivElement,
  leaderboard: document.getElementById('leaderboard') as HTMLDivElement,
  finish: document.getElementById('finish') as HTMLDivElement,
};

// HUD elements
const hudTime = document.getElementById('hud-time') as HTMLDivElement;
const hudTarget = document.getElementById('hud-target') as HTMLDivElement;
const hudPause = document.getElementById('hud-pause') as HTMLButtonElement;
const hudRestart = document.getElementById('hud-restart') as HTMLButtonElement;

// Tracks grid
const tracksGrid = document.getElementById('tracks-grid') as HTMLDivElement;
const tracksStars = document.getElementById('tracks-stars') as HTMLSpanElement;

// Finish elements
const finishTitle = document.getElementById('finish-title') as HTMLHeadingElement;
const finishTime = document.getElementById('finish-time') as HTMLElement;
const finishBest = document.getElementById('finish-best') as HTMLElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
const btnToTracks = document.getElementById('btn-tomenu') as HTMLButtonElement;
const btnToMain = document.getElementById('btn-tomain') as HTMLButtonElement;

// Leaderboard
const lbList = document.getElementById('lb-list') as HTMLDivElement;

// State
let lastLevel: LevelDef | null = null;

const game = new Game(canvas, {
  onFinish: (level, ms, isBest) => showFinish(level, ms, isBest, false),
  onCrash: (level) => showFinish(level, game.getElapsed(), false, true),
});

// ---------- helpers ----------

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${m}:${pad2(s)}.${pad2(cs)}`;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** Generate a small inline SVG showing the level silhouette. */
function levelPreviewSvg(level: LevelDef, w = 200, h = 64): string {
  const pts = level.points;
  if (!pts.length) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const padTop = 6;
  const padBot = 4;
  const sx = w / dx;
  const sy = (h - padTop - padBot) / dy;
  const pad = 2;

  const polyPts = pts
    .map((p) => `${((p.x - minX) * sx).toFixed(1)},${((p.y - minY) * sy + padTop).toFixed(1)}`)
    .join(' ');

  // Vertical hatch lines: every 14px in svg-space.
  const hatch: string[] = [];
  for (let x = pad; x <= w - pad; x += 14) {
    // find surface y at this x by scanning
    const wx = minX + (x / w) * dx;
    let y = h;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].x <= wx && pts[i + 1].x >= wx) {
        const t = (wx - pts[i].x) / (pts[i + 1].x - pts[i].x || 1);
        const yy = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
        y = (yy - minY) * sy + padTop;
        break;
      }
    }
    hatch.push(`<line x1="${x}" y1="${y.toFixed(1)}" x2="${x}" y2="${h - 1}" stroke="#2f8a3e" stroke-width="0.8" opacity="0.55" />`);
  }

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    ${hatch.join('')}
    <polyline points="${polyPts}" fill="none" stroke="#2f8a3e" stroke-width="1.6" stroke-linejoin="miter" />
  </svg>`;
}

// ---------- screen management ----------

function hideAllScreens() {
  (Object.keys(screens) as ScreenName[]).forEach((k) => {
    screens[k].classList.add('hidden');
  });
}

function showMenu() {
  hideAllScreens();
  screens.menu.classList.remove('hidden');
  hudEl.classList.add('hidden');
  game.toMenu();
}

function showTracks() {
  buildTracksGrid();
  hideAllScreens();
  screens.tracks.classList.remove('hidden');
  hudEl.classList.add('hidden');
  game.toMenu();
}

function showLeaderboard() {
  buildLeaderboardMock();
  hideAllScreens();
  screens.leaderboard.classList.remove('hidden');
}

function playLevel(level: LevelDef) {
  lastLevel = level;
  hideAllScreens();
  hudEl.classList.remove('hidden');
  hudTarget.textContent = `★ ${fmtTime(targetTimeFor(level))}`;
  game.start(level);
}

function showFinish(level: LevelDef, ms: number, isBest: boolean, crashed: boolean) {
  lastLevel = level;
  finishTitle.textContent = crashed ? 'CRASH' : isBest ? 'НОВЫЙ РЕКОРД!' : 'ФИНИШ';
  finishTime.textContent = fmtTime(ms);
  const best = game.getBest(level.id);
  finishBest.textContent = best != null ? fmtTime(best) : '--:--.--';

  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const next = LEVELS[idx + 1];
  btnNext.disabled = !next;
  btnNext.style.opacity = next ? '1' : '0.4';
  btnNext.onclick = () => { if (next) playLevel(next); };

  hideAllScreens();
  screens.finish.classList.remove('hidden');
}

// ---------- tracks grid ----------

function buildTracksGrid() {
  tracksGrid.innerHTML = '';
  let total = 0;
  let earned = 0;
  LEVELS.forEach((lv, i) => {
    const card = document.createElement('button');
    card.className = 'track-card';
    card.type = 'button';

    const best = game.getBest(lv.id);
    const stars = best != null ? starsFor(lv, best) : 0;
    total += 3;
    earned += stars;

    const num = (i + 1).toString().padStart(2, '0');
    card.innerHTML = `
      <div class="lv-num">${num}</div>
      <h3 class="lv-name">${lv.name.toUpperCase()}</h3>
      <div class="lv-preview">${levelPreviewSvg(lv)}</div>
      <div class="lv-best">★ ${best != null ? fmtTime(best) : '--:--.--'}</div>
    `;
    card.addEventListener('click', () => playLevel(lv));
    tracksGrid.appendChild(card);
  });

  // Locked placeholder (hint for "more levels coming") to mirror mockup feel.
  const ghost = document.createElement('button');
  ghost.className = 'track-card locked';
  ghost.type = 'button';
  ghost.disabled = true;
  ghost.innerHTML = `
    <div class="lv-num">06</div>
    <h3 class="lv-name">ЛУНА</h3>
    <div class="lv-preview">
      <svg viewBox="0 0 200 64" preserveAspectRatio="none">
        <polyline points="10,40 30,30 60,42 95,28 130,38 165,30 190,42" fill="none" stroke="#a8b2a4" stroke-width="1.6" />
      </svg>
    </div>
    <div class="lv-best" style="color:#9a9a92">★ --:--.--</div>
    <div class="lv-lock">🔒</div>
  `;
  tracksGrid.appendChild(ghost);

  tracksStars.textContent = `★ ${earned}/${total}`;
}

/** A simple star rating: 1 star = finished, 2 = under target × 1.4, 3 = under target. */
function targetTimeFor(level: LevelDef): number {
  // Heuristic target — we don't ship hand-tuned ones yet.
  const len = level.points[level.points.length - 1].x - level.points[0].x;
  return Math.round((len / 700) * 1000);
}

function starsFor(level: LevelDef, ms: number): number {
  const target = targetTimeFor(level);
  if (ms <= target) return 3;
  if (ms <= target * 1.4) return 2;
  return 1;
}

// ---------- leaderboard mock ----------

function buildLeaderboardMock() {
  const youBest = LEVELS
    .map((l) => game.getBest(l.id))
    .filter((b): b is number => b != null)
    .reduce((a, b) => a + b, 0);
  const youTotal = youBest > 0 ? youBest : 99999;

  const mock = [
    { rank: 1, name: 'MadSkillz', time: 5210 },
    { rank: 2, name: 'GravityKing', time: 5840 },
    { rank: 3, name: 'BikeMaster', time: 6180 },
    { rank: 4, name: 'SpeedDemon', time: 6350 },
    { rank: 5, name: 'TrialExpert', time: 6720 },
    { rank: 6, name: 'MotoFan', time: 7010 },
    { rank: 7, name: 'NightRider', time: 7250 },
    { rank: 8, name: 'JumpHero', time: 7560 },
    { rank: 9, name: 'ProRacer', time: 7830 },
    { rank: 10, name: 'HillClimber', time: 8120 },
  ];
  // Slot the player in if their cumulative best is competitive.
  const list = [...mock];
  if (youTotal < 99999) {
    list.push({ rank: 99, name: 'YOU', time: youTotal });
    list.sort((a, b) => a.time - b.time).forEach((r, i) => (r.rank = i + 1));
  }

  lbList.innerHTML = list
    .map(
      (r) => `<div class="lb-row${r.name === 'YOU' ? ' me' : ''}">
        <span class="rank">${r.rank}</span>
        <span class="name">${r.name}</span>
        <span class="time">${fmtTime(r.time)}</span>
      </div>`,
    )
    .join('');
}

// ---------- nav wiring (data-nav attribute) ----------

document.body.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const btn = t.closest<HTMLElement>('[data-nav]');
  if (!btn) return;
  const action = btn.dataset.nav;
  switch (action) {
    case 'menu':
      showMenu();
      break;
    case 'tracks':
      showTracks();
      break;
    case 'leaderboard':
      showLeaderboard();
      break;
    case 'play':
      // Quick-play: continue last level, or first
      playLevel(lastLevel ?? LEVELS[0]);
      break;
    case 'settings':
      // Placeholder
      break;
    case 'exit':
      // No-op on web
      break;
    case 'pause':
      pauseGame();
      break;
    case 'resume':
      resumeGame();
      break;
    case 'restart':
      if (lastLevel) playLevel(lastLevel);
      break;
  }
});

// HUD inline buttons
hudPause.addEventListener('click', pauseGame);
hudRestart.addEventListener('click', () => { if (lastLevel) playLevel(lastLevel); });

// Finish actions
btnRestart.addEventListener('click', () => { if (lastLevel) playLevel(lastLevel); });
btnToTracks.addEventListener('click', () => showTracks());
btnToMain.addEventListener('click', () => showMenu());

// ---------- pause toggle ----------

function pauseGame() {
  if (game.getState() !== 'playing' || game.isPaused()) return;
  game.pause();
  hudEl.classList.add('hidden');
  screens.pause.classList.remove('hidden');
}

function resumeGame() {
  if (!lastLevel || !game.isPaused()) return;
  screens.pause.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.resume();
}

// HUD touch controls are bound automatically by Input class (queries #hud-controls .ctrl-btn).

// HUD timer tick + score
function hudLoop() {
  if (game.getState() === 'playing') {
    hudTime.textContent = fmtTime(game.getElapsed());
  }
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);

// Boot
showMenu();

// Prevent unwanted scroll/zoom gestures on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
