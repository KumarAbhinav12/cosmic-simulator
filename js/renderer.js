/**
 * High-Precision 3D WebGL Renderer (Three.js)
 * Render Engine for Mesh Objects, Shaders, Keplerian Orbit Overlays,
 * Lagrange Points L1-L5 Markers, and Tidal Disruption Debris Cloud.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OrbitalMath } from './orbitalMath.js';

export class CosmicRenderer {
  constructor(container) {
    this.container = container;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    this.camera.position.set(0, 45, 90);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 3000;
    this.controls.minDistance = 1;

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0x222233, 0.6);
    this.scene.add(this.ambientLight);

    // Starfield Background
    this.createStarfield();

    // Maps & Groups
    this.bodyMeshes = new Map();
    this.trailLines = new Map();
    this.orbitEllipses = new Map();
    this.lagrangeGroup = new THREE.Group();
    this.scene.add(this.lagrangeGroup);

    // Settings Flags
    this.showOrbits = true;
    this.showLagrange = false;

    // Velocity Vector Drag Indicator
    this.vectorArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      0,
      0x00f0ff,
      1.5,
      1.0
    );
    this.vectorArrow.visible = false;
    this.scene.add(this.vectorArrow);

    // Selection Highlight Reticle
    this.createSelectionReticle();

    this.trackedBodyId = null;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  createStarfield() {
    const starCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0x00f0ff),
      new THREE.Color(0x9d4edd),
      new THREE.Color(0xffffff),
      new THREE.Color(0xffb703),
      new THREE.Color(0x4cc9f0)
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 800 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  createSelectionReticle() {
    const ringGeo = new THREE.RingGeometry(1.2, 1.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    this.selectionReticle = new THREE.Mesh(ringGeo, ringMat);
    this.selectionReticle.visible = false;
    this.scene.add(this.selectionReticle);
  }

  createBodyMesh(body) {
    const group = new THREE.Group();
    group.position.set(body.position.x, body.position.y, body.position.z);
    group.userData.bodyId = body.id;

    if (body.type === 'blackhole') {
      const geo = new THREE.SphereGeometry(body.radius, 32, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const core = new THREE.Mesh(geo, mat);
      core.userData.bodyId = body.id;
      group.add(core);

      const haloGeo = new THREE.RingGeometry(body.radius * 1.3, body.radius * 2.5, 48);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x9d4edd,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 3;
      halo.userData.bodyId = body.id;
      group.add(halo);

      const glowGeo = new THREE.SphereGeometry(body.radius * 1.15, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.userData.bodyId = body.id;
      group.add(glow);

    } else if (body.type === 'star') {
      const geo = new THREE.SphereGeometry(body.radius, 32, 32);
      const color = new THREE.Color(body.color);
      const mat = new THREE.MeshBasicMaterial({ color: color });
      const core = new THREE.Mesh(geo, mat);
      core.userData.bodyId = body.id;
      group.add(core);

      const light = new THREE.PointLight(color, 2.5, 500);
      group.add(light);

      const auraGeo = new THREE.SphereGeometry(body.radius * 1.35, 32, 32);
      const auraMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.userData.bodyId = body.id;
      group.add(aura);

    } else if (body.type === 'planet') {
      const geo = new THREE.SphereGeometry(body.radius, 32, 32);
      const color = new THREE.Color(body.color);
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        metalness: 0.2
      });
      const core = new THREE.Mesh(geo, mat);
      core.userData.bodyId = body.id;
      group.add(core);

      if (body.name.toLowerCase().includes('saturn') || (body.mass > 8 && Math.random() > 0.5)) {
        const ringGeo = new THREE.RingGeometry(body.radius * 1.4, body.radius * 2.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffb703,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        ring.userData.bodyId = body.id;
        group.add(ring);
      }

    } else {
      const geo = new THREE.SphereGeometry(body.radius, 10, 10);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(body.color),
        transparent: true,
        opacity: body.type === 'debris' ? 0.9 : 0.7
      });
      const core = new THREE.Mesh(geo, mat);
      core.userData.bodyId = body.id;
      group.add(core);
    }

    this.scene.add(group);
    this.bodyMeshes.set(body.id, group);

    this.createTrailLine(body);
    this.createOrbitEllipseLine(body);

    return group;
  }

  createTrailLine(body) {
    const maxPoints = body.maxTrailLength;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(body.color),
      transparent: true,
      opacity: 0.5
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.trailLines.set(body.id, line);
  }

  updateTrailLine(body) {
    const line = this.trailLines.get(body.id);
    if (!line) return;

    const trail = body.trail;
    const positions = line.geometry.attributes.position.array;

    for (let i = 0; i < trail.length; i++) {
      positions[i * 3] = trail[i].x;
      positions[i * 3 + 1] = trail[i].y;
      positions[i * 3 + 2] = trail[i].z;
    }

    for (let i = trail.length; i < body.maxTrailLength; i++) {
      positions[i * 3] = body.position.x;
      positions[i * 3 + 1] = body.position.y;
      positions[i * 3 + 2] = body.position.z;
    }

    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, trail.length);
  }

  createOrbitEllipseLine(body) {
    const maxPoints = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(body.color),
      dashSize: 1,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.4
    });

    const line = new THREE.Line(geometry, material);
    line.visible = false;
    this.scene.add(line);
    this.orbitEllipses.set(body.id, line);
  }

  updateOrbitEllipseLine(body, primary, G) {
    const line = this.orbitEllipses.get(body.id);
    if (!line) return;

    if (!this.showOrbits || !primary || primary.id === body.id) {
      line.visible = false;
      return;
    }

    const points = OrbitalMath.generateOrbitEllipsePoints(body, primary, G, 120);
    if (points.length === 0) {
      line.visible = false;
      return;
    }

    const positions = line.geometry.attributes.position.array;
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }

    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, points.length);
    line.visible = true;
  }

  updateLagrangePoints(primary, secondary) {
    while (this.lagrangeGroup.children.length > 0) {
      const obj = this.lagrangeGroup.children[0];
      this.lagrangeGroup.remove(obj);
    }

    if (!this.showLagrange || !primary || !secondary) return;

    const lagrange = OrbitalMath.calculateLagrangePoints(primary, secondary);
    if (!lagrange) return;

    const points = [lagrange.L1, lagrange.L2, lagrange.L3, lagrange.L4, lagrange.L5];

    points.forEach((lp) => {
      const geo = new THREE.OctahedronGeometry(0.8, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: lp.name.startsWith('L4') || lp.name.startsWith('L5') ? 0x00f0ff : 0xff0055,
        wireframe: true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(lp.x, lp.y, lp.z);
      this.lagrangeGroup.add(mesh);
    });
  }

  removeBodyMesh(id) {
    const group = this.bodyMeshes.get(id);
    if (group) {
      this.scene.remove(group);
      this.bodyMeshes.delete(id);
    }

    const line = this.trailLines.get(id);
    if (line) {
      this.scene.remove(line);
      this.trailLines.delete(id);
    }

    const ellipse = this.orbitEllipses.get(id);
    if (ellipse) {
      this.scene.remove(ellipse);
      this.orbitEllipses.delete(id);
    }
  }

  sync(physicsEngine, selectedBodyId = null, showTrails = true) {
    const currentIds = new Set(physicsEngine.bodies.map(b => b.id));

    for (const [id] of this.bodyMeshes) {
      if (!currentIds.has(id)) {
        this.removeBodyMesh(id);
      }
    }

    let primaryBody = null;
    let maxMass = -1;
    for (const b of physicsEngine.bodies) {
      if (b.mass > maxMass) {
        maxMass = b.mass;
        primaryBody = b;
      }
    }

    let secondaryBody = null;
    let secondMass = -1;
    for (const b of physicsEngine.bodies) {
      if (b !== primaryBody && b.mass > secondMass) {
        secondMass = b.mass;
        secondaryBody = b;
      }
    }

    for (const body of physicsEngine.bodies) {
      let meshGroup = this.bodyMeshes.get(body.id);
      if (!meshGroup) {
        meshGroup = this.createBodyMesh(body);
      }

      meshGroup.position.set(body.position.x, body.position.y, body.position.z);

      const line = this.trailLines.get(body.id);
      if (line) {
        line.visible = showTrails;
        if (showTrails) {
          this.updateTrailLine(body);
        }
      }

      this.updateOrbitEllipseLine(body, primaryBody, physicsEngine.G);
    }

    this.updateLagrangePoints(primaryBody, secondaryBody);

    // Selection Reticle & Camera Tracking
    if (selectedBodyId) {
      const selectedMesh = this.bodyMeshes.get(selectedBodyId);
      const selectedBody = physicsEngine.bodies.find(b => b.id === selectedBodyId);

      if (selectedMesh && selectedBody) {
        this.selectionReticle.visible = true;
        this.selectionReticle.position.copy(selectedMesh.position);
        this.selectionReticle.scale.setScalar(selectedBody.radius * 1.6);
        this.selectionReticle.lookAt(this.camera.position);

        if (this.trackedBodyId === selectedBodyId) {
          this.controls.target.copy(selectedMesh.position);
        }
      } else {
        this.selectionReticle.visible = false;
      }
    } else {
      this.selectionReticle.visible = false;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  showVectorArrow(origin, direction, length) {
    this.vectorArrow.position.set(origin.x, origin.y, origin.z);
    this.vectorArrow.setDirection(direction.clone().normalize());
    this.vectorArrow.setLength(length, Math.min(length * 0.3, 1.5), Math.min(length * 0.2, 1.0));
    this.vectorArrow.visible = true;
  }

  hideVectorArrow() {
    this.vectorArrow.visible = false;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
