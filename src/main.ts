import './styles.css';
import { Game } from './game/Game';
import type { LevelDef } from './game/types';
import { LEVELS } from './levels/levels';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menuEl = document.getElementById('menu') as HTMLDivElement;
const hudEl = document.getElementById('hud') as HTMLDivElement;
const hudLevel = document.getElementById('hud-level') as HTMLDivElement;
const hudTimer = document.getElementById('hud-timer') as HTMLDivElement;
const hudBack = document.getElementById('hud-back') as HTMLButtonElement;
const finishEl = document.getElementById('finish') as HTMLDivElement;
const finishTitle = document.getElementById('finish-title') as HTMLHeadingElement;
const finishTime = document.getElementById('finish-time') as HTMLElement;
const finishBest = document.getElementById('finish-best') as HTMLElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
const btnToMenu = document.getElementById('btn-tomenu') as HTMLButtonElement;
const touchEl = document.getElementById('touch') as HTMLDivElement;
const levelListEl = document.getElementById('level-list') as HTMLDivElement;

const isTouchDevice =
  'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

const game = new Game(canvas, {
  onFinish: (level, ms, isBest) => showFinish(level, ms, isBest, false),
  onCrash: (level) => showFinish(level, game.getElapsed(), false, true),
});

function fmtTime(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function buildMenu() {
  levelListEl.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const row = document.createElement('button');
    row.className = 'level-row';
    row.type = 'button';
    const best = game.getBest(lv.id);
    row.innerHTML = `
      <span class="lv-name">${i + 1}. ${lv.name} <span style="opacity:.5;font-size:11px">· ${lv.difficulty}</span></span>
      <span class="lv-best ${best != null ? 'set' : ''}">${best != null ? fmtTime(best) : '--:--.--'}</span>
    `;
    row.addEventListener('click', () => playLevel(lv));
    levelListEl.appendChild(row);
  });
}

function showMenu() {
  buildMenu();
  menuEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  touchEl.classList.add('hidden');
  game.toMenu();
}

function playLevel(level: LevelDef) {
  menuEl.classList.add('hidden');
  finishEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  if (isTouchDevice) touchEl.classList.remove('hidden');
  hudLevel.textContent = level.name.toUpperCase();
  game.start(level);
}

function showFinish(level: LevelDef, ms: number, isBest: boolean, crashed: boolean) {
  finishTitle.textContent = crashed ? 'CRASH' : isBest ? 'NEW BEST!' : 'FINISH';
  finishTitle.style.color = crashed ? '#ff5a3c' : '#ffc26b';
  finishTime.textContent = fmtTime(ms);
  const best = game.getBest(level.id);
  finishBest.textContent = best != null ? fmtTime(best) : '--:--.--';
  finishEl.classList.remove('hidden');
  // Hint: hide touch overlay so it doesn't intercept taps on dialog
  touchEl.classList.add('hidden');
  // Wire up "Next" only if there is a next level
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const next = LEVELS[idx + 1];
  btnNext.disabled = !next;
  btnNext.style.opacity = next ? '1' : '0.4';
  btnNext.onclick = () => {
    if (next) playLevel(next);
  };
}

btnRestart.addEventListener('click', () => {
  if (!game) return;
  finishEl.classList.add('hidden');
  if (isTouchDevice) touchEl.classList.remove('hidden');
  // Game.start re-reads currentLevel via input handler path; we use the latest known.
  const current = (window as unknown as { __gdLast?: LevelDef }).__gdLast;
  if (current) game.start(current);
});

btnToMenu.addEventListener('click', () => showMenu());
hudBack.addEventListener('click', () => showMenu());

// Track last-played level for restart button
const _origStart = game.start.bind(game);
game.start = (lv: LevelDef) => {
  (window as unknown as { __gdLast?: LevelDef }).__gdLast = lv;
  _origStart(lv);
};

// HUD timer tick
function hudLoop() {
  if (game.getState() === 'playing') {
    hudTimer.textContent = fmtTime(game.getElapsed());
  }
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);

showMenu();

// Prevent unwanted scroll/zoom gestures on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
