/**
 * Física 2D da mesa. Coordenadas em "unidades de mesa": a área de jogo (pano,
 * por dentro das tabelas) vai de (0, 0) a (W, H). Bola 0 é a branca.
 */

export const W = 1000;
export const H = 500;
export const R = 11.5;
/** Linha de cabeceira (de onde se sai) e marca do pé (onde fica o triângulo). */
export const HEAD_X = W * 0.25;
export const FOOT_X = W * 0.75;

export const MAX_SPEED = 1700;
const DECEL = 260; // atrito do pano (unidades/s²)
const STOP_SPEED = 4;
const BALL_RESTITUTION = 0.95;
const RAIL_RESTITUTION = 0.78;
const RAIL_FRICTION = 0.96;
const MAX_SUBSTEP = 1 / 600;

export type Ball = { id: number; x: number; y: number; vx: number; vy: number; inPlay: boolean };

export type Pocket = { x: number; y: number; r: number };

export const POCKETS: Pocket[] = [
  { x: -2, y: -2, r: 30 },
  { x: W / 2, y: -10, r: 21 },
  { x: W + 2, y: -2, r: 30 },
  { x: -2, y: H + 2, r: 30 },
  { x: W / 2, y: H + 10, r: 21 },
  { x: W + 2, y: H + 2, r: 30 },
];

// trechos das tabelas que são boca de caçapa (a bola passa em vez de quicar)
const CORNER_MOUTH = 30;
const SIDE_MOUTH = 21;

const inCornerMouth = (along: number, length: number) =>
  along < CORNER_MOUTH || along > length - CORNER_MOUTH;
const inLongRailMouth = (x: number) => inCornerMouth(x, W) || Math.abs(x - W / 2) < SIDE_MOUTH;

/** O que aconteceu durante a tacada (acumulado entre os passos). */
export type ShotEvents = { firstHit: number | null; potted: number[] };

export const newShotEvents = (): ShotEvents => ({ firstHit: null, potted: [] });

export function isMoving(balls: Ball[]): boolean {
  return balls.some((b) => b.inPlay && (b.vx !== 0 || b.vy !== 0));
}

export function shoot(balls: Ball[], angle: number, power: number) {
  const cue = balls.find((b) => b.id === 0);
  if (!cue || !cue.inPlay) return;
  const p = Math.min(Math.max(power, 0), 1);
  // curva suave: tacadas fracas ficam mais controláveis
  const speed = 60 + (MAX_SPEED - 60) * p ** 1.7;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
}

/** Quica na tabela vertical em `wallX`; `into` = sentido da velocidade que bate nela. */
function bounceX(b: Ball, wallX: number, into: 1 | -1) {
  b.x = wallX;
  if (Math.sign(b.vx) === into) {
    b.vx = -b.vx * RAIL_RESTITUTION;
    b.vy *= RAIL_FRICTION;
  }
}

function bounceY(b: Ball, wallY: number, into: 1 | -1) {
  b.y = wallY;
  if (Math.sign(b.vy) === into) {
    b.vy = -b.vy * RAIL_RESTITUTION;
    b.vx *= RAIL_FRICTION;
  }
}

function pot(b: Ball, ev: ShotEvents) {
  b.inPlay = false;
  b.vx = 0;
  b.vy = 0;
  ev.potted.push(b.id);
}

function substep(balls: Ball[], h: number, ev: ShotEvents) {
  // movimento + atrito
  for (const b of balls) {
    if (!b.inPlay) continue;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed === 0) continue;
    const next = speed - DECEL * h;
    if (next <= STOP_SPEED) {
      b.vx = 0;
      b.vy = 0;
      continue;
    }
    b.vx *= next / speed;
    b.vy *= next / speed;
    b.x += b.vx * h;
    b.y += b.vy * h;
  }

  // colisão entre bolas (massas iguais)
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.inPlay) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.inPlay) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      // separa as bolas sobrepostas
      const overlap = (2 * R - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn <= 0) continue; // já estão se afastando
      const jImpulse = ((1 + BALL_RESTITUTION) / 2) * vn;
      a.vx -= jImpulse * nx;
      a.vy -= jImpulse * ny;
      b.vx += jImpulse * nx;
      b.vy += jImpulse * ny;

      if (ev.firstHit === null) {
        if (a.id === 0) ev.firstHit = b.id;
        else if (b.id === 0) ev.firstHit = a.id;
      }
    }
  }

  // tabelas e caçapas
  for (const b of balls) {
    if (!b.inPlay) continue;

    if (!inCornerMouth(b.y, H)) {
      if (b.x < R) bounceX(b, R, -1);
      else if (b.x > W - R) bounceX(b, W - R, 1);
    }
    if (!inLongRailMouth(b.x)) {
      if (b.y < R) bounceY(b, R, -1);
      else if (b.y > H - R) bounceY(b, H - R, 1);
    }

    const captured = POCKETS.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r);
    const escaped = b.x < -2 * R || b.x > W + 2 * R || b.y < -2 * R || b.y > H + 2 * R;
    if (captured || escaped) pot(b, ev);
  }
}

/** Avança a simulação `dt` segundos, em passos pequenos para nenhuma bola atravessar outra. */
export function step(balls: Ball[], dt: number, ev: ShotEvents) {
  const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  for (let i = 0; i < n; i++) substep(balls, dt / n, ev);
}

export type AimPreview = {
  /** Onde a branca vai estar no momento do contato (ou da tabela). */
  ghost: { x: number; y: number };
  hit: number | null;
  /** Direção da bola atingida e da branca após o contato. */
  objectDir: { x: number; y: number } | null;
  cueDir: { x: number; y: number } | null;
};

/** Linha de mira: primeira bola (ou tabela) no caminho da branca. */
export function aimPreview(balls: Ball[], angle: number): AimPreview | null {
  const cue = balls.find((b) => b.id === 0);
  if (!cue || !cue.inPlay) return null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  let best = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b.id === 0 || !b.inPlay) continue;
    const cx = b.x - cue.x;
    const cy = b.y - cue.y;
    const proj = cx * dx + cy * dy;
    if (proj <= 0) continue;
    const perp2 = cx * cx + cy * cy - proj * proj;
    if (perp2 >= 4 * R * R) continue;
    const t = proj - Math.sqrt(4 * R * R - perp2);
    if (t >= 0 && t < best) {
      best = t;
      hit = b;
    }
  }

  const tx = dx > 0 ? (W - R - cue.x) / dx : dx < 0 ? (R - cue.x) / dx : Infinity;
  const ty = dy > 0 ? (H - R - cue.y) / dy : dy < 0 ? (R - cue.y) / dy : Infinity;
  const tWall = Math.max(0, Math.min(tx, ty));
  if (!hit || tWall < best) {
    return {
      ghost: { x: cue.x + dx * tWall, y: cue.y + dy * tWall },
      hit: null,
      objectDir: null,
      cueDir: null,
    };
  }

  const gx = cue.x + dx * best;
  const gy = cue.y + dy * best;
  const nx = (hit.x - gx) / (2 * R);
  const ny = (hit.y - gy) / (2 * R);
  const along = dx * nx + dy * ny;
  const tx2 = dx - along * nx;
  const ty2 = dy - along * ny;
  const tLen = Math.hypot(tx2, ty2);
  return {
    ghost: { x: gx, y: gy },
    hit: hit.id,
    objectDir: { x: nx, y: ny },
    cueDir: tLen > 1e-6 ? { x: tx2 / tLen, y: ty2 / tLen } : null,
  };
}

/** A branca pode ficar aqui? (dentro da mesa e sem encostar em outra bola) */
export function isFreeSpot(balls: Ball[], x: number, y: number, ignoreId = 0): boolean {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  return balls.every(
    (b) => b.id === ignoreId || !b.inPlay || Math.hypot(b.x - x, b.y - y) >= 2 * R + 0.5,
  );
}
