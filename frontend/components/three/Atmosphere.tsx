"use client";

import { useMemo } from "react";
import { makeAtmosphereMaterial } from "@/lib/three/planetMaterials";

export default function Atmosphere({ radius, color }: { radius: number; color: string }) {
  const material = useMemo(() => makeAtmosphereMaterial(color), [color]);
  return (
    <mesh scale={1.12}>
      <sphereGeometry args={[radius, 48, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
