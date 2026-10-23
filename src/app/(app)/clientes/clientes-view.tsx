"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconArrowUpRight, IconSearch, IconUpload } from "@/components/icons";
import { ClassLegend, DistributionBar } from "@/components/ui/distribution";
import ui from "@/components/ui/ui.module.css";
import type { ClientSummary } from "@/lib/api/types";
import { corAvatar } from "@/lib/avatar";
import { brl, brlSinal, diaMes, iniciais, mesAno, nomeProprio, pctSinal } from "@/lib/format";
import styles from "./clientes.module.css";

export type Situacao = "todos" | "ativos" | "desatualizados" | "zerados";
type Ordem = "saldo" | "variacao" | "nome";

function situacaoDe(c: ClientSummary): Exclude<Situacao, "todos"> {
  if (c.saldo_desatualizado) return "desatualizados";
  return c.ativo ? "ativos" : "zerados";
}

const SELO = {
  ativos: { texto: "Ativo", classe: ui.chipPine },
  desatualizados: { texto: "Desatualizado", classe: ui.chipTomato },
  zerados: { texto: "Zerado", classe: "" },
} as const;

const FILTROS: { id: Situacao; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "desatualizados", label: "Desatualizados" },
  { id: "zerados", label: "Zerados" },
];

function variacao(c: ClientSummary) {
  if (c.saldo_desatualizado) {
    return { pct: "—", abs: c.data_saldo ? `Último saldo em ${diaMes(c.data_saldo)}` : "Sem saldo", cor: "" };
  }
  if (c.variacao_saldo === null) return { pct: "—", abs: "Primeiro fechamento", cor: "" };
  return {
    pct: c.variacao_saldo_pct === null ? "—" : pctSinal(c.variacao_saldo_pct),
    abs: `${brlSinal(c.variacao_saldo)} no mês`,
    cor: c.variacao_saldo >= 0 ? styles.pos : styles.neg,
  };
}

export function ClientesView({ clientes, situacaoInicial }: { clientes: ClientSummary[]; situacaoInicial: Situacao }) {
  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState<Situacao>(situacaoInicial);
  const [ordem, setOrdem] = useState<Ordem>("saldo");
  const [modo, setModo] = useState<"grade" | "tabela">("grade");

  const visiveis = useMemo(() => {
    const busca = q.trim().toLowerCase();
    const num = (v: number | null) => v ?? Number.NEGATIVE_INFINITY;
    return clientes
      .filter((c) => situacao === "todos" || situacaoDe(c) === situacao)
      .filter((c) => !busca || c.nome.toLowerCase().includes(busca) || c.codigo.includes(busca))
      .sort((a, b) =>
        ordem === "nome"
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : ordem === "variacao"
            ? num(b.variacao_saldo_pct) - num(a.variacao_saldo_pct)
            : num(b.saldo_atual) - num(a.saldo_atual),
      );
  }, [clientes, q, situacao, ordem]);

  const contagem = (s: Situacao) => (s === "todos" ? clientes.length : clientes.filter((c) => situacaoDe(c) === s).length);

  return (
    <>
      <div className={`${styles.toolbar} rv`} style={{ animationDelay: "260ms" }}>
        <div className={styles.busca}>
          <IconSearch size={17} strokeWidth={2} />
          <label htmlFor="busca" className="sr-only">
            Buscar por nome ou código
          </label>
          <input
            id="busca"
            type="search"
            className={ui.input}
            placeholder="Buscar nome ou código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Filtrar por situação" className={styles.filtros}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="press"
              aria-pressed={situacao === f.id}
              onClick={() => setSituacao(f.id)}
            >
              {f.label} <span className={styles.qtd}>{contagem(f.id)}</span>
            </button>
          ))}
        </div>
        <span className={styles.espaco} />
        <label htmlFor="ordenar" className="sr-only">
          Ordenar por
        </label>
        <select id="ordenar" className={`${ui.input} ${styles.select}`} value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
          <option value="saldo">Maior patrimônio</option>
          <option value="variacao">Maior variação</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <div role="group" aria-label="Modo de exibição" className={ui.segmented}>
          <button type="button" aria-pressed={modo === "grade"} onClick={() => setModo("grade")}>
            Grade
          </button>
          <button type="button" aria-pressed={modo === "tabela"} onClick={() => setModo("tabela")}>
            Tabela
          </button>
        </div>
        <Link href="/importar" className={`${ui.inkBtn} press`} style={{ height: 46 }}>
          <IconUpload size={16} strokeWidth={2.2} /> Importar planilha
        </Link>
      </div>

      {visiveis.length === 0 ? (
        <div className={`${ui.card} ${ui.empty} rv`}>
          Nenhum cliente encontrado
          <span>Tente outro nome ou código, ou limpe o filtro.</span>
        </div>
      ) : modo === "grade" ? (
        <div className={styles.grade}>
          {visiveis.map((c, i) => {
            const v = variacao(c);
            const selo = SELO[situacaoDe(c)];
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className={`${styles.cartao} lift rv`}
                style={{ animationDelay: `${Math.min(i, 12) * 50 + 220}ms` }}
              >
                <span className={styles.cartaoTopo}>
                  <span className={ui.avatar} style={{ ...corAvatar(c.id), width: 48, height: 48, fontSize: 15 }}>
                    {iniciais(c.nome)}
                  </span>
                  <span className={`${ui.chip} ${selo.classe}`}>{selo.texto}</span>
                </span>
                <span className={styles.nomeBloco}>
                  <span className={styles.nome}>{nomeProprio(c.nome)}</span>
                  <span className={ui.muted}>
                    Cód. {c.codigo}
                    {c.data_abertura && ` · desde ${mesAno(c.data_abertura)}`}
                  </span>
                </span>
                <span className={styles.poco}>
                  <span>
                    <span className={ui.muted}>Patrimônio</span>
                    <strong>{c.saldo_atual === null ? "—" : brl(c.saldo_atual)}</strong>
                  </span>
                  <span>
                    <span className={ui.muted}>Variação</span>
                    <strong className={v.cor}>{v.pct}</strong>
                  </span>
                </span>
                {c.distribuicao ? (
                  <DistributionBar dist={c.distribuicao} />
                ) : (
                  <span className={`${ui.muted} ${styles.semDist}`}>Sem diversificação informada</span>
                )}
                <span className={styles.cartaoBase}>
                  <span className={ui.muted}>{v.abs}</span>
                  <span className={styles.seta}>
                    <IconArrowUpRight size={15} strokeWidth={2} />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.tabelaBox} rv`}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col" className={styles.num}>
                  Patrimônio
                </th>
                <th scope="col" className={styles.num}>
                  Variação
                </th>
                <th scope="col" style={{ width: 170 }}>
                  Distribuição
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const v = variacao(c);
                const selo = SELO[situacaoDe(c)];
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`} className={styles.celulaNome}>
                        <span className={ui.avatar} style={{ ...corAvatar(c.id), width: 38, height: 38, fontSize: 13 }}>
                          {iniciais(c.nome)}
                        </span>
                        <span>
                          <strong>{nomeProprio(c.nome)}</strong>
                          <span className={ui.muted}>Cód. {c.codigo}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={styles.num}>
                      <strong>{c.saldo_atual === null ? "—" : brl(c.saldo_atual)}</strong>
                    </td>
                    <td className={styles.num}>
                      <strong className={v.cor}>{v.pct}</strong>
                      <span className={ui.muted}>{v.abs}</span>
                    </td>
                    <td>
                      {c.distribuicao ? <DistributionBar dist={c.distribuicao} /> : <span className={ui.muted}>Sem diversificação</span>}
                    </td>
                    <td>
                      <span className={`${ui.chip} ${selo.classe}`}>{selo.texto}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.rodape}>
        <span>
          {visiveis.length} {visiveis.length === 1 ? "cliente" : "clientes"} nesta lista
        </span>
        <ClassLegend />
      </div>
    </>
  );
}
