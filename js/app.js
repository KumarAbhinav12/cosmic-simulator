/**
 * Cosmic N-Body Physics Simulator App Entry Point
 */

import { PhysicsEngine } from './physics.js';
import { CosmicRenderer } from './renderer.js';
import { UIController } from './ui.js';
import { Scenarios } from './scenarios.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  // Initialize Core Systems
  const physics = new PhysicsEngine();
  const renderer = new CosmicRenderer(container);
  const ui = new UIController(physics, renderer);

  // Load Initial Default Scenario (Solar System)
  Scenarios.solarSystem(physics);

  // Main Animation Loop
  let lastTime = performance.now();

  function animate(currentTime) {
    requestAnimationFrame(animate);

    const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // Step Physics if not paused
    if (!ui.paused) {
      physics.update(ui.timeScale);
    }

    // Synchronize 3D Meshes & Camera
    renderer.sync(physics, ui.selectedBodyId, ui.showTrails);

    // Refresh HUD Telemetry
    ui.updateHUD();
  }

  requestAnimationFrame(animate);
});
