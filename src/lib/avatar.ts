/** Pares fundo/texto dos avatares de iniciais. */
const PALETA = [
  ["var(--butter)", "var(--ink)"],
  ["var(--pine)", "var(--on-ink)"],
  ["var(--tomato)", "var(--on-ink)"],
  ["var(--ink)", "var(--on-ink)"],
  ["#f2d3bd", "#7a2e17"],
  ["#cfdfcd", "#1f4238"],
] as const;

/** Cor estável para um cliente (a mesma em todas as telas). */
export function corAvatar(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [bg, fg] = PALETA[h % PALETA.length];
  return { background: bg, color: fg };
}
