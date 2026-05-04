import Matter from 'matter-js';
import type { LevelDef, Vec2 } from './types';

const { Bodies, Composite } = Matter;

const CAT_GROUND = 0x0001;

/**
 * Track: builds Matter static bodies along the level polyline (one rotated rect
 * per segment) and renders the visible terrain.
 */
export class Track {
  composite: Matter.Composite;
  /** Surface points (top edge of terrain). */
  points: Vec2[];
  /** Filled polygon for rendering: surface + offscreen bottom edges. */
  fillPath: Path2D;
  /** Topline only, for grass/edge stroke. */
  topPath: Path2D;
  finishX: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };

  /** Vertical thickness of the rectangle bodies (deep enough never to fall through). */
  private readonly thickness = 800;

  constructor(level: LevelDef, private engine: Matter.Engine) {
    this.points = level.points;
    this.finishX = level.finishX;
    this.composite = Composite.create({ label: 'track' });

    const segments: Matter.Body[] = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const angle = Math.atan2(dy, dx);
      // Normal pointing "below" the segment (positive y-down).
      const nx = -dy / len;
      const ny = dx / len;
      const cx = (a.x + b.x) / 2 + nx * (this.thickness / 2);
      const cy = (a.y + b.y) / 2 + ny * (this.thickness / 2);
      const seg = Bodies.rectangle(cx, cy, len + 2, this.thickness, {
        isStatic: true,
        angle,
        friction: 0.95,
        frictionStatic: 1.2,
        restitution: 0.05,
        collisionFilter: { category: CAT_GROUND },
        label: 'ground',
      });
      segments.push(seg);
    }
    Composite.add(this.composite, segments);
    Composite.add(engine.world, this.composite);

    this.fillPath = this.buildFillPath();
    this.topPath = this.buildTopPath();
    this.bounds = this.computeBounds();
  }

  private buildFillPath(): Path2D {
    const p = new Path2D();
    const pts = this.points;
    if (!pts.length) return p;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      p.lineTo(pts[i].x, pts[i].y);
    }
    const last = pts[pts.length - 1];
    p.lineTo(last.x, last.y + 1500);
    p.lineTo(pts[0].x, pts[0].y + 1500);
    p.closePath();
    return p;
  }

  private buildTopPath(): Path2D {
    const p = new Path2D();
    const pts = this.points;
    if (!pts.length) return p;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      p.lineTo(pts[i].x, pts[i].y);
    }
    return p;
  }

  private computeBounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }

  destroy() {
    Composite.remove(this.engine.world, this.composite);
  }
}
