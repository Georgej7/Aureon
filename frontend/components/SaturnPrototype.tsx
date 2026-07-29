"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import Atmosphere from "@/components/three/Atmosphere";
import { makeBandedTexture, makeRingTexture } from "@/lib/three/planetMaterials";

/**
 * WebGL proof-of-concept -- validates whether real shader lighting/shadows
 * actually reads as "cinematic" before committing to rebuilding the whole
 * Orrery in Three.js. Deliberately scoped to one planet, not the full
 * system: cheap to build, cheap to judge, cheap to throw away if it
 * doesn't land. Textures are canvas-generated (banded gradients + noise),
 * not downloaded imagery -- the win here is real lighting/shadow/rim-glow
 * on top of that, which canvas 2D can only ever fake.
 */

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
