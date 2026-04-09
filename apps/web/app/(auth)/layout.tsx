import type { ReactNode } from "react";
import { SpiralBackground } from "@/components/ui/spiral-background";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Spiral background — fills entire viewport */}
      <SpiralBackground />

      {/* Content layer — above the canvas */}
      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="mb-6">
          <span className="text-[20px] font-semibold text-white">MindMap</span>
        </div>
        <div className="w-full max-w-[400px] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
