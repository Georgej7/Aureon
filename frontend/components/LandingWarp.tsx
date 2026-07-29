"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import Atmosphere from "@/components/three/Atmosphere";
import { makeBandedTexture, makeRingTexture, makeRockyTexture, makeSunMaterial } from "@/lib/three/planetMaterials";

/**
 * Original cinematic entrance flythrough -- camera accelerates toward the
 * Sun, passing a handful of planets along the way, ending in a white burst
 * that hands off to the real page underneath. Built after a reference
 * Instagram Reel (Student Astronomy, "THE SUN GLORY") set the bar for the
 * kind of feeling we wanted, but this is an original scene/camera path/
 * shaders -- reusing their actual footage or replicating their specific
 * composition wasn't an option (someone else's copyrighted render).
 */

const DURATION_MS = 2600;
const FLASH_START = 0.82; // fraction of the flight where the burst begins

type PlanetDef = {
  position: [number, number, number];
  radius: number;
  spin: number;
  kind: "banded" | "rocky" | "ringed";
  color: string;
  craterColor?: string;
  atmosphere?: string;
};

const PLANETS: PlanetDef[] = [
  { position: [4.2, -1.1, 27], radius: 1.05, spin: 0.15, kind: "banded", color: "#c9a26a", atmosphere: "#e8cf9e" },
  { position: [-3.6, 1.3, 19], radius: 1.3, spin: 0.1, kind: "ringed", color: "#d8c090", atmosphere: "#ecd8ab" },
  { position: [-2.1, -1.7, 11], radius: 0.55, spin: 0.4, kind: "rocky", color: "#b8543a", craterColor: "#5a2a1c", atmosphere: "#ffb18f" },
  { position: [3, 1.4, 5.5], radius: 0.42, spin: 0.35, kind: "rocky", color: "#4c78ad", craterColor: "#274764", atmosphere: "#a9d0ff" },
];

function Planet({ def }: { def: PlanetDef }) {
  const ref = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    if (def.kind === "banded")
      return makeBandedTexture([
        [0, def.color],
        [0.3, "#e2c390"],
        [0.5, def.color],
        [0.7, "#f0dcb0"],
        [1, "#a97a4c"],
      ]);
    if (def.kind === "ringed")
      return makeBandedTexture([
        [0, def.color],
        [0.4, "#efe0b8"],
        [0.6, def.color],
        [1, "#b89a68"],
      ]);
    return makeRockyTexture(def.color, def.craterColor ?? "#000");
  }, [def]);
  const ringTexture = useMemo(() => (def.kind === "ringed" ? makeRingTexture() : null), [def.kind]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * def.spin;
  });

  return (
    <group ref={ref} position={def.position}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[def.radius, 48, 48]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
      {def.atmosphere && <Atmosphere radius={def.radius} color={def.atmosphere} />}
      {ringTexture && (
        <mesh rotation={[Math.PI / 2.6, 0, 0]}>
          <ringGeometry args={[def.radius * 1.4, def.radius * 2.4, 96]} />
          <meshStandardMaterial map={ringTexture} transparent side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Sun() {
  const material = useMemo(() => makeSunMaterial(), []);
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.6, 64, 64]} />
        <primitive object={material} attach="material" />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={4000} color="#ffedc4" distance={90} decay={1} />
    </group>
  );
}

function Flight({ onComplete }: { onComplete: () => void }) {
  const { camera } = useThree();
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [flash, setFlash] = useState(0);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const t = Math.min(1, elapsed / (DURATION_MS / 1000));
    const eased = t * t * (3 - 2 * t) * t; // accelerating ease-in, snaps toward the end

    camera.position.z = 40 - eased * 39.2;
    camera.position.x = Math.sin(t * 2.2) * 0.6 * (1 - t);
    camera.position.y = Math.cos(t * 1.7) * 0.4 * (1 - t);
    camera.lookAt(0, 0, 0);

    if (t >= FLASH_START) {
      setFlash((t - FLASH_START) / (1 - FLASH_START));
    }
    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return flash > 0 ? (
    <mesh position={[camera.position.x, camera.position.y, camera.position.z - 1]} renderOrder={999}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#fff7e6" transparent opacity={Math.min(1, flash * 1.15)} depthTest={false} />
    </mesh>
  ) : null;
}

export default function LandingWarp({ onComplete }: { onComplete: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#020204" }}>
      <Canvas shadows camera={{ position: [0, 0, 40], fov: 50 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.22} />
        <Sun />
        <Stars radius={100} depth={50} count={4000} factor={3.5} fade speed={0.6} />
        {PLANETS.map((p, i) => (
          <Planet key={i} def={p} />
        ))}
        <Flight onComplete={onComplete} />
      </Canvas>
    </div>
  );
}
