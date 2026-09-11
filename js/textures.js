/**
 * Procedural Photorealistic Canvas Texture Generators
 * Creates dynamic 2D surface maps for Stars, Earth-like Terrestrial Planets, Gas Giants, and Moon/Asteroids.
 */

import * as THREE from 'three';

export class TextureGenerator {

  /**
   * Generates a Solar Surface Texture with convective plasma noise and magnetic flares.
   */
  static createStarTexture(colorHex = '#ffaa00') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#ffcc00');
    grad.addColorStop(0.5, colorHex);
    grad.addColorStop(1, '#ff3300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convective plasma cell noise
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 1 + Math.random() * 4;
      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 255, 200, 0.25)' : 'rgba(150, 20, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Generates a Terrestrial Earth-like Planet Texture (Oceans, Continents, Clouds, Ice Caps).
   */
  static createTerrestrialTexture(colorHex = '#00f0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Deep Ocean base
    ctx.fillStyle = '#0a2342';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Continents procedural blobs
    ctx.fillStyle = '#2d6a4f';
    for (let i = 0; i < 18; i++) {
      const cx = Math.random() * canvas.width;
      const cy = 40 + Math.random() * (canvas.height - 80);
      const rx = 30 + Math.random() * 60;
      const ry = 20 + Math.random() * 40;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Polar Ice Caps
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, 25);
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);

    // Swirling White Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 15 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generates Gas Giant Banded Cloud Texture (Jupiter/Saturn-like swirls with Great Red Spot).
   */
  static createGasGiantTexture(colorHex = '#ffb703') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Parallel Cloud Bands
    const bandColors = ['#e0a96d', '#d4a373', '#f4a261', '#264653', '#e9c46a', '#f4a261', '#cc8b65'];
    const bandHeight = canvas.height / bandColors.length;

    bandColors.forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, idx * bandHeight, canvas.width, bandHeight);
    });

    // Turbulent Swirls
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 5 + Math.random() * 20;
      ctx.fillStyle = 'rgba(255, 240, 200, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Great Red Spot Storm Oval
    ctx.fillStyle = '#b7094c';
    ctx.beginPath();
    ctx.ellipse(320, 160, 45, 25, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generates Atmospheric Fresnel Edge Glow Shader Material
   */
  static createAtmosphereMaterial(colorHex = '#00f0ff') {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vecvec4(position, 1.0);
        }
      `.replace('vecvec4', 'vec4'),
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 color;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.2);
          gl_FragColor = vec4(color, 1.0) * intensity;
        }
      `,
      uniforms: {
        color: { value: new THREE.Color(colorHex) }
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
  }
}
