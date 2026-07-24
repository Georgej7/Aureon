"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ChartRevealHandle = { reveal: () => void };

/**
 * Signature moment: converging chart reveal shown on onboarding submit.
 * Ported from the prototype's revealChart() — imperative canvas animation,
 * exposed to the onboarding page via an imperative handle since it's triggered
 * by a button click rather than owning its own trigger UI.
 */
const ChartReveal = forwardRef<ChartRevealHandle>(function ChartReveal(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const [show, setShow] = useState(false);
  const [text, setText] = useState("Reading your chart…");
  const router = useRouter();

  useImperativeHandle(ref, () => ({
    reveal() {
      setActive(true);
      setText("Reading your chart…");
      requestAnimationFrame(() => setShow(true));

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width,
        H = canvas.height,
        cx = W / 2,
        cy = H / 2;

      const N = 60;
      const points = Array.from({ length: N }, (_, i) => ({
        startX: Math.random() * W,
        startY: Math.random() * H,
        angle: (i / N) * Math.PI * 2,
        radius: 150 + (i % 3) * 20,
      }));

      const duration = 1600;
      const start = performance.now();

      function ease(x: number) {
        return 1 - Math.pow(1 - x, 3);
      }

      function draw(now: number) {
        const p = Math.min(1, (now - start) / duration);
        const e = ease(p);
        ctx!.clearRect(0, 0, W, H);

        ctx!.strokeStyle = "rgba(201,162,74," + (0.5 * e).toFixed(2) + ")";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(cx, cy, 150, 0, Math.PI * 2);
        ctx!.stroke();

        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx!.beginPath();
          ctx!.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
          ctx!.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150);
          ctx!.strokeStyle = "rgba(201,162,74," + (0.18 * e).toFixed(2) + ")";
          ctx!.stroke();
        }

        for (const pt of points) {
          const targetX = cx + Math.cos(pt.angle) * pt.radius;
          const targetY = cy + Math.sin(pt.angle) * pt.radius;
          const x = pt.startX + (targetX - pt.startX) * e;
          const y = pt.startY + (targetY - pt.startY) * e;
          ctx!.beginPath();
          ctx!.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx!.fillStyle = "rgba(242,237,226," + (0.25 + 0.55 * e).toFixed(2) + ")";
          ctx!.fill();
        }

        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 60);
        grad.addColorStop(0, "rgba(201,162,74," + (0.35 * e).toFixed(2) + ")");
        grad.addColorStop(1, "rgba(201,162,74,0)");
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx!.fill();

        if (p < 1) {
          requestAnimationFrame(draw);
        } else {
          setText("Your chart is ready");
          setTimeout(() => {
            setShow(false);
            setTimeout(() => {
              setActive(false);
              router.push("/dashboard");
            }, 500);
          }, 700);
        }
      }
      requestAnimationFrame(draw);
    },
  }));

  return (
    <div className={`cosmic-reveal${active ? " active" : ""}${show ? " show" : ""}`}>
      <canvas ref={canvasRef} id="revealCanvas" width={420} height={420} />
      <div className="reveal-text">{text}</div>
    </div>
  );
});

export default ChartReveal;
