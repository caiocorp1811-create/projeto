import { type AimPreview, type Ball, H, HEAD_X, FOOT_X, POCKETS, R, W } from "./engine/physics";

/** Espessura da madeira em volta do pano, em unidades de mesa. */
export const RAIL = 44;
export const CANVAS_W = W + 2 * RAIL;
export const CANVAS_H = H + 2 * RAIL;

const BASE_COLORS: Record<number, string> = {
  1: "#f2c230",
  2: "#1f4fbf",
  3: "#d23224",
  4: "#5b2c8f",
  5: "#ef7a1a",
  6: "#1d7a45",
  7: "#7a1f1f",
  8: "#151515",
};

export const ballColor = (id: number) => (id === 0 ? "#f6f3ea" : BASE_COLORS[id > 8 ? id - 8 : id]);
export const isStripe = (id: number) => id > 8;

export function drawTable(ctx: CanvasRenderingContext2D, kitchenHint: boolean) {
  // madeira
  const wood = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  wood.addColorStop(0, "#6b4428");
  wood.addColorStop(0.5, "#4f311b");
  wood.addColorStop(1, "#3b2413");
  ctx.fillStyle = wood;
  roundRect(ctx, -RAIL, -RAIL, CANVAS_W, CANVAS_H, 26);
  ctx.fill();

  // tabelas (borracha) e pano
  ctx.fillStyle = "#1c5a42";
  roundRect(ctx, -12, -12, W + 24, H + 24, 8);
  ctx.fill();
  const cloth = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62);
  cloth.addColorStop(0, "#3a8f69");
  cloth.addColorStop(1, "#276f50");
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, W, H);

  // área da saída
  if (kitchenHint) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, HEAD_X, H);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(HEAD_X, 0);
  ctx.lineTo(HEAD_X, H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const x of [HEAD_X, FOOT_X]) {
    ctx.beginPath();
    ctx.arc(x, H / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // losangos na madeira
  ctx.fillStyle = "#e9dcc0";
  const diamond = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 3, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    diamond((W * i) / 8, -RAIL / 2 - 4);
    diamond((W * i) / 8, H + RAIL / 2 + 4);
  }
  for (let i = 1; i < 4; i++) {
    diamond(-RAIL / 2 - 4, (H * i) / 4);
    diamond(W + RAIL / 2 + 4, (H * i) / 4);
  }

  // caçapas
  for (const p of POCKETS) {
    const r = p.r > 25 ? 25 : 21;
    ctx.fillStyle = "#0d0f0e";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, b: Ball) {
  if (!b.inPlay) return;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(b.x + 2.5, b.y + 3.5, R, R * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
  ctx.clip();
  if (isStripe(b.id)) {
    ctx.fillStyle = "#f6f3ea";
    ctx.fillRect(b.x - R, b.y - R, 2 * R, 2 * R);
    ctx.fillStyle = ballColor(b.id);
    ctx.fillRect(b.x - R, b.y - R * 0.55, 2 * R, R * 1.1);
  } else {
    ctx.fillStyle = ballColor(b.id);
    ctx.fillRect(b.x - R, b.y - R, 2 * R, 2 * R);
  }
  if (b.id !== 0) {
    ctx.fillStyle = "#fbf8f2";
    ctx.beginPath();
    ctx.arc(b.x, b.y, R * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17191a";
    ctx.font = `700 ${b.id > 9 ? 8 : 9}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(b.id), b.x, b.y + 0.5);
  }
  const shine = ctx.createRadialGradient(b.x - R * 0.4, b.y - R * 0.45, 1, b.x, b.y, R * 1.1);
  shine.addColorStop(0, "rgba(255,255,255,0.55)");
  shine.addColorStop(0.35, "rgba(255,255,255,0.08)");
  shine.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = shine;
  ctx.fillRect(b.x - R, b.y - R, 2 * R, 2 * R);
  ctx.restore();
}

export function drawAim(ctx: CanvasRenderingContext2D, cue: Ball, p: AimPreview) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(cue.x, cue.y);
  ctx.lineTo(p.ghost.x, p.ghost.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(p.ghost.x, p.ghost.y, R, 0, Math.PI * 2);
  ctx.stroke();

  if (p.objectDir && p.hit !== null) {
    const sx = p.ghost.x + p.objectDir.x * 2 * R;
    const sy = p.ghost.y + p.objectDir.y * 2 * R;
    ctx.strokeStyle = "rgba(242,201,76,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + p.objectDir.x * 70, sy + p.objectDir.y * 70);
    ctx.stroke();
  }
  if (p.cueDir) {
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.ghost.x, p.ghost.y);
    ctx.lineTo(p.ghost.x + p.cueDir.x * 45, p.ghost.y + p.cueDir.y * 45);
    ctx.stroke();
  }
  ctx.restore();
}

/** Taco atrás da branca; `pull` (0–1) afasta o taco conforme a força. */
export function drawCue(ctx: CanvasRenderingContext2D, cue: Ball, angle: number, pull: number) {
  ctx.save();
  ctx.translate(cue.x, cue.y);
  ctx.rotate(angle + Math.PI);
  const start = R + 6 + pull * 90;
  const length = 420;
  const grad = ctx.createLinearGradient(start, 0, start + length, 0);
  grad.addColorStop(0, "#f4efe2");
  grad.addColorStop(0.03, "#3a6fb0");
  grad.addColorStop(0.05, "#e7cf9a");
  grad.addColorStop(0.7, "#b98a4f");
  grad.addColorStop(0.72, "#2b1a0e");
  grad.addColorStop(1, "#1a0f08");
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(start + 3, 3 - 2.5);
  ctx.lineTo(start + length + 3, 3 - 6);
  ctx.lineTo(start + length + 3, 3 + 6);
  ctx.lineTo(start + 3, 3 + 2.5);
  ctx.fill();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(start, -2.5);
  ctx.lineTo(start + length, -6);
  ctx.lineTo(start + length, 6);
  ctx.lineTo(start, 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPlacementRing(ctx: CanvasRenderingContext2D, cue: Ball, t: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(242,201,76,${0.55 + 0.35 * Math.sin(t / 220)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cue.x, cue.y, R + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Rotação cantada: anel na caçapa escolhida, ou anéis piscando enquanto falta escolher. */
export function drawPocketMarks(ctx: CanvasRenderingContext2D, called: number | null, awaiting: boolean, t: number) {
  ctx.save();
  POCKETS.forEach((p, i) => {
    const r = (p.r > 25 ? 25 : 21) + 6;
    if (i === called) {
      ctx.strokeStyle = "#f2c94c";
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
    } else if (awaiting) {
      ctx.strokeStyle = `rgba(242,201,76,${0.3 + 0.3 * Math.sin(t / 260)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
    } else {
      return;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}
