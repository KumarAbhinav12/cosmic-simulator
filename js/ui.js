/**
 * UI Controller & Sound Engine (Upgraded with 3D Move Gizmos & 3D Ruler Measurement Tape)
 */

import * as THREE from 'three';
import { Body } from './physics.js';
import { Scenarios } from './scenarios.js';
import { OrbitalMath } from './orbitalMath.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.droneGain = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.droneGain.gain.setValueAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime);

    osc1.connect(this.droneGain);
    osc2.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
  }

  toggleMute() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.muted = !this.muted;
    if (this.droneGain) {
      this.droneGain.gain.setValueAtTime(this.muted ? 0 : 0.04, this.ctx.currentTime);
    }
    return this.muted;
  }

  playCollisionSound(massRatio = 1.0) {
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = Math.max(60, 300 - Math.min(massRatio * 40, 240));
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.36);
  }

  playTidalDisruptionSound() {
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.51);
  }

  playBlackHoleSound() {
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.61);
  }
}

export class UIController {
  constructor(physicsEngine, renderer) {
    this.physics = physicsEngine;
    this.renderer = renderer;
    this.sound = new SoundEngine();

    this.paused = false;
    this.timeScale = 1.0;
    this.showTrails = true;
    this.spawnMode = false;

    // Tool Modes: 'inspect', 'move', 'ruler'
    this.activeTool = 'inspect';

    this.selectedBodyId = null;
    this.rulerBodyAId = null;
    this.rulerBodyBId = null;
    this.lastPopulatedBodyCount = -1;

    this.spawnType = 'planet';
    this.spawnMass = 1.0;
    this.dragStart = null;
    this.dragCurrent = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.bindDOM();
    this.bindPointerEvents();

    this.physics.events.onCollision = (survivor, victim) => {
      this.sound.playCollisionSound(victim.mass);
      if (this.renderer.triggerExplosion) {
        this.renderer.triggerExplosion(survivor.position, 0x00f0ff);
      }
    };
    this.physics.events.onBlackHoleConsume = (survivor, victim) => {
      this.sound.playBlackHoleSound();
      if (this.renderer.triggerExplosion) {
        this.renderer.triggerExplosion(survivor.position, 0x9d4edd);
      }
    };
    this.physics.events.onTidalDisruption = (primary, secondary) => {
      this.sound.playTidalDisruptionSound();
      if (this.renderer.triggerExplosion) {
        this.renderer.triggerExplosion(secondary.position, 0xff0055);
      }
    };
  }

  bindDOM() {
    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (Scenarios[val]) {
          Scenarios[val](this.physics);
          this.selectedBodyId = null;
          this.rulerBodyAId = null;
          this.rulerBodyBId = null;
          this.renderer.trackedBodyId = null;
          this.renderer.detachGizmo();
          this.lastPopulatedBodyCount = -1;
          this.onSelectionChanged();
        }
      });
    }

    // 3D Tool Mode Switchers
    const btnSelect = document.getElementById('tool-select-btn');
    const btnMove = document.getElementById('tool-move-btn');
    const btnRuler = document.getElementById('tool-ruler-btn');
    const toolDesc = document.getElementById('tool-desc');
    const rulerCard = document.getElementById('ruler-card');

    const setToolMode = (mode) => {
      this.activeTool = mode;
      btnSelect.classList.toggle('active', mode === 'inspect');
      btnMove.classList.toggle('active', mode === 'move');
      btnRuler.classList.toggle('active', mode === 'ruler');

      if (rulerCard) rulerCard.style.display = mode === 'ruler' ? 'block' : 'none';

      if (mode === 'inspect') {
        if (toolDesc) toolDesc.textContent = 'Click objects in 3D to inspect Keplerian orbital elements.';
        this.renderer.detachGizmo();
      } else if (mode === 'move') {
        if (toolDesc) toolDesc.textContent = 'Select an object to display 3D translation arrow handles and drag it in 3D space.';
        if (this.selectedBodyId) this.renderer.attachGizmo(this.selectedBodyId);
      } else if (mode === 'ruler') {
        if (toolDesc) toolDesc.textContent = 'Click two objects in 3D space to measure distance, relative velocity, and gravitational force.';
        this.renderer.detachGizmo();
      }
    };

    if (btnSelect) btnSelect.addEventListener('click', () => setToolMode('inspect'));
    if (btnMove) btnMove.addEventListener('click', () => setToolMode('move'));
    if (btnRuler) btnRuler.addEventListener('click', () => setToolMode('ruler'));

    // Inspector Target Body Select Dropdown
    const bodyInspectorSelect = document.getElementById('body-inspector-select');
    const nameInput = document.getElementById('inspector-name-input');
    if (bodyInspectorSelect) {
      bodyInspectorSelect.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        this.selectedBodyId = selectedId || null;
        this.onSelectionChanged();
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        if (this.selectedBodyId) {
          const b = this.physics.bodies.find(body => body.id === this.selectedBodyId);
          if (b) {
            b.name = e.target.value.trim() || 'Unnamed Object';
            if (bodyInspectorSelect) {
              const opt = bodyInspectorSelect.querySelector(`option[value="${b.id}"]`);
              if (opt) {
                opt.textContent = `${b.name} (${b.type.toUpperCase()})`;
              }
            }
          }
        }
      });
    }

    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
      gridToggle.addEventListener('change', (e) => {
        this.renderer.showSpacetimeGrid = e.target.checked;
      });
    }

    const integratorSelect = document.getElementById('integrator-select');
    if (integratorSelect) {
      integratorSelect.addEventListener('change', (e) => {
        this.physics.integrator = e.target.value;
        this.physics.recalculateInitialEnergy();
      });
    }

    const timeSlider = document.getElementById('time-slider');
    const timeVal = document.getElementById('time-val');
    if (timeSlider) {
      timeSlider.addEventListener('input', (e) => {
        this.timeScale = parseFloat(e.target.value);
        if (timeVal) timeVal.textContent = `${this.timeScale.toFixed(1)}x`;
      });
    }

    const gSlider = document.getElementById('g-slider');
    const gVal = document.getElementById('g-val');
    if (gSlider) {
      gSlider.addEventListener('input', (e) => {
        this.physics.G = parseFloat(e.target.value);
        if (gVal) gVal.textContent = this.physics.G.toFixed(1);
      });
    }

    const grToggle = document.getElementById('gr-toggle');
    if (grToggle) {
      grToggle.addEventListener('change', (e) => {
        this.physics.enableGR = e.target.checked;
      });
    }

    const rocheToggle = document.getElementById('roche-toggle');
    if (rocheToggle) {
      rocheToggle.addEventListener('change', (e) => {
        this.physics.enableTidalDisruption = e.target.checked;
      });
    }

    const orbitsToggle = document.getElementById('orbits-toggle');
    if (orbitsToggle) {
      orbitsToggle.addEventListener('change', (e) => {
        this.renderer.showOrbits = e.target.checked;
      });
    }

    const lagrangeToggle = document.getElementById('lagrange-toggle');
    if (lagrangeToggle) {
      lagrangeToggle.addEventListener('change', (e) => {
        this.renderer.showLagrange = e.target.checked;
      });
    }

    const trailsToggle = document.getElementById('trails-toggle');
    if (trailsToggle) {
      trailsToggle.addEventListener('change', (e) => {
        this.showTrails = e.target.checked;
      });
    }

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.paused = !this.paused;
        pauseBtn.classList.toggle('active', this.paused);
        pauseBtn.innerHTML = this.paused ? '▶ Play' : '⏸ Pause';
      });
    }

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.physics.clear();
        this.selectedBodyId = null;
        this.rulerBodyAId = null;
        this.rulerBodyBId = null;
        this.renderer.trackedBodyId = null;
        this.renderer.detachGizmo();
        this.lastPopulatedBodyCount = -1;
        this.onSelectionChanged();
      });
    }

    const spawnBtn = document.getElementById('spawn-mode-btn');
    const spawnBadge = document.getElementById('spawn-badge');
    if (spawnBtn) {
      spawnBtn.addEventListener('click', () => {
        this.spawnMode = !this.spawnMode;
        spawnBtn.classList.toggle('active', this.spawnMode);
        if (spawnBadge) spawnBadge.style.display = this.spawnMode ? 'flex' : 'none';
        this.renderer.controls.enabled = !this.spawnMode;
        if (this.spawnMode) this.renderer.detachGizmo();
      });
    }

    const spawnTypeSelect = document.getElementById('spawn-type');
    if (spawnTypeSelect) {
      spawnTypeSelect.addEventListener('change', (e) => {
        this.spawnType = e.target.value;
      });
    }

    const spawnMassSlider = document.getElementById('spawn-mass');
    const spawnMassVal = document.getElementById('spawn-mass-val');
    if (spawnMassSlider) {
      spawnMassSlider.addEventListener('input', (e) => {
        this.spawnMass = parseFloat(e.target.value);
        if (spawnMassVal) spawnMassVal.textContent = this.spawnMass.toFixed(1);
      });
    }

    const followBtn = document.getElementById('follow-btn');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        if (this.selectedBodyId) {
          this.renderer.trackedBodyId = (this.renderer.trackedBodyId === this.selectedBodyId) ? null : this.selectedBodyId;
          followBtn.classList.toggle('active', !!this.renderer.trackedBodyId);
        }
      });
    }

    const audioBtn = document.getElementById('audio-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isMuted = this.sound.toggleMute();
        audioBtn.textContent = isMuted ? '🔇' : '🔊';
        audioBtn.classList.toggle('active', !isMuted);
      });
    }
  }

  onSelectionChanged() {
    const dropdown = document.getElementById('body-inspector-select');
    const nameInput = document.getElementById('inspector-name-input');
    const followBtn = document.getElementById('follow-btn');

    if (this.selectedBodyId) {
      const b = this.physics.bodies.find(body => body.id === this.selectedBodyId);
      if (b) {
        if (dropdown && dropdown.value !== b.id) dropdown.value = b.id;
        if (nameInput) {
          nameInput.value = b.name;
          nameInput.disabled = false;
        }
        if (followBtn) followBtn.disabled = false;

        // Attach Move Gizmo if active mode is 'move'
        if (this.activeTool === 'move') {
          this.renderer.attachGizmo(b.id);
        } else {
          this.renderer.detachGizmo();
        }
        return;
      }
    }

    if (dropdown) dropdown.value = '';
    if (nameInput) {
      nameInput.value = '';
      nameInput.disabled = true;
      nameInput.placeholder = 'Select a body...';
    }
    if (followBtn) followBtn.disabled = true;
    this.renderer.detachGizmo();
  }

  get3DPointFromMouse(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, target);
    return target;
  }

  bindPointerEvents() {
    const dom = this.renderer.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.glass-panel')) return;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.renderer.camera);

      if (this.spawnMode) {
        const hitPoint = this.get3DPointFromMouse(e);
        if (hitPoint) {
          this.dragStart = hitPoint.clone();
          this.dragCurrent = hitPoint.clone();
        }
      } else {
        const meshes = Array.from(this.renderer.bodyMeshes.values());
        const intersects = this.raycaster.intersectObjects(meshes, true);

        let hitId = null;
        for (const hit of intersects) {
          let curr = hit.object;
          while (curr && !hitId) {
            if (curr.userData && curr.userData.bodyId) {
              hitId = curr.userData.bodyId;
              break;
            }
            curr = curr.parent;
          }
          if (hitId) break;
        }

        if (this.activeTool === 'ruler') {
          if (hitId) {
            if (!this.rulerBodyAId || (this.rulerBodyAId && this.rulerBodyBId)) {
              this.rulerBodyAId = hitId;
              this.rulerBodyBId = null;
            } else if (this.rulerBodyAId && !this.rulerBodyBId && hitId !== this.rulerBodyAId) {
              this.rulerBodyBId = hitId;
            }
          }
        } else {
          this.selectedBodyId = hitId || null;
          this.onSelectionChanged();
        }
      }
    });

    dom.addEventListener('pointermove', (e) => {
      if (this.spawnMode && this.dragStart) {
        const hitPoint = this.get3DPointFromMouse(e);
        if (hitPoint) {
          this.dragCurrent = hitPoint.clone();
          const dir = new THREE.Vector3().subVectors(this.dragCurrent, this.dragStart);
          const len = dir.length();
          this.renderer.showVectorArrow(this.dragStart, dir, len);
        }
      }
    });

    dom.addEventListener('pointerup', () => {
      if (this.spawnMode && this.dragStart && this.dragCurrent) {
        const velVector = new THREE.Vector3().subVectors(this.dragCurrent, this.dragStart).multiplyScalar(0.25);

        let color = '#00f0ff';
        if (this.spawnType === 'star') color = '#ffb703';
        if (this.spawnType === 'blackhole') color = '#9d4edd';
        if (this.spawnType === 'dust') color = '#8899a6';

        const newBody = new Body({
          name: `${this.spawnType.toUpperCase()} ${this.physics.bodies.length + 1}`,
          type: this.spawnType,
          mass: this.spawnMass,
          position: { x: this.dragStart.x, y: this.dragStart.y, z: this.dragStart.z },
          velocity: { x: velVector.x, y: velVector.y, z: velVector.z },
          color: color
        });

        this.physics.addBody(newBody);
        this.selectedBodyId = newBody.id;
        this.lastPopulatedBodyCount = -1;
        this.onSelectionChanged();

        this.dragStart = null;
        this.dragCurrent = null;
        this.renderer.hideVectorArrow();
      }
    });
  }

  drawEnergyChart() {
    const canvas = document.getElementById('energy-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const history = this.physics.energyHistory;
    if (history.length < 2) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const maxPoints = 100;
    const dx = w / maxPoints;

    for (let i = 0; i < history.length; i++) {
      const x = i * dx;
      const drift = history[i].driftPct;
      const y = (h / 2) - Math.min(Math.max(drift * 5, -h/2 + 4), h/2 - 4);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  updateRulerTelemetry() {
    const pairEl = document.getElementById('ruler-pair-names');
    const distEl = document.getElementById('ruler-dist');
    const relVEl = document.getElementById('ruler-rel-v');
    const forceEl = document.getElementById('ruler-force');

    if (!pairEl) return;

    const bA = this.physics.bodies.find(b => b.id === this.rulerBodyAId);
    const bB = this.physics.bodies.find(b => b.id === this.rulerBodyBId);

    if (bA && bB) {
      this.renderer.updateRulerLine(bA, bB);

      const dx = bB.position.x - bA.position.x;
      const dy = bB.position.y - bA.position.y;
      const dz = bB.position.z - bA.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const dvx = bB.velocity.x - bA.velocity.x;
      const dvy = bB.velocity.y - bA.velocity.y;
      const dvz = bB.velocity.z - bA.velocity.z;
      const relV = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

      const force = (this.physics.G * bA.mass * bB.mass) / Math.max(1.0, dist * dist);

      pairEl.textContent = `${bA.name} ➔ ${bB.name}`;
      if (distEl) distEl.textContent = `${dist.toFixed(2)} units`;
      if (relVEl) relVEl.textContent = `${relV.toFixed(2)} v`;
      if (forceEl) forceEl.textContent = `${force.toFixed(2)} N`;

    } else if (bA) {
      pairEl.textContent = `${bA.name} ➔ Select 2nd body...`;
      if (distEl) distEl.textContent = '--';
      if (relVEl) relVEl.textContent = '--';
      if (forceEl) forceEl.textContent = '--';
      this.renderer.updateRulerLine(null, null);
    } else {
      pairEl.textContent = 'Select 2 bodies in 3D...';
      if (distEl) distEl.textContent = '--';
      if (relVEl) relVEl.textContent = '--';
      if (forceEl) forceEl.textContent = '--';
      this.renderer.updateRulerLine(null, null);
    }
  }

  populateInspectorDropdown() {
    const dropdown = document.getElementById('body-inspector-select');
    if (!dropdown) return;

    if (this.lastPopulatedBodyCount === this.physics.bodies.length) {
      if (dropdown.value !== (this.selectedBodyId || '')) {
        dropdown.value = this.selectedBodyId || '';
      }
      return;
    }

    this.lastPopulatedBodyCount = this.physics.bodies.length;
    dropdown.innerHTML = '<option value="">-- None Selected --</option>';

    this.physics.bodies.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.type.toUpperCase()})`;
      if (b.id === this.selectedBodyId) opt.selected = true;
      dropdown.appendChild(opt);
    });
  }

  updateHUD() {
    const bodyCountEl = document.getElementById('stat-body-count');
    const driftEl = document.getElementById('stat-drift');
    const keEl = document.getElementById('stat-ke');
    const peEl = document.getElementById('stat-pe');

    if (bodyCountEl) bodyCountEl.textContent = this.physics.bodies.length;

    const ke = this.physics.getTotalKineticEnergy();
    const pe = this.physics.getTotalPotentialEnergy();
    if (keEl) keEl.textContent = ke.toFixed(1);
    if (peEl) peEl.textContent = pe.toFixed(1);

    const history = this.physics.energyHistory;
    if (driftEl && history.length > 0) {
      const latestDrift = history[history.length - 1].driftPct;
      driftEl.textContent = `${latestDrift.toFixed(3)}%`;
      driftEl.style.color = latestDrift < 0.1 ? '#00f0ff' : (latestDrift < 1.0 ? '#ffb703' : '#ff0055');
    }

    this.drawEnergyChart();
    this.populateInspectorDropdown();
    this.updateRulerTelemetry();

    const inspectorSma = document.getElementById('inspector-sma');
    const inspectorEcc = document.getElementById('inspector-ecc');
    const inspectorPeriod = document.getElementById('inspector-period');
    const inspectorSpeed = document.getElementById('inspector-speed');
    const followBtn = document.getElementById('follow-btn');

    if (this.selectedBodyId) {
      const b = this.physics.bodies.find(body => body.id === this.selectedBodyId);

      let primary = null, maxM = -1;
      for (const body of this.physics.bodies) {
        if (body.id !== this.selectedBodyId && body.mass > maxM) {
          maxM = body.mass; primary = body;
        }
      }

      if (b) {
        if (inspectorSpeed) inspectorSpeed.textContent = b.getSpeed().toFixed(2);
        if (followBtn) followBtn.disabled = false;

        if (primary && primary.mass > b.mass) {
          const elem = OrbitalMath.calculateKeplerianElements(b, primary, this.physics.G);
          if (inspectorSma) inspectorSma.textContent = elem.semiMajorAxis > 0 ? elem.semiMajorAxis.toFixed(1) : 'Parabolic';
          if (inspectorEcc) inspectorEcc.textContent = elem.eccentricity.toFixed(3);
          if (inspectorPeriod) inspectorPeriod.textContent = elem.period > 0 ? `${elem.period.toFixed(1)}s` : '∞';
        } else {
          if (inspectorSma) inspectorSma.textContent = 'Primary Attractor';
          if (inspectorEcc) inspectorEcc.textContent = '0.000';
          if (inspectorPeriod) inspectorPeriod.textContent = '--';
        }
        return;
      }
    }

    if (inspectorSma) inspectorSma.textContent = '--';
    if (inspectorEcc) inspectorEcc.textContent = '--';
    if (inspectorPeriod) inspectorPeriod.textContent = '--';
    if (inspectorSpeed) inspectorSpeed.textContent = '--';
    if (followBtn) followBtn.disabled = true;
  }
}
