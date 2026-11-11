import { useMemo, useSyncExternalStore } from "react";
import { parseRecord, type RecordKey, type RecordValue } from "./engine/records";

// Recordes ficam só no navegador de quem joga (localStorage). Se o acesso ao
// armazenamento falhar (aba anônima, bloqueio), o jogo segue sem recorde.
const EVENT = "sinuca-recorde";
const storageKey = (key: RecordKey) => `sinuca:recorde:${key}`;

function readRaw(key: RecordKey): string | null {
  try {
    return window.localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

export const readRecord = (key: RecordKey) => parseRecord(readRaw(key));

export function saveRecord(key: RecordKey, value: RecordValue) {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Recorde atual do modo; null no servidor e enquanto não houver recorde. */
export function useRecord(key: RecordKey | null): RecordValue | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? readRaw(key) : null),
    () => null,
  );
  return useMemo(() => parseRecord(raw), [raw]);
}
