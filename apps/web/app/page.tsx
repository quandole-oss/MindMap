import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Top nav */}
      <header className="px-6 py-4">
        <span className="text-[20px] font-semibold text-[#18181b]">MindMap</span>
      </header>

      {/* Hero section */}
      <main className="flex flex-col items-center px-6 pt-16 pb-16">
        <div className="w-full max-w-[640px] flex flex-col items-center text-center gap-6">
          <h1 className="text-[28px] font-semibold leading-[1.15] text-[#18181b]">
            Curiosity has a shape. Yours is unique.
          </h1>
          <p className="text-[16px] font-normal leading-[1.5] text-[#52525b]">
            MindMap builds your personal knowledge graph as you learn — one question at a time.
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/signup">
              <Button size="lg" className="bg-[#18181b] text-white hover:bg-[#27272a] h-11 px-6">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="h-11 px-6">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
