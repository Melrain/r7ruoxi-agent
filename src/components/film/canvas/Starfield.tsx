"use client";

import { useEffect, useMemo, useState } from "react";

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Viewport-tied starfield. Client-mount only (hydration-safe).
 * Tool style A: default off; when on, keep very weak so grid stays primary.
 */
export function Starfield({
  x,
  y,
  zoom,
  intensity = "weak",
}: {
  x: number;
  y: number;
  zoom: number;
  intensity?: "off" | "weak";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const stars = useMemo(() => {
    const out: { id: number; cx: number; cy: number; r: number; o: number }[] =
      [];
    // Much sparser / dimmer than the old 240-star demo field.
    for (let i = 0; i < 48; i++) {
      out.push({
        id: i,
        cx: hash(i) * 2800 - 400,
        cy: hash(i + 99) * 1800 - 300,
        r: hash(i + 3) > 0.7 ? 1.0 : 0.45,
        o: 0.35 + hash(i + 21) * 0.4,
      });
    }
    return out;
  }, []);

  if (!mounted || intensity === "off") return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.05]"
      aria-hidden
    >
      <defs>
        <radialGradient id="nebula-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4a3470" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#4a3470" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebula-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e4a52" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#1e4a52" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={x + 720 * zoom}
        cy={y + 380 * zoom}
        rx={520 * zoom}
        ry={280 * zoom}
        fill="url(#nebula-a)"
      />
      <ellipse
        cx={x + 1480 * zoom}
        cy={y + 820 * zoom}
        rx={460 * zoom}
        ry={240 * zoom}
        fill="url(#nebula-b)"
      />
      {stars.map((star) => (
        <circle
          key={star.id}
          cx={x + star.cx * zoom}
          cy={y + star.cy * zoom}
          r={star.r}
          fill="#f4efe4"
          opacity={star.o}
        />
      ))}
    </svg>
  );
}
