import type { Vec2 } from './types';

/**
 * 2D camera with smooth follow and look-ahead based on target velocity.
 */
export class Camera {
  pos: Vec2 = { x: 0, y: 0 };
  zoom = 1;
  targetZoom = 1;
  viewportW = 1;
  viewportH = 1;
  /** World coords currently visible at top-left of canvas. */
  worldOffsetX = 0;
  worldOffsetY = 0;

  private smooth = 0.12;

  setViewport(w: number, h: number) {
    this.viewportW = w;
    this.viewportH = h;
  }

  follow(target: Vec2, targetVel: Vec2 = { x: 0, y: 0 }) {
    const lookAheadX = clamp(targetVel.x * 14, -160, 220);
    const lookAheadY = clamp(targetVel.y * 8, -90, 90);
    const desiredX = target.x + lookAheadX;
    // Push the camera *up* in world coords (smaller y) so the bike appears
    // in the upper-middle of the viewport with track visible below it.
    // Offset is proportional to viewport height so it scales correctly on
    // any device — equates to bike sitting ~32% from top.
    const yOffset = this.viewportH * 0.18;
    const desiredY = target.y - yOffset + lookAheadY;
    this.pos.x += (desiredX - this.pos.x) * this.smooth;
    this.pos.y += (desiredY - this.pos.y) * this.smooth * 0.7;
    this.zoom += (this.targetZoom - this.zoom) * 0.06;
    this.recalc();
  }

  snapTo(target: Vec2) {
    this.pos.x = target.x;
    this.pos.y = target.y - this.viewportH * 0.18;
    this.zoom = this.targetZoom;
    this.recalc();
  }

  private recalc() {
    this.worldOffsetX = this.pos.x - this.viewportW / (2 * this.zoom);
    this.worldOffsetY = this.pos.y - this.viewportH / (2 * this.zoom);
  }

  /** Apply camera transform to a 2D context. Caller is responsible for save/restore. */
  apply(ctx: CanvasRenderingContext2D) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.worldOffsetX, -this.worldOffsetY);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
