/**
 * Advanced Orbital Mathematics & Celestial Mechanics Suite
 * - Keplerian Osculating Orbital Elements (a, e, i, Omega, omega, T)
 * - Exact Elliptical Conic Section Orbit Mesh Generator
 * - Circular Restricted Three-Body Problem (CR3BP) Lagrange Points Solver (L1 - L5)
 * - Fluid & Rigid Roche Limit Calculations
 */

export class OrbitalMath {

  /**
   * Calculates Keplerian Orbital Elements from 3D Position and Velocity relative to a primary mass.
   * @param {Object} body - Target orbiting body {position, velocity, mass}
   * @param {Object} primary - Primary attractor body {position, velocity, mass}
   * @param {number} G - Gravitational Constant
   */
  static calculateKeplerianElements(body, primary, G) {
    const mu = G * (primary.mass + body.mass);

    // Relative position and velocity vectors
    const rx = body.position.x - primary.position.x;
    const ry = body.position.y - primary.position.y;
    const rz = body.position.z - primary.position.z;

    const vx = body.velocity.x - primary.velocity.x;
    const vy = body.velocity.y - primary.velocity.y;
    const vz = body.velocity.z - primary.velocity.z;

    const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const vSq = vx * vx + vy * vy + vz * vz;

    // Specific Angular Momentum vector h = r x v
    const hx = ry * vz - rz * vy;
    const hy = rz * vx - rx * vz;
    const hz = rx * vy - ry * vx;
    const h = Math.sqrt(hx * hx + hy * hy + hz * hz);

    if (h < 1e-6) {
      return { semiMajorAxis: r, eccentricity: 0, inclination: 0, period: 0, isBound: false };
    }

    // Specific Orbital Energy epsilon = v^2 / 2 - mu / r
    const energy = (vSq / 2) - (mu / r);

    // Semi-major axis a = -mu / (2 * energy)
    let a = 0;
    let isBound = true;
    if (Math.abs(energy) > 1e-6) {
      a = -mu / (2 * energy);
      if (a < 0) isBound = false; // Hyperbolic or Parabolic orbit
    } else {
      a = r;
      isBound = false;
    }

    // Eccentricity vector e = ((v^2 - mu/r)r - (r.v)v) / mu
    const rDotV = rx * vx + ry * vy + rz * vz;
    const ex = ((vSq - mu / r) * rx - rDotV * vx) / mu;
    const ey = ((vSq - mu / r) * ry - rDotV * vy) / mu;
    const ez = ((vSq - mu / r) * rz - rDotV * vz) / mu;
    const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

    // Inclination i = acos(hz / h)
    const inc = Math.acos(Math.min(1.0, Math.max(-1.0, hz / h))) * (180 / Math.PI);

    // Orbital Period T = 2 * pi * sqrt(a^3 / mu)
    let T = 0;
    if (isBound && a > 0) {
      T = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
    }

    // Periapsis distance rp = a * (1 - e)
    const periapsis = a > 0 ? a * (1 - e) : r;
    const apoapsis = a > 0 ? a * (1 + e) : r;

    return {
      semiMajorAxis: a,
      eccentricity: e,
      inclination: inc,
      period: T,
      periapsis: periapsis,
      apoapsis: apoapsis,
      isBound: isBound,
      energy: energy,
      angularMomentum: h,
      eccentricityVector: { x: ex, y: ey, z: ez }
    };
  }

  /**
   * Generates 3D coordinates for rendering the exact predicted Keplerian elliptical orbit overlay.
   */
  static generateOrbitEllipsePoints(body, primary, G, numPoints = 120) {
    const elem = this.calculateKeplerianElements(body, primary, G);
    if (!elem.isBound || elem.semiMajorAxis <= 0 || elem.eccentricity >= 1.0) {
      return [];
    }

    const a = elem.semiMajorAxis;
    const e = elem.eccentricity;
    const b = a * Math.sqrt(1 - e * e); // Semi-minor axis

    // Relative position
    const rx = body.position.x - primary.position.x;
    const ry = body.position.y - primary.position.y;
    const rz = body.position.z - primary.position.z;

    // Eccentricity unit vector
    const ex = elem.eccentricityVector.x;
    const ey = elem.eccentricityVector.y;
    const ez = elem.eccentricityVector.z;
    const eLen = Math.sqrt(ex * ex + ey * ey + ez * ez);

    let uX = 1, uY = 0, uZ = 0;
    if (eLen > 1e-4) {
      uX = ex / eLen;
      uY = ey / eLen;
      uZ = ez / eLen;
    } else {
      const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rLen > 0) {
        uX = rx / rLen; uY = ry / rLen; uZ = rz / rLen;
      }
    }

    // Specific Angular Momentum unit vector (normal to orbit plane)
    const vx = body.velocity.x - primary.velocity.x;
    const vy = body.velocity.y - primary.velocity.y;
    const vz = body.velocity.z - primary.velocity.z;

    const hx = ry * vz - rz * vy;
    const hy = rz * vx - rx * vz;
    const hz = rx * vy - ry * vx;
    const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);

    let nX = 0, nY = 1, nZ = 0;
    if (hLen > 1e-4) {
      nX = hx / hLen; nY = hy / hLen; nZ = hz / hLen;
    }

    // Semi-minor axis vector vVector = nVector x uVector
    const vX = nY * uZ - nZ * uY;
    const vY = nZ * uX - nX * uZ;
    const vZ = nX * uY - nY * uX;

    // Focus offset distance c = a * e (Primary attractor sits at focus)
    const c = a * e;

    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * Math.PI * 2;
      const xLocal = a * Math.cos(theta) - c;
      const yLocal = b * Math.sin(theta);

      const px = primary.position.x + (xLocal * uX + yLocal * vX);
      const py = primary.position.y + (xLocal * uY + yLocal * vY);
      const pz = primary.position.z + (xLocal * uZ + yLocal * vZ);

      points.push({ x: px, y: py, z: pz });
    }

    return points;
  }

  /**
   * Calculates 3D positions of the 5 Lagrange Points (L1, L2, L3, L4, L5) for a binary pair.
   * @param {Object} primary - Primary body (e.g., Sun)
   * @param {Object} secondary - Secondary body (e.g., Earth or Jupiter)
   */
  static calculateLagrangePoints(primary, secondary) {
    const M1 = primary.mass;
    const M2 = secondary.mass;
    if (M1 < M2) return null; // Ensure primary is larger

    const dx = secondary.position.x - primary.position.x;
    const dy = secondary.position.y - primary.position.y;
    const dz = secondary.position.z - primary.position.z;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (R < 1e-4) return null;

    // Unit direction vector from Primary to Secondary
    const uX = dx / R;
    const uY = dy / R;
    const uZ = dz / R;

    // Perpendicular plane vector (assume Y-up plane or compute from velocity)
    let pX = -uZ;
    let pY = 0;
    let pZ = uX;
    const pLen = Math.sqrt(pX * pX + pZ * pZ);
    if (pLen < 1e-4) {
      pX = 0; pY = 1; pZ = 0;
    } else {
      pX /= pLen; pZ /= pLen;
    }

    const mu = M2 / (M1 + M2); // Mass ratio
    const alpha = Math.cbrt(mu / 3.0); // Approximation for Hill radius ratio

    // L1: Between Primary and Secondary (inside secondary's orbit)
    const rL1 = R * (1 - alpha);
    const L1 = {
      name: 'L1',
      x: primary.position.x + uX * rL1,
      y: primary.position.y + uY * rL1,
      z: primary.position.z + uZ * rL1
    };

    // L2: Beyond Secondary
    const rL2 = R * (1 + alpha);
    const L2 = {
      name: 'L2',
      x: primary.position.x + uX * rL2,
      y: primary.position.y + uY * rL2,
      z: primary.position.z + uZ * rL2
    };

    // L3: Opposite side of Primary
    const rL3 = R * (1 + (5 / 12) * mu);
    const L3 = {
      name: 'L3',
      x: primary.position.x - uX * rL3,
      y: primary.position.y - uY * rL3,
      z: primary.position.z - uZ * rL3
    };

    // L4: 60 degrees leading in orbit plane (Equilateral Triangle)
    const cos60 = 0.5;
    const sin60 = 0.8660254;
    const L4 = {
      name: 'L4',
      x: primary.position.x + (uX * cos60 + pX * sin60) * R,
      y: primary.position.y + (uY * cos60 + pY * sin60) * R,
      z: primary.position.z + (uZ * cos60 + pZ * sin60) * R
    };

    // L5: 60 degrees trailing in orbit plane
    const L5 = {
      name: 'L5',
      x: primary.position.x + (uX * cos60 - pX * sin60) * R,
      y: primary.position.y + (uY * cos60 - pY * sin60) * R,
      z: primary.position.z + (uZ * cos60 - pZ * sin60) * R
    };

    return { L1, L2, L3, L4, L5 };
  }

  /**
   * Fluid Roche Limit distance d_R = 2.44 * R1 * (M1 / M2)^(1/3)
   */
  static calculateRocheLimit(primaryMass, primaryRadius, secondaryMass) {
    if (secondaryMass <= 0) return 0;
    return 2.44 * primaryRadius * Math.cbrt(primaryMass / secondaryMass);
  }
}
