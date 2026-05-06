import Matter from 'matter-js';
import { Bike } from './Bike';
import { Camera } from './Camera';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { Track } from './Track';
import type { GameState, LevelDef } from './types';

const { Engine, Events } = Matter;

export interface GameCallbacks {
  onFinish: (level: LevelDef, timeMs: number, isBest: boolean) => void;
  onCrash: (level: LevelDef) => void;
}

const FIXED_DT = 1000 / 60;

export class Game {
  private engine: Matter.Engine;
  private bike: Bike | null = null;
  private track: Track | null = null;
  private input: Input;
  private camera: Camera;
  private renderer: Renderer;

  private currentLevel: LevelDef | null = null;
  private state: GameState = 'menu';
  private startTimeMs = 0;
  private finishTimeMs = 0;

  private accumulator = 0;
  private lastFrame = 0;
  private rafId = 0;
  private bestTimes: Map<string, number>;
  private finishLogged = false;
  private pauseStartedAt: number | null = null;

  constructor(public canvas: HTMLCanvasElement, private cb: GameCallbacks) {
    this.engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.0014 },
      enableSleeping: false,
    });

    this.camera = new Camera();
    this.renderer = new Renderer(canvas, this.camera);
    this.input = new Input({
      onRestart: () => {
        if (this.state === 'playing' || this.state === 'crashed' || this.state === 'finished') {
          this.start(this.currentLevel!);
        }
      },
    });

    this.bestTimes = loadBestTimes();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
  }

  private handleResize = () => {
    this.renderer.resize();
  };

  start(level: LevelDef) {
    this.cleanup();
    this.currentLevel = level;
    this.track = new Track(level, this.engine);
    this.bike = new Bike({ spawn: level.start }, this.engine);
    this.camera.snapTo(level.start);
    this.startTimeMs = performance.now();
    this.finishTimeMs = 0;
    this.finishLogged = false;
    this.pauseStartedAt = null;
    this.state = 'playing';
    this.input.reset();
    this.ensureLoopRunning();
  }

  toMenu() {
    this.state = 'menu';
    this.pauseStartedAt = null;
    this.cleanup();
  }

  /** Suspend physics & timer without unloading the world. */
  pause() {
    if (this.state === 'playing' && this.pauseStartedAt == null) {
      this.pauseStartedAt = performance.now();
      this.input.reset();
    }
  }

  /** Resume after pause(); shifts startTime so timer doesn't tick during pause. */
  resume() {
    if (this.pauseStartedAt != null) {
      const now = performance.now();
      const delta = now - this.pauseStartedAt;
      this.startTimeMs += delta;
      this.pauseStartedAt = null;
      this.lastFrame = now;
      this.accumulator = 0;
    }
  }

  isPaused(): boolean {
    return this.pauseStartedAt != null;
  }

  getBest(levelId: string): number | null {
    return this.bestTimes.get(levelId) ?? null;
  }

  private cleanup() {
    if (this.bike) {
      this.bike.destroy();
      this.bike = null;
    }
    if (this.track) {
      this.track.destroy();
      this.track = null;
    }
  }

  private ensureLoopRunning() {
    if (this.rafId) return;
    this.lastFrame = performance.now();
    this.accumulator = 0;
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private frame(now: number) {
    const frameTime = Math.min(now - this.lastFrame, 100);
    this.lastFrame = now;

    if (this.state === 'playing' && this.pauseStartedAt == null) {
      this.accumulator += frameTime;
      // Fixed-step physics for stability across devices.
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 5) {
        this.bike?.applyInput(this.input.state, FIXED_DT);
        Engine.update(this.engine, FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;

        // Check finish / crash conditions.
        if (this.bike && this.track && this.currentLevel && !this.finishLogged) {
          if (this.bike.crashed) {
            this.state = 'crashed';
            this.finishTimeMs = now - this.startTimeMs;
            this.finishLogged = true;
            this.cb.onCrash(this.currentLevel);
            break;
          }
          if (this.bike.position.x >= this.track.finishX) {
            this.state = 'finished';
            this.finishTimeMs = now - this.startTimeMs;
            this.finishLogged = true;
            const prev = this.bestTimes.get(this.currentLevel.id);
            const isBest = prev === undefined || this.finishTimeMs < prev;
            if (isBest) {
              this.bestTimes.set(this.currentLevel.id, this.finishTimeMs);
              saveBestTimes(this.bestTimes);
            }
            this.cb.onFinish(this.currentLevel, this.finishTimeMs, isBest);
            break;
          }

          // Out-of-bounds safeguard: if bike falls way below the track, treat as crash.
          if (this.bike.position.y > this.track.bounds.maxY + 1500) {
            this.state = 'crashed';
            this.finishTimeMs = now - this.startTimeMs;
            this.finishLogged = true;
            this.cb.onCrash(this.currentLevel);
            break;
          }
        }
      }
      if (this.bike) {
        this.camera.follow(this.bike.position, this.bike.velocity);
      }
    }

    this.render();
  }

  private render() {
    const { renderer, camera } = this;
    renderer.begin();

    // The diegetic scene (sky + track + bike) tilts together for the GD camera-
    // on-an-angle feel. Parallax mountains intentionally skipped here — the
    // mockup uses clean white sky, and the menu screens carry their own
    // decorative mountain footers.
    renderer.beginTilt();
    renderer.drawSky();

    if (this.track || this.bike) {
      renderer.ctx.save();
      camera.apply(renderer.ctx);
      if (this.track) renderer.drawTrack(this.track);
      if (this.bike) renderer.drawBike(this.bike);
      renderer.ctx.restore();
    }
    renderer.endTilt();

    renderer.drawForeground();
  }

  /** Live-running timer in ms while playing, else final time. */
  getElapsed(): number {
    if (this.state === 'playing') return performance.now() - this.startTimeMs;
    return this.finishTimeMs;
  }

  getState(): GameState {
    return this.state;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.input.destroy();
    this.cleanup();
    Events.off(this.engine, '');
  }
}

const STORAGE_KEY = 'gd:bestTimes:v1';

function loadBestTimes(): Map<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveBestTimes(m: Map<string, number>) {
  try {
    const obj: Record<string, number> = {};
    m.forEach((v, k) => (obj[k] = v));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}
