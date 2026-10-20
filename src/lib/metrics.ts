/**
 * Cálculos factuais sobre a carteira. Funções puras (sem banco), fáceis de testar.
 *
 * Importante: `variacao_saldo` é saldo atual menos saldo anterior. Ela mistura
 * aportes/resgates com rentabilidade; NÃO é rentabilidade.
 */

export type Snapshot = { asOf: string; balance: number };

/** Frações de 0 a 1. `int` = INT. da planilha. */
export type Distribution = { rf: number; rv: number; ci: number; int: number };

export type ClientData = {
  id: string;
  code: string;
  name: string;
  openedOn: string | null;
  /** Em ordem crescente de data. */
  snapshots: Snapshot[];
  /** Diversificação mais recente, se houver. */
  allocation: Distribution | null;
};

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const money = (n: number) => round(n, 2);

const CLASSES = ["rf", "rv", "ci", "int"] as const;
const emptyDistribution = (): Distribution => ({ rf: 0, rv: 0, ci: 0, int: 0 });

function delta(current: number, previous: number | null) {
  if (previous === null) return { variacao_saldo: null, variacao_saldo_pct: null };
  return {
    variacao_saldo: money(current - previous),
    // sem base de comparação (saldo anterior zero) não existe percentual
    variacao_saldo_pct: previous > 0 ? round((current - previous) / previous, 6) : null,
  };
}

/** Data de referência = fechamento mais recente de toda a base. */
export function referenceDate(clients: ClientData[]): string | null {
  let max: string | null = null;
  for (const c of clients) {
    for (const s of c.snapshots) if (max === null || s.asOf > max) max = s.asOf;
  }
  return max;
}

export function valueByClass(balance: number, dist: Distribution | null) {
  if (!dist) return null;
  return {
    rf: money(balance * dist.rf),
    rv: money(balance * dist.rv),
    ci: money(balance * dist.ci),
    int: money(balance * dist.int),
  };
}

export function clientSummary(client: ClientData, refDate: string | null) {
  const { snapshots } = client;
  const last = snapshots.at(-1) ?? null;
  const prev = snapshots.at(-2) ?? null;
  const saldo = last?.balance ?? null;
  return {
    id: client.id,
    codigo: client.code,
    nome: client.name,
    data_abertura: client.openedOn,
    saldo_atual: saldo,
    data_saldo: last?.asOf ?? null,
    // o último fechamento do cliente é anterior ao da base
    saldo_desatualizado: last !== null && refDate !== null && last.asOf < refDate,
    saldo_anterior: prev?.balance ?? null,
    data_saldo_anterior: prev?.asOf ?? null,
    ...(last ? delta(last.balance, prev?.balance ?? null) : delta(0, null)),
    ativo: saldo !== null && saldo > 0,
    distribuicao: client.allocation,
  };
}

export function clientHistory(client: ClientData) {
  return client.snapshots.map((s, i) => ({
    data: s.asOf,
    saldo: s.balance,
    ...delta(s.balance, client.snapshots[i - 1]?.balance ?? null),
  }));
}

export function clientDetail(client: ClientData, refDate: string | null) {
  const summary = clientSummary(client, refDate);
  return {
    ...summary,
    valor_por_classe:
      summary.saldo_atual === null
        ? null
        : valueByClass(summary.saldo_atual, client.allocation),
    historico: clientHistory(client),
  };
}

/**
 * Versão do cliente para mostrar a ele. Lista explícita de campos (allowlist):
 * qualquer campo novo no detalhe interno NÃO vaza para cá por acidente.
 */
export function presentationView(client: ClientData, refDate: string | null) {
  const d = clientDetail(client, refDate);
  return {
    id: d.id,
    nome: d.nome,
    data_abertura: d.data_abertura,
    saldo_atual: d.saldo_atual,
    data_saldo: d.data_saldo,
    variacao_saldo: d.variacao_saldo,
    variacao_saldo_pct: d.variacao_saldo_pct,
    distribuicao: d.distribuicao,
    valor_por_classe: d.valor_por_classe,
    historico: d.historico,
  };
}

export function dashboard(clients: ClientData[]) {
  const refDate = referenceDate(clients);

  // patrimônio por data = soma dos saldos informados naquela data
  const byDate = new Map<string, { total: number; n: number }>();
  for (const c of clients) {
    for (const s of c.snapshots) {
      const e = byDate.get(s.asOf) ?? { total: 0, n: 0 };
      e.total += s.balance;
      e.n += 1;
      byDate.set(s.asOf, e);
    }
  }
  const evolucao = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, e]) => ({
      data,
      patrimonio: money(e.total),
      clientes_com_saldo: e.n,
    }));

  const atual = evolucao.at(-1) ?? null;
  const anterior = evolucao.at(-2) ?? null;

  // distribuição consolidada: média ponderada pelo saldo atual de quem tem diversificação
  let ativos = 0;
  let coberto = 0;
  const porClasse = emptyDistribution();
  for (const c of clients) {
    const last = c.snapshots.at(-1);
    if (!last || last.asOf !== refDate || last.balance <= 0) continue;
    ativos += 1;
    if (!c.allocation) continue;
    coberto += last.balance;
    for (const k of CLASSES) porClasse[k] += last.balance * c.allocation[k];
  }
  const patrimonio = atual?.patrimonio ?? 0;
  const distribuicao =
    coberto > 0
      ? {
          rf: round(porClasse.rf / coberto, 6),
          rv: round(porClasse.rv / coberto, 6),
          ci: round(porClasse.ci / coberto, 6),
          int: round(porClasse.int / coberto, 6),
        }
      : null;

  return {
    data_referencia: refDate,
    data_anterior: anterior?.data ?? null,
    total_clientes: clients.length,
    clientes_ativos: ativos,
    clientes_zerados: clients.length - ativos,
    patrimonio_total: patrimonio,
    ...(atual ? delta(atual.patrimonio, anterior?.patrimonio ?? null) : delta(0, null)),
    evolucao,
    distribuicao,
    valor_por_classe: {
      rf: money(porClasse.rf),
      rv: money(porClasse.rv),
      ci: money(porClasse.ci),
      int: money(porClasse.int),
    },
    // fração do patrimônio ativo que tem diversificação informada
    cobertura_distribuicao:
      patrimonio > 0 ? round(Math.min(coberto / patrimonio, 1), 4) : null,
  };
}

export type ListSort = "nome" | "saldo" | "variacao";

export function listClients(
  clients: ClientData[],
  opts: { q?: string; ativo?: boolean; sort?: ListSort; desc?: boolean } = {},
) {
  const refDate = referenceDate(clients);
  const q = opts.q?.trim().toLowerCase();
  let rows = clients.map((c) => clientSummary(c, refDate));
  if (q) rows = rows.filter((r) => r.nome.toLowerCase().includes(q) || r.codigo.includes(q));
  if (opts.ativo !== undefined) rows = rows.filter((r) => r.ativo === opts.ativo);

  const sort = opts.sort ?? "nome";
  const dir = opts.desc ? -1 : 1;
  const num = (v: number | null) => v ?? Number.NEGATIVE_INFINITY;
  rows.sort((a, b) => {
    const cmp =
      sort === "saldo"
        ? num(a.saldo_atual) - num(b.saldo_atual)
        : sort === "variacao"
          ? num(a.variacao_saldo_pct) - num(b.variacao_saldo_pct)
          : a.nome.localeCompare(b.nome, "pt-BR");
    return (Number.isNaN(cmp) ? 0 : cmp) * dir || a.nome.localeCompare(b.nome, "pt-BR");
  });
  return { data_referencia: refDate, total: rows.length, clientes: rows };
}
