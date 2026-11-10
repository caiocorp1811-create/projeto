import { describe, expect, it } from "vitest";
import {
  aimPreview,
  type Ball,
  H,
  HEAD_X,
  isMoving,
  newShotEvents,
  R,
  step,
  W,
} from "./physics";
import {
  canPlaceCue,
  type GameState,
  groupOf,
  newGameState,
  rackBalls,
  resolveShot,
  respot,
  targetLabel,
} from "./rules";

const ball = (id: number, x: number, y: number, vx = 0, vy = 0): Ball => ({ id, x, y, vx, vy, inPlay: true });

/** Roda a física até tudo parar (ou até 20 s simulados). */
function runUntilStopped(balls: Ball[]) {
  const ev = newShotEvents();
  for (let t = 0; t < 20 && (t === 0 || isMoving(balls)); t += 1 / 60) step(balls, 1 / 60, ev);
  return ev;
}

describe("física", () => {
  it("tacada reta em bola parada: a branca para e a bola segue", () => {
    const balls = [ball(0, 300, 250, 800, 0), ball(1, 400, 250)];
    const ev = newShotEvents();
    for (let i = 0; i < 12; i++) step(balls, 1 / 60, ev);
    expect(ev.firstHit).toBe(1);
    expect(Math.abs(balls[0].vx)).toBeLessThan(60);
    expect(balls[1].vx).toBeGreaterThan(600);
  });

  it("bola em direção à caçapa do canto cai", () => {
    const balls = [ball(0, 100, 100, -900, -900)];
    const ev = runUntilStopped(balls);
    expect(ev.potted).toEqual([0]);
    expect(balls[0].inPlay).toBe(false);
  });

  it("bola em direção à caçapa do meio cai", () => {
    const balls = [ball(5, W / 2, 200, 0, -900)];
    expect(runUntilStopped(balls).potted).toEqual([5]);
  });

  it("bola quica na tabela fora da boca da caçapa e fica na mesa", () => {
    const balls = [ball(2, 300, 250, 0, -800)];
    const ev = runUntilStopped(balls);
    expect(ev.potted).toEqual([]);
    expect(balls[0].y).toBeGreaterThanOrEqual(R);
    expect(balls[0].y).toBeLessThanOrEqual(H - R);
  });

  it("o atrito para a bola", () => {
    const balls = [ball(3, 300, 250, 300, 0)];
    runUntilStopped(balls);
    expect(isMoving(balls)).toBe(false);
  });

  it("bolas nunca se atravessam numa tacada forte", () => {
    const balls = [ball(0, 100, 250, 1700, 0), ball(1, 140, 250)];
    const ev = newShotEvents();
    step(balls, 1 / 30, ev);
    expect(ev.firstHit).toBe(1);
    expect(balls[1].x).toBeGreaterThan(balls[0].x);
  });

  it("a mira encontra a primeira bola no caminho", () => {
    const balls = [ball(0, 200, 250), ball(1, 500, 250), ball(2, 400, 250)];
    const p = aimPreview(balls, 0)!;
    expect(p.hit).toBe(2);
    expect(p.ghost.x).toBeCloseTo(400 - 2 * R, 5);
    expect(p.objectDir!.x).toBeCloseTo(1, 5);
  });

  it("a mira sem bola no caminho para na tabela", () => {
    const p = aimPreview([ball(0, 200, 250)], Math.PI)!;
    expect(p.hit).toBeNull();
    expect(p.ghost.x).toBeCloseTo(R, 5);
  });
});

describe("montagem da mesa", () => {
  const noOverlap = (balls: Ball[]) =>
    balls.every((a, i) => balls.slice(i + 1).every((b) => Math.hypot(a.x - b.x, a.y - b.y) >= 2 * R));

  it("todas: 15 bolas + branca, 8 no centro do triângulo, sem sobreposição", () => {
    const balls = rackBalls("todas", () => 0.42);
    expect(balls.map((b) => b.id).sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    expect(noOverlap(balls)).toBe(true);
    const eight = balls.find((b) => b.id === 8)!;
    expect(eight.y).toBeCloseTo(H / 2, 5);
    expect(balls.every((b) => b.x > R && b.x < W - R && b.y > R && b.y < H - R)).toBe(true);
    expect(balls.find((b) => b.id === 0)!.x).toBeLessThan(HEAD_X);
  });

  it("bolinho: só as bolas 1, 2 e 3 + branca", () => {
    const balls = rackBalls("bolinho");
    expect(balls.map((b) => b.id).sort()).toEqual([0, 1, 2, 3]);
    expect(noOverlap(balls)).toBe(true);
  });

  it("respot procura um lugar livre", () => {
    const balls = rackBalls("bolinho");
    const three = balls.find((b) => b.id === 3)!;
    three.inPlay = false;
    respot(balls, 3);
    expect(three.inPlay).toBe(true);
    expect(noOverlap(balls.filter((b) => b.inPlay))).toBe(true);
  });

  it("bola na mão da saída só atrás da linha", () => {
    const balls = rackBalls("bolinho");
    expect(canPlaceCue(balls, "cabeceira", HEAD_X - 10, 100)).toBe(true);
    expect(canPlaceCue(balls, "cabeceira", HEAD_X + 10, 100)).toBe(false);
    expect(canPlaceCue(balls, "livre", HEAD_X + 10, 100)).toBe(true);
  });
});

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const playing = (over: Partial<GameState> = {}): GameState => ({
  ...newGameState("todas"),
  isBreak: false,
  ballInHand: null,
  ...over,
});

describe("regras: todas as bolas (bola 8)", () => {
  it("saída com bola encaçapada: continua e a mesa segue aberta", () => {
    const r = resolveShot(newGameState("todas"), { firstHit: 1, potted: [3, 11] }, ALL);
    expect(r.state).toMatchObject({ turn: 0, groups: [null, null], isBreak: false });
  });

  it("primeira bola encaçapada depois da saída define os grupos", () => {
    const r = resolveShot(playing({ turn: 1 }), { firstHit: 12, potted: [12] }, ALL);
    expect(r.state.groups).toEqual(["lisas", "listradas"]);
    expect(r.state.turn).toBe(1);
  });

  it("não encaçapou: passa a vez", () => {
    const r = resolveShot(playing(), { firstHit: 2, potted: [] }, ALL);
    expect(r.state).toMatchObject({ turn: 1, ballInHand: null });
  });

  it("branca na caçapa é falta: bola na mão livre para o adversário", () => {
    const r = resolveShot(playing({ groups: ["lisas", "listradas"] }), { firstHit: 2, potted: [2, 0] }, ALL);
    expect(r.state).toMatchObject({ turn: 1, ballInHand: "livre" });
    expect(r.state.message).toMatch(/branca/);
  });

  it("acertar primeiro a bola do adversário é falta", () => {
    const r = resolveShot(playing({ groups: ["lisas", "listradas"] }), { firstHit: 9, potted: [] }, ALL);
    expect(r.state).toMatchObject({ turn: 1, ballInHand: "livre" });
  });

  it("não acertar nada é falta", () => {
    const r = resolveShot(playing(), { firstHit: null, potted: [] }, ALL);
    expect(r.state.ballInHand).toBe("livre");
  });

  it("encaçapar a 8 antes da hora perde", () => {
    const r = resolveShot(playing({ groups: ["lisas", "listradas"] }), { firstHit: 3, potted: [8] }, ALL);
    expect(r.state.winner).toBe(1);
  });

  it("encaçapar a 8 depois de limpar as suas vence", () => {
    const onTable = [8, 9, 10];
    const r = resolveShot(playing({ groups: ["lisas", "listradas"] }), { firstHit: 8, potted: [8] }, onTable);
    expect(r.state.winner).toBe(0);
    expect(targetLabel(playing({ groups: ["lisas", "listradas"] }), onTable)).toBe("bola 8");
  });

  it("8 com a branca junto perde, mesmo na vez da 8", () => {
    const r = resolveShot(playing({ groups: ["lisas", "listradas"] }), { firstHit: 8, potted: [8, 0] }, [8, 9]);
    expect(r.state.winner).toBe(1);
  });

  it("8 na saída volta para a mesa e a jogada segue a regra normal", () => {
    const r = resolveShot(newGameState("todas"), { firstHit: 1, potted: [8, 4] }, ALL);
    expect(r.respot).toEqual([8]);
    expect(r.state).toMatchObject({ winner: null, turn: 0 });
    const r2 = resolveShot(newGameState("todas"), { firstHit: 1, potted: [8] }, ALL);
    expect(r2.state).toMatchObject({ winner: null, turn: 1 });
  });

  it("classifica lisas e listradas", () => {
    expect([1, 7, 8, 9, 15, 0].map(groupOf)).toEqual(["lisas", "lisas", null, "listradas", "listradas", null]);
  });
});

describe("regras: bolinho (3 bolas)", () => {
  const start = () => ({ ...newGameState("bolinho"), isBreak: false, ballInHand: null }) as GameState;

  it("tem que acertar a menor bola primeiro", () => {
    const r = resolveShot(start(), { firstHit: 2, potted: [2] }, [1, 2, 3]);
    expect(r.state).toMatchObject({ turn: 1, ballInHand: "livre" });
    expect(targetLabel(start(), [2, 3])).toBe("bola 2");
  });

  it("encaçapou certo: continua", () => {
    const r = resolveShot(start(), { firstHit: 1, potted: [1] }, [1, 2, 3]);
    expect(r.state).toMatchObject({ turn: 0, winner: null });
  });

  it("encaçapar a 3 sem falta vence (vale combinação)", () => {
    const r = resolveShot(start(), { firstHit: 1, potted: [3] }, [1, 2, 3]);
    expect(r.state.winner).toBe(0);
  });

  it("a 3 com falta volta para a mesa e o adversário ganha bola na mão", () => {
    const r = resolveShot(start(), { firstHit: 2, potted: [3] }, [1, 2, 3]);
    expect(r.respot).toEqual([3]);
    expect(r.state).toMatchObject({ winner: null, turn: 1, ballInHand: "livre" });
  });
});
