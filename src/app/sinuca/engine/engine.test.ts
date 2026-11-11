import { describe, expect, it } from "vitest";
import { aimPreview, type Ball, H, HEAD_X, isMoving, newShotEvents, R, step, W } from "./physics";
import { formatRecord, formatTime, isBetter, parseRecord, recordKey } from "./records";
import {
  canPlaceCue,
  type GameState,
  type Mode,
  newGameState,
  objectBallIds,
  rackBalls,
  rerack,
  resolveShot,
  respot,
  type ShotResult,
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

  it("bola em direção à caçapa do canto cai e registra a caçapa", () => {
    const balls = [ball(0, 100, 100, -900, -900)];
    const ev = runUntilStopped(balls);
    expect(ev.potted).toEqual([0]);
    expect(ev.pocketOf[0]).toBe(0); // canto de cima, à esquerda
    expect(balls[0].inPlay).toBe(false);
  });

  it("bola em direção à caçapa do meio de baixo cai nela", () => {
    const ev = runUntilStopped([ball(5, W / 2, 300, 0, 900)]);
    expect(ev.potted).toEqual([5]);
    expect(ev.pocketOf[5]).toBe(4);
  });

  it("bola quica na tabela fora da boca da caçapa e fica na mesa", () => {
    const balls = [ball(2, 300, 250, 0, -800)];
    expect(runUntilStopped(balls).potted).toEqual([]);
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

  it("um quadro longo (0,1 s, PC lento) também não deixa bola atravessar", () => {
    const balls = [ball(0, 100, 250, 1700, 0), ball(1, 200, 250)];
    const ev = newShotEvents();
    step(balls, 0.1, ev);
    expect(ev.firstHit).toBe(1);
    expect(balls[1].x).toBeGreaterThan(balls[0].x + 2 * R - 0.01);
  });

  it("a mira encontra a primeira bola no caminho", () => {
    const p = aimPreview([ball(0, 200, 250), ball(1, 500, 250), ball(2, 400, 250)], 0)!;
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
  const ids = (balls: Ball[]) => balls.map((b) => b.id).sort((a, b) => a - b);
  const inside = (balls: Ball[]) => balls.every((b) => b.x > R && b.x < W - R && b.y > R && b.y < H - R);

  it.each(["tempo", "tacadas", "rotacao", "treino"] as Mode[])("%s: 15 bolas + branca, sem sobreposição", (mode) => {
    const balls = rackBalls(mode, 9, () => 0.42);
    expect(ids(balls)).toEqual([...Array(16).keys()]);
    expect(noOverlap(balls)).toBe(true);
    expect(inside(balls)).toBe(true);
    expect(balls.find((b) => b.id === 0)!.x).toBeLessThan(HEAD_X);
  });

  it("sequência de 9: losango com a 1 na ponta e a 9 no centro", () => {
    const balls = rackBalls("sequencia", 9);
    expect(ids(balls)).toEqual([...Array(10).keys()]);
    expect(noOverlap(balls)).toBe(true);
    const one = balls.find((b) => b.id === 1)!;
    const nine = balls.find((b) => b.id === 9)!;
    expect(nine.y).toBeCloseTo(H / 2, 5);
    expect(one.x).toBeLessThan(nine.x);
  });

  it("sequência de 3 (bolinho): só a 1, a 2 e a 3", () => {
    const balls = rackBalls("sequencia", 3);
    expect(ids(balls)).toEqual([0, 1, 2, 3]);
    expect(noOverlap(balls)).toBe(true);
  });

  it("respot procura um lugar livre", () => {
    const balls = rackBalls("sequencia", 3);
    const three = balls.find((b) => b.id === 3)!;
    three.inPlay = false;
    respot(balls, 3);
    expect(three.inPlay).toBe(true);
    expect(noOverlap(balls.filter((b) => b.inPlay))).toBe(true);
  });

  it("rerack devolve as 15 bolas e tira a branca do caminho", () => {
    const balls = rackBalls("rotacao");
    for (const b of balls) if (b.id !== 0) b.inPlay = false;
    const cue = balls.find((b) => b.id === 0)!;
    Object.assign(cue, { x: 760, y: H / 2 }); // em cima do triângulo
    rerack(balls);
    expect(balls.every((b) => b.inPlay)).toBe(true);
    expect(noOverlap(balls)).toBe(true);
    expect(cue.x).toBeLessThanOrEqual(HEAD_X);
  });

  it("bola na mão da saída só atrás da linha", () => {
    const balls = rackBalls("sequencia", 3);
    expect(canPlaceCue(balls, "cabeceira", HEAD_X - 10, 100)).toBe(true);
    expect(canPlaceCue(balls, "cabeceira", HEAD_X + 10, 100)).toBe(false);
    expect(canPlaceCue(balls, "livre", HEAD_X + 10, 100)).toBe(true);
  });
});

const shot = (firstHit: number | null, potted: number[], pocketOf: Record<number, number> = {}): ShotResult => ({
  firstHit,
  potted,
  pocketOf,
});
/** Estado depois da saída (sem bola na mão). */
const playing = (mode: Mode, over: Partial<GameState> = {}): GameState => ({
  ...newGameState(mode),
  isBreak: false,
  ballInHand: null,
  ...over,
});
const FIFTEEN = objectBallIds("tempo", 9);

describe("limpar a mesa (contra o relógio e menos tacadas)", () => {
  it("conta as tacadas e as bolas que faltam", () => {
    const r = resolveShot(playing("tacadas"), shot(1, [1, 2]), FIFTEEN);
    expect(r.state).toMatchObject({ shots: 1, over: false });
    expect(r.state.message).toMatch(/2 bolas na caçapa\. Faltam 13/);
  });

  it("branca na caçapa: +5 s no relógio e bola na mão", () => {
    const r = resolveShot(playing("tempo"), shot(3, [0]), FIFTEEN);
    expect(r.state).toMatchObject({ penaltyMs: 5000, fouls: 1, shots: 1, ballInHand: "livre" });
  });

  it("branca na caçapa: +1 tacada no modo tacadas", () => {
    const r = resolveShot(playing("tacadas"), shot(3, [0]), FIFTEEN);
    expect(r.state).toMatchObject({ shots: 2, fouls: 1, penaltyMs: 0 });
  });

  it("última bola na caçapa: mesa limpa", () => {
    const r = resolveShot(playing("tempo", { shots: 20 }), shot(7, [7]), [7]);
    expect(r.state).toMatchObject({ over: true, success: true, shots: 21 });
  });
});

describe("rotação cantada", () => {
  it("a saída é livre e não pontua", () => {
    const r = resolveShot(newGameState("rotacao"), shot(1, [3, 9]), FIFTEEN);
    expect(r.state).toMatchObject({ score: 0, over: false, isBreak: false });
  });

  it("bola na caçapa cantada vale ponto; em outra caçapa não vale", () => {
    const r = resolveShot(playing("rotacao", { calledPocket: 2 }), shot(5, [5, 6], { 5: 2, 6: 0 }), FIFTEEN);
    expect(r.state).toMatchObject({ score: 1, over: false, calledPocket: null });
  });

  it("errar a caçapa encerra a sequência", () => {
    const r = resolveShot(playing("rotacao", { calledPocket: 2, score: 7 }), shot(5, [5], { 5: 1 }), FIFTEEN);
    expect(r.state).toMatchObject({ score: 7, over: true });
    expect(r.state.message).toMatch(/caçapa escolhida. Fim da sequência./);
  });

  it("falta encerra a sequência, mesmo acertando a caçapa", () => {
    const r = resolveShot(playing("rotacao", { calledPocket: 2 }), shot(5, [5, 0], { 5: 2, 0: 3 }), FIFTEEN);
    expect(r.state).toMatchObject({ over: true, score: 0 });
  });

  it("limpar a mesa remonta as bolas e dá saída livre", () => {
    const r = resolveShot(playing("rotacao", { calledPocket: 4, score: 14 }), shot(8, [8], { 8: 4 }), [8]);
    expect(r.rerack).toBe(true);
    expect(r.state).toMatchObject({ score: 15, isBreak: true, over: false });
  });

  it("mostra a caçapa escolhida como alvo", () => {
    expect(targetLabel(playing("rotacao"), FIFTEEN)).toBe("escolha a caçapa");
    expect(targetLabel(playing("rotacao", { calledPocket: 1 }), FIFTEEN)).toBe("meio de cima");
  });
});

describe("sequência numérica", () => {
  const seq = (over: Partial<GameState> = {}) => playing("sequencia", over);

  it("na ordem: soma e aponta a próxima", () => {
    const r = resolveShot(seq(), shot(1, [1, 2]), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.state).toMatchObject({ score: 2, over: false });
    expect(r.state.message).toMatch(/Próxima: bola 3/);
  });

  it("bola fora de ordem encerra o jogo", () => {
    const r = resolveShot(seq({ score: 2 }), shot(3, [4]), [3, 4, 5, 6, 7, 8, 9]);
    expect(r.state).toMatchObject({ over: true, success: false, score: 2 });
    expect(r.state.message).toMatch(/bola 4 caiu fora de ordem/);
  });

  it("na saída, bola fora de ordem volta para a mesa", () => {
    const r = resolveShot(newGameState("sequencia"), shot(1, [1, 5]), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.respot).toEqual([5]);
    expect(r.state).toMatchObject({ over: false, score: 1 });
  });

  it("branca na caçapa custa uma tacada mas não encerra", () => {
    const r = resolveShot(seq(), shot(1, [0]), [1, 2, 3]);
    expect(r.state).toMatchObject({ over: false, shots: 2, ballInHand: "livre" });
  });

  it("encaçapar a última completa a sequência", () => {
    const r = resolveShot(seq({ seqSize: 3, score: 2, shots: 4 }), shot(3, [3]), [3]);
    expect(r.state).toMatchObject({ over: true, success: true, score: 3, shots: 5 });
  });
});

describe("treino livre", () => {
  it("não tem fim nem falta, só conta as bolas", () => {
    const r = resolveShot(playing("treino"), shot(null, [0, 4]), FIFTEEN);
    expect(r.state).toMatchObject({ over: false, score: 1, ballInHand: "livre" });
  });
});

describe("recordes", () => {
  it("cada modo tem a sua chave; treino não tem recorde", () => {
    expect(recordKey("tempo", 9)).toBe("tempo");
    expect(recordKey("sequencia", 3)).toBe("sequencia-3");
    expect(recordKey("treino", 9)).toBeNull();
  });

  it("tempo e tacadas: menor é melhor; rotação: maior é melhor", () => {
    expect(isBetter("tempo", 60_000, 70_000)).toBe(true);
    expect(isBetter("tacadas", 20, 18)).toBe(false);
    expect(isBetter("rotacao", 12, 9)).toBe(true);
    expect(isBetter("rotacao", 3, null)).toBe(true);
  });

  it("sequência: completar vence; depois menos tacadas; senão mais bolas", () => {
    const done = (shots: number) => ({ cleared: true, balls: 9, shots });
    const partial = (balls: number, shots = 10) => ({ cleared: false, balls, shots });
    expect(isBetter("sequencia-9", done(30), partial(8))).toBe(true);
    expect(isBetter("sequencia-9", partial(8), done(30))).toBe(false);
    expect(isBetter("sequencia-9", done(12), done(14))).toBe(true);
    expect(isBetter("sequencia-9", partial(5), partial(4))).toBe(true);
  });

  it("formata tempo e recordes", () => {
    expect(formatTime(83_450)).toBe("1:23.4");
    expect(formatTime(59_999)).toBe("0:59.9");
    expect(formatRecord("tacadas", 17)).toBe("17 tacadas");
    expect(formatRecord("rotacao", 1)).toBe("1 ponto");
    expect(formatRecord("sequencia-3", { cleared: false, balls: 2, shots: 4 })).toBe("2 de 3 bolas");
  });

  it("ignora valor salvo corrompido", () => {
    expect(parseRecord("{lixo")).toBeNull();
    expect(parseRecord('"texto"')).toBeNull();
    expect(parseRecord("-3")).toBeNull();
    expect(parseRecord("42")).toBe(42);
    expect(parseRecord('{"cleared":true,"balls":9,"shots":11,"x":1}')).toEqual({ cleared: true, balls: 9, shots: 11 });
  });
});
