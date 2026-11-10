import { type Ball, FOOT_X, H, HEAD_X, isFreeSpot, R, W } from "./physics";

/**
 * "todas": bola 8 com as 15 bolas (lisas 1–7, listradas 9–15, a 8 por último).
 * "bolinho": 3 bolas (1, 2 e 3), acerta sempre a menor da mesa primeiro e
 * quem encaçapar a 3 sem falta vence.
 */
export type Mode = "todas" | "bolinho";
export type Group = "lisas" | "listradas";
export type Player = 0 | 1;
/** Bola na mão: "cabeceira" = só atrás da linha de saída; "livre" = em qualquer lugar. */
export type BallInHand = "cabeceira" | "livre" | null;

export type GameState = {
  mode: Mode;
  turn: Player;
  groups: [Group | null, Group | null];
  ballInHand: BallInHand;
  isBreak: boolean;
  winner: Player | null;
  message: string;
};

export type ShotResult = { firstHit: number | null; potted: number[] };

export const PLAYER_NAMES = ["Jogador 1", "Jogador 2"] as const;

export function groupOf(id: number): Group | null {
  if (id >= 1 && id <= 7) return "lisas";
  if (id >= 9 && id <= 15) return "listradas";
  return null;
}

const other = (p: Player): Player => (p === 0 ? 1 : 0);
const name = (p: Player) => PLAYER_NAMES[p];
const otherGroup = (g: Group): Group => (g === "lisas" ? "listradas" : "lisas");

export function newGameState(mode: Mode): GameState {
  return {
    mode,
    turn: 0,
    groups: [null, null],
    ballInHand: "cabeceira",
    isBreak: true,
    winner: null,
    message: `${name(0)} sai. Posicione a branca atrás da linha e dê a tacada.`,
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

/** Posições do triângulo: ponta na marca do pé, fileiras em direção à tabela do fundo. */
function trianglePositions(rows: number) {
  const gap = 0.2;
  const dx = ((2 * R + gap) * Math.sqrt(3)) / 2;
  const dy = 2 * R + gap;
  const pos: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let k = 0; k <= row; k++) {
      pos.push({ x: FOOT_X + row * dx, y: H / 2 + (k - row / 2) * dy });
    }
  }
  return pos;
}

const ball = (id: number, x: number, y: number): Ball => ({ id, x, y, vx: 0, vy: 0, inPlay: true });

export function rackBalls(mode: Mode, rng: () => number = Math.random): Ball[] {
  const cue = ball(0, HEAD_X - 60, H / 2);

  if (mode === "bolinho") {
    const [p1, p2, p3] = trianglePositions(2);
    const [a, b] = shuffle([2, 3], rng);
    return [cue, ball(1, p1.x, p1.y), ball(a, p2.x, p2.y), ball(b, p3.x, p3.y)];
  }

  // 5 fileiras = 15 posições. Índices: 0 ponta, 4 centro, 10 e 14 cantos do fundo.
  const pos = trianglePositions(5);
  const ids: number[] = new Array(15);
  ids[0] = 1;
  ids[4] = 8;
  // um canto do fundo lisa, o outro listrada
  const solids = shuffle([2, 3, 4, 5, 6, 7], rng);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15], rng);
  const solidCorner = solids.pop()!;
  const stripeCorner = stripes.pop()!;
  if (rng() < 0.5) [ids[10], ids[14]] = [solidCorner, stripeCorner];
  else [ids[10], ids[14]] = [stripeCorner, solidCorner];
  const rest = shuffle([...solids, ...stripes], rng);
  for (let i = 0; i < 15; i++) if (ids[i] === undefined) ids[i] = rest.pop()!;

  return [cue, ...pos.map((p, i) => ball(ids[i], p.x, p.y))];
}

/** Volta uma bola para a marca do pé (ou o mais perto livre, em direção ao fundo). */
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

/** Texto curto do que o jogador da vez precisa acertar. */
export function targetLabel(state: GameState, onTable: number[]): string {
  if (state.mode === "bolinho") {
    const low = Math.min(...onTable);
    return Number.isFinite(low) ? `bola ${low}` : "—";
  }
  const g = state.groups[state.turn];
  if (!g) return "mesa aberta";
  const remaining = onTable.filter((id) => groupOf(id) === g);
  return remaining.length === 0 ? "bola 8" : g;
}

export type Resolution = { state: GameState; respot: number[] };

/**
 * Aplica as regras a uma tacada encerrada.
 * `onTableBefore` = bolas numeradas que estavam na mesa antes da tacada.
 */
export function resolveShot(state: GameState, shot: ShotResult, onTableBefore: number[]): Resolution {
  return state.mode === "bolinho"
    ? resolveBolinho(state, shot, onTableBefore)
    : resolveTodas(state, shot, onTableBefore);
}

function afterFoul(state: GameState, foul: string, extra = ""): GameState {
  const next = other(state.turn);
  return {
    ...state,
    turn: next,
    ballInHand: "livre",
    isBreak: false,
    message: `Falta: ${foul}. ${extra}Bola na mão para ${name(next)}.`,
  };
}

function resolveBolinho(state: GameState, shot: ShotResult, onTableBefore: number[]): Resolution {
  const p = state.turn;
  const lowest = Math.min(...onTableBefore);
  const objPotted = shot.potted.filter((id) => id !== 0);

  let foul: string | null = null;
  if (shot.firstHit === null) foul = "não acertou nenhuma bola";
  else if (shot.potted.includes(0)) foul = "a branca caiu";
  else if (shot.firstHit !== lowest) foul = `tinha que acertar a bola ${lowest} primeiro`;

  if (objPotted.includes(3)) {
    if (!foul) {
      return { state: { ...state, winner: p, ballInHand: null, isBreak: false, message: `${name(p)} encaçapou a 3 e venceu!` }, respot: [] };
    }
    return { state: afterFoul(state, foul, "A 3 volta para a mesa. "), respot: [3] };
  }
  if (foul) return { state: afterFoul(state, foul), respot: [] };

  if (objPotted.length > 0) {
    return {
      state: { ...state, ballInHand: null, isBreak: false, message: `${name(p)} encaçapou e continua.` },
      respot: [],
    };
  }
  const next = other(p);
  return {
    state: { ...state, turn: next, ballInHand: null, isBreak: false, message: `Vez de ${name(next)}.` },
    respot: [],
  };
}

function resolveTodas(state: GameState, shot: ShotResult, onTableBefore: number[]): Resolution {
  const p = state.turn;
  const opp = other(p);
  let objPotted = shot.potted.filter((id) => id !== 0);
  const eightPotted = objPotted.includes(8);
  const group = state.groups[p];
  const onEight = group !== null && !onTableBefore.some((id) => groupOf(id) === group);

  let foul: string | null = null;
  if (shot.firstHit === null) foul = "não acertou nenhuma bola";
  else if (shot.potted.includes(0)) foul = "a branca caiu";
  else if (group) {
    if (onEight && shot.firstHit !== 8) foul = "tinha que acertar a 8 primeiro";
    else if (!onEight && groupOf(shot.firstHit) !== group) foul = `tinha que acertar uma das ${group} primeiro`;
  } else if (shot.firstHit === 8 && !state.isBreak) {
    foul = "com a mesa aberta, não pode acertar a 8 primeiro";
  }

  // bola 8: na saída ela volta para a mesa; depois disso decide a partida
  let note = "";
  const respots: number[] = [];
  if (eightPotted && state.isBreak) {
    note = "A 8 caiu na saída e volta para a mesa. ";
    respots.push(8);
    objPotted = objPotted.filter((id) => id !== 8);
  } else if (eightPotted) {
    const won = onEight && !foul;
    const winner = won ? p : opp;
    const why = won
      ? `${name(p)} encaçapou a 8 e venceu!`
      : `${name(p)} encaçapou a 8 ${foul ? "com falta" : "antes da hora"}. ${name(opp)} venceu!`;
    return { state: { ...state, winner, ballInHand: null, isBreak: false, message: why }, respot: [] };
  }

  if (foul) {
    const s = afterFoul(state, foul);
    return { state: { ...s, message: note + s.message }, respot: respots };
  }

  // define lisas/listradas na primeira bola encaçapada depois da saída
  let groups = state.groups;
  let assigned = "";
  if (!group && !state.isBreak && objPotted.length > 0) {
    const g = groupOf(objPotted[0])!;
    groups = p === 0 ? [g, otherGroup(g)] : [otherGroup(g), g];
    assigned = `${name(p)} fica com as ${g}. `;
  }
  const myGroup = groups[p];
  const pottedOwn = myGroup
    ? objPotted.some((id) => groupOf(id) === myGroup)
    : objPotted.length > 0; // mesa aberta (saída): qualquer bola vale

  if (pottedOwn) {
    return {
      state: { ...state, groups, ballInHand: null, isBreak: false, message: `${note}${assigned}${name(p)} continua.` },
      respot: respots,
    };
  }
  return {
    state: { ...state, groups, turn: opp, ballInHand: null, isBreak: false, message: `${note}${assigned}Vez de ${name(opp)}.` },
    respot: respots,
  };
}
