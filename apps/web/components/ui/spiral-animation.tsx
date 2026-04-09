"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  color: string;
}

export function SpiralAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 5000;
    const particles: Particle[] = [];
    let animationId: number;
    let tl: gsap.core.Timeline;

    function resize() {
      const parent = canvas!.parentElement;
      canvas!.width = parent ? parent.offsetWidth : canvas!.offsetWidth;
      canvas!.height = parent ? parent.offsetHeight : canvas!.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Build spiral particles
    const initialW = canvas.width;
    const initialH = canvas.height;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const angle = t * Math.PI * 2 * 20; // 20 full rotations
      const radius = t * Math.min(initialW, initialH) * 0.45;
      const z = (1 - t) * 600 + 100;
      particles.push({
        ox: Math.cos(angle) * radius,
        oy: Math.sin(angle) * radius,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z,
        color: `rgba(255,255,255,${0.1 + t * 0.6})`,
      });
    }

    // GSAP: animate particles z depth for 3D fly-through pulsing effect
    tl = gsap.timeline({ repeat: -1 });
    particles.forEach((p, i) => {
      tl.to(
        p,
        {
          z: p.z + 200,
          duration: 8 + Math.random() * 4,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
          delay: (i / PARTICLE_COUNT) * 2,
        },
        0
      );
    });

    function project(x: number, y: number, z: number, w: number, h: number) {
      const fov = 500;
      const scale = fov / (fov + z);
      return {
        sx: x * scale + w / 2,
        sy: y * scale + h / 2,
        scale,
      };
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.fillStyle = "rgba(0,0,0,0.18)";
      ctx!.fillRect(0, 0, w, h);

      for (const p of particles) {
        const { sx, sy, scale } = project(p.ox, p.oy, p.z, w, h);
        const size = Math.max(0.5, scale * 2);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(sx, sy, size, 0, Math.PI * 2);
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      tl.kill();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
