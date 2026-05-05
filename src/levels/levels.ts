import type { LevelDef, Vec2 } from '../game/types';

/**
 * Generate a polyline by sampling a function f(x) over [x0, x1] with `steps` segments.
 * Returns points with x ascending. Y is quantized to an 8px grid so the visible
 * silhouette has the original game's polygonal, vertex-driven feel.
 */
const Y_GRID = 8;
function sample(x0: number, x1: number, steps: number, f: (x: number) => number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(f(x) / Y_GRID) * Y_GRID;
    out.push({ x, y });
  }
  return out;
}

function smoothJoin(...segments: Vec2[][]): Vec2[] {
  const out: Vec2[] = [];
  for (const seg of segments) {
    if (out.length && seg.length && out[out.length - 1].x === seg[0].x) {
      out.push(...seg.slice(1));
    } else {
      out.push(...seg);
    }
  }
  return out;
}

// Level 1 — Pioneer: mostly flat with gentle hills, intro to controls.
const lvl1Points: Vec2[] = sample(0, 4200, 70, (x) => {
  const base = 380;
  return base
    + Math.sin(x * 0.004) * 30
    + Math.sin(x * 0.011) * 12
    - Math.max(0, x - 800) * 0.02
    + (x > 2200 && x < 2600 ? -40 * Math.sin(((x - 2200) / 400) * Math.PI) : 0);
});

// Level 2 — Dunes: rolling hills with bigger jumps.
const lvl2Points: Vec2[] = sample(0, 4800, 80, (x) => {
  const base = 380;
  const dunes = Math.sin(x * 0.006) * 90 + Math.sin(x * 0.013) * 25;
  const ramp = x > 1800 && x < 2000 ? -60 * Math.sin(((x - 1800) / 200) * Math.PI) : 0;
  return base + dunes + ramp - x * 0.01;
});

// Level 3 — Canyon: deep pits requiring momentum and air control.
const lvl3Raw: Vec2[] = [];
{
  const segments: Vec2[][] = [];
  segments.push(sample(0, 800, 14, (x) => 380 + Math.sin(x * 0.01) * 15));
  // Approach ramp
  segments.push(sample(800, 1100, 10, (x) => {
    const t = (x - 800) / 300;
    return 380 - 80 * t;
  }));
  // Canyon 1: drop and rise
  segments.push(sample(1100, 1600, 18, (x) => {
    const t = (x - 1100) / 500;
    return 300 + 220 * Math.sin(t * Math.PI);
  }));
  // Land
  segments.push(sample(1600, 2300, 14, (x) => {
    return 360 + Math.sin((x - 1600) * 0.02) * 20;
  }));
  // Big jump
  segments.push(sample(2300, 2500, 10, (x) => {
    const t = (x - 2300) / 200;
    return 360 - 100 * t;
  }));
  // Gap
  segments.push(sample(2500, 2900, 8, (x) => {
    const t = (x - 2500) / 400;
    return 260 + 240 * t;
  }));
  // Climb
  segments.push(sample(2900, 4200, 28, (x) => {
    const base = 500 - (x - 2900) * 0.15;
    return base + Math.sin((x - 2900) * 0.012) * 25;
  }));
  // Final straight
  segments.push(sample(4200, 5000, 14, (x) => 305 + Math.sin(x * 0.01) * 10));
  lvl3Raw.push(...smoothJoin(...segments));
}

// Level 4 — Mountain: long climb with steeper grades.
const lvl4Points: Vec2[] = sample(0, 5400, 90, (x) => {
  const climb = 420 - x * 0.07;
  const wobble = Math.sin(x * 0.014) * 28 + Math.sin(x * 0.005) * 50;
  const stairs = x > 2000 && x < 3200 ? Math.floor((x - 2000) / 200) * -8 : 0;
  return climb + wobble + stairs;
});

// Level 5 — Final: combination, demands precision.
const lvl5Raw: Vec2[] = [];
{
  const segs: Vec2[][] = [];
  segs.push(sample(0, 600, 10, (x) => 380 + Math.sin(x * 0.012) * 16));
  segs.push(sample(600, 1400, 18, (x) => {
    const t = (x - 600) / 800;
    return 380 - 120 * Math.sin(t * Math.PI * 2) - 30 * t;
  }));
  segs.push(sample(1400, 2200, 18, (x) => {
    const t = (x - 1400) / 800;
    return 290 + 60 * Math.sin(t * Math.PI * 3) + Math.sin(x * 0.02) * 20;
  }));
  // Plateau then drop
  segs.push(sample(2200, 2500, 8, (x) => 290 + (x - 2200) * 0.05));
  segs.push(sample(2500, 2900, 10, (x) => {
    const t = (x - 2500) / 400;
    return 305 + 200 * t * t;
  }));
  // Ridge climb
  segs.push(sample(2900, 4200, 28, (x) => {
    const t = (x - 2900) / 1300;
    return 505 - 220 * t + Math.sin(x * 0.018) * 25;
  }));
  // Final descent + finish
  segs.push(sample(4200, 5400, 22, (x) => {
    const t = (x - 4200) / 1200;
    return 285 + 80 * t + Math.sin(x * 0.01) * 15;
  }));
  lvl5Raw.push(...smoothJoin(...segs));
}

export const LEVELS: LevelDef[] = [
  {
    id: 'pioneer',
    name: 'Pioneer',
    points: lvl1Points,
    start: { x: 80, y: 320 },
    finishX: 4100,
    difficulty: 'easy',
  },
  {
    id: 'dunes',
    name: 'Dunes',
    points: lvl2Points,
    start: { x: 80, y: 280 },
    finishX: 4700,
    difficulty: 'easy',
  },
  {
    id: 'canyon',
    name: 'Canyon',
    points: lvl3Raw,
    start: { x: 80, y: 320 },
    finishX: 4900,
    difficulty: 'medium',
  },
  {
    id: 'mountain',
    name: 'Mountain',
    points: lvl4Points,
    start: { x: 80, y: 360 },
    finishX: 5300,
    difficulty: 'medium',
  },
  {
    id: 'finale',
    name: 'Finale',
    points: lvl5Raw,
    start: { x: 80, y: 320 },
    finishX: 5300,
    difficulty: 'hard',
  },
];
