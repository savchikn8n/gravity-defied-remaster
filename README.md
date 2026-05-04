# Gravity Defied — Remaster

Modern web remake of the J2ME classic, inspired by the original Codebrew Software
game (2004). All code, art, levels and physics are written from scratch. The
original `.jar` is used only as a personal reference and is not included in this
repository.

**Stack.** TypeScript · Vite · Matter.js · Canvas 2D · deployed on Vercel.

## Running locally

```bash
npm install
npm run dev          # dev server on http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve dist/
```

## Controls

| Key            | Action          |
| -------------- | --------------- |
| `↑` / `W`      | Throttle        |
| `↓` / `S`      | Brake / reverse |
| `←` / `A`      | Lean back       |
| `→` / `D`      | Lean forward    |
| `R`            | Restart level   |
| `Esc`          | Back to menu    |

On touch devices the on-screen pad appears automatically.

## Status

Prototype — first playable iteration. 5 hand-crafted levels with timer and
local-storage best times. Telegram Mini App integration is planned for a later
phase.

## Project layout

```
src/
  main.ts              entry, menu wiring, HUD
  styles.css
  game/
    Game.ts            state machine, fixed-step loop
    Bike.ts            chassis + wheels + helmet (Matter.js)
    Track.ts           polyline → static segment bodies
    Renderer.ts        sky, parallax, terrain, bike art
    Camera.ts          smooth follow with look-ahead
    Input.ts           keyboard + touch
    types.ts
  levels/
    levels.ts          5 levels generated from analytic curves
```
