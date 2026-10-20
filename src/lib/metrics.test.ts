import { describe, expect, it } from "vitest";
import {
  type ClientData,
  clientDetail,
  dashboard,
  listClients,
  presentationView,
  referenceDate,
} from "./metrics";

const D1 = "2026-09-11";
const D2 = "2026-10-09";

const client = (over: Partial<ClientData> & { id: string }): ClientData => ({
  code: over.id,
  name: `Cliente ${over.id}`,
  openedOn: null,
  snapshots: [],
  allocation: null,
  ...over,
});

const A = client({
  id: "A",
  name: "Ana",
  snapshots: [
    { asOf: D1, balance: 1000 },
    { asOf: D2, balance: 1100 },
  ],
  allocation: { rf: 0.6, rv: 0.4, ci: 0, int: 0 },
});
// conta nova: saldo zero no 1º fechamento
const B = client({
  id: "B",
  name: "Bruno",
  snapshots: [
    { asOf: D1, balance: 0 },
    { asOf: D2, balance: 500 },
  ],
  allocation: { rf: 1, rv: 0, ci: 0, int: 0 },
});
// só tem o 1º fechamento, com saldo zero
const C = client({ id: "C", name: "Carla", snapshots: [{ asOf: D1, balance: 0 }] });
// ativo mas sem diversificação informada
const E = client({
  id: "E",
  name: "Edu",
  snapshots: [
    { asOf: D1, balance: 200 },
    { asOf: D2, balance: 100 },
  ],
});
const all = [A, B, C, E];

describe("referenceDate", () => {
  it("é o fechamento mais recente da base", () => {
    expect(referenceDate(all)).toBe(D2);
    expect(referenceDate([])).toBeNull();
  });
});

describe("clientDetail", () => {
  it("calcula variação em valor e em %", () => {
    const d = clientDetail(A, D2);
    expect(d).toMatchObject({
      saldo_atual: 1100,
      saldo_anterior: 1000,
      variacao_saldo: 100,
      variacao_saldo_pct: 0.1,
      ativo: true,
      saldo_desatualizado: false,
    });
    expect(d.valor_por_classe).toEqual({ rf: 660, rv: 440, ci: 0, int: 0 });
    expect(d.historico).toEqual([
      { data: D1, saldo: 1000, variacao_saldo: null, variacao_saldo_pct: null },
      { data: D2, saldo: 1100, variacao_saldo: 100, variacao_saldo_pct: 0.1 },
    ]);
  });

  it("não inventa percentual quando o saldo anterior é zero", () => {
    const d = clientDetail(B, D2);
    expect(d.variacao_saldo).toBe(500);
    expect(d.variacao_saldo_pct).toBeNull();
  });

  it("queda no saldo é negativa", () => {
    expect(clientDetail(E, D2)).toMatchObject({
      variacao_saldo: -100,
      variacao_saldo_pct: -0.5,
    });
  });

  it("marca saldo desatualizado e inativo; sem 2º fechamento não há variação", () => {
    expect(clientDetail(C, D2)).toMatchObject({
      saldo_atual: 0,
      ativo: false,
      saldo_desatualizado: true,
      variacao_saldo: null,
    });
  });

  it("cliente sem nenhum saldo", () => {
    const d = clientDetail(client({ id: "Z" }), D2);
    expect(d).toMatchObject({ saldo_atual: null, ativo: false, historico: [] });
    expect(d.valor_por_classe).toBeNull();
  });
});

describe("dashboard", () => {
  const d = dashboard(all);

  it("soma o patrimônio por data e compara os dois últimos fechamentos", () => {
    expect(d.evolucao).toEqual([
      { data: D1, patrimonio: 1200, clientes_com_saldo: 4 },
      { data: D2, patrimonio: 1700, clientes_com_saldo: 3 },
    ]);
    expect(d).toMatchObject({
      data_referencia: D2,
      data_anterior: D1,
      patrimonio_total: 1700,
      variacao_saldo: 500,
    });
    expect(d.variacao_saldo_pct).toBeCloseTo(0.416667, 5);
  });

  it("conta clientes ativos e zerados", () => {
    expect(d).toMatchObject({ total_clientes: 4, clientes_ativos: 3, clientes_zerados: 1 });
  });

  it("distribuição consolidada é ponderada pelo saldo e informa a cobertura", () => {
    // coberto: A 1100 (60/40) + B 500 (100% RF) = 1600; E (100) fica sem diversificação
    expect(d.valor_por_classe).toEqual({ rf: 1160, rv: 440, ci: 0, int: 0 });
    expect(d.distribuicao).toEqual({ rf: 0.725, rv: 0.275, ci: 0, int: 0 });
    expect(d.cobertura_distribuicao).toBeCloseTo(1600 / 1700, 4);
  });

  it("base vazia não quebra", () => {
    expect(dashboard([])).toMatchObject({
      data_referencia: null,
      patrimonio_total: 0,
      variacao_saldo: null,
      distribuicao: null,
      evolucao: [],
    });
  });
});

describe("listClients", () => {
  it("ordena por nome por padrão e filtra por busca e por ativo", () => {
    expect(listClients(all).clientes.map((c) => c.nome)).toEqual([
      "Ana",
      "Bruno",
      "Carla",
      "Edu",
    ]);
    expect(listClients(all, { q: "bru" }).clientes).toHaveLength(1);
    expect(listClients(all, { ativo: false }).clientes.map((c) => c.id)).toEqual(["C"]);
  });

  it("ordena por saldo decrescente", () => {
    const ids = listClients(all, { sort: "saldo", desc: true }).clientes.map((c) => c.id);
    expect(ids).toEqual(["A", "B", "E", "C"]);
  });
});

describe("presentationView (o que o cliente pode ver)", () => {
  it("expõe só campos permitidos", () => {
    const view = presentationView(A, D2);
    expect(Object.keys(view).sort()).toEqual(
      [
        "id",
        "nome",
        "data_abertura",
        "saldo_atual",
        "data_saldo",
        "variacao_saldo",
        "variacao_saldo_pct",
        "distribuicao",
        "valor_por_classe",
        "historico",
      ].sort(),
    );
  });

  it("não carrega código interno, notas nem tarefas, mesmo que existam no objeto", () => {
    const polluted = {
      ...A,
      notas: [{ body: "segredo" }],
      tarefas: [{ title: "ligar" }],
    } as ClientData;
    const json = JSON.stringify(presentationView(polluted, D2));
    expect(json).not.toMatch(/segredo|ligar|notas|tarefas|codigo/);
  });
});
