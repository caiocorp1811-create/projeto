import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowUpRight, IconX } from "@/components/icons";
import { CountUp } from "@/components/ui/count-up";
import { EvolutionChart } from "@/components/ui/evolution-chart";
import { CLASSES } from "@/lib/classes";
import { getPresentation } from "@/lib/data";
import { brl, brlCompacto, brlSinal, data, nomeProprio, pct, pctSinal } from "@/lib/format";
import styles from "./apresentacao.module.css";

export const metadata: Metadata = { title: "Apresentação" };

/**
 * Modo apresentação: tela limpa para mostrar ao cliente. Usa só o
 * presentationView (sem notas, tarefas ou código interno).
 */
export default async function ApresentacaoPage({ params }: PageProps<"/apresentacao/[id]">) {
  const { id } = await params;
  const p = await getPresentation(id);
  if (!p) notFound();

  const nome = nomeProprio(p.nome);
  const primeiroNome = nome.split(" ")[0];
  const historico = p.historico;
  const primeiro = historico[0];
  const recentes = historico.slice(-5);
  const dist = p.distribuicao;

  // rosca: cada classe começa onde a anterior terminou (com um respiro de 1%)
  let acumulado = 0;
  const fatias = dist
    ? CLASSES.filter((c) => dist[c.key] > 0).map((c, i) => {
        const tam = dist[c.key] * 100;
        const fatia = { ...c, tam, inicio: acumulado, delay: 700 + i * 120 };
        acumulado += tam;
        return fatia;
      })
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={`${styles.topo} rv`}>
          <span className={styles.brand}>
            <span className={styles.logo}>H</span>
            hub do caio
          </span>
          <Link href={`/clientes/${p.id}`} className={`${styles.sair} press`}>
            <IconX size={15} strokeWidth={2.2} /> Sair da apresentação
          </Link>
        </header>

        <section className={styles.hero}>
          <h1 className={styles.titulo}>
            <span className="ln">
              <span className={styles.ola} style={{ animationDelay: "100ms" }}>
                Olá, {primeiroNome}.
              </span>
            </span>
            <span className="ln">
              <span style={{ animationDelay: "200ms" }}>Seu patrimônio,</span>
            </span>
            <span className="ln">
              <span style={{ animationDelay: "300ms" }}>mês a mês.</span>
            </span>
          </h1>
          <div className={`${styles.cartaoValor} lift rv`} style={{ animationDelay: "420ms" }}>
            <span className={styles.cartaoTopo}>
              <span>{p.data_saldo ? `Patrimônio em ${data(p.data_saldo)}` : "Patrimônio"}</span>
              <span className={styles.pontoButter} />
            </span>
            <span className={styles.valor}>
              {p.saldo_atual === null ? "—" : <CountUp value={p.saldo_atual} format="brl" delay={450} duration={1500} />}
            </span>
            {p.variacao_saldo !== null && (
              <span className={styles.variacao}>
                <span className={styles.variacaoChip} data-neg={p.variacao_saldo < 0 || undefined}>
                  <IconArrowUpRight size={14} strokeWidth={2.2} />
                  {brlSinal(p.variacao_saldo)}
                  {p.variacao_saldo_pct !== null && ` (${pctSinal(p.variacao_saldo_pct)})`}
                </span>
                {historico.length > 1 && <span>desde {data(historico[historico.length - 2].data)}</span>}
              </span>
            )}
          </div>
        </section>

        <div className={styles.linha}>
          <section className={`${styles.card} ${styles.grafico} rv`} style={{ animationDelay: "520ms" }}>
            <div>
              <h2>Evolução do patrimônio</h2>
              {primeiro && p.saldo_atual !== null && (
                <p className={styles.sub}>
                  De {brl(primeiro.saldo)} em {data(primeiro.data)} para {brl(p.saldo_atual)}
                  {p.data_saldo ? ` em ${data(p.data_saldo)}` : ""}
                </p>
              )}
            </div>
            <EvolutionChart
              altura={280}
              pontos={historico.map((h) => ({ data: h.data, valor: h.saldo }))}
              descricao={`Evolução do patrimônio de ${nome} por fechamento.`}
            />
          </section>

          <section className={`${styles.card} ${styles.dist} rv`} style={{ animationDelay: "600ms" }}>
            <h2>Como está distribuído</h2>
            {dist ? (
              <>
                <div className={styles.rosca}>
                  <svg
                    role="img"
                    aria-label={CLASSES.map((c) => `${c.nome} ${pct(dist[c.key])}`).join(", ")}
                    viewBox="0 0 42 42"
                  >
                    {fatias.map((f) => (
                      <circle
                        key={f.key}
                        className="seg"
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="none"
                        stroke={f.cor}
                        strokeWidth="5.5"
                        strokeDasharray={`${Math.max(f.tam - (fatias.length > 1 ? 1 : 0), 0.5)} ${100 - f.tam + (fatias.length > 1 ? 1 : 0)}`}
                        strokeDashoffset={-f.inicio}
                        style={{ animationDelay: `${f.delay}ms` }}
                      />
                    ))}
                  </svg>
                  <span className={styles.roscaCentro}>
                    <span>Total</span>
                    <strong>{p.saldo_atual === null ? "—" : brlCompacto(p.saldo_atual)}</strong>
                  </span>
                </div>
                <div className={styles.classes}>
                  {CLASSES.map((c) => (
                    <div key={c.key} className={styles.classe}>
                      <span className={styles.pontoClasse} style={{ background: c.cor }} />
                      <span>
                        <strong>{c.nome}</strong>
                        {p.valor_por_classe && <span>{brl(p.valor_por_classe[c.key])}</span>}
                      </span>
                      <span className={styles.classePct}>{pct(dist[c.key])}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.sub}>A distribuição por classe ainda não foi informada.</p>
            )}
          </section>
        </div>

        {recentes.length > 0 && (
          <section className={styles.fechamentos}>
            <h2 className="rv" style={{ animationDelay: "680ms" }}>
              Últimos fechamentos
            </h2>
            <div className={styles.tiles}>
              {recentes.map((h, i) => {
                const ultimo = i === recentes.length - 1;
                return (
                  <div
                    key={h.data}
                    className={`${styles.tile} lift rv`}
                    data-ultimo={ultimo || undefined}
                    style={{ animationDelay: `${760 + i * 70}ms` }}
                  >
                    <span className={styles.tileData}>{data(h.data)}</span>
                    <span className={styles.tileValor}>{brl(h.saldo)}</span>
                    <span className={styles.tileChip} data-neg={(h.variacao_saldo ?? 0) < 0 || undefined}>
                      {h.variacao_saldo === null
                        ? "Primeiro registro"
                        : `${brlSinal(h.variacao_saldo)}${h.variacao_saldo_pct !== null ? ` (${pctSinal(h.variacao_saldo_pct)})` : ""}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className={`${styles.nota} rv`} style={{ animationDelay: "900ms" }}>
          A variação mostra a diferença de saldo entre fechamentos e inclui aportes e resgates. Ela não representa a
          rentabilidade dos investimentos.
        </p>
      </div>
    </div>
  );
}
