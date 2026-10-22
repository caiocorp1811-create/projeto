"use client";

import { useId, useState } from "react";
import { brl, brlCompacto, data as fmtData, mesAno } from "@/lib/format";
import styles from "./evolution-chart.module.css";

export type ChartPoint = { data: string; valor: number };

const W = 600;
const TOPO = 10;

function passoBonito(bruto: number) {
  const p = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Eixo Y com 4 faixas "redondas" que cobrem os valores, com folga. */
function escala(valores: number[]) {
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) {
    min = min * 0.9;
    max = max * 1.1 || 1;
  }
  const folga = (max - min) * 0.25;
  let passo = passoBonito((max - min + 2 * folga) / 4);
  let lo = 0;
  for (;;) {
    lo = Math.floor((min - folga) / passo) * passo;
    if (min >= 0 && lo < 0) lo = 0;
    if (lo + passo * 4 >= max) break;
    passo = passoBonito(passo * 1.01); // próximo passo "redondo" acima
  }
  const hi = lo + passo * 4;
  const ticks = Array.from({ length: 5 }, (_, i) => hi - passo * i);
  return { lo, hi, ticks };
}

/** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos. */
function curva(p: [number, number][]) {
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Gráfico de evolução do patrimônio: linha que se desenha ao aparecer e
 * balão com o valor do fechamento sob o mouse (ou o último, por padrão).
 */
export function EvolutionChart({
  pontos,
  altura = 220,
  referencia,
  descricao,
}: {
  pontos: ChartPoint[];
  altura?: number;
  /** Linha tracejada horizontal (ex.: fechamento anterior). */
  referencia?: number;
  /** Texto para leitores de tela. */
  descricao: string;
}) {
  const gradId = `grad${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ultimo = pontos.length - 1;
  const [hover, setHover] = useState(ultimo);

  if (pontos.length === 0) {
    return <p className={styles.vazio}>Ainda não há fechamentos importados.</p>;
  }

  const baseY = altura - 10;
  const { lo, hi, ticks } = escala([...pontos.map((p) => p.valor), ...(referencia ? [referencia] : [])]);
  const y = (v: number) => TOPO + ((hi - v) / (hi - lo)) * (baseY - TOPO);
  const xPct = (i: number) => (pontos.length === 1 ? 50 : (i / ultimo) * 100);
  const coords = pontos.map((p, i): [number, number] => [(xPct(i) / 100) * W, y(p.valor)]);
  const linha = pontos.length > 1 ? curva(coords) : "";
  const area = linha ? `${linha} L${W},${baseY} L0,${baseY} Z` : "";

  // até 6 rótulos no eixo X, sempre com o primeiro e o último
  const passoX = Math.max(1, Math.ceil(pontos.length / 6));
  const indices = pontos.map((_, i) => i).filter((i) => i % passoX === 0 && ultimo - i >= passoX / 2);
  if (!indices.includes(ultimo)) indices.push(ultimo);
  const rotulos = indices.map((i) => ({ i, texto: mesAno(pontos[i].data) }));

  const h = Math.min(hover, ultimo);
  const lado = pontos.length === 1 ? "meio" : xPct(h) < 15 ? "esq" : xPct(h) > 85 ? "dir" : "meio";
  const zona = pontos.length === 1 ? 100 : 100 / ultimo;

  return (
    <div className={styles.grid}>
      <div className={styles.eixoY} aria-hidden="true" style={{ height: altura }}>
        {ticks.map((t) => (
          <span key={t} style={{ top: y(t) }}>
            {brlCompacto(t)}
          </span>
        ))}
      </div>
      <div className={styles.area} style={{ height: altura }} onMouseLeave={() => setHover(ultimo)}>
        <svg
          role="img"
          aria-label={descricao}
          viewBox={`0 0 ${W} ${altura}`}
          preserveAspectRatio="none"
          className={styles.svg}
          style={{ height: altura }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c8431f" stopOpacity="0.28" />
              <stop offset="1" stopColor="#c8431f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="#17191a14" vectorEffect="non-scaling-stroke" />
          ))}
          {referencia !== undefined && (
            <line
              className="fade"
              x1="0"
              x2={W}
              y1={y(referencia)}
              y2={y(referencia)}
              stroke="#17191a"
              strokeWidth="1.6"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: "1.2s" }}
            />
          )}
          {linha && (
            <g className="draw">
              <path d={area} fill={`url(#${gradId})`} />
              <path
                d={linha}
                fill="none"
                stroke="#c8431f"
                strokeWidth="2.6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
        </svg>

        {pontos.map((p, i) => (
          <span
            key={p.data}
            className={styles.zona}
            style={{ left: `${xPct(i) - zona / 2}%`, width: `${zona}%` }}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        <span className={`${styles.guia} fade`} style={{ left: `${xPct(h)}%`, top: coords[h][1] }} aria-hidden="true" />
        <span className={`${styles.ponto} fade`} style={{ left: `${xPct(h)}%`, top: coords[h][1] }} aria-hidden="true" />
        <span
          className={`${styles.balao} fade`}
          data-lado={lado}
          style={{ left: `${xPct(h)}%`, top: coords[h][1] }}
          aria-hidden="true"
        >
          <span className={styles.balaoData}>{fmtData(pontos[h].data)}</span>
          <span className={styles.balaoValor}>{brl(pontos[h].valor)}</span>
        </span>
      </div>
      <div />
      <div className={styles.eixoX} aria-hidden="true">
        {rotulos.map(({ i, texto }) => (
          <span key={i} data-lado={i === 0 && pontos.length > 1 ? "esq" : i === ultimo && pontos.length > 1 ? "dir" : "meio"} style={{ left: `${xPct(i)}%` }}>
            {texto}
          </span>
        ))}
      </div>
    </div>
  );
}
