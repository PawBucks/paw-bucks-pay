import { useEffect, useRef } from "react";

const CONFETTI_COLORS = [
  "hsl(178, 55%, 42%)",
  "#d4a017",
  "#ec4899",
  "#7c3aed",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#ffffff",
];
const SHAPES = ["circle", "rect", "star"] as const;

type Particle = {
  x: number; y: number; vx: number; vy: number;
  rot: number; vrot: number; size: number;
  color: string; shape: typeof SHAPES[number];
  opacity: number; gravity: number;
  wobble: number; wobbleSpeed: number;
};

function makeParticle(canvasW: number): Particle {
  return {
    x: Math.random() * canvasW,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 8,
    size: 6 + Math.random() * 10,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    opacity: 1,
    gravity: 0.08 + Math.random() * 0.05,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.05 + Math.random() * 0.08,
  };
}

export function ConfettiCanvas({ active, onDone }: { active: boolean; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number | null>(null);
  const DURATION = 3800;
  const BURST = 220;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = (canvas.width = canvas.offsetWidth);
    const H = (canvas.height = canvas.offsetHeight);
    const start = performance.now();
    particlesRef.current = Array.from({ length: BURST }, () => makeParticle(W));

    const drawStar = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const b = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
        ctx[i === 0 ? "moveTo" : "lineTo"](x + r * Math.cos(a), y + r * Math.sin(a));
        ctx.lineTo(x + (r / 2) * Math.cos(b), y + (r / 2) * Math.sin(b));
      }
      ctx.closePath();
      ctx.fill();
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);

      if (elapsed < 1000 && particlesRef.current.length < BURST * 1.5 && Math.random() < 0.4) {
        particlesRef.current.push(makeParticle(W));
      }

      particlesRef.current = particlesRef.current.filter((p) => p.y < H + 40 && p.opacity > 0.01);

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rot += p.vrot;
        p.wobble += p.wobbleSpeed;
        p.vx += Math.sin(p.wobble) * 0.2;
        if (elapsed > DURATION * 0.6) p.opacity -= 0.012;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          drawStar(0, 0, p.size / 2);
        }
        ctx.restore();
      });

      if (elapsed < DURATION || particlesRef.current.length > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[100]"
      aria-hidden="true"
    />
  );
}