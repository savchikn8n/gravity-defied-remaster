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

  /**
   * Global scene tilt (radians). Negative = CCW = world appears to go uphill
   * to the right. Matches the original Gravity Defied "camera-on-an-angle" feel.
   * Tweak between -0.04 and -0.08 to taste.
   */
  sceneTilt = -0.055;

  constructor(public canvas: HTMLCanvasElement, public camera: Camera) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
  }

  /** Wrap sky/parallax/world drawing so the whole scene is tilted. */
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

  /** Flat off-white backdrop in classic GD style. Overdraws to cover tilt. */
  drawSky() {
    const { ctx, width, height } = this;
    const m = 120;
    // Subtle vertical wash so the page doesn't look too sterile, but stays light.
    const grad = ctx.createLinearGradient(0, -m, 0, height + m);
    grad.addColorStop(0, '#f7f6ee');
    grad.addColorStop(1, '#e8e6d8');
    ctx.fillStyle = grad;
    ctx.fillRect(-m, -m, width + m * 2, height + m * 2);
  }

  /** Distant hills as a faint silhouette layer behind the track. */
  drawParallax() {
    const { ctx, width, height, camera } = this;
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.16, height * 0.72, 'rgba(170, 178, 158, 0.55)', 200, 60, 1.0);
    this.drawMountainLayer(ctx, width, height, camera.pos.x * 0.28, height * 0.80, 'rgba(140, 152, 130, 0.75)', 130, 40, 1.6);
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
    // Bigger steps + quantization for an angular, polygonal silhouette.
    const step = 60;
    for (let x = -m; x <= w + m; x += step) {
      const wx = x + offset;
      const raw = baseY
        - amp * (0.5 + 0.5 * Math.sin(wx / period))
        - amp * 0.35 * Math.sin(wx / (period * 0.4) * freq);
      // Snap so vertices feel deliberate.
      const y = Math.round(raw / 6) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + m, h + m);
    ctx.closePath();
    ctx.fill();
  }

  /** Draw terrain polygon and topline — flat white interior with bright green outline. */
  drawTrack(track: Track) {
    const { ctx } = this;

    // Filled body (slightly off-white so the silhouette reads on the backdrop)
    ctx.fillStyle = '#ffffff';
    ctx.fill(track.fillPath);

    // Subtle hatching to suggest "ground volume" without breaking the flat style
    ctx.save();
    ctx.clip(track.fillPath);
    ctx.strokeStyle = 'rgba(80, 110, 70, 0.10)';
    ctx.lineWidth = 1;
    const minX = track.bounds.minX - 100;
    const maxX = track.bounds.maxX + 100;
    const minY = track.bounds.minY - 50;
    const maxY = track.bounds.maxY + 800;
    for (let y = minY; y < maxY; y += 16) {
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
    ctx.restore();

    // Sharp polygonal green outline (the GD signature)
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 8;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#2f8a3e';
    ctx.stroke(track.topPath);

    // Inner darker line for a touch of depth
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#1f5a28';
    ctx.stroke(track.topPath);

    // Finish line
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
    const top = y - 220;
    // Pole (dark grey reads well on light bg)
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(x - 2, top, 4, 220);
    // Checkered flag
    const fw = 70, fh = 40;
    ctx.save();
    ctx.translate(x + 2, top);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#1a1a1a';
        ctx.fillRect(col * (fw / 7), row * (fh / 4), fw / 7 + 1, fh / 4 + 1);
      }
    }
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0, 0, fw, fh);
    ctx.restore();
  }

  /** Bike + rider, world-space. Layered to read as a real motorcycle silhouette. */
  drawBike(bike: Bike) {
    const { ctx } = this;
    const c = bike.chassis;

    // World-space connectors (they span between independent bodies)
    this.drawSwingarm(bike);
    this.drawFork(bike);

    // Wheels
    this.drawWheel(bike.rearWheel.position.x, bike.rearWheel.position.y, bike.wheelR, bike.rearWheel.angle);
    this.drawWheel(bike.frontWheel.position.x, bike.frontWheel.position.y, bike.wheelR, bike.frontWheel.angle);

    // Chassis-local elements (rider + bodywork)
    ctx.save();
    ctx.translate(c.position.x, c.position.y);
    ctx.rotate(c.angle);
    this.drawExhaust();
    this.drawEngine();
    this.drawFrame();
    this.drawTank();
    this.drawSeat();
    this.drawHeadlight();
    this.drawHandlebars();
    this.drawRider();
    ctx.restore();

    // Helmet — tracks the head body for accurate crash visuals
    this.drawHelmet(bike.head.position.x, bike.head.position.y, bike.head.angle);
  }

  /** Telescopic front fork: two parallel chrome tubes from headstock to wheel. */
  private drawFork(bike: Bike) {
    const ctx = this.ctx;
    const c = bike.chassis;
    const cosA = Math.cos(c.angle);
    const sinA = Math.sin(c.angle);
    // Headstock attach point in world (chassis-local coords transformed)
    const lx = 28, ly = -6;
    const wx = c.position.x + cosA * lx - sinA * ly;
    const wy = c.position.y + sinA * lx + cosA * ly;
    const fx = bike.frontWheel.position.x;
    const fy = bike.frontWheel.position.y;
    const dx = fx - wx, dy = fy - wy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // perpendicular unit
    const off = 2.4;

    ctx.save();
    ctx.lineCap = 'round';
    // Outer dark casing
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0c0c14';
    ctx.beginPath();
    ctx.moveTo(wx + nx * off, wy + ny * off);
    ctx.lineTo(fx + nx * off, fy + ny * off);
    ctx.moveTo(wx - nx * off, wy - ny * off);
    ctx.lineTo(fx - nx * off, fy - ny * off);
    ctx.stroke();
    // Chrome highlight along the fork tubes
    const grad = ctx.createLinearGradient(wx, wy, fx, fy);
    grad.addColorStop(0, '#3a3a48');
    grad.addColorStop(0.45, '#c4c5d0');
    grad.addColorStop(1, '#444452');
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(wx + nx * off, wy + ny * off);
    ctx.lineTo(fx + nx * off, fy + ny * off);
    ctx.moveTo(wx - nx * off, wy - ny * off);
    ctx.lineTo(fx - nx * off, fy - ny * off);
    ctx.stroke();
    ctx.restore();
  }

  /** Rear swingarm + monoshock. Trapezoid narrowing toward the wheel. */
  private drawSwingarm(bike: Bike) {
    const ctx = this.ctx;
    const c = bike.chassis;
    const cosA = Math.cos(c.angle);
    const sinA = Math.sin(c.angle);
    // Pivot near engine bottom
    const lx = -8, ly = 6;
    const ax = c.position.x + cosA * lx - sinA * ly;
    const ay = c.position.y + sinA * lx + cosA * ly;
    const rx = bike.rearWheel.position.x;
    const ry = bike.rearWheel.position.y;
    const dx = rx - ax, dy = ry - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;

    ctx.save();
    // Swingarm trapezoid
    ctx.beginPath();
    const w1 = 5.5, w2 = 3;
    ctx.moveTo(ax + nx * w1, ay + ny * w1);
    ctx.lineTo(rx + nx * w2, ry + ny * w2);
    ctx.lineTo(rx - nx * w2, ry - ny * w2);
    ctx.lineTo(ax - nx * w1, ay - ny * w1);
    ctx.closePath();
    const sg = ctx.createLinearGradient(ax, ay - 4, ax, ay + 4);
    sg.addColorStop(0, '#2c2c38');
    sg.addColorStop(1, '#0c0c14');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#3a3a48';
    ctx.stroke();

    // Monoshock: from chassis upper-rear to swingarm midpoint
    const stx = c.position.x + cosA * (-12) - sinA * (-9);
    const sty = c.position.y + sinA * (-12) + cosA * (-9);
    const smx = (ax + rx) * 0.5;
    const smy = (ay + ry) * 0.5;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = '#1a1a22';
    ctx.beginPath();
    ctx.moveTo(stx, sty);
    ctx.lineTo(smx, smy);
    ctx.stroke();
    // Spring color core
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(stx, sty);
    ctx.lineTo(smx, smy);
    ctx.stroke();
    ctx.restore();
  }

  private drawWheel(x: number, y: number, r: number, angle: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    // Tire body
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Sidewall edge
    ctx.strokeStyle = '#1a1a26';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Spinning bits
    ctx.rotate(angle);

    // Tread chunks
    ctx.strokeStyle = '#252531';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1));
      ctx.lineTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.stroke();
    }

    // Brake disc (silver)
    const discR = r - 5;
    const dg = ctx.createRadialGradient(0, 0, 1, 0, 0, discR);
    dg.addColorStop(0, '#e8e8ee');
    dg.addColorStop(0.5, '#a8a9b4');
    dg.addColorStop(1, '#5e5f6a');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();

    // Disc holes
    ctx.fillStyle = '#0a0a12';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (discR - 3.2), Math.sin(a) * (discR - 3.2), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spokes
    ctx.strokeStyle = '#cfd0d8';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a + Math.PI) * (discR - 2), Math.sin(a + Math.PI) * (discR - 2));
      ctx.lineTo(Math.cos(a) * (discR - 2), Math.sin(a) * (discR - 2));
      ctx.stroke();
    }

    // Hub
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ----- chassis-local (already translated/rotated) -----

  private drawExhaust() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    // Outer dark casing
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = '#0a0a12';
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.quadraticCurveTo(-15, 5, -28, 7);
    ctx.stroke();
    // Chrome highlight
    const g = ctx.createLinearGradient(0, 4, 0, 9);
    g.addColorStop(0, '#cfd0d8');
    g.addColorStop(0.5, '#82838f');
    g.addColorStop(1, '#262630');
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.quadraticCurveTo(-15, 5, -28, 7);
    ctx.stroke();
    // Muffler tip
    const mg = ctx.createLinearGradient(-32, 4, -22, 10);
    mg.addColorStop(0, '#52535e');
    mg.addColorStop(0.5, '#bdbec8');
    mg.addColorStop(1, '#2a2b34');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(-30, 7, 6.5, 3.2, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#0a0a12';
    ctx.stroke();
    // Pipe hole
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.ellipse(-33, 7, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEngine() {
    const ctx = this.ctx;
    ctx.save();
    // Block
    const grad = ctx.createLinearGradient(0, -3, 0, 11);
    grad.addColorStop(0, '#3a3a48');
    grad.addColorStop(0.55, '#1a1a24');
    grad.addColorStop(1, '#0a0a12');
    ctx.fillStyle = grad;
    this.roundRect(ctx, -10, -2, 22, 13, 2);
    ctx.fill();
    ctx.strokeStyle = '#080810';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // Cooling fins
    ctx.strokeStyle = '#52535e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = -1 + i * 3;
      ctx.beginPath();
      ctx.moveTo(-9, y);
      ctx.lineTo(11, y);
      ctx.stroke();
    }
    // Cylinder bolts
    ctx.fillStyle = '#82838f';
    for (let i = 0; i < 3; i++) {
      const x = -7 + i * 7;
      ctx.beginPath();
      ctx.arc(x, -2.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFrame() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Down tube + top tube + seat post (triangulated frame)
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = '#0c0c14';
    ctx.beginPath();
    ctx.moveTo(28, -6);
    ctx.lineTo(11, -1);
    ctx.moveTo(28, -6);
    ctx.lineTo(-11, -7);
    ctx.moveTo(-11, -7);
    ctx.lineTo(-9, 4);
    ctx.stroke();
    // Color highlight
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#3a2030';
    ctx.beginPath();
    ctx.moveTo(28, -6);
    ctx.lineTo(11, -1);
    ctx.moveTo(28, -6);
    ctx.lineTo(-11, -7);
    ctx.moveTo(-11, -7);
    ctx.lineTo(-9, 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawTank() {
    const ctx = this.ctx;
    ctx.save();
    // Teardrop tank
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.bezierCurveTo(-1, -16, 14, -17, 22, -10);
    ctx.lineTo(22, -7);
    ctx.lineTo(2, -5);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -16, 0, -4);
    grad.addColorStop(0, '#ff8866');
    grad.addColorStop(0.45, '#dc3a22');
    grad.addColorStop(1, '#5a160e');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#2a0a05';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Highlight band
    ctx.beginPath();
    ctx.moveTo(2, -13);
    ctx.bezierCurveTo(8, -16, 16, -15, 19, -11);
    ctx.strokeStyle = 'rgba(255,255,240,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Filler cap
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.arc(12, -13, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSeat() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(-22, -8);
    ctx.lineTo(-22, -4);
    ctx.lineTo(-2, -2);
    ctx.closePath();
    ctx.fillStyle = '#0e0e16';
    ctx.fill();
    ctx.strokeStyle = '#3a2030';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Stitch line
    ctx.strokeStyle = 'rgba(255,90,60,0.32)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(-20, -7);
    ctx.stroke();
    ctx.restore();
  }

  private drawHeadlight() {
    const ctx = this.ctx;
    ctx.save();
    // Front fairing/cowl
    ctx.beginPath();
    ctx.moveTo(28, -8);
    ctx.lineTo(38, -3);
    ctx.lineTo(36, 4);
    ctx.lineTo(28, 0);
    ctx.closePath();
    const fg = ctx.createLinearGradient(28, -8, 36, 4);
    fg.addColorStop(0, '#dc3a22');
    fg.addColorStop(1, '#5a160e');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#0a0a12';
    ctx.stroke();
    // Light glow
    const lg = ctx.createRadialGradient(35, 0, 0.5, 35, 0, 5);
    lg.addColorStop(0, '#fffce0');
    lg.addColorStop(0.6, '#ffd070');
    lg.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(35, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // Bulb core
    ctx.fillStyle = '#fffce0';
    ctx.beginPath();
    ctx.arc(35, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawHandlebars() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    // Riser stem (headstock up to bar)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1a1a22';
    ctx.beginPath();
    ctx.moveTo(28, -7);
    ctx.lineTo(26, -16);
    ctx.stroke();
    // Bar
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#3a3a48';
    ctx.beginPath();
    ctx.moveTo(22, -17);
    ctx.lineTo(31, -15);
    ctx.stroke();
    // Right grip
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = '#0a0a12';
    ctx.beginPath();
    ctx.moveTo(28, -15);
    ctx.lineTo(31, -15);
    ctx.stroke();
    // Mirror stalk
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#1a1a22';
    ctx.beginPath();
    ctx.moveTo(26, -17);
    ctx.lineTo(24, -22);
    ctx.stroke();
    ctx.fillStyle = '#52535e';
    ctx.beginPath();
    ctx.ellipse(23, -23, 2, 1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRider() {
    const ctx = this.ctx;
    ctx.save();
    // Torso bent forward in racing tuck
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-2, -10);
    ctx.quadraticCurveTo(8, -22, 16, -20);
    ctx.lineTo(20, -16);
    ctx.lineTo(8, -13);
    ctx.lineTo(-3, -8);
    ctx.closePath();
    const sg = ctx.createLinearGradient(0, -22, 0, -6);
    sg.addColorStop(0, '#2c2c40');
    sg.addColorStop(1, '#0c0c18');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Racing stripe
    ctx.strokeStyle = '#ff5a3c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -16);
    ctx.lineTo(15, -18);
    ctx.stroke();
    // Arm (shoulder to grip)
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1f1f2c';
    ctx.beginPath();
    ctx.moveTo(17, -19);
    ctx.quadraticCurveTo(24, -18, 29, -16);
    ctx.stroke();
    // Glove
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.arc(29, -15, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Upper leg (hip to knee)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1f1f2c';
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.lineTo(0, 2);
    ctx.stroke();
    // Lower leg (knee to peg)
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-10, 9);
    ctx.stroke();
    // Boot
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.ellipse(-12, 10, 4, 2.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2030';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawHelmet(x: number, y: number, ang: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // Outer shell
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    const helm = ctx.createLinearGradient(0, -9, 0, 9);
    helm.addColorStop(0, '#ff8a5a');
    helm.addColorStop(0.55, '#d83a22');
    helm.addColorStop(1, '#5a160e');
    ctx.fillStyle = helm;
    ctx.fill();
    ctx.strokeStyle = '#0c0a10';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // Smoked wrap-around visor
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.bezierCurveTo(3, -5, 8, -3.5, 9, 0);
    ctx.lineTo(8, 3);
    ctx.lineTo(2, 4);
    ctx.bezierCurveTo(-1, 3, -2, 0, -1, -3);
    ctx.closePath();
    const vg = ctx.createLinearGradient(2, -3, 8, 3);
    vg.addColorStop(0, '#202028');
    vg.addColorStop(0.5, '#0a0a14');
    vg.addColorStop(1, '#3a3a44');
    ctx.fillStyle = vg;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Visor top highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.lineTo(7, -2);
    ctx.stroke();
    // Top decorative arc band
    ctx.strokeStyle = '#0c0a10';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, -2.6, -0.5);
    ctx.stroke();
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, -2.6, -0.5);
    ctx.stroke();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** Subtle screen-edge fade to keep the bright bg from feeling flat. */
  drawForeground() {
    const { ctx, width, height } = this;
    const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.45, width / 2, height / 2, height * 1.1);
    g.addColorStop(0, 'rgba(60, 70, 50, 0)');
    g.addColorStop(1, 'rgba(60, 70, 50, 0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
