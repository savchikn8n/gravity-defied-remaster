import type { Bike } from './Bike';
import { Camera } from './Camera';
import type { Track } from './Track';

/**
 * Canvas2D renderer. Draws sky gradient, parallax mountains, terrain,
 * finish line and the bike+rider in a clean HD vector style.
 */
export class Renderer {
  ctx: CanvasRenderingContext2D;
  dpr = window.devicePixelRatio || 1;
  width = 0;
  height = 0;

  constructor(public canvas: HTMLCanvasElement, public camera: Camera) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
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

  /** Vertical sunset sky, screen-space. */
  drawSky() {
    const { ctx, width, height } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0e0a24');
    grad.addColorStop(0.45, '#3b1d4a');
    grad.addColorStop(0.75, '#a83a52');
    grad.addColorStop(1, '#f0a26a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Sun glow
    const cx = width * 0.72;
    const cy = height * 0.62;
    const r = Math.max(width, height) * 0.5;
    const sun = ctx.createRadialGradient(cx, cy, 8, cx, cy, r);
    sun.addColorStop(0, 'rgba(255, 220, 170, 0.8)');
    sun.addColorStop(0.18, 'rgba(255, 150, 90, 0.25)');
    sun.addColorStop(1, 'rgba(255, 150, 90, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
  }

  /** Parallax mountain silhouettes. */
  drawParallax() {
    const { ctx, width, height, camera } = this;
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.08, height * 0.62, 'rgba(28, 18, 50, 0.85)', 220, 90, 0.6);
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.18, height * 0.7, 'rgba(40, 22, 60, 0.95)', 160, 70, 1.1);
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.32, height * 0.78, 'rgba(20, 12, 32, 1)', 110, 50, 1.7);
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
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const step = 18;
    for (let x = -step; x <= w + step; x += step) {
      const wx = x + offset;
      const y = baseY
        - amp * (0.5 + 0.5 * Math.sin(wx / period))
        - amp * 0.35 * Math.sin(wx / (period * 0.4) * freq);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  /** Draw the terrain polygon and topline. World-space. */
  drawTrack(track: Track) {
    const { ctx } = this;

    // Soft glow above the terrain edge
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 200, 140, 0.18)';
    ctx.lineJoin = 'round';
    ctx.stroke(track.topPath);
    ctx.restore();

    // Fill (dirt body)
    const grad = ctx.createLinearGradient(0, track.bounds.minY - 20, 0, track.bounds.minY + 600);
    grad.addColorStop(0, '#3a2748');
    grad.addColorStop(0.4, '#251a35');
    grad.addColorStop(1, '#0e0a1c');
    ctx.fillStyle = grad;
    ctx.fill(track.fillPath);

    // Top accent line (grass-like)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff7a4a';
    ctx.lineJoin = 'round';
    ctx.stroke(track.topPath);

    // Finish line
    this.drawFinishLine(track);
  }

  private drawFinishLine(track: Track) {
    const { ctx } = this;
    // Find approximate y at finishX by scanning track points
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
    const top = y - 220;
    // Pole
    ctx.fillStyle = '#dadada';
    ctx.fillRect(x - 2, top, 4, 220);
    // Flag (checkered)
    const fw = 70, fh = 40;
    ctx.save();
    ctx.translate(x + 2, top);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#1a1a1a';
        ctx.fillRect(col * (fw / 7), row * (fh / 4), fw / 7 + 1, fh / 4 + 1);
      }
    }
    ctx.restore();
    // Beam glow
    ctx.save();
    ctx.fillStyle = 'rgba(255, 220, 140, 0.10)';
    ctx.fillRect(x - 18, y - 200, 36, 200);
    ctx.restore();
  }

  /** Bike + rider, world-space. */
  drawBike(bike: Bike) {
    const { ctx } = this;
    const cx = bike.chassis.position.x;
    const cy = bike.chassis.position.y;
    const ang = bike.chassis.angle;

    // Wheels (drawn in world space, not chassis-local, since wheels are independent bodies)
    this.drawWheel(bike.rearWheel.position.x, bike.rearWheel.position.y, bike.wheelR, bike.rearWheel.angle);
    this.drawWheel(bike.frontWheel.position.x, bike.frontWheel.position.y, bike.wheelR, bike.frontWheel.angle);

    // Chassis + rider, oriented to chassis angle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    // Frame (sportbike silhouette)
    ctx.beginPath();
    ctx.moveTo(-32, 5);
    ctx.lineTo(-10, -8);
    ctx.lineTo(18, -10);
    ctx.lineTo(34, 0);
    ctx.lineTo(28, 10);
    ctx.lineTo(-28, 10);
    ctx.closePath();
    const frameGrad = ctx.createLinearGradient(0, -12, 0, 12);
    frameGrad.addColorStop(0, '#ff5a3c');
    frameGrad.addColorStop(0.55, '#c93824');
    frameGrad.addColorStop(1, '#5a160e');
    ctx.fillStyle = frameGrad;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();

    // Tank highlight
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(14, -9);
    ctx.lineTo(12, -4);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();

    // Headlight
    ctx.beginPath();
    ctx.arc(34, -2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9a0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(34, -2, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7d6';
    ctx.fill();

    // Exhaust
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-36, 4, 8, 5);

    // Rider body (silhouette, leaning forward)
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.quadraticCurveTo(0, -28, 16, -22);
    ctx.lineTo(20, -16);
    ctx.lineTo(8, -14);
    ctx.lineTo(-2, -10);
    ctx.closePath();
    ctx.fillStyle = '#1d1428';
    ctx.fill();

    // Arm
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1d1428';
    ctx.beginPath();
    ctx.moveTo(10, -20);
    ctx.lineTo(28, -8);
    ctx.stroke();

    // Leg
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-18, 12);
    ctx.stroke();

    ctx.restore();

    // Helmet (drawn at the head body's position so it tracks crashes correctly)
    const hx = bike.head.position.x;
    const hy = bike.head.position.y;
    const hAng = bike.head.angle;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(hAng);
    // Outer shell
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    const helm = ctx.createLinearGradient(0, -8, 0, 8);
    helm.addColorStop(0, '#ff8a5a');
    helm.addColorStop(1, '#a02a18');
    ctx.fillStyle = helm;
    ctx.fill();
    // Visor
    ctx.beginPath();
    ctx.moveTo(2, -3);
    ctx.lineTo(8, -1);
    ctx.lineTo(8, 3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fillStyle = '#0a0a0f';
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(-2, -3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.restore();
  }

  private drawWheel(x: number, y: number, r: number, angle: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    // Tire
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1f';
    ctx.fill();

    // Tread highlights (rotate with wheel)
    ctx.rotate(angle);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3a3a44';
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#9aa0b4';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.stroke();
    }

    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a3c';
    ctx.fill();
    ctx.restore();
  }

  /** Optional: subtle ground vignette and motion lines. */
  drawForeground() {
    const { ctx, width, height } = this;
    const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
