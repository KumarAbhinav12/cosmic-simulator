/**
 * Advanced Astronomical Scenarios
 * High-precision astronomical systems (Relativistic Precession, Lagrange Points & Trojans,
 * Tidal Disruption TDE, Circumbinary Binary Systems, Solar System, Colliding Galaxies).
 */

import { Body } from './physics.js';

export const Scenarios = {
  solarSystem: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;
    physicsEngine.softening = 0.3;

    // Sun
    const sun = new Body({
      name: 'Sun',
      type: 'star',
      mass: 800.0,
      radius: 4.5,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: '#ffaa00',
      fixed: false
    });
    physicsEngine.addBody(sun);

    const planets = [
      { name: 'Mercury', mass: 0.1, dist: 12, color: '#a6a6a6', radius: 0.4 },
      { name: 'Venus', mass: 0.8, dist: 18, color: '#e3bb76', radius: 0.7 },
      { name: 'Earth', mass: 1.0, dist: 26, color: '#00f0ff', radius: 0.8 },
      { name: 'Mars', mass: 0.4, dist: 35, color: '#ff4d4d', radius: 0.6 },
      { name: 'Jupiter', mass: 18.0, dist: 52, color: '#ffb703', radius: 2.2 },
      { name: 'Saturn', mass: 12.0, dist: 75, color: '#e0a96d', radius: 1.8 },
      { name: 'Uranus', mass: 5.0, dist: 98, color: '#72efdd', radius: 1.3 },
      { name: 'Neptune', mass: 4.8, dist: 120, color: '#4895ef', radius: 1.3 }
    ];

    planets.forEach(p => {
      const v = Math.sqrt((physicsEngine.G * sun.mass) / p.dist);
      const angle = Math.random() * Math.PI * 2;

      const planet = new Body({
        name: p.name,
        type: 'planet',
        mass: p.mass,
        radius: p.radius,
        position: { x: Math.cos(angle) * p.dist, y: (Math.random() - 0.5) * 1.5, z: Math.sin(angle) * p.dist },
        velocity: { x: -Math.sin(angle) * v, y: 0, z: Math.cos(angle) * v },
        color: p.color
      });
      physicsEngine.addBody(planet);

      if (p.name === 'Earth') {
        const moonDist = 2.2;
        const vMoon = v + Math.sqrt((physicsEngine.G * planet.mass) / moonDist);
        physicsEngine.addBody(new Body({
          name: 'Moon',
          type: 'asteroid',
          mass: 0.05,
          radius: 0.25,
          position: { x: planet.position.x + moonDist, y: planet.position.y, z: planet.position.z },
          velocity: { x: planet.velocity.x, y: planet.velocity.y, z: planet.velocity.z + (vMoon - v) },
          color: '#d6d6d6'
        }));
      }
    });

    for (let i = 0; i < 70; i++) {
      const dist = 40 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const v = Math.sqrt((physicsEngine.G * sun.mass) / dist);

      physicsEngine.addBody(new Body({
        name: `Asteroid ${i+1}`,
        type: 'asteroid',
        mass: 0.01,
        radius: 0.15,
        position: { x: Math.cos(angle) * dist, y: (Math.random() - 0.5) * 2.0, z: Math.sin(angle) * dist },
        velocity: { x: -Math.sin(angle) * v + (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.1, z: Math.cos(angle) * v + (Math.random() - 0.5) * 0.2 },
        color: '#8899a6'
      }));
    }

    physicsEngine.zeroLinearMomentum();
  },

  relativisticPrecession: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;
    physicsEngine.enableGR = true;
    physicsEngine.cSpeed = 50.0; // Enhanced speed of light parameter to highlight GR precession

    // Heavy Central Star
    const sun = new Body({
      name: 'Relativistic Sun',
      type: 'star',
      mass: 1500.0,
      radius: 4.0,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: '#ffb703',
      fixed: true
    });
    physicsEngine.addBody(sun);

    // Highly Eccentric Orbiting Mercury
    const periapsis = 10.0;
    const ecc = 0.55;
    const a = periapsis / (1 - ecc); // Semi-major axis = 22.22
    const vPeriapsis = Math.sqrt(physicsEngine.G * sun.mass * ((2 / periapsis) - (1 / a)));

    const mercury = new Body({
      name: 'Precessing Mercury',
      type: 'planet',
      mass: 0.1,
      radius: 0.5,
      position: { x: periapsis, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: vPeriapsis },
      color: '#00f0ff'
    });
    physicsEngine.addBody(mercury);
  },

  lagrangeTrojans: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;
    physicsEngine.softening = 0.2;

    // Sun Primary
    const sun = new Body({
      name: 'Sun',
      type: 'star',
      mass: 1000.0,
      radius: 4.5,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: '#ffb703'
    });
    physicsEngine.addBody(sun);

    // Jupiter Secondary
    const R = 45.0;
    const vJup = Math.sqrt((physicsEngine.G * sun.mass) / R);
    const jupiter = new Body({
      name: 'Jupiter',
      type: 'planet',
      mass: 40.0,
      radius: 2.2,
      position: { x: R, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: vJup },
      color: '#e0a96d'
    });
    physicsEngine.addBody(jupiter);

    // Trojan Asteroids trapped in L4 (60 degrees leading)
    for (let i = 0; i < 25; i++) {
      const angle = (Math.PI / 3) + (Math.random() - 0.5) * 0.15; // 60 deg +- wobble
      const rDist = R + (Math.random() - 0.5) * 3.5;
      const v = Math.sqrt((physicsEngine.G * sun.mass) / rDist);

      physicsEngine.addBody(new Body({
        name: `Trojan (L4) ${i+1}`,
        type: 'asteroid',
        mass: 0.01,
        position: { x: Math.cos(angle) * rDist, y: (Math.random() - 0.5) * 1.0, z: Math.sin(angle) * rDist },
        velocity: { x: -Math.sin(angle) * v, y: 0, z: Math.cos(angle) * v },
        color: '#00f0ff'
      }));
    }

    // Greek Asteroids trapped in L5 (60 degrees trailing)
    for (let i = 0; i < 25; i++) {
      const angle = -(Math.PI / 3) + (Math.random() - 0.5) * 0.15; // -60 deg +- wobble
      const rDist = R + (Math.random() - 0.5) * 3.5;
      const v = Math.sqrt((physicsEngine.G * sun.mass) / rDist);

      physicsEngine.addBody(new Body({
        name: `Greek (L5) ${i+1}`,
        type: 'asteroid',
        mass: 0.01,
        position: { x: Math.cos(angle) * rDist, y: (Math.random() - 0.5) * 1.0, z: Math.sin(angle) * rDist },
        velocity: { x: -Math.sin(angle) * v, y: 0, z: Math.cos(angle) * v },
        color: '#ff0055'
      }));
    }

    physicsEngine.zeroLinearMomentum();
  },

  tidalDisruption: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;
    physicsEngine.enableTidalDisruption = true;

    // Supermassive Black Hole
    const superBH = new Body({
      name: 'Supermassive BH',
      type: 'blackhole',
      mass: 2500.0,
      radius: 3.5,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      color: '#9d4edd',
      fixed: true
    });
    physicsEngine.addBody(superBH);

    // Victim Star heading directly on hyperbolic encounter crossing Roche limit
    const victimStar = new Body({
      name: 'Victim Star',
      type: 'star',
      mass: 2.5,
      radius: 1.2,
      position: { x: -75.0, y: 0, z: 8.0 },
      velocity: { x: 4.8, y: 0, z: -0.4 },
      color: '#ffaa00'
    });
    physicsEngine.addBody(victimStar);
  },

  circumbinary: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;

    // Binary Star A
    const starA = new Body({
      name: 'Alpha Star',
      type: 'star',
      mass: 500.0,
      radius: 3.0,
      position: { x: -6.0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: -3.5 },
      color: '#ffb703'
    });
    physicsEngine.addBody(starA);

    // Binary Star B
    const starB = new Body({
      name: 'Beta Star',
      type: 'star',
      mass: 400.0,
      radius: 2.6,
      position: { x: 7.5, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 4.375 },
      color: '#00f0ff'
    });
    physicsEngine.addBody(starB);

    // Circumbinary Planet (Tatooine) orbiting both stars at wide radius
    const totalMass = starA.mass + starB.mass;
    const rPlan = 40.0;
    const vPlan = Math.sqrt((physicsEngine.G * totalMass) / rPlan);

    const tatooine = new Body({
      name: 'Tatooine',
      type: 'planet',
      mass: 1.2,
      radius: 0.9,
      position: { x: 0, y: 0, z: rPlan },
      velocity: { x: vPlan, y: 0, z: 0 },
      color: '#e3bb76'
    });
    physicsEngine.addBody(tatooine);

    physicsEngine.zeroLinearMomentum();
  },

  galaxyCollision: (physicsEngine) => {
    physicsEngine.clear();
    physicsEngine.G = 1.0;
    physicsEngine.softening = 0.5;

    const createSpiralGalaxy = (centerPos, centerVel, bhMass, starCount, radius, colorHex, inclinationAngle) => {
      const bh = new Body({
        name: 'Supermassive BH',
        type: 'blackhole',
        mass: bhMass,
        position: { ...centerPos },
        velocity: { ...centerVel },
        color: '#9d4edd'
      });
      physicsEngine.addBody(bh);

      for (let i = 0; i < starCount; i++) {
        const r = 4 + Math.pow(Math.random(), 0.8) * radius;
        const theta = Math.random() * Math.PI * 2;
        const vOrb = Math.sqrt((physicsEngine.G * bhMass) / r);

        let px = Math.cos(theta) * r;
        let py = (Math.random() - 0.5) * 1.2;
        let pz = Math.sin(theta) * r;

        let vx = -Math.sin(theta) * vOrb;
        let vy = 0;
        let vz = Math.cos(theta) * vOrb;

        if (inclinationAngle !== 0) {
          const cosA = Math.cos(inclinationAngle);
          const sinA = Math.sin(inclinationAngle);

          const pyNew = py * cosA - pz * sinA;
          const pzNew = py * sinA + pz * cosA;
          py = pyNew; pz = pzNew;

          const vyNew = vy * cosA - vz * sinA;
          const vzNew = vy * sinA + vz * cosA;
          vy = vyNew; vz = vzNew;
        }

        physicsEngine.addBody(new Body({
          name: `Star ${i+1}`,
          type: 'star',
          mass: 0.2 + Math.random() * 0.5,
          position: { x: centerPos.x + px, y: centerPos.y + py, z: centerPos.z + pz },
          velocity: { x: centerVel.x + vx, y: centerVel.y + vy, z: centerVel.z + vz },
          color: colorHex
        }));
      }
    };

    createSpiralGalaxy({ x: -45, y: 10, z: 0 }, { x: 1.8, y: -0.5, z: 0 }, 1200, 140, 55, '#00f0ff', 0.2);
    createSpiralGalaxy({ x: 45, y: -10, z: 15 }, { x: -1.8, y: 0.5, z: -0.3 }, 900, 140, 45, '#ffb703', -0.6);
  }
};
