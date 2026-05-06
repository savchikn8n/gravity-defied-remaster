import type { Bike } from './Bike';
import { Camera } from './Camera';
import type { Track } from './Track';

/**
 * Canvas2D renderer. Sketch-style: white world, green polygonal track,
 * minimal high-contrast bike silhouette with a red rider.
 */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  dpr = window.devicePixelRatio || 1;
  width = 0;
  height = 0;

  /**
   * Global scene tilt (radians). Negative = CCW = world appears to go uphill
   * to the right. Tweak between -0.04 and -0.08 to taste.
   */
  sceneTilt = -0.045;

  constructor(public canvas: HTMLCanvasElement, public camera: Camera) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
  }

  beginTilt() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.rotate(this.sceneTilt);
    ctx.translate(-this.width / 2, -this.height / 2);
  }

  endTilt() {
    this.ctx.restore();
  }

  resize() {
    // Fall back to window dimensions if the canvas hasn't been laid out yet —
    // safer than reading 0 and sizing the canvas internal coords incorrectly,
    // which would visually scale everything up.
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.setViewport(w, h);
  }

  begin() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
  }

  /** Flat warm-white backdrop matching the menu cards. */
  drawSky() {
    const { ctx, width, height } = this;
    const m = 120;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-m, -m, width + m * 2, height + m * 2);
  }

  /** Distant hills: sparse, faint, off behind the track. */
  drawParallax() {
    const { ctx, width, height, camera } = this;
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.18, height * 0.78, 'rgba(150, 175, 145, 0.35)', 180, 50, 1.2);
  }

  private drawMountainLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    offset: number,
    baseY: number,
    color: string,
    period: number,
    amp: number,
    freq: number,
  ) {
    const m = 140;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-m, h + m);
    const step = 60;
    for (let x = -m; x <= w + m; x += step) {
      const wx = x + offset;
      const raw = baseY
        - amp * (0.5 + 0.5 * Math.sin(wx / period))
        - amp * 0.35 * Math.sin(wx / (period * 0.4) * freq);
      const y = Math.round(raw / 6) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + m, h + m);
    ctx.closePath();
    ctx.fill();
  }

  /** Track in sketch style: white interior, vertical green hatch, green polygonal outline. */
  drawTrack(track: Track) {
    const { ctx } = this;

    // White interior
    ctx.fillStyle = '#ffffff';
    ctx.fill(track.fillPath);

    // Vertical hatch lines clipped to the track polygon
    ctx.save();
    ctx.clip(track.fillPath);
    ctx.strokeStyle = 'rgba(47, 138, 62, 0.5)';
    ctx.lineWidth = 1;
    const minX = Math.floor((track.bounds.minX - 20) / 16) * 16;
    const maxX = track.bounds.maxX + 20;
    const minY = track.bounds.minY - 40;
    const maxY = track.bounds.maxY + 1200;
    for (let x = minX; x <= maxX; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }
    ctx.restore();

    // Sharp polygonal green outline
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 8;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#2f8a3e';
    ctx.stroke(track.topPath);

    this.drawFinishLine(track);
  }

  private drawFinishLine(track: Track) {
    const { ctx } = this;
    const pts = track.points;
    let y = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pts[i].x <= track.finishX && pts[i + 1].x >= track.finishX) {
        const t = (track.finishX - pts[i].x) / (pts[i + 1].x - pts[i].x);
        y = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
        break;
      }
    }
    const x = track.finishX;
    const top = y - 200;
    // Pole
    ctx.fillStyle = '#161616';
    ctx.fillRect(x - 2, top, 3, 200);
    // Checkered flag
    const fw = 60, fh = 36;
    ctx.save();
    ctx.translate(x + 2, top);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#161616';
        ctx.fillRect(col * (fw / 6), row * (fh / 4), fw / 6 + 1, fh / 4 + 1);
      }
    }
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0, 0, fw, fh);
    ctx.restore();
  }

  // ============== BIKE ==============

  /** Sketch-style bike: black silhouette, red rider, simple wheels. */
  drawBike(bike: Bike) {
    const ctx = this.ctx;
    const c = bike.chassis;

    // Connectors first (world-space, span between independent bodies)
    this.drawSwingarm(bike);
    this.drawFork(bike);

    // Wheels
    this.drawWheel(bike.rearWheel.position.x, bike.rearWheel.position.y, bike.wheelR, bike.rearWheel.angle);
    this.drawWheel(bike.frontWheel.position.x, bike.frontWheel.position.y, bike.wheelR, bike.frontWheel.angle);

    // Bike body + rider (chassis-local)
    ctx.save();
    ctx.translate(c.position.x, c.position.y);
    ctx.rotate(c.angle);
    this.drawBikeBody();
    this.drawRider();
    ctx.restore();

    // Helmet (head body, separate from chassis rotation)
    this.drawHelmet(bike.head.position.x, bike.head.position.y, bike.head.angle);
  }

  /** Single thick black line from headstock to front wheel. */
  private drawFork(bike: Bike) {
    const ctx = this.ctx;
    const c = bike.chassis;
    const cosA = Math.cos(c.angle);
    const sinA = Math.sin(c.angle);
    const lx = 26, ly = -6;
    const wx = c.position.x + cosA * lx - sinA * ly;
    const wy = c.position.y + sinA * lx + cosA * ly;
    const fx = bike.frontWheel.position.x;
    const fy = bike.frontWheel.position.y;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = '#161616';
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.restore();
  }

  /** Single thick black line from chassis to rear wheel. */
  private drawSwingarm(bike: Bike) {
    const ctx = this.ctx;
    const c = bike.chassis;
    const cosA = Math.cos(c.angle);
    const sinA = Math.sin(c.angle);
    const lx = -6, ly = 4;
    const ax = c.position.x + cosA * lx - sinA * ly;
    const ay = c.position.y + sinA * lx + cosA * ly;
    const rx = bike.rearWheel.position.x;
    const ry = bike.rearWheel.position.y;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = '#161616';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.restore();
  }

  /** Simple wheel: black tire, white inner, two diametric spokes that rotate. */
  private drawWheel(x: number, y: number, r: number, angle: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    // Tire
    ctx.fillStyle = '#161616';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Inner white rim
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.fill();
    // Spokes (rotate with wheel for visible spin)
    ctx.rotate(angle);
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const a = (i / 2) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
      ctx.lineTo(Math.cos(a + Math.PI) * (r - 5), Math.sin(a + Math.PI) * (r - 5));
      ctx.stroke();
    }
    // Hub
    ctx.fillStyle = '#161616';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Bike body silhouette in chassis-local coords. */
  private drawBikeBody() {
    const ctx = this.ctx;
    ctx.save();
    // Frame: rear → seat → tank → headstock → bottom → engine → rear
    ctx.beginPath();
    ctx.moveTo(-30, 7);
    ctx.lineTo(-22, -2);
    ctx.lineTo(-8, -6);
    ctx.lineTo(8, -10);
    ctx.lineTo(20, -7);
    ctx.lineTo(28, -4);
    ctx.lineTo(24, 3);
    ctx.lineTo(8, 7);
    ctx.lineTo(-30, 7);
    ctx.closePath();
    ctx.fillStyle = '#161616';
    ctx.fill();

    // Subtle red side panel — small accent stripe over the tank
    ctx.fillStyle = '#d0392c';
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.lineTo(18, -6);
    ctx.lineTo(16, -4);
    ctx.lineTo(-3, -6);
    ctx.closePath();
    ctx.fill();

    // Headstock stem (riser)
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.lineTo(24, -16);
    ctx.stroke();
    // Handlebar
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(20, -16);
    ctx.lineTo(28, -15);
    ctx.stroke();
    // Grip dot
    ctx.fillStyle = '#161616';
    ctx.beginPath();
    ctx.arc(28, -15, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Rider in red shirt, leaning forward. */
  private drawRider() {
    const ctx = this.ctx;
    ctx.save();
    // Torso (red shirt)
    ctx.beginPath();
    ctx.moveTo(-12, -7);
    ctx.lineTo(-2, -10);
    ctx.quadraticCurveTo(8, -22, 18, -19);
    ctx.lineTo(20, -15);
    ctx.lineTo(8, -12);
    ctx.lineTo(-3, -8);
    ctx.closePath();
    ctx.fillStyle = '#d0392c';
    ctx.fill();
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Arm (dark) — shoulder to grip
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#161616';
    ctx.beginPath();
    ctx.moveTo(17, -18);
    ctx.quadraticCurveTo(22, -17, 26, -15);
    ctx.stroke();

    // Leg (dark pants) — hip to peg
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-3, -7);
    ctx.lineTo(0, 2);
    ctx.lineTo(-10, 9);
    ctx.stroke();
    ctx.restore();
  }

  /** Helmet (separate physics body). */
  private drawHelmet(x: number, y: number, ang: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // Shell
    ctx.fillStyle = '#161616';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    // Visor (white slit)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, -1, 5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }

  /** Light edge fade — keeps the bright bg from feeling perfectly flat. */
  drawForeground() {
    const { ctx, width, height } = this;
    const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.5, width / 2, height / 2, height * 1.15);
    g.addColorStop(0, 'rgba(40, 60, 40, 0)');
    g.addColorStop(1, 'rgba(40, 60, 40, 0.10)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
