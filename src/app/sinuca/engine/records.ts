import { type Mode, pointsLabel, type SeqSize } from "./rules";

/** Resultado da sequência: completou? quantas bolas em ordem? em quantas tacadas? */
export type SeqResult = { cleared: boolean; balls: number; shots: number };
export type RecordKey = "tempo" | "tacadas" | "rotacao" | "sequencia-3" | "sequencia-9";
/** Tempo em ms, tacadas ou pontos; ou o resultado da sequência. */
export type RecordValue = number | SeqResult;

export function recordKey(mode: Mode, seqSize: SeqSize): RecordKey | null {
  if (mode === "treino") return null;
  if (mode === "sequencia") return `sequencia-${seqSize}`;
  return mode;
}

const isSeq = (v: RecordValue): v is SeqResult => typeof v === "object";

/** O novo resultado bate o recorde atual? */
export function isBetter(key: RecordKey, candidate: RecordValue, current: RecordValue | null): boolean {
  if (current === null) return true;
  if (isSeq(candidate) || isSeq(current)) {
    if (!isSeq(candidate) || !isSeq(current)) return false;
    if (candidate.cleared !== current.cleared) return candidate.cleared;
    if (candidate.cleared) return candidate.shots < current.shots;
    if (candidate.balls !== current.balls) return candidate.balls > current.balls;
    return candidate.shots < current.shots;
  }
  return key === "rotacao" ? candidate > current : candidate < current;
}

/** 83_450 ms -> "1:23.4" */
export function formatTime(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const min = Math.floor(tenths / 600);
  const sec = Math.floor((tenths % 600) / 10);
  return `${min}:${String(sec).padStart(2, "0")}.${tenths % 10}`;
}

export function formatRecord(key: RecordKey, value: RecordValue): string {
  if (isSeq(value)) {
    const total = key === "sequencia-3" ? 3 : 9;
    return value.cleared ? `completa em ${value.shots} tacadas` : `${value.balls} de ${total} bolas`;
  }
  if (key === "tempo") return formatTime(value);
  if (key === "tacadas") return `${value} tacadas`;
  return pointsLabel(value);
}

/** Lê um valor salvo, descartando qualquer coisa fora do formato esperado. */
export function parseRecord(raw: string | null): RecordValue | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (
      v &&
      typeof v === "object" &&
      typeof (v as SeqResult).cleared === "boolean" &&
      typeof (v as SeqResult).balls === "number" &&
      typeof (v as SeqResult).shots === "number"
    ) {
      const { cleared, balls, shots } = v as SeqResult;
      return { cleared, balls, shots };
    }
  } catch {
    // valor corrompido: ignora
  }
  return null;
}
