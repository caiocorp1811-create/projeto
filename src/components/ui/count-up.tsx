"use client";

import { useEffect, useState } from "react";
import { brlRedondo } from "@/lib/format";

const FORMATOS = {
  brl: brlRedondo,
  int: (v: number) => Math.round(v).toLocaleString("pt-BR"),
} as const;

/**
 * Número que conta de 0 até o valor ao aparecer. Leitores de tela recebem
 * direto o valor final (texto .sr-only).
 */
export function CountUp({
  value,
  format = "int",
  prefix = "",
  duration = 1300,
  delay = 250,
}: {
  value: number;
  format?: keyof typeof FORMATOS;
  prefix?: string;
  duration?: number;
  delay?: number;
}) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = performance.now() + (reduz ? -duration : delay);
    let raf = 0;
    const tick = (agora: number) => {
      const p = Math.max(0, Math.min(1, (agora - inicio) / duration));
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  const fmt = FORMATOS[format];
  const eased = 1 - Math.pow(1 - t, 3);
  return (
    <>
      <span className="sr-only">{prefix + fmt(value)}</span>
      <span aria-hidden="true">{prefix + fmt(value * eased)}</span>
    </>
  );
}
