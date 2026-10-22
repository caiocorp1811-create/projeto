/**
 * Formatação para a tela. A API manda números crus (reais como número,
 * percentuais como fração de 0 a 1, datas AAAA-MM-DD); tudo vira texto aqui.
 */

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlInteiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** R$ 12.345,67 */
export const brl = (v: number) => brlFmt.format(v);

/** R$ 12.346 (sem centavos, para números grandes de destaque) */
export const brlRedondo = (v: number) => brlInteiro.format(v);

/** R$ 254,3 mil · R$ 1,25 mi */
export function brlCompacto(v: number) {
  const abs = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  const num = (n: number, casas: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
  if (abs >= 1_000_000) return `${sinal}R$ ${num(abs / 1_000_000, 2)} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${num(abs / 1_000, 1)} mil`;
  return `${sinal}R$ ${num(abs, 0)}`;
}

/** Valor com sinal: +R$ 1.234,00 / −R$ 50,00 */
export function brlSinal(v: number) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${brl(Math.abs(v))}`;
}

/** Fração → "52%" (ou "52,3%" com casas). */
export function pct(frac: number, casas = 0) {
  return `${(frac * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** Fração → "+2,6%" / "−1,4%". */
export function pctSinal(frac: number, casas = 1) {
  const s = pct(Math.abs(frac), casas);
  return frac > 0 ? `+${s}` : frac < 0 ? `−${s}` : s;
}

/** "2026-10-09" → "09/10/2026" */
export function data(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-10-09" → "09/10" */
export function diaMes(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-09" → "out/26" */
export function mesAno(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

/** "2026-10-09" → { dia: "09", mes: "out" } */
export function diaEMes(iso: string) {
  const [, m, d] = iso.split("-");
  return { dia: d, mes: MESES[Number(m) - 1] };
}

/** Data e hora de um timestamp ISO, no fuso de São Paulo: "21/10/2026 14:32". */
export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

/** Hoje (AAAA-MM-DD) no fuso de São Paulo, igual ao backend usa para "atrasada". */
export function hojeSP(agora = new Date()) {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somaDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const MINUSCULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/** "ANDERSON RODRIGUES DA SILVA" → "Anderson Rodrigues da Silva" */
export function nomeProprio(nome: string) {
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

/** "Anderson Rodrigues da Silva" → "AS" (primeiro e último nome) */
export function iniciais(nome: string) {
  const partes = nome.split(/\s+/).filter((p) => p && !MINUSCULAS.has(p.toLowerCase()));
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** "Anderson Rodrigues da Silva" → "Anderson Silva" (para cartões pequenos) */
export function nomeCurto(nome: string) {
  const partes = nomeProprio(nome).split(" ").filter((p) => !MINUSCULAS.has(p));
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0] ?? nome;
}
