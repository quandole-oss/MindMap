"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  brightness: number;
  baseSize: number;
}

interface Connection {
  a: number; // particle index
  b: number;
  life: number; // 0→1 fade in, hold, then fade out
  maxLife: number;
  age: number;
  hue: number;
}

export function SpiralAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 3000;
    const MAX_CONNECTIONS = 40;
    const CONNECTION_DISTANCE = 120; // max screen-space distance to form a connection
    const particles: Particle[] = [];
    const connections: Connection[] = [];
    let animationId: number;
    let tl: gsap.core.Timeline;
    let frameCount = 0;

    function resize() {
      const parent = canvas!.parentElement;
      canvas!.width = parent ? parent.offsetWidth : canvas!.offsetWidth;
      canvas!.height = parent ? parent.offsetHeight : canvas!.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const initialW = canvas.width;
    const initialH = canvas.height;
    const maxDim = Math.max(initialW, initialH);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const isSpiralParticle = Math.random() < 0.4;

      let ox: number, oy: number;
      if (isSpiralParticle) {
        const angle = t * Math.PI * 2 * 8;
        const radius = t * maxDim * 0.5 + (Math.random() - 0.5) * 80;
        ox = Math.cos(angle) * radius;
        oy = Math.sin(angle) * radius;
      } else {
        ox = (Math.random() - 0.5) * maxDim * 1.2;
        oy = (Math.random() - 0.5) * maxDim * 1.2;
      }

      const z = Math.random() * 800 + 50;
      const brightness = 0.05 + Math.random() * 0.4;
      const baseSize = 0.3 + Math.random() * 1.5;

      particles.push({ ox, oy, x: ox, y: oy, z, brightness, baseSize });
    }

    // Slow depth animation
    tl = gsap.timeline({ repeat: -1 });
    particles.forEach((p, i) => {
      tl.to(
        p,
        {
          z: p.z + 100 + Math.random() * 150,
          duration: 12 + Math.random() * 8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: (i / PARTICLE_COUNT) * 3,
        },
        0
      );
    });

    function project(x: number, y: number, z: number, w: number, h: number) {
      const fov = 600;
      const scale = fov / (fov + z);
      return { sx: x * scale + w / 2, sy: y * scale + h / 2, scale };
    }

    // Pre-compute bright particle indices for connection candidates
    const brightIndices: number[] = [];
    particles.forEach((p, i) => {
      if (p.brightness > 0.15) brightIndices.push(i);
    });

    function spawnConnection(w: number, h: number) {
      if (connections.length >= MAX_CONNECTIONS) return;

      // Pick a random bright particle
      const ai = brightIndices[Math.floor(Math.random() * brightIndices.length)];
      const pa = particles[ai];
      const projA = project(pa.ox, pa.oy, pa.z, w, h);

      // Find a nearby bright particle
      const candidates: number[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        const bi = brightIndices[Math.floor(Math.random() * brightIndices.length)];
        if (bi === ai) continue;
        // Skip if this pair already connected
        if (connections.some((c) => (c.a === ai && c.b === bi) || (c.a === bi && c.b === ai))) continue;

        const pb = particles[bi];
        const projB = project(pb.ox, pb.oy, pb.z, w, h);
        const dx = projA.sx - projB.sx;
        const dy = projA.sy - projB.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE && dist > 20) {
          candidates.push(bi);
        }
      }

      if (candidates.length > 0) {
        const bi = candidates[Math.floor(Math.random() * candidates.length)];
        const hue = 220 + Math.random() * 60; // blue to purple
        connections.push({
          a: ai,
          b: bi,
          life: 0,
          maxLife: 180 + Math.random() * 240, // 3-7 seconds at 60fps
          age: 0,
          hue,
        });
      }
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      frameCount++;

      // Deep space background
      ctx!.fillStyle = "rgba(5, 5, 16, 0.15)";
      ctx!.fillRect(0, 0, w, h);

      // Spawn new connections periodically
      if (frameCount % 15 === 0) {
        spawnConnection(w, h);
      }

      // Draw connections
      for (let i = connections.length - 1; i >= 0; i--) {
        const conn = connections[i];
        conn.age++;

        // Fade in (first 30 frames), hold, fade out (last 30 frames)
        const fadeIn = Math.min(conn.age / 30, 1);
        const fadeOut = Math.min((conn.maxLife - conn.age) / 30, 1);
        const alpha = Math.min(fadeIn, fadeOut) * 0.35;

        if (conn.age >= conn.maxLife) {
          connections.splice(i, 1);
          continue;
        }

        const pa = particles[conn.a];
        const pb = particles[conn.b];
        const projA = project(pa.ox, pa.oy, pa.z, w, h);
        const projB = project(pb.ox, pb.oy, pb.z, w, h);

        // Draw the connection line
        ctx!.strokeStyle = `hsla(${conn.hue}, 50%, 65%, ${alpha})`;
        ctx!.lineWidth = 0.5 + alpha;
        ctx!.beginPath();
        ctx!.moveTo(projA.sx, projA.sy);
        ctx!.lineTo(projB.sx, projB.sy);
        ctx!.stroke();

        // Brief glow pulse when connection first forms
        if (conn.age < 20) {
          const pulseAlpha = (1 - conn.age / 20) * 0.3;
          const midX = (projA.sx + projB.sx) / 2;
          const midY = (projA.sy + projB.sy) / 2;
          ctx!.fillStyle = `hsla(${conn.hue}, 60%, 70%, ${pulseAlpha})`;
          ctx!.beginPath();
          ctx!.arc(midX, midY, 4 + (1 - conn.age / 20) * 6, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // Draw particles
      for (const p of particles) {
        const { sx, sy, scale } = project(p.ox, p.oy, p.z, w, h);
        const size = Math.max(0.3, scale * p.baseSize);
        const alpha = p.brightness * scale * 2;

        const hue = 200 + Math.sin(p.ox * 0.01) * 40;
        ctx!.fillStyle = `hsla(${hue}, 20%, ${70 + alpha * 30}%, ${Math.min(alpha, 0.7)})`;
        ctx!.beginPath();
        ctx!.arc(sx, sy, size, 0, Math.PI * 2);
        ctx!.fill();

        // Glow for brighter particles
        if (p.brightness > 0.3 && size > 0.8) {
          ctx!.fillStyle = `hsla(${hue}, 30%, 80%, ${alpha * 0.15})`;
          ctx!.beginPath();
          ctx!.arc(sx, sy, size * 3, 0, Math.PI * 2);
          ctx!.fill();
        }
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
      style={{ background: "#050510" }}
      aria-hidden="true"
    />
  );
}
