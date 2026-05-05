import Matter from 'matter-js';
import type { InputState, Vec2 } from './types';

const { Bodies, Body, Composite, Constraint, Events } = Matter;

const CAT_BIKE = 0x0002;
const CAT_GROUND = 0x0001;
const CAT_HEAD = 0x0004;

export interface BikeConfig {
  spawn: Vec2;
}

/**
 * Two-wheel bike with chassis + rider. Designed to feel close to the
 * Gravity Defied original: rear wheel drives, both can lift, bike crashes
 * when the rider's helmet contacts the ground.
 */
export class Bike {
  composite: Matter.Composite;
  chassis: Matter.Body;
  rearWheel: Matter.Body;
  frontWheel: Matter.Body;
  head: Matter.Body;
  rearAxle: Matter.Constraint;
  frontAxle: Matter.Constraint;
  headJoint: Matter.Constraint;

  /** Wheel-radius for rendering. Must match Matter circle radius. */
  readonly wheelR = 18;
  /** Half-length of chassis, for rendering. */
  readonly chassisHalf = { w: 42, h: 7 };

  private rearContacts = 0;
  private frontContacts = 0;
  crashed = false;

  get rearOnGround() { return this.rearContacts > 0; }
  get frontOnGround() { return this.frontContacts > 0; }

  constructor(cfg: BikeConfig, private engine: Matter.Engine) {
    const { x, y } = cfg.spawn;

    this.chassis = Bodies.rectangle(x, y, 84, 14, {
      density: 0.0018,
      friction: 0.05,
      frictionAir: 0.005,
      collisionFilter: { category: CAT_BIKE, mask: CAT_GROUND },
      label: 'chassis',
    });

    const wheelOpts: Matter.IBodyDefinition = {
      density: 0.006,
      friction: 1.1,
      frictionStatic: 1.6,
      restitution: 0.05,
      collisionFilter: { category: CAT_BIKE, mask: CAT_GROUND },
    };

    this.rearWheel = Bodies.circle(x - 32, y + 18, this.wheelR, { ...wheelOpts, label: 'rearWheel' });
    this.frontWheel = Bodies.circle(x + 32, y + 18, this.wheelR, { ...wheelOpts, label: 'frontWheel' });

    // Helmet: small sensor body above the rider, kinematically attached to chassis.
    this.head = Bodies.circle(x + 6, y - 26, 9, {
      density: 0.0006,
      friction: 0.3,
      collisionFilter: { category: CAT_HEAD, mask: CAT_GROUND },
      label: 'head',
    });

    // Suspension constraints: two per wheel for rotational stability.
    this.rearAxle = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: -32, y: 9 },
      bodyB: this.rearWheel,
      stiffness: 0.85,
      damping: 0.2,
      length: 0,
    });
    const rearAxle2 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: -28, y: 9 },
      bodyB: this.rearWheel,
      pointB: { x: -4, y: 0 },
      stiffness: 0.6,
      damping: 0.2,
      length: 0,
    });
    this.frontAxle = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: 32, y: 9 },
      bodyB: this.frontWheel,
      stiffness: 0.85,
      damping: 0.2,
      length: 0,
    });
    const frontAxle2 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: 28, y: 9 },
      bodyB: this.frontWheel,
      pointB: { x: 4, y: 0 },
      stiffness: 0.6,
      damping: 0.2,
      length: 0,
    });

    this.headJoint = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: 6, y: -26 },
      bodyB: this.head,
      stiffness: 0.95,
      damping: 0.4,
      length: 0,
    });
    const headJoint2 = Constraint.create({
      bodyA: this.chassis,
      pointA: { x: 14, y: -22 },
      bodyB: this.head,
      pointB: { x: 6, y: 4 },
      stiffness: 0.85,
      damping: 0.4,
      length: 0,
    });

    this.composite = Composite.create({ label: 'bike' });
    Composite.add(this.composite, [
      this.chassis,
      this.rearWheel,
      this.frontWheel,
      this.head,
      this.rearAxle,
      rearAxle2,
      this.frontAxle,
      frontAxle2,
      this.headJoint,
      headJoint2,
    ]);

    Composite.add(engine.world, this.composite);

    Events.on(engine, 'collisionStart', this.onCollisionStart);
    Events.on(engine, 'collisionEnd', this.onCollisionEnd);
  }

  private onCollisionStart = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label;
      const b = pair.bodyB.label;
      if (a === 'rearWheel' || b === 'rearWheel') this.rearContacts++;
      if (a === 'frontWheel' || b === 'frontWheel') this.frontContacts++;
      if (a === 'head' || b === 'head') this.crashed = true;
      // Chassis hitting ground = the bike fell on its side, that's a crash.
      if (a === 'chassis' || b === 'chassis') this.crashed = true;
    }
  };

  private onCollisionEnd = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA.label;
      const b = pair.bodyB.label;
      if (a === 'rearWheel' || b === 'rearWheel') this.rearContacts = Math.max(0, this.rearContacts - 1);
      if (a === 'frontWheel' || b === 'frontWheel') this.frontContacts = Math.max(0, this.frontContacts - 1);
    }
  };

  /** Run before Engine.update each tick. Applies forces from current input. */
  applyInput(input: InputState, dtMs: number) {
    if (this.crashed) return;
    const dt = Math.min(2, dtMs / 16.6667); // normalize to "frames at 60fps", clamp on lag spikes
    const inAir = !this.rearOnGround && !this.frontOnGround;

    // GAS: torque-based drive with slip limit. The previous version directly
    // overrode angular velocity, which made the wheel spin freely no matter what
    // the chassis was doing → endless burnout when the bike couldn't move.
    //
    // Now: target angular velocity = (bike linear speed / wheel radius) + a small
    // slip allowance. Wheel can't spin much faster than the bike's actual rolling
    // speed, so any "extra" power converts into linear acceleration via friction.
    // Both wheels drive (AWD): more grip on hills and in launches; rear is the
    // dominant driver, front contributes less.
    if (input.gas) {
      const slipMargin = 0.18;        // how much faster than rolling speed wheels may spin
      const desiredFromSpeed = this.chassis.velocity.x / this.wheelR;
      const target = Math.max(0.05, desiredFromSpeed + slipMargin);
      const accelStep = 0.05 * dt;    // per-frame approach toward target

      // Rear wheel (primary drive) — only when grounded so airborne revving
      // doesn't pre-load infinite RPMs that burn out on landing.
      if (this.rearOnGround) {
        if (this.rearWheel.angularVelocity < target) {
          Body.setAngularVelocity(
            this.rearWheel,
            Math.min(target, this.rearWheel.angularVelocity + accelStep),
          );
        }
      }
      // Front wheel (assist) — half the throttle authority, only on ground.
      if (this.frontOnGround) {
        const targetF = Math.max(0.05, desiredFromSpeed + slipMargin * 0.6);
        if (this.frontWheel.angularVelocity < targetF) {
          Body.setAngularVelocity(
            this.frontWheel,
            Math.min(targetF, this.frontWheel.angularVelocity + accelStep * 0.55),
          );
        }
      }
    }

    // BRAKE / REVERSE: aggressive damping; slow reverse creep when stopped.
    if (input.brake) {
      const damp = Math.pow(0.86, dt);
      Body.setAngularVelocity(this.rearWheel, this.rearWheel.angularVelocity * damp);
      Body.setAngularVelocity(this.frontWheel, this.frontWheel.angularVelocity * damp);
      // Reverse creep — drive both wheels backward, slip-limited like forward gas.
      if (this.chassis.velocity.x < 0.6 && (this.rearOnGround || this.frontOnGround)) {
        const revTarget = Math.min(-0.05, this.chassis.velocity.x / this.wheelR - 0.18);
        if (this.rearOnGround && this.rearWheel.angularVelocity > revTarget) {
          Body.setAngularVelocity(
            this.rearWheel,
            Math.max(revTarget, this.rearWheel.angularVelocity - 0.04 * dt),
          );
        }
        if (this.frontOnGround && this.frontWheel.angularVelocity > revTarget) {
          Body.setAngularVelocity(
            this.frontWheel,
            Math.max(revTarget, this.frontWheel.angularVelocity - 0.025 * dt),
          );
        }
      }
    }

    // LEAN: directly nudge chassis angular velocity for snappy, GD-like response.
    // In matter.js with y-down, positive ω = clockwise = nose down (front lower).
    const leanStep = inAir ? 0.0090 : 0.0055;
    if (input.leanBack) {
      Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity - leanStep * dt);
    }
    if (input.leanFwd) {
      Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity + leanStep * dt);
    }

    // Cap chassis spin so flips don't go infinite.
    const cap = 0.34;
    if (this.chassis.angularVelocity > cap) Body.setAngularVelocity(this.chassis, cap);
    if (this.chassis.angularVelocity < -cap) Body.setAngularVelocity(this.chassis, -cap);
  }

  get position(): Vec2 {
    return this.chassis.position;
  }

  get velocity(): Vec2 {
    return this.chassis.velocity;
  }

  get angle(): number {
    return this.chassis.angle;
  }

  /** Restart from spawn — re-create the composite for a clean state. */
  destroy() {
    Events.off(this.engine, 'collisionStart', this.onCollisionStart);
    Events.off(this.engine, 'collisionEnd', this.onCollisionEnd);
    Composite.remove(this.engine.world, this.composite);
  }
}
