"use client";

import { type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_H,
  CANVAS_W,
  RAIL,
  ballColor,
  drawAim,
  drawBall,
  drawCue,
  drawPlacementRing,
  drawPocketMarks,
  drawTable,
  isStripe,
} from "./draw";
import {
  aimPreview,
  type Ball,
  isMoving,
  newShotEvents,
  POCKETS,
  R,
  type ShotEvents,
  shoot,
  step,
} from "./engine/physics";
import { formatRecord, formatTime, isBetter, recordKey, type RecordValue } from "./engine/records";
import {
  canPlaceCue,
  type GameState,
  type Mode,
  newGameState,
  objectBallIds,
  PAR,
  placeCueDefault,
  POCKET_NAMES,
  pointsLabel,
  rackBalls,
  rerack,
  resolveShot,
  respot,
  SCRATCH_PENALTY_MS,
  type SeqSize,
  targetLabel,
} from "./engine/rules";
import styles from "./sinuca.module.css";
import { readRecord, saveRecord, useRecord } from "./use-record";

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
  /** Relógio (performance.now) da primeira tacada e do fim da partida. */
  startedAt: number | null;
  endedAt: number | null;
};

type Result = { value: RecordValue; newRecord: boolean };

/** O que o painel (React) precisa saber. */
type Hud = { game: GameState; onTable: number[]; phase: Phase; result: Result | null };

const MODES: { id: Mode; label: string }[] = [
  { id: "tempo", label: "Contra o relógio" },
  { id: "tacadas", label: "Menos tacadas" },
  { id: "rotacao", label: "Rotação cantada" },
  { id: "sequencia", label: "Sequência" },
  { id: "treino", label: "Treino livre" },
];

/** Arrasto (em unidades de mesa, ~40% da largura) para chegar à força máxima. */
const FULL_POWER_DRAG = 440;
/** Distância (unidades de mesa) para um clique contar como "na caçapa". */
const POCKET_CLICK_RADIUS = 38;

function createSim(mode: Mode, seqSize: SeqSize): Sim {
  return {
    balls: rackBalls(mode, seqSize),
    game: newGameState(mode, seqSize),
    phase: "aim",
    aimAngle: 0,
    charging: null,
    placing: false,
    events: newShotEvents(),
    onTableBefore: [],
    startedAt: null,
    endedAt: null,
  };
}

const objectBallsOnTable = (balls: Ball[]) => balls.filter((b) => b.id !== 0 && b.inPlay).map((b) => b.id);
const hudOf = (s: Sim, result: Result | null = null): Hud => ({
  game: s.game,
  onTable: objectBallsOnTable(s.balls),
  phase: s.phase,
  result,
});

function elapsedMs(s: Sim, now: number) {
  const run = s.startedAt === null ? 0 : (s.endedAt ?? now) - s.startedAt;
  return run + s.game.penaltyMs;
}

/** Valor que entra na disputa de recorde ao fim da partida (null = não conta; zerado não conta). */
function resultValue(s: Sim, now: number): RecordValue | null {
  const g = s.game;
  switch (g.mode) {
    case "tempo":
      return g.success ? Math.round(elapsedMs(s, now)) : null;
    case "tacadas":
      return g.success ? g.shots : null;
    case "rotacao":
      return g.score > 0 ? g.score : null;
    case "sequencia":
      return g.success || g.score > 0 ? { cleared: g.success, balls: g.score, shots: g.shots } : null;
    default:
      return null;
  }
}

/** Golfe: par de 1 tacada por bola. `d` = tacadas - bolas encaçapadas. */
function parLabel(d: number) {
  if (d === 0) return "no par";
  return d > 0 ? `${d} acima do par` : `${-d} abaixo do par`;
}

export function SinucaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<HTMLElement>(null);
  const simRef = useRef<Sim | null>(null);
  const [hud, setHud] = useState<Hud>(() => ({
    game: newGameState("tempo"),
    onTable: objectBallIds("tempo", 9),
    phase: "aim",
    result: null,
  }));
  const [power, setPower] = useState(0);
  const { game, onTable, phase, result } = hud;
  const key = recordKey(game.mode, game.seqSize);
  const record = useRecord(key);

  const startGame = useCallback((mode: Mode, seqSize: SeqSize) => {
    const s = createSim(mode, seqSize);
    simRef.current = s;
    setHud(hudOf(s));
    setPower(0);
  }, []);

  // laço de animação + ajuste do canvas ao tamanho da tela
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    simRef.current ??= createSim("tempo", 9);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const finishShot = (s: Sim, now: number) => {
      const res = resolveShot(s.game, s.events, s.onTableBefore);
      for (const id of res.respot) respot(s.balls, id);
      if (res.rerack) rerack(s.balls);
      s.game = res.state;
      const cue = s.balls.find((b) => b.id === 0)!;
      if (!cue.inPlay) placeCueDefault(s.balls, s.game.ballInHand ?? "livre");

      let outcome: Result | null = null;
      if (s.game.over) {
        s.phase = "over";
        s.endedAt = now;
        const value = resultValue(s, now);
        const k = recordKey(s.game.mode, s.game.seqSize);
        if (value !== null && k) {
          const newRecord = isBetter(k, value, readRecord(k));
          if (newRecord) saveRecord(k, value);
          outcome = { value, newRecord };
        }
      } else {
        s.phase = "aim";
      }
      setHud(hudOf(s, outcome));
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const s = simRef.current!;
      // até 0,1 s por quadro: a física acompanha o tempo real mesmo a ~10 fps
      // (os subpassos de step() mantêm a colisão estável); acima disso, câmera lenta
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (s.phase === "moving") {
        step(s.balls, dt, s.events);
        if (!isMoving(s.balls)) finishShot(s, now);
      }

      // cronômetro escrito direto no DOM: evita re-renderizar o React 60x por segundo
      if (timerRef.current && s.game.mode === "tempo") {
        const text = formatTime(elapsedMs(s, now));
        if (timerRef.current.textContent !== text) timerRef.current.textContent = text;
      }

      const scale = canvas.width / CANVAS_W;
      ctx.setTransform(scale, 0, 0, scale, RAIL * scale, RAIL * scale);
      ctx.clearRect(-RAIL, -RAIL, CANVAS_W, CANVAS_H);
      drawTable(ctx, s.game.ballInHand === "cabeceira" && s.phase === "aim");
      if (s.game.mode === "rotacao" && !s.game.isBreak && s.phase !== "over") {
        drawPocketMarks(ctx, s.game.calledPocket, s.phase === "aim" && s.game.calledPocket === null, now);
      }
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

    // bola na mão (ou treino): arrastar a branca
    const canDrag = s.game.ballInHand !== null || s.game.mode === "treino";
    if (canDrag && Math.hypot(p.x - cue.x, p.y - cue.y) < 2.4 * R) {
      e.currentTarget.setPointerCapture(e.pointerId);
      s.placing = true;
      return;
    }

    // rotação cantada: clique numa caçapa escolhe o alvo; sem alvo não dá para tacar
    if (s.game.mode === "rotacao" && !s.game.isBreak) {
      const pocket = POCKETS.findIndex((k) => Math.hypot(p.x - k.x, p.y - k.y) < POCKET_CLICK_RADIUS);
      if (pocket >= 0) {
        s.game = { ...s.game, calledPocket: pocket, message: `Caçapa escolhida: ${POCKET_NAMES[pocket]}. Agora mire e taque.` };
        setHud(hudOf(s));
        return;
      }
      if (s.game.calledPocket === null) {
        s.game = { ...s.game, message: "Escolha a caçapa antes de tacar: clique numa delas." };
        setHud(hudOf(s));
        return;
      }
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    // no mouse a mira já vem do movimento; no toque, o próprio toque mira
    if (e.pointerType !== "mouse") s.aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
    s.charging = { x: p.x, y: p.y, power: 0 };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = simRef.current;
    if (!s || s.phase !== "aim") return;
    const p = toTable(e);
    const cue = s.balls.find((b) => b.id === 0)!;
    if (s.placing) {
      if (canPlaceCue(s.balls, s.game.ballInHand ?? "livre", p.x, p.y)) {
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
    s.startedAt ??= performance.now();
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

  const target = targetLabel(game, onTable);
  const total = objectBallIds(game.mode, game.seqSize).length;
  const awaitingCall = game.mode === "rotacao" && !game.isBreak && game.calledPocket === null;
  const hint =
    phase === "moving"
      ? "As bolas estão rolando…"
      : phase === "over"
        ? ""
        : game.ballInHand && game.mode !== "treino"
          ? "Bola na mão: arraste a branca para posicionar. Depois mire e taque."
          : awaitingCall
            ? "Clique numa caçapa para cantar a jogada. Depois mire e taque."
            : game.mode === "treino"
              ? "Arraste a branca para onde quiser. Mire com o mouse, clique e arraste para dar força."
              : "Mire com o mouse. Clique e arraste para dar força, solte para tacar. Setas: ajuste fino.";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sinuca</h1>
          <p className={styles.subtitle}>Pausa para o café. Você contra o seu recorde.</p>
        </div>
        <button type="button" className={styles.restart} onClick={() => startGame(game.mode, game.seqSize)}>
          {game.mode === "treino" ? "Remontar mesa" : "Nova partida"}
        </button>
      </header>

      <nav className={styles.modeBar} aria-label="Modo de jogo">
        <div className={styles.modes} role="group">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.mode}
              aria-pressed={game.mode === m.id}
              onClick={() => startGame(m.id, game.seqSize)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {game.mode === "sequencia" && (
          <div className={styles.modes} role="group" aria-label="Quantidade de bolas">
            {([3, 9] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={styles.mode}
                aria-pressed={game.seqSize === n}
                onClick={() => startGame("sequencia", n)}
              >
                {n === 3 ? "3 bolas (bolinho)" : "9 bolas"}
              </button>
            ))}
          </div>
        )}
      </nav>

      <section className={styles.stats} aria-label="Placar">
        <MainStat game={game} total={total} onTable={onTable} target={target} timerRef={timerRef} />
        {game.mode === "tacadas" ? (
          <Stat label="Encaçapadas" value={`${total - onTable.length} de ${total}`} sub={game.fouls ? `${game.fouls} com a branca caindo` : undefined} />
        ) : (
          <Stat label="Tacadas" value={String(game.shots)} sub={game.fouls ? `${game.fouls} com a branca caindo` : undefined} />
        )}
        {key ? (
          <Stat
            label="Recorde"
            value={record !== null ? formatRecord(key, record) : "—"}
            sub={record === null ? "jogue para marcar o primeiro" : undefined}
          />
        ) : (
          <Stat label="Encaçapadas" value={String(game.score)} sub="no treino não tem recorde" />
        )}
        <div className={styles.onTable}>
          <span className={styles.statLabel}>Na mesa</span>
          <div className={styles.potted}>
            {onTable.length === 0 ? (
              <span className={styles.statSub}>nenhuma</span>
            ) : (
              onTable.map((id) => <MiniBall key={id} id={id} />)
            )}
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
        {phase === "over" && (
          <GameOver game={game} result={result} recordKey={key} record={record} onRestart={() => startGame(game.mode, game.seqSize)} />
        )}
      </div>

      <p className={styles.message} aria-live="polite">
        {game.message}
      </p>
      {hint && <p className={styles.hint}>{hint}</p>}

      <details className={styles.rules}>
        <summary>Como funciona</summary>
        <RulesText mode={game.mode} seqSize={game.seqSize} />
      </details>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

function MainStat({
  game,
  total,
  onTable,
  target,
  timerRef,
}: {
  game: GameState;
  total: number;
  onTable: number[];
  target: string | null;
  timerRef: RefObject<HTMLElement | null>;
}) {
  switch (game.mode) {
    case "tempo":
      return (
        <div className={styles.stat}>
          <span className={styles.statLabel}>Tempo</span>
          {/* preenchido pelo laço de animação */}
          <strong className={styles.statValue} ref={timerRef} />
          <span className={styles.statSub}>
            {game.penaltyMs ? `inclui +${game.penaltyMs / 1000} s de penalidade` : "começa na primeira tacada"}
          </span>
        </div>
      );
    case "tacadas":
      return (
        <Stat
          label="Tacadas"
          value={`${game.shots} / ${PAR}`}
          sub={`par ${PAR} · ${parLabel(game.shots - (total - onTable.length))}`}
        />
      );
    case "rotacao":
      return <Stat label="Pontos" value={String(game.score)} sub={target ? `alvo: ${target}` : "saída livre"} />;
    case "sequencia":
      return (
        <Stat
          label="Próxima"
          value={target ?? "—"}
          sub={`${total - onTable.length} de ${total} em ordem`}
        />
      );
    case "treino":
      return <Stat label="Treino livre" value="sem regras" sub="a branca pode ser arrastada" />;
  }
}

function GameOver({
  game,
  result,
  recordKey: key,
  record,
  onRestart,
}: {
  game: GameState;
  result: Result | null;
  recordKey: ReturnType<typeof recordKey>;
  record: RecordValue | null;
  onRestart: () => void;
}) {
  let title: string;
  let detail: string;
  switch (game.mode) {
    case "tempo":
      title = `Mesa limpa em ${typeof result?.value === "number" ? formatTime(result.value) : "—"}`;
      detail = game.penaltyMs ? `inclui +${game.penaltyMs / 1000} s por branca na caçapa` : "sem nenhuma falta";
      break;
    case "tacadas":
      title = `Mesa limpa em ${game.shots} tacadas`;
      detail = parLabel(game.shots - PAR);
      break;
    case "rotacao":
      title = pointsLabel(game.score);
      detail = game.message;
      break;
    default:
      title = game.success
        ? `Sequência completa em ${game.shots} tacadas`
        : `Parou com ${game.score} de ${game.seqSize} bolas`;
      detail = game.message;
  }
  const recordLine = result?.newRecord
    ? "Novo recorde!"
    : key && record !== null
      ? `Recorde: ${formatRecord(key, record)}`
      : "";

  return (
    <div className={styles.overlay}>
      <p className={styles.overlayTitle}>{title}</p>
      <p className={styles.overlayDetail}>{detail}</p>
      {recordLine && (
        <p className={styles.overlayRecord} data-new={Boolean(result?.newRecord)}>
          {recordLine}
        </p>
      )}
      <button type="button" className={styles.restart} onClick={onRestart}>
        Jogar de novo
      </button>
    </div>
  );
}

function RulesText({ mode, seqSize }: { mode: Mode; seqSize: SeqSize }) {
  const items: Record<Mode, string[]> = {
    tempo: [
      "Encaçape as 15 bolas, em qualquer ordem, no menor tempo possível.",
      "O relógio começa na primeira tacada.",
      `Se a branca cair, você ganha bola na mão e leva +${SCRATCH_PENALTY_MS / 1000} s.`,
    ],
    tacadas: [
      "Encaçape as 15 bolas, em qualquer ordem, com o menor número de tacadas.",
      `O par é ${PAR}: uma bola por tacada. Encaçapar duas de uma vez te deixa abaixo do par.`,
      "Se a branca cair, você ganha bola na mão e leva +1 tacada.",
    ],
    rotacao: [
      "A saída é livre. Depois dela, clique numa caçapa antes de cada tacada para cantar a jogada.",
      "Cada bola que cair na caçapa cantada vale 1 ponto. Bolas em outras caçapas não valem.",
      "Errou a caçapa, não acertou nenhuma bola ou a branca caiu: fim da sequência.",
      "Limpou a mesa: as bolas voltam e a sequência continua.",
    ],
    sequencia: [
      `Encaçape da 1 à ${seqSize}, sempre em ordem crescente. Combinação vale, desde que caia a próxima.`,
      "Bola fora de ordem encerra o jogo. Na saída, ela só volta para a mesa.",
      "Se a branca cair, você ganha bola na mão e leva +1 tacada.",
    ],
    treino: [
      "Sem regras e sem placar: só a mesa.",
      "Arraste a branca para onde quiser a qualquer momento (com as bolas paradas).",
      "Use Remontar mesa para começar de novo.",
    ],
  };
  return (
    <ul>
      {items[mode].map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function MiniBall({ id }: { id: number }) {
  const color = ballColor(id);
  const background = isStripe(id) ? `linear-gradient(#f6f3ea 0 28%, ${color} 28% 72%, #f6f3ea 72%)` : color;
  return (
    <span className={styles.mini} style={{ background }} title={`Bola ${id}`}>
      <span>{id}</span>
    </span>
  );
}
