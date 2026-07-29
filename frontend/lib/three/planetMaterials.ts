import * as THREE from "three";

/**
 * Shared procedural-texture + shader helpers for real-time WebGL planet
 * rendering. Textures are canvas-generated (banded gradients, turbulence,
 * mottling) rather than downloaded imagery -- the point of the WebGL work
 * is the real lighting/shadows/atmosphere on top of that, not photoreal
 * source art. Used by both the standalone /prototype Saturn scene and the
 * landing-gate cinematic flythrough so the two don't drift apart.
 */

export function makeBandedTexture(bands: [number, string][], noiseAlpha = 0.06): THREE.CanvasTexture {
  const w = 512,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  for (const [stop, color] of bands) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) {
    const y = Math.random() * h;
    const x = Math.random() * w;
    const len = 20 + Math.random() * 60;
    ctx.strokeStyle = `rgba(255,255,255,${(Math.random() * noiseAlpha).toFixed(3)})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeRockyTexture(base: string, crater: string): THREE.CanvasTexture {
  const w = 512,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 4 + Math.random() * 16;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, crater);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.2 + Math.random() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Grayscale height map for bumpMap -- this, not the color texture, is what
// actually stops a lit sphere from reading as a smooth plastic ball. A
// flat-painted crater (a dark circle in the color map) looks like a sticker;
// a crater in the BUMP map makes the renderer compute real per-pixel surface
// normals, so light genuinely catches a rim and falls into a shadowed pit.
export function makeBumpTexture(kind: "craters" | "bands", detail = 60): THREE.CanvasTexture {
  const w = 512,
    h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);
  // Fine grain everywhere so even "smooth" gas-giant cloud tops aren't
  // mirror-flat -- real atmospheres have turbulent micro-structure.
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * w,
      y = Math.random() * h;
    const v = Math.round(95 + Math.random() * 65);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  if (kind === "craters") {
    for (let i = 0; i < detail; i++) {
      const x = Math.random() * w,
        y = Math.random() * h;
      const r = 4 + Math.random() * 16;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgb(55,55,55)"); // pit floor -- lower
      grad.addColorStop(0.72, "rgb(70,70,70)");
      grad.addColorStop(0.85, "rgb(180,180,180)"); // raised rim -- higher
      grad.addColorStop(1, "rgb(128,128,128)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 45; i++) {
      const y = Math.random() * h;
      const grad = ctx.createLinearGradient(0, y - 7, 0, y + 7);
      const v = Math.round(135 + Math.random() * 35);
      grad.addColorStop(0, "rgba(128,128,128,0)");
      grad.addColorStop(0.5, `rgba(${v},${v},${v},0.55)`);
      grad.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 7, w, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function makeRingTexture(): THREE.CanvasTexture {
  const w = 512,
    h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(235,215,175,0)");
  grad.addColorStop(0.08, "rgba(235,215,175,0.85)");
  grad.addColorStop(0.3, "rgba(210,190,150,0.35)");
  grad.addColorStop(0.42, "rgba(235,215,175,0.9)");
  grad.addColorStop(0.55, "rgba(180,160,125,0.15)");
  grad.addColorStop(0.7, "rgba(235,215,175,0.75)");
  grad.addColorStop(0.9, "rgba(210,190,150,0.4)");
  grad.addColorStop(1, "rgba(235,215,175,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fresnel rim-light -- brightens the silhouette edge where a real
// atmosphere scatters sunlight at a grazing angle. Real per-pixel
// view-angle math, not a radial-gradient approximation.
export const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;
export const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  void main() {
    float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    float glow = pow(rim, 2.4);
    gl_FragColor = vec4(uColor, glow * 0.9);
  }
`;

export function makeAtmosphereMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// Sun surface -- animated turbulent glow, not a flat emissive sphere.
export const sunVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const sunFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  void main() {
    vec2 p = vUv * 6.0 + vec2(uTime * 0.05, uTime * 0.03);
    float n = noise(p) * 0.6 + noise(p * 2.3 + 4.0) * 0.3 + noise(p * 5.0 + 8.0) * 0.15;
    vec3 deep = vec3(0.85, 0.32, 0.06);
    vec3 mid = vec3(1.0, 0.7, 0.25);
    vec3 hot = vec3(1.0, 0.96, 0.8);
    vec3 color = mix(deep, mid, smoothstep(0.3, 0.7, n));
    color = mix(color, hot, smoothstep(0.65, 0.95, n));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function makeSunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
    uniforms: { uTime: { value: 0 } },
  });
}
