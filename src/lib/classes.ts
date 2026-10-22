import type { Distribution } from "@/lib/metrics";

/** Classes da diversificação, na ordem e com as cores usadas em toda a interface. */
export const CLASSES: { key: keyof Distribution; nome: string; cor: string }[] = [
  { key: "rf", nome: "Renda fixa", cor: "var(--pine)" },
  { key: "rv", nome: "Renda variável", cor: "var(--tomato)" },
  { key: "ci", nome: "CI", cor: "var(--butter)" },
  { key: "int", nome: "Internacional", cor: "var(--ink)" },
];
