"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Atmosphere from "@/components/three/Atmosphere";

/**
 * WebGL proof-of-concept -- validates whether real shader lighting reads as
 * cinematic before committing to rebuilding the whole Orrery in Three.js.
 * Deliberately scoped to one planet, not the full system.
 *
 * Second pass: the first version used hand-drawn canvas gradients for the
 * surface texture, which read as "painted plastic" no matter how the
 * lighting/roughness was tuned -- there was no real surface detail for
 * light to catch. Swapped to real texture maps from Solar System Scope
 * (solarsystemscope.com/textures, CC Attribution 4.0 -- free for
 * commercial use with credit) instead of continuing to fake it.
 */

function SaturnBody() {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 1.6;

  const [bodyTexture, ringTexture] = useTexture([
    "/textures/2k_saturn.jpg",
    "/textures/2k_saturn_ring_alpha.png",
  ]);

  useEffect(() => {
    bodyTexture.colorSpace = THREE.SRGBColorSpace;
    ringTexture.colorSpace = THREE.SRGBColorSpace;
  }, [bodyTexture, ringTexture]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.04;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow rotation={[0, 0, 0.02]}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial map={bodyTexture} roughness={0.75} metalness={0} />
      </mesh>
      <Atmosphere radius={radius} color="#ebd7af" />
      <mesh rotation={[Math.PI / 2.6, 0, 0]} castShadow receiveShadow>
        <ringGeometry args={[radius * 1.35, radius * 2.3, 128]} />
        <meshStandardMaterial map={ringTexture} transparent side={THREE.DoubleSide} roughness={0.9} />
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
      <Suspense fallback={null}>
        <SaturnBody />
      </Suspense>
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
        Saturn, rendered with real lighting and a real texture map -- the
        ring casts an actual shadow across the globe, and the pale rim glow
        is a view-angle atmosphere shader. Drag to rotate, scroll to zoom.
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
          Textures: solarsystemscope.com/textures (CC BY 4.0)
        </div>
      </div>
    </div>
  );
}
