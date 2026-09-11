/**
 * High-Precision Cosmic N-Body Physics Engine
 * - 4th-Order Runge-Kutta (RK4), Velocity Verlet & Symplectic Euler Integrators
 * - Post-Newtonian General Relativity 1PN Precession Force Correction
 * - Tidal Disruption & Roche Limit Shattering Mechanics
 * - Real-time Energy Drift Tracking & Center of Mass Zero-Momentum Calibration
 */

import { OrbitalMath } from './orbitalMath.js';

export class Body {
  constructor({
    id = Math.random().toString(36).substr(2, 9),
    name = 'Celestial Body',
    type = 'planet', // 'star', 'planet', 'blackhole', 'dust', 'asteroid', 'debris'
    mass = 1.0,
    radius = null,
    position = { x: 0, y: 0, z: 0 },
    velocity = { x: 0, y: 0, z: 0 },
    color = '#00f0ff',
    fixed = false
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.mass = mass;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.acceleration = { x: 0, y: 0, z: 0 };
    this.color = color;
    this.fixed = fixed;

    if (radius !== null) {
      this.radius = radius;
    } else {
      this.updateRadiusFromMass();
    }

    this.trail = [];
    this.maxTrailLength = 120;
  }

  updateRadiusFromMass() {
    if (this.type === 'blackhole') {
      this.radius = Math.max(0.6, Math.pow(this.mass, 0.4) * 0.35);
    } else if (this.type === 'star') {
      this.radius = Math.max(0.8, Math.pow(this.mass, 0.333) * 0.7);
    } else if (this.type === 'dust' || this.type === 'debris') {
      this.radius = 0.15;
    } else {
      this.radius = Math.max(0.2, Math.pow(this.mass, 0.333) * 0.35);
    }
  }

  addTrailPoint() {
    this.trail.push({ x: this.position.x, y: this.position.y, z: this.position.z });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }

  getSpeed() {
    return Math.sqrt(
      this.velocity.x * this.velocity.x +
      this.velocity.y * this.velocity.y +
      this.velocity.z * this.velocity.z
    );
  }

  getKineticEnergy() {
    const speed = this.getSpeed();
    return 0.5 * this.mass * speed * speed;
  }
}

export class PhysicsEngine {
  constructor() {
    this.G = 1.0;
    this.cSpeed = 80.0; // Scaled speed of light for GR Post-Newtonian effects
    this.softening = 0.4;
    this.timeStep = 0.016;
    this.integrator = 'rk4'; // 'rk4', 'verlet', 'euler'
    this.enableGR = true; // General Relativity 1PN Precession
    this.enableTidalDisruption = true; // Roche limit shattering
    this.collisionsEnabled = true;
    this.subSteps = 4;
    this.bodies = [];

    // Energy Drift Analytics
    this.initialEnergy = null;
    this.energyHistory = []; // Array of { time, ke, pe, total, driftPct }
    this.stepCount = 0;

    this.events = {
      onCollision: null,
      onBlackHoleConsume: null,
      onTidalDisruption: null
    };
  }

  addBody(body) {
    this.bodies.push(body);
    this.recalculateInitialEnergy();
    return body;
  }

  removeBody(id) {
    const idx = this.bodies.findIndex(b => b.id === id);
    if (idx !== -1) {
      const removed = this.bodies[idx];
      this.bodies.splice(idx, 1);
      this.recalculateInitialEnergy();
      return removed;
    }
    return null;
  }

  clear() {
    this.bodies = [];
    this.initialEnergy = null;
    this.energyHistory = [];
    this.stepCount = 0;
  }

  recalculateInitialEnergy() {
    const ke = this.getTotalKineticEnergy();
    const pe = this.getTotalPotentialEnergy();
    this.initialEnergy = ke + pe;
  }

  zeroLinearMomentum() {
    let totalMass = 0;
    let px = 0, py = 0, pz = 0;

    for (const b of this.bodies) {
      totalMass += b.mass;
      px += b.mass * b.velocity.x;
      py += b.mass * b.velocity.y;
      pz += b.mass * b.velocity.z;
    }

    if (totalMass > 0) {
      const vCMx = px / totalMass;
      const vCMy = py / totalMass;
      const vCMz = pz / totalMass;

      for (const b of this.bodies) {
        if (!b.fixed) {
          b.velocity.x -= vCMx;
          b.velocity.y -= vCMy;
          b.velocity.z -= vCMz;
        }
      }
    }
  }

  update(dtMultiplier = 1.0) {
    const dt = (this.timeStep * dtMultiplier) / this.subSteps;

    for (let step = 0; step < this.subSteps; step++) {
      if (this.integrator === 'rk4') {
        this.stepRK4(dt);
      } else if (this.integrator === 'verlet') {
        this.stepVerlet(dt);
      } else {
        this.stepEuler(dt);
      }

      if (this.enableTidalDisruption) {
        this.checkTidalDisruption();
      }

      if (this.collisionsEnabled) {
        this.handleCollisions();
      }
    }

    // Record trail positions once per full frame
    for (let i = 0; i < this.bodies.length; i++) {
      this.bodies[i].addTrailPoint();
    }

    // Log Energy Drift Analytics
    this.stepCount++;
    if (this.stepCount % 5 === 0) {
      this.logEnergyDrift();
    }
  }

  /**
   * Computes accelerations for a given state array [pos, vel]
   */
  computeAccelerations(positions, velocities) {
    const n = this.bodies.length;
    const accs = new Array(n);
    for (let i = 0; i < n; i++) accs[i] = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < n; i++) {
      const b1 = this.bodies[i];
      const p1 = positions[i];
      const v1 = velocities[i];

      for (let j = i + 1; j < n; j++) {
        const b2 = this.bodies[j];
        const p2 = positions[j];
        const v2 = velocities[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;

        const distSq = dx * dx + dy * dy + dz * dz + this.softening * this.softening;
        const dist = Math.sqrt(distSq);

        // Newtonian Gravity: F = G * m1 * m2 / distSq
        let fMagOverR = (this.G * b1.mass * b2.mass) / (distSq * dist);

        // Post-Newtonian GR 1PN Correction for massive stars / black holes
        if (this.enableGR && (b1.type === 'blackhole' || b1.type === 'star' || b2.type === 'blackhole' || b2.type === 'star')) {
          // Relativistic Perihelion Precession correction: f_GR = f_Newton * (1 + 3 * h^2 / (c^2 * r^2))
          const rVec = { x: dx, y: dy, z: dz };
          const vRel = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
          const hSq = Math.pow(rVec.y * vRel.z - rVec.z * vRel.y, 2) +
                      Math.pow(rVec.z * vRel.x - rVec.x * vRel.z, 2) +
                      Math.pow(rVec.x * vRel.y - rVec.y * vRel.x, 2);

          const grFactor = 1.0 + (3.0 * hSq) / (this.cSpeed * this.cSpeed * distSq);
          fMagOverR *= grFactor;
        }

        const fx = fMagOverR * dx;
        const fy = fMagOverR * dy;
        const fz = fMagOverR * dz;

        if (!b1.fixed) {
          accs[i].x += fx / b1.mass;
          accs[i].y += fy / b1.mass;
          accs[i].z += fz / b1.mass;
        }

        if (!b2.fixed) {
          accs[j].x -= fx / b2.mass;
          accs[j].y -= fy / b2.mass;
          accs[j].z -= fz / b2.mass;
        }
      }
    }

    return accs;
  }

  /**
   * 4th-Order Runge-Kutta (RK4) High-Precision Numerical Integrator
   */
  stepRK4(dt) {
    const n = this.bodies.length;
    if (n === 0) return;

    // Current State Y0 = (P0, V0)
    const P0 = this.bodies.map(b => ({ ...b.position }));
    const V0 = this.bodies.map(b => ({ ...b.velocity }));

    // k1 = f(Y0)
    const A1 = this.computeAccelerations(P0, V0);

    // k2 = f(Y0 + 0.5 * dt * k1)
    const P1 = P0.map((p, i) => ({
      x: p.x + 0.5 * dt * V0[i].x,
      y: p.y + 0.5 * dt * V0[i].y,
      z: p.z + 0.5 * dt * V0[i].z
    }));
    const V1 = V0.map((v, i) => ({
      x: v.x + 0.5 * dt * A1[i].x,
      y: v.y + 0.5 * dt * A1[i].y,
      z: v.z + 0.5 * dt * A1[i].z
    }));
    const A2 = this.computeAccelerations(P1, V1);

    // k3 = f(Y0 + 0.5 * dt * k2)
    const P2 = P0.map((p, i) => ({
      x: p.x + 0.5 * dt * V1[i].x,
      y: p.y + 0.5 * dt * V1[i].y,
      z: p.z + 0.5 * dt * V1[i].z
    }));
    const V2 = V0.map((v, i) => ({
      x: v.x + 0.5 * dt * A2[i].x,
      y: v.y + 0.5 * dt * A2[i].y,
      z: v.z + 0.5 * dt * A2[i].z
    }));
    const A3 = this.computeAccelerations(P2, V2);

    // k4 = f(Y0 + dt * k3)
    const P3 = P0.map((p, i) => ({
      x: p.x + dt * V2[i].x,
      y: p.y + dt * V2[i].y,
      z: p.z + dt * V2[i].z
    }));
    const V3 = V0.map((v, i) => ({
      x: v.x + dt * A3[i].x,
      y: v.y + dt * A3[i].y,
      z: v.z + dt * A3[i].z
    }));
    const A4 = this.computeAccelerations(P3, V3);

    // Final RK4 Update: Y_next = Y0 + (dt / 6) * (k1 + 2*k2 + 2*k3 + k4)
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;

      b.position.x += (dt / 6.0) * (V0[i].x + 2 * V1[i].x + 2 * V2[i].x + V3[i].x);
      b.position.y += (dt / 6.0) * (V0[i].y + 2 * V1[i].y + 2 * V2[i].y + V3[i].y);
      b.position.z += (dt / 6.0) * (V0[i].z + 2 * V1[i].z + 2 * V2[i].z + V3[i].z);

      b.velocity.x += (dt / 6.0) * (A1[i].x + 2 * A2[i].x + 2 * A3[i].x + A4[i].x);
      b.velocity.y += (dt / 6.0) * (A1[i].y + 2 * A2[i].y + 2 * A3[i].y + A4[i].y);
      b.velocity.z += (dt / 6.0) * (A1[i].z + 2 * A2[i].z + 2 * A3[i].z + A4[i].z);
    }
  }

  /**
   * Velocity Verlet Integrator
   */
  stepVerlet(dt) {
    const P = this.bodies.map(b => ({ ...b.position }));
    const V = this.bodies.map(b => ({ ...b.velocity }));
    const A = this.computeAccelerations(P, V);

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;

      b.velocity.x += A[i].x * dt;
      b.velocity.y += A[i].y * dt;
      b.velocity.z += A[i].z * dt;

      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      b.position.z += b.velocity.z * dt;
    }
  }

  /**
   * Symplectic Euler Integrator
   */
  stepEuler(dt) {
    const P = this.bodies.map(b => ({ ...b.position }));
    const V = this.bodies.map(b => ({ ...b.velocity }));
    const A = this.computeAccelerations(P, V);

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;

      b.velocity.x += A[i].x * dt;
      b.velocity.y += A[i].y * dt;
      b.velocity.z += A[i].z * dt;

      b.position.x += b.velocity.x * dt;
      b.position.y += b.velocity.y * dt;
      b.position.z += b.velocity.z * dt;
    }
  }

  /**
   * Roche Limit Tidal Disruption Check
   */
  checkTidalDisruption() {
    const newDebris = [];
    const toRemove = new Set();

    for (let i = 0; i < this.bodies.length; i++) {
      const b1 = this.bodies[i];
      if (toRemove.has(b1.id)) continue;

      for (let j = i + 1; j < this.bodies.length; j++) {
        const b2 = this.bodies[j];
        if (toRemove.has(b2.id)) continue;

        let primary = b1, secondary = b2;
        if (b2.mass > b1.mass) {
          primary = b2; secondary = b1;
        }

        // Only shatter smaller stars/planets/asteroids when crossing massive object's Roche limit
        if (primary.mass < secondary.mass * 8.0 || secondary.type === 'blackhole' || secondary.type === 'debris') continue;

        const rocheLimit = OrbitalMath.calculateRocheLimit(primary.mass, primary.radius, secondary.mass);

        const dx = secondary.position.x - primary.position.x;
        const dy = secondary.position.y - primary.position.y;
        const dz = secondary.position.z - primary.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < rocheLimit && dist > (primary.radius + secondary.radius) * 0.8) {
          // Shatter secondary body into 14 debris particles spreading out in tidal stream
          toRemove.add(secondary.id);
          const debrisCount = 14;
          const pieceMass = secondary.mass / debrisCount;

          for (let d = 0; d < debrisCount; d++) {
            const spread = (Math.random() - 0.5) * secondary.radius * 2.0;
            const vSpread = (Math.random() - 0.5) * 0.8;

            newDebris.push(new Body({
              name: `Tidal Debris ${secondary.name}`,
              type: 'debris',
              mass: pieceMass,
              position: {
                x: secondary.position.x + (Math.random() - 0.5) * secondary.radius,
                y: secondary.position.y + (Math.random() - 0.5) * secondary.radius,
                z: secondary.position.z + (Math.random() - 0.5) * secondary.radius
              },
              velocity: {
                x: secondary.velocity.x + vSpread,
                y: secondary.velocity.y + vSpread,
                z: secondary.velocity.z + vSpread
              },
              color: secondary.color
            }));
          }

          if (this.events.onTidalDisruption) {
            this.events.onTidalDisruption(primary, secondary);
          }
        }
      }
    }

    if (toRemove.size > 0) {
      this.bodies = this.bodies.filter(b => !toRemove.has(b.id));
      this.bodies.push(...newDebris);
    }
  }

  /**
   * Collision Merging Mechanics
   */
  handleCollisions() {
    const toRemove = new Set();

    for (let i = 0; i < this.bodies.length; i++) {
      const b1 = this.bodies[i];
      if (toRemove.has(b1.id)) continue;

      for (let j = i + 1; j < this.bodies.length; j++) {
        const b2 = this.bodies[j];
        if (toRemove.has(b2.id)) continue;

        const dx = b2.position.x - b1.position.x;
        const dy = b2.position.y - b1.position.y;
        const dz = b2.position.z - b1.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < (b1.radius + b2.radius) * 0.85) {
          let survivor = b1;
          let victim = b2;

          if (b2.type === 'blackhole' && b1.type !== 'blackhole') {
            survivor = b2; victim = b1;
          } else if (b2.mass > b1.mass && b1.type !== 'blackhole') {
            survivor = b2; victim = b1;
          }

          const totalMass = survivor.mass + victim.mass;
          survivor.velocity.x = (survivor.mass * survivor.velocity.x + victim.mass * victim.velocity.x) / totalMass;
          survivor.velocity.y = (survivor.mass * survivor.velocity.y + victim.mass * victim.velocity.y) / totalMass;
          survivor.velocity.z = (survivor.mass * survivor.velocity.z + victim.mass * victim.velocity.z) / totalMass;

          if (!survivor.fixed) {
            survivor.position.x = (survivor.mass * survivor.position.x + victim.mass * victim.position.x) / totalMass;
            survivor.position.y = (survivor.mass * survivor.position.y + victim.mass * victim.position.y) / totalMass;
            survivor.position.z = (survivor.mass * survivor.position.z + victim.mass * victim.position.z) / totalMass;
          }

          survivor.mass = totalMass;
          survivor.updateRadiusFromMass();

          toRemove.add(victim.id);

          if (survivor.type === 'blackhole' && this.events.onBlackHoleConsume) {
            this.events.onBlackHoleConsume(survivor, victim);
          } else if (this.events.onCollision) {
            this.events.onCollision(survivor, victim);
          }
        }
      }
    }

    if (toRemove.size > 0) {
      this.bodies = this.bodies.filter(b => !toRemove.has(b.id));
    }
  }

  getTotalKineticEnergy() {
    return this.bodies.reduce((sum, b) => sum + b.getKineticEnergy(), 0);
  }

  getTotalPotentialEnergy() {
    let u = 0;
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const b1 = this.bodies[i];
        const b2 = this.bodies[j];
        const dx = b2.position.x - b1.position.x;
        const dy = b2.position.y - b1.position.y;
        const dz = b2.position.z - b1.position.z;
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz + this.softening * this.softening);
        u -= (this.G * b1.mass * b2.mass) / r;
      }
    }
    return u;
  }

  logEnergyDrift() {
    const ke = this.getTotalKineticEnergy();
    const pe = this.getTotalPotentialEnergy();
    const total = ke + pe;

    if (this.initialEnergy === null || Math.abs(this.initialEnergy) < 1e-5) {
      this.initialEnergy = total;
    }

    const driftPct = this.initialEnergy !== 0 ? Math.abs((total - this.initialEnergy) / this.initialEnergy) * 100 : 0;

    this.energyHistory.push({
      step: this.stepCount,
      ke: ke,
      pe: pe,
      total: total,
      driftPct: driftPct
    });

    if (this.energyHistory.length > 100) {
      this.energyHistory.shift();
    }
  }
}
