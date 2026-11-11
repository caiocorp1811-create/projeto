import { type Ball, FOOT_X, H, HEAD_X, isFreeSpot, R, W } from "./physics";

/**
 * Modos solo (uma pessoa jogando contra o próprio recorde):
 * - "tempo": limpar as 15 bolas no menor tempo. Branca na caçapa = +5 s.
 * - "tacadas": limpar as 15 bolas com o menor número de tacadas (par 15).
 *   Branca na caçapa = +1 tacada.
 * - "rotacao": rotação cantada. Antes de cada tacada escolhe-se a caçapa; cada
 *   bola que cair nela vale 1 ponto. Errar a caçapa ou cometer falta encerra a
 *   sequência. Mesa limpa = as bolas voltam e a sequência continua.
 * - "sequencia": encaçapar da 1 à 3 (bolinho) ou da 1 à 9, em ordem crescente.
 *   Bola fora de ordem encerra o jogo (na saída, ela volta para a mesa).
 * - "treino": sem regras, a branca pode ser arrastada à vontade.
 */
export type Mode = "tempo" | "tacadas" | "rotacao" | "sequencia" | "treino";
export type SeqSize = 3 | 9;
/** Bola na mão: "cabeceira" = só atrás da linha de saída; "livre" = em qualquer lugar. */
export type BallInHand = "cabeceira" | "livre" | null;

export const PAR = 15;
export const SCRATCH_PENALTY_MS = 5000;

/** Mesma ordem de POCKETS (physics.ts). */
export const POCKET_NAMES = [
  "canto de cima, à esquerda",
  "meio de cima",
  "canto de cima, à direita",
  "canto de baixo, à esquerda",
  "meio de baixo",
  "canto de baixo, à direita",
] as const;

export type GameState = {
  mode: Mode;
  seqSize: SeqSize;
  ballInHand: BallInHand;
  isBreak: boolean;
  /** Tacadas dadas, já com as de penalidade. */
  shots: number;
  fouls: number;
  /** Tempo de penalidade acumulado (modo tempo). */
  penaltyMs: number;
  /** Pontos (rotação), bolas em ordem (sequência) ou bolas encaçapadas (treino). */
  score: number;
  /** Rotação: caçapa escolhida para a próxima tacada. */
  calledPocket: number | null;
  over: boolean;
  /** O objetivo foi cumprido (mesa limpa / sequência completa). */
  success: boolean;
  message: string;
};

export type ShotResult = {
  firstHit: number | null;
  potted: number[];
  pocketOf: Record<number, number>;
};

export type Resolution = {
  state: GameState;
  /** Bolas que voltam para a mesa. */
  respot: number[];
  /** Mesa remontada (rotação, depois de limpar tudo). */
  rerack: boolean;
};

export function objectBallIds(mode: Mode, seqSize: SeqSize): number[] {
  const n = mode === "sequencia" ? seqSize : 15;
  return Array.from({ length: n }, (_, i) => i + 1);
}

const START_MESSAGE: Record<Mode, (n: SeqSize) => string> = {
  tempo: () => "Posicione a branca atrás da linha e dê a saída. O relógio começa na primeira tacada.",
  tacadas: () => `Limpe a mesa em até ${PAR} tacadas. Posicione a branca atrás da linha e dê a saída.`,
  rotacao: () => "Saída livre. Depois, escolha a caçapa (clique nela) antes de cada tacada.",
  sequencia: (n) => `Encaçape da 1 à ${n}, sempre em ordem. Posicione a branca e dê a saída.`,
  treino: () => "Mesa livre, sem regras. Arraste a branca para onde quiser.",
};

export function newGameState(mode: Mode, seqSize: SeqSize = 9): GameState {
  return {
    mode,
    seqSize,
    ballInHand: mode === "treino" ? "livre" : "cabeceira",
    isBreak: true,
    shots: 0,
    fouls: 0,
    penaltyMs: 0,
    score: 0,
    calledPocket: null,
    over: false,
    success: false,
    message: START_MESSAGE[mode](seqSize),
  };
}

// --- montagem da mesa --------------------------------------------------------

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fileiras com `counts[i]` bolas cada, a partir da marca do pé, rumo à tabela do fundo. */
function rowPositions(counts: number[]) {
  const gap = 0.2;
  const dx = ((2 * R + gap) * Math.sqrt(3)) / 2;
  const dy = 2 * R + gap;
  const pos: { x: number; y: number }[] = [];
  counts.forEach((count, row) => {
    for (let k = 0; k < count; k++) {
      pos.push({ x: FOOT_X + row * dx, y: H / 2 + (k - (count - 1) / 2) * dy });
    }
  });
  return pos;
}

const ball = (id: number, x: number, y: number): Ball => ({ id, x, y, vx: 0, vy: 0, inPlay: true });

/** Triângulo de 15: a 1 na ponta, a 8 no centro, uma lisa e uma listrada nos cantos do fundo. */
function fifteenRack(rng: () => number): Ball[] {
  const pos = rowPositions([1, 2, 3, 4, 5]);
  const ids: number[] = new Array(15);
  ids[0] = 1;
  ids[4] = 8;
  const solids = shuffle([2, 3, 4, 5, 6, 7], rng);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15], rng);
  const solidCorner = solids.pop()!;
  const stripeCorner = stripes.pop()!;
  if (rng() < 0.5) [ids[10], ids[14]] = [solidCorner, stripeCorner];
  else [ids[10], ids[14]] = [stripeCorner, solidCorner];
  const rest = shuffle([...solids, ...stripes], rng);
  for (let i = 0; i < 15; i++) if (ids[i] === undefined) ids[i] = rest.pop()!;
  return pos.map((p, i) => ball(ids[i], p.x, p.y));
}

export function rackBalls(mode: Mode, seqSize: SeqSize = 9, rng: () => number = Math.random): Ball[] {
  const cue = ball(0, HEAD_X - 60, H / 2);

  if (mode === "sequencia" && seqSize === 3) {
    const [p1, p2, p3] = rowPositions([1, 2]);
    const [a, b] = shuffle([2, 3], rng);
    return [cue, ball(1, p1.x, p1.y), ball(a, p2.x, p2.y), ball(b, p3.x, p3.y)];
  }
  if (mode === "sequencia") {
    // losango da bola 9: 1 na ponta, 9 no centro
    const pos = rowPositions([1, 2, 3, 2, 1]);
    const rest = shuffle([2, 3, 4, 5, 6, 7, 8], rng);
    const ids = pos.map((_, i) => (i === 0 ? 1 : i === 4 ? 9 : rest.pop()!));
    return [cue, ...pos.map((p, i) => ball(ids[i], p.x, p.y))];
  }
  return [cue, ...fifteenRack(rng)];
}

/** Remonta as 15 bolas no triângulo. Se a branca estiver no caminho, ela vai para a cabeceira. */
export function rerack(balls: Ball[], rng: () => number = Math.random) {
  for (const fresh of fifteenRack(rng)) {
    const b = balls.find((x) => x.id === fresh.id);
    if (b) Object.assign(b, fresh);
  }
  const cue = balls.find((b) => b.id === 0)!;
  if (!cue.inPlay || !isFreeSpot(balls, cue.x, cue.y, 0)) {
    cue.inPlay = false;
    placeCueDefault(balls, "cabeceira");
  }
}

/** Volta uma bola para a marca do pé (ou o mais perto livre, na linha central). */
export function respot(balls: Ball[], id: number) {
  const b = balls.find((x) => x.id === id);
  if (!b) return;
  const y = H / 2;
  for (let d = 0; d < W; d += 1) {
    for (const x of [FOOT_X + d, FOOT_X - d]) {
      if (isFreeSpot(balls, x, y, id)) {
        Object.assign(b, { x, y, vx: 0, vy: 0, inPlay: true });
        return;
      }
    }
  }
}

/** Coloca a branca (fora de jogo) num ponto livre: atrás da linha ou no centro. */
export function placeCueDefault(balls: Ball[], where: BallInHand) {
  const cue = balls.find((b) => b.id === 0)!;
  const startX = where === "cabeceira" ? HEAD_X - 60 : W / 2;
  for (let d = 0; d < H; d += 2) {
    for (const [x, y] of [
      [startX, H / 2 + d],
      [startX, H / 2 - d],
      [startX - d, H / 2],
    ]) {
      if (isFreeSpot(balls, x, y, 0) && (where !== "cabeceira" || x <= HEAD_X)) {
        Object.assign(cue, { x, y, vx: 0, vy: 0, inPlay: true });
        return;
      }
    }
  }
}

/** Pode deixar a branca aqui, dado o tipo de bola na mão? */
export function canPlaceCue(balls: Ball[], where: BallInHand, x: number, y: number) {
  if (where === "cabeceira" && x > HEAD_X) return false;
  return isFreeSpot(balls, x, y, 0);
}

// --- regras ------------------------------------------------------------------

/** O que o jogador precisa acertar agora (só nos modos que têm alvo). */
export function targetLabel(state: GameState, onTable: number[]): string | null {
  if (state.mode === "sequencia") return onTable.length ? `bola ${Math.min(...onTable)}` : null;
  if (state.mode === "rotacao" && !state.isBreak) {
    return state.calledPocket === null ? "escolha a caçapa" : POCKET_NAMES[state.calledPocket];
  }
  return null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const pointsLabel = (n: number) => plural(n, "ponto", "pontos");

/**
 * Aplica as regras do modo a uma tacada encerrada.
 * `onTableBefore` = bolas numeradas que estavam na mesa antes da tacada.
 */
export function resolveShot(state: GameState, shot: ShotResult, onTableBefore: number[]): Resolution {
  const scratch = shot.potted.includes(0);
  const potted = shot.potted.filter((id) => id !== 0);
  const base: GameState = {
    ...state,
    shots: state.shots + 1,
    isBreak: false,
    ballInHand: scratch ? "livre" : null,
    calledPocket: null,
  };
  const remaining = onTableBefore.filter((id) => !potted.includes(id));
  const done = (s: GameState, respot: number[] = [], rerack = false): Resolution => ({ state: s, respot, rerack });

  switch (state.mode) {
    case "tempo":
    case "tacadas": {
      let s = base;
      let note = "";
      if (scratch) {
        s =
          state.mode === "tempo"
            ? { ...s, fouls: s.fouls + 1, penaltyMs: s.penaltyMs + SCRATCH_PENALTY_MS }
            : { ...s, fouls: s.fouls + 1, shots: s.shots + 1 };
        note = state.mode === "tempo" ? "A branca caiu: +5 s. " : "A branca caiu: +1 tacada. ";
      }
      if (remaining.length === 0) {
        return done({ ...s, ballInHand: null, over: true, success: true, message: `${note}Mesa limpa!` });
      }
      const left = remaining.length === 1 ? "Falta 1." : `Faltam ${remaining.length}.`;
      const hit = potted.length ? `${plural(potted.length, "bola", "bolas")} na caçapa. ` : "";
      return done({ ...s, message: `${note}${hit}${left}` });
    }

    case "rotacao": {
      if (state.isBreak) {
        if (remaining.length === 0) {
          return done({ ...base, isBreak: true, message: "Limpou a mesa na saída! As bolas voltaram." }, [], true);
        }
        return done({
          ...base,
          message: scratch
            ? "A branca caiu na saída: bola na mão. Agora escolha a caçapa."
            : "Saída feita. Agora escolha a caçapa antes de cada tacada.",
        });
      }
      const end = (why: string) =>
        done({ ...base, ballInHand: null, over: true, message: `${why} Fim da sequência.` });
      if (shot.firstHit === null) return end("Não acertou nenhuma bola.");
      if (scratch) return end("A branca caiu.");
      const called = state.calledPocket;
      const hits = called === null ? [] : potted.filter((id) => shot.pocketOf[id] === called);
      if (hits.length === 0) return end("Nenhuma bola caiu na caçapa escolhida.");

      const score = state.score + hits.length;
      if (remaining.length === 0) {
        return done(
          { ...base, score, isBreak: true, message: `+${hits.length}. Mesa limpa! As bolas voltaram: saída livre.` },
          [],
          true,
        );
      }
      return done({ ...base, score, message: `+${pointsLabel(hits.length)}. Escolha a próxima caçapa.` });
    }

    case "sequencia": {
      const order = [...onTableBefore].sort((a, b) => a - b);
      const got = [...potted].sort((a, b) => a - b);
      let ok = 0;
      while (ok < got.length && got[ok] === order[ok]) ok++;
      const wrong = got.slice(ok);
      let respots: number[] = [];
      let note = "";
      if (wrong.length > 0) {
        if (!state.isBreak) {
          return done({
            ...base,
            ballInHand: null,
            score: state.score + ok,
            over: true,
            message: `A bola ${wrong[0]} caiu fora de ordem.`,
          });
        }
        respots = wrong;
        note = "Na saída, bola fora de ordem volta para a mesa. ";
      }
      let s: GameState = { ...base, score: state.score + ok };
      if (scratch) {
        s = { ...s, fouls: s.fouls + 1, shots: s.shots + 1 };
        note += "A branca caiu: +1 tacada. ";
      }
      const kept = got.slice(0, ok);
      const left = onTableBefore.filter((id) => !kept.includes(id));
      if (left.length === 0) {
        return done({ ...s, ballInHand: null, over: true, success: true, message: `${note}Sequência completa!` });
      }
      return done({ ...s, message: `${note}Próxima: bola ${Math.min(...left)}.` }, respots);
    }

    case "treino": {
      const s = { ...base, score: state.score + potted.length };
      const message = scratch
        ? "A branca caiu. Arraste-a para onde quiser."
        : remaining.length === 0
          ? "Mesa limpa! Clique em Remontar mesa para jogar de novo."
          : potted.length
            ? "Boa!"
            : "Mesa livre, sem regras.";
      return done({ ...s, message });
    }
  }
}
