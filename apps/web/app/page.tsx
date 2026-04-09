"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SpiralBackground } from "@/components/ui/spiral-background";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

type View = "landing" | "login" | "signup";

export default function LandingPage() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Spiral background — always mounted, never restarts */}
      <SpiralBackground />

      {/* Content layer */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top nav */}
        <header className="px-6 py-4">
          <button
            onClick={() => setView("landing")}
            className="text-[20px] font-semibold text-white hover:text-white/80 transition-colors"
          >
            MindMap
          </button>
        </header>

        {/* Views */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
          {view === "landing" && (
            <div className="w-full max-w-[640px] flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
              <h1 className="text-[36px] font-bold leading-[1.15] text-white">
                Curiosity has a shape. Yours is unique.
              </h1>
              <p className="text-[16px] font-normal leading-[1.5] text-white/60">
                MindMap builds your personal knowledge graph as you learn — one question at a time.
              </p>
              <div className="flex gap-3 mt-2">
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 h-11 px-6"
                  onClick={() => setView("signup")}
                >
                  Get Started
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 px-6 border-white/30 bg-transparent text-white hover:bg-white/10"
                  onClick={() => setView("login")}
                >
                  Log In
                </Button>
              </div>
            </div>
          )}

          {view === "login" && (
            <div className="w-full max-w-[400px] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-6 animate-in fade-in duration-300">
              <LoginForm onSwitchToSignup={() => setView("signup")} />
            </div>
          )}

          {view === "signup" && (
            <div className="w-full max-w-[400px] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-6 animate-in fade-in duration-300">
              <SignupForm onSwitchToLogin={() => setView("login")} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
