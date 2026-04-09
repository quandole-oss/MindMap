"use client";

import dynamic from "next/dynamic";

const SpiralAnimation = dynamic(
  () => import("@/components/ui/spiral-animation").then((m) => m.SpiralAnimation),
  { ssr: false }
);

export function SpiralBackground() {
  return <SpiralAnimation />;
}
