"use client";

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, RAIL, ballColor, drawAim, drawBall, drawCue, drawPlacementRing, drawTable, isStripe } from "./draw";
import {
  aimPreview,
  type Ball,
  isMoving,
  newShotEvents,
  R,
  type ShotEvents,
  shoot,
  step,
} from "./engine/physics";
import {
  canPlaceCue,
  type GameState,
  groupOf,
  type Mode,
  newGameState,
  PLAYER_NAMES,
  placeCueDefault,
  rackBalls,
  resolveShot,
  respot,
  targetLabel,
} from "./engine/rules";
import styles from "./sinuca.module.css";

type Phase = "aim" | "moving" | "over";

/** Estado mutável da simulação: vive fora do React para o laço de animação não re-renderizar. */
type Sim = {
  balls: Ball[];
  game: GameState;
  phase: Phase;
  aimAngle: number;
  charging: { x: number; y: number; power: number } | null;
  placing: boolean;
  events: ShotEvents;
  onTableBefore: number[];
};

/** O que o placar (React) precisa saber. */
type Hud = { game: GameState; onTable: number[]; phase: Phase };

/** Arrasto (em unidades de mesa, ~40% da largura) para chegar à força máxima. */
const FULL_POWER_DRAG = 440;

function createSim(mode: Mode): Sim {
  return {
    balls: rackBalls(mode),
    game: newGameState(mode),
    phase: "aim",
    aimAngle: 0,
    charging: null,
    placing: false,
    events: newShotEvents(),
    onTableBefore: [],
  };
}

const objectBallsOnTable = (balls: Ball[]) => balls.filter((b) => b.id !== 0 && b.inPlay).map((b) => b.id);
const hudOf = (s: Sim): Hud => ({ game: s.game, onTable: objectBallsOnTable(s.balls), phase: s.phase });
const allIds = (mode: Mode) => (mode === "bolinho" ? [1, 2, 3] : [...Array(15)].map((_, i) => i + 1));

export function SinucaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const [hud, setHud] = useState<Hud>(() => ({
    game: newGameState("todas"),
    onTable: allIds("todas"),
    phase: "aim",
  }));
  const [power, setPower] = useState(0);

  const startGame = useCallback((mode: Mode) => {
    const s = createSim(mode);
    simRef.current = s;
    setHud(hudOf(s));
    setPower(0);
  }, []);

  // laço de animação + ajuste do canvas ao tamanho da tela
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    simRef.current ??= createSim("todas");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const finishShot = (s: Sim) => {
      const res = resolveShot(s.game, s.events, s.onTableBefore);
      for (const id of res.respot) respot(s.balls, id);
      s.game = res.state;
      const cue = s.balls.find((b) => b.id === 0)!;
      if (!cue.inPlay) placeCueDefault(s.balls, s.game.ballInHand ?? "livre");
      s.phase = s.game.winner === null ? "aim" : "over";
      setHud(hudOf(s));
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const s = simRef.current!;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (s.phase === "moving") {
        step(s.balls, dt, s.events);
        if (!isMoving(s.balls)) finishShot(s);
      }

      const scale = canvas.width / CANVAS_W;
      ctx.setTransform(scale, 0, 0, scale, RAIL * scale, RAIL * scale);
      ctx.clearRect(-RAIL, -RAIL, CANVAS_W, CANVAS_H);
      drawTable(ctx, s.game.ballInHand === "cabeceira" && s.phase === "aim");
      const cue = s.balls.find((b) => b.id === 0)!;
      if (s.phase === "aim" && s.game.ballInHand && cue.inPlay) drawPlacementRing(ctx, cue, now);
      for (const b of s.balls) drawBall(ctx, b);
      if (s.phase === "aim" && cue.inPlay && !s.placing) {
        const preview = aimPreview(s.balls, s.aimAngle);
        if (preview) drawAim(ctx, cue, preview);
        drawCue(ctx, cue, s.aimAngle, s.charging?.power ?? 0);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // setas: ajuste fino da mira (Shift = mais rápido); Esc cancela a força
    const onKey = (e: KeyboardEvent) => {
      const s = simRef.current;
      if (!s || s.phase !== "aim") return;
      if (e.key === "Escape" && s.charging) {
        s.charging = null;
        setPower(0);
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const delta = ((e.shiftKey ? 1 : 0.15) * Math.PI) / 180;
      s.aimAngle += e.key === "ArrowLeft" ? -delta : delta;
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toTable = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * CANVAS_W) / rect.width - RAIL,
      y: ((e.clientY - rect.top) * CANVAS_H) / rect.height - RAIL,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = simRef.current;
    if (!s || s.phase !== "aim" || e.button !== 0) return;
    const p = toTable(e);
    const cue = s.balls.find((b) => b.id === 0)!;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (s.game.ballInHand && Math.hypot(p.x - cue.x, p.y - cue.y) < 2.4 * R) {
      s.placing = true;
      return;
    }
    s.aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
    s.charging = { x: p.x, y: p.y, power: 0 };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = simRef.current;
    if (!s || s.phase !== "aim") return;
    const p = toTable(e);
    const cue = s.balls.find((b) => b.id === 0)!;
    if (s.placing) {
      if (canPlaceCue(s.balls, s.game.ballInHand, p.x, p.y)) {
        cue.x = p.x;
        cue.y = p.y;
      }
    } else if (s.charging) {
      const pw = Math.min(Math.hypot(p.x - s.charging.x, p.y - s.charging.y) / FULL_POWER_DRAG, 1);
      s.charging.power = pw;
      setPower(pw);
    } else if (e.pointerType === "mouse") {
      s.aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
    }
  };

  const onPointerUp = () => {
    const s = simRef.current;
    if (!s) return;
    if (s.placing) {
      s.placing = false;
      return;
    }
    if (!s.charging) return;
    const pw = s.charging.power;
    s.charging = null;
    setPower(0);
    if (pw < 0.03) return; // só um toque: serve para mirar
    s.onTableBefore = objectBallsOnTable(s.balls);
    s.events = newShotEvents();
    s.game = { ...s.game, ballInHand: null };
    shoot(s.balls, s.aimAngle, pw);
    s.phase = "moving";
    setHud(hudOf(s));
  };

  const onPointerCancel = () => {
    const s = simRef.current;
    if (!s) return;
    s.placing = false;
    s.charging = null;
    setPower(0);
  };

  const { game, onTable, phase } = hud;
  const target = targetLabel(game, onTable);
  const hint =
    phase === "moving"
      ? "As bolas estão rolando…"
      : game.ballInHand
        ? "Bola na mão: arraste a branca para posicionar. Depois mire e tacada."
        : "Mire com o mouse. Clique e arraste para dar força, solte para tacar. Setas: ajuste fino.";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sinuca</h1>
          <p className={styles.subtitle}>Pausa para o café. Dois jogadores, mesmo computador.</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.modes} role="group" aria-label="Modalidade">
            {(["todas", "bolinho"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={styles.mode}
                aria-pressed={game.mode === m}
                onClick={() => startGame(m)}
              >
                {m === "todas" ? "Todas as bolas" : "Bolinho · 3 bolas"}
              </button>
            ))}
          </div>
          <button type="button" className={styles.restart} onClick={() => startGame(game.mode)}>
            Nova partida
          </button>
        </div>
      </header>

      <section className={styles.players} aria-label="Jogadores">
        {([0, 1] as const).map((p) => {
          const active = game.turn === p && game.winner === null;
          const group = game.groups[p];
          const mine = group ? allIds("todas").filter((id) => groupOf(id) === group && !onTable.includes(id)) : [];
          return (
            <div key={p} className={styles.player} data-active={active} data-winner={game.winner === p}>
              <div className={styles.playerTop}>
                <span className={styles.dot} aria-hidden />
                <strong>{PLAYER_NAMES[p]}</strong>
                {active && <span className={styles.turn}>na vez</span>}
                {game.winner === p && <span className={styles.turn}>venceu</span>}
              </div>
              <div className={styles.playerInfo}>
                {game.mode === "todas" ? (group ? `Grupo: ${group}` : "Mesa aberta") : "Bolinho"}
                {active && target !== "mesa aberta" && <> · Alvo: {target}</>}
              </div>
              {game.mode === "todas" && (
                <div className={styles.potted} aria-label="Bolas encaçapadas">
                  {mine.length === 0 ? <span className={styles.none}>nenhuma ainda</span> : mine.map((id) => <MiniBall key={id} id={id} />)}
                </div>
              )}
            </div>
          );
        })}
        <div className={styles.onTable}>
          <span className={styles.label}>Na mesa</span>
          <div className={styles.potted}>
            {onTable.map((id) => (
              <MiniBall key={id} id={id} />
            ))}
          </div>
        </div>
      </section>

      <div className={styles.tableWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => {
            e.preventDefault();
            onPointerCancel();
          }}
          aria-label="Mesa de sinuca"
          role="img"
        />
        <div className={styles.power} aria-hidden data-visible={power > 0}>
          <div className={styles.powerFill} style={{ width: `${Math.round(power * 100)}%` }} />
        </div>
        {game.winner !== null && (
          <div className={styles.overlay}>
            <p className={styles.overlayTitle}>{PLAYER_NAMES[game.winner]} venceu!</p>
            <button type="button" className={styles.restart} onClick={() => startGame(game.mode)}>
              Jogar de novo
            </button>
          </div>
        )}
      </div>

      <p className={styles.message} aria-live="polite">
        {game.message}
      </p>
      <p className={styles.hint}>{hint}</p>

      <details className={styles.rules}>
        <summary>Regras</summary>
        {game.mode === "todas" ? (
          <ul>
            <li>Lisas (1–7) contra listradas (9–15). A mesa fica aberta até alguém encaçapar depois da saída: o grupo dessa bola é seu.</li>
            <li>Encaçapou uma das suas: joga de novo. Senão, passa a vez.</li>
            <li>Falta (branca na caçapa, não acertar nada, ou acertar primeiro a bola errada): bola na mão para o adversário.</li>
            <li>Limpou o seu grupo, encaçape a 8. A 8 antes da hora ou com falta perde a partida. A 8 na saída volta para a mesa.</li>
          </ul>
        ) : (
          <ul>
            <li>Só as bolas 1, 2 e 3. Acerte sempre primeiro a de menor número que estiver na mesa.</li>
            <li>Encaçapou (sem falta): joga de novo. Quem encaçapar a 3 sem falta vence, inclusive de combinação.</li>
            <li>Falta: bola na mão para o adversário. Se a 3 cair com falta, ela volta para a mesa.</li>
          </ul>
        )}
      </details>
    </main>
  );
}

function MiniBall({ id }: { id: number }) {
  const color = ballColor(id);
  const background = isStripe(id)
    ? `linear-gradient(#f6f3ea 0 28%, ${color} 28% 72%, #f6f3ea 72%)`
    : color;
  return (
    <span className={styles.mini} style={{ background }} title={`Bola ${id}`}>
      <span>{id}</span>
    </span>
  );
}
