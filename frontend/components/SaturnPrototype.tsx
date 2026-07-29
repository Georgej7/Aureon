"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

/**
 * WebGL proof-of-concept -- validates whether real shader lighting/shadows
 * actually reads as "cinematic" before committing to rebuilding the whole
 * Orrery in Three.js. Deliberately scoped to one planet, not the full
 * system: cheap to build, cheap to judge, cheap to throw away if it
 * doesn't land. Textures are canvas-generated (banded gradients + noise),
 * not downloaded imagery -- the win here is real lighting/shadow/rim-glow
 * on top of that, which canvas 2D can only ever fake.
 */

function makeBandedTexture(bands: [number, string][], noiseAlpha = 0.06): THREE.CanvasTexture {
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
  // Faint horizontal turbulence so bands don't read as flat printed stripes.
  for (let i = 0; i < 900; i++) {
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

function makeRingTexture(): THREE.CanvasTexture {
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
// atmosphere scatters sunlight at a grazing angle. This is the specific
// effect canvas 2D radial gradients can only approximate; here it's an
// actual per-pixel view-angle calculation.
const atmosphereVertex = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;
const atmosphereFragment = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  void main() {
    float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    float glow = pow(rim, 2.4);
    gl_FragColor = vec4(uColor, glow * 0.9);
  }
`;

function Atmosphere({ radius, color }: { radius: number; color: string }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: { uColor: { value: new THREE.Color(color) } },
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color]
  );
  return (
    <mesh scale={1.12}>
      <sphereGeometry args={[radius, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SaturnBody() {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 1.6;

  const bodyTexture = useMemo(
    () =>
      makeBandedTexture([
        [0, "#c9a26a"],
        [0.15, "#e2c390"],
        [0.32, "#c9a26a"],
        [0.48, "#f0dcb0"],
        [0.62, "#d4ad78"],
        [0.8, "#e8cf9e"],
        [1, "#b8895a"],
      ]),
    []
  );
  const ringTexture = useMemo(() => makeRingTexture(), []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.04;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow rotation={[0, 0, 0.02]}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial map={bodyTexture} roughness={0.85} metalness={0} />
      </mesh>
      <Atmosphere radius={radius} color="#ebd7af" />
      <mesh rotation={[Math.PI / 2.6, 0, 0]} castShadow receiveShadow>
        <ringGeometry args={[radius * 1.35, radius * 2.3, 128]} />
        <meshStandardMaterial
          map={ringTexture}
          transparent
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight
        position={[8, 3, 5]}
        intensity={220}
        color="#fff4dd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Stars radius={80} depth={40} count={3000} factor={3} fade speed={0.4} />
      <SaturnBody />
      <OrbitControls enablePan={false} minDistance={3.5} maxDistance={9} autoRotate={false} />
    </>
  );
}

export default function SaturnPrototype() {
  // Escapes .app's stacking context -- a nested fixed div's z-index only
  // wins locally within its ancestor's context, and .app's later sibling
  // (<footer>, same z-index) would otherwise still paint on top regardless
  // of any z-index set in here. Hiding the site chrome + decorative
  // Starfield canvas also keeps this a fair perf test of the WebGL scene
  // alone, not two canvases competing for the frame budget.
  useEffect(() => {
    document.body.classList.add("prototype-fullscreen");
    return () => document.body.classList.remove("prototype-fullscreen");
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#05060c", zIndex: 999 }}>
      <Canvas shadows camera={{ position: [0, 1.6, 6], fov: 42 }} gl={{ antialias: true }}>
        <Scene />
      </Canvas>
      <div
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          color: "rgba(236,231,218,0.85)",
          fontFamily: "var(--font-manrope), sans-serif",
          fontSize: 13,
          maxWidth: 320,
          lineHeight: 1.5,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#b4924f", marginBottom: 6 }}>
          WebGL prototype
        </div>
        Saturn, rendered with real lighting and shadows -- the ring casts an
        actual shadow across the globe, and the pale rim glow is a
        view-angle atmosphere shader, not a faked gradient. Drag to rotate,
        scroll to zoom.
      </div>
    </div>
  );
}
