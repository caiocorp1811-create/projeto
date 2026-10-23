import Link from "next/link";
import { IconArrowUpRight, IconChecklist, IconClock, IconFile, IconPlus, IconTrend, IconUpload, IconUsers, IconWarning } from "@/components/icons";
import { HeaderStat, PageHeader } from "@/components/page-header";
import { TaskItem } from "@/components/tasks/task-item";
import { CountUp } from "@/components/ui/count-up";
import { DistributionBlocks } from "@/components/ui/distribution";
import { EvolutionChart } from "@/components/ui/evolution-chart";
import ui from "@/components/ui/ui.module.css";
import { CLASSES } from "@/lib/classes";
import { getDashboard, getImports, getTasks } from "@/lib/data";
import { brlCompacto, brlSinal, data, dataHora, diaMes, nomeCurto, pct, pctSinal } from "@/lib/format";
import styles from "./visao-geral.module.css";

export default async function VisaoGeralPage() {
  const [{ resumo, lista }, tarefas, importacoes] = await Promise.all([getDashboard(), getTasks(), getImports(4)]);
  const ref = resumo.data_referencia;

  if (!ref) {
    return (
      <>
        <PageHeader linhas={["Visão", "geral"]} />
        <section className={`${ui.card} ${ui.empty} rv`} style={{ animationDelay: "200ms" }}>
          Ainda não há dados na carteira.
          <span>Importe a planilha de fechamento para ver patrimônio, evolução e distribuição.</span>
          <Link href="/importar" className={`${ui.inkBtn} press`} style={{ marginTop: 10 }}>
            <IconUpload size={16} /> Importar planilha
          </Link>
        </section>
      </>
    );
  }

  const clientes = lista.clientes;
  const desatualizados = clientes.filter((c) => c.saldo_desatualizado);
  const zerados = clientes.filter((c) => !c.ativo && !c.saldo_desatualizado).length;
  const ativos = resumo.clientes_ativos;
  const total = resumo.total_clientes;
  const abertas = tarefas.filter((t) => t.status === "open");
  const atrasadas = abertas.filter((t) => t.atrasada);
  const proximas = abertas.filter((t) => !t.atrasada).slice(0, 5);
  const maiores = clientes.filter((c) => c.saldo_atual !== null && c.saldo_atual > 0).slice(0, 4);
  const ultimo = resumo.evolucao.at(-1);
  const anterior = resumo.evolucao.at(-2);
  const totalAtencao = atrasadas.length + desatualizados.length;
  const atencao = [
    ...atrasadas.map((t) => ({
      id: `t-${t.id}`,
      href: t.cliente_id ? `/clientes/${t.cliente_id}` : "/tarefas",
      tipo: "tarefa" as const,
      titulo: t.titulo,
      detalhe: `${t.cliente_nome ? nomeCurto(t.cliente_nome) : "Geral"} · venceu em ${diaMes(t.data_limite!)}`,
      selo: "Atrasada",
    })),
    ...desatualizados.map((c) => ({
      id: `c-${c.id}`,
      href: `/clientes/${c.id}`,
      tipo: "cliente" as const,
      titulo: nomeCurto(c.nome),
      detalhe: `Fora do fechamento de ${diaMes(ref)} · último saldo em ${c.data_saldo ? diaMes(c.data_saldo) : "—"}`,
      selo: "Desatualizado",
    })),
  ].slice(0, 5);

  return (
    <>
      <PageHeader linhas={["Visão", "geral"]}>
        <HeaderStat
          icon={<IconTrend />}
          valor={<CountUp value={resumo.patrimonio_total} format="brl" />}
          selo={
            resumo.variacao_saldo_pct !== null && (
              <span className={`${ui.chip} ${resumo.variacao_saldo_pct >= 0 ? ui.chipPine : ui.chipTomato}`}>
                {pctSinal(resumo.variacao_saldo_pct)}
              </span>
            )
          }
          legenda={`Patrimônio em ${data(ref)}`}
        />
        <HeaderStat
          icon={<IconUsers />}
          delay={280}
          valor={`${ativos} de ${total}`}
          selo={
            desatualizados.length > 0 && (
              <span className={`${ui.chip} ${ui.chipButter}`}>{desatualizados.length} desatualizados</span>
            )
          }
          legenda="Clientes ativos"
        />
        <HeaderStat
          icon={<IconChecklist />}
          delay={360}
          valor={abertas.length}
          selo={atrasadas.length > 0 && <span className={`${ui.chip} ${ui.chipTomato}`}>{atrasadas.length} atrasadas</span>}
          legenda="Tarefas abertas"
        />
      </PageHeader>

      <div className={ui.row}>
        <section className={`${ui.card} ${styles.patrimonio} rv`} style={{ animationDelay: "300ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Patrimônio</h2>
            <Link href="/clientes" aria-label="Ver clientes" className={`${ui.roundBtn} press`}>
              <IconArrowUpRight size={18} />
            </Link>
          </div>
          <div className={styles.destaque}>
            <span className={ui.bigNumber}>
              <CountUp value={resumo.patrimonio_total} format="brl" />
            </span>
            <span className={ui.muted}>
              em {data(ref)}
              {resumo.variacao_saldo !== null && resumo.data_anterior && (
                <>
                  {" · "}
                  <strong className={resumo.variacao_saldo >= 0 ? styles.pos : styles.neg}>
                    {brlSinal(resumo.variacao_saldo)}
                  </strong>{" "}
                  desde {diaMes(resumo.data_anterior)}
                </>
              )}
            </span>
          </div>
          <div className={styles.legenda}>
            <span>
              <span className={styles.dot} />
              Patrimônio total
            </span>
            {anterior && (
              <span>
                <span className={styles.dash} />
                Fechamento anterior · {brlCompacto(anterior.patrimonio)}
              </span>
            )}
          </div>
          <EvolutionChart
            pontos={resumo.evolucao.map((e) => ({ data: e.data, valor: e.patrimonio }))}
            referencia={anterior?.patrimonio}
            descricao={`Patrimônio por fechamento, de ${data(resumo.evolucao[0].data)} a ${data(ref)}. Último valor: ${brlCompacto(resumo.patrimonio_total)}.`}
          />
          {ultimo && (
            <p className={ui.muted}>
              {ultimo.clientes_com_saldo} {ultimo.clientes_com_saldo === 1 ? "cliente informado" : "clientes informados"} no
              fechamento de {data(ultimo.data)}. A variação inclui aportes e resgates.
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.maiores} rv`} style={{ animationDelay: "380ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Maiores carteiras</h2>
            <Link href="/clientes" aria-label="Ver todos os clientes" className={`${ui.roundBtn} press`}>
              <IconArrowUpRight size={18} />
            </Link>
          </div>
          <div className={styles.tiles}>
            {maiores.map((c, i) => {
              const principal = c.distribuicao
                ? [...CLASSES].sort((a, b) => c.distribuicao![b.key] - c.distribuicao![a.key])[0]
                : null;
              const tom = c.saldo_desatualizado ? "tomato" : i === 2 ? "pine" : "ink";
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className={`${styles.tile} lift rv`}
                  data-tom={tom}
                  style={{ animationDelay: `${480 + i * 60}ms` }}
                >
                  <span className={styles.tileTopo}>
                    <span className={styles.tileTag}>{c.saldo_desatualizado ? "Saldo desatualizado" : "Ativo"}</span>
                    <span className={styles.tileNome}>{nomeCurto(c.nome)}</span>
                    <span className={styles.tileTag}>
                      {principal ? `${principal.nome} ${pct(c.distribuicao![principal.key])}` : "Sem diversificação"}
                    </span>
                  </span>
                  <span className={styles.tileBase}>
                    <span className={styles.tileValor}>{brlCompacto(c.saldo_atual!)}</span>
                    <span className={styles.tileTag}>
                      {c.saldo_desatualizado
                        ? `Último saldo em ${diaMes(c.data_saldo!)}`
                        : c.variacao_saldo_pct !== null
                          ? `${pctSinal(c.variacao_saldo_pct)} vs. anterior`
                          : "Primeiro fechamento"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className={ui.row}>
        <section className={`${styles.ativos} rv`} style={{ animationDelay: "460ms" }}>
          <h2 className={ui.cardTitle}>Clientes ativos</h2>
          <div className={styles.anel}>
            <svg role="img" aria-label={`${ativos} de ${total} clientes ativos`} viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#ffffff24" strokeWidth="3.6" />
              {ativos > 0 && (
                <circle
                  className="seg"
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  stroke="var(--butter)"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeDasharray={`${(ativos / total) * 100} ${100 - (ativos / total) * 100}`}
                  style={{ animationDelay: "600ms" }}
                />
              )}
            </svg>
            <span className={styles.anelCentro}>
              <strong>
                <CountUp value={total > 0 ? Math.round((ativos / total) * 100) : 0} />%
              </strong>
              <span>
                {ativos} de {total}
              </span>
            </span>
          </div>
          <div className={styles.trio}>
            <span>
              <span>Ativos</span>
              <strong>{ativos}</strong>
            </span>
            <span>
              <span>Zerados</span>
              <strong>{zerados}</strong>
            </span>
            <span>
              <span>Desatualizados</span>
              <strong>{desatualizados.length}</strong>
            </span>
          </div>
          {desatualizados.length > 0 && (
            <Link href="/clientes?situacao=desatualizados" className={`${styles.ativosBtn} press`}>
              {desatualizados.length} fora do último fechamento
            </Link>
          )}
        </section>

        <section className={`${ui.card} ${styles.distribuicao} rv`} style={{ animationDelay: "520ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Distribuição</h2>
            {resumo.cobertura_distribuicao !== null && (
              <span className={ui.muted}>baseada em {pct(resumo.cobertura_distribuicao)} do patrimônio</span>
            )}
          </div>
          {resumo.distribuicao ? (
            <>
              <div className={styles.destaque}>
                <span className={styles.distTotal}>{brlCompacto(resumo.patrimonio_total)}</span>
                <span className={ui.muted}>em 4 classes, ponderado pelo saldo</span>
              </div>
              <DistributionBlocks dist={resumo.distribuicao} valores={resumo.valor_por_classe} />
            </>
          ) : (
            <p className={ui.empty}>
              Nenhum cliente ativo tem diversificação informada.
              <span>Ela vem da planilha, junto com os saldos.</span>
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.acoes} rv`} style={{ animationDelay: "580ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Próximas ações</h2>
            <Link href="/tarefas" className={`${ui.inkBtn} press`} style={{ height: 40 }}>
              <IconPlus size={15} strokeWidth={2.2} /> Nova
            </Link>
          </div>
          {proximas.length > 0 ? (
            <ul className={styles.lista}>
              {proximas.map((t) => (
                <TaskItem key={t.id} tarefa={t} />
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>
              Nenhuma tarefa com prazo pela frente.
              <span>Crie tarefas para lembrar de ligações, reuniões e revisões.</span>
            </p>
          )}
        </section>
      </div>

      <div className={ui.row}>
        <section className={`${ui.card} ${styles.metade} rv`} style={{ animationDelay: "640ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Pontos de atenção</h2>
            {totalAtencao > 0 && <span className={`${ui.chip} ${ui.chipTomato}`}>{totalAtencao}</span>}
          </div>
          {atencao.length > 0 ? (
            <div className={styles.lista}>
              {atencao.map((a) => (
                <Link key={a.id} href={a.href} className={ui.listRow}>
                  <span className={styles.icone} data-tipo={a.tipo}>
                    {a.tipo === "tarefa" ? <IconClock size={18} strokeWidth={2} /> : <IconWarning size={18} strokeWidth={2} />}
                  </span>
                  <span className={styles.textoLinha}>
                    <strong>{a.titulo}</strong>
                    <span className={ui.muted}>{a.detalhe}</span>
                  </span>
                  <span className={ui.chip}>{a.selo}</span>
                </Link>
              ))}
              {totalAtencao > atencao.length && (
                <Link href="/clientes?situacao=desatualizados" className={styles.mais}>
                  e mais {totalAtencao - atencao.length}
                </Link>
              )}
            </div>
          ) : (
            <p className={ui.empty}>
              Tudo em dia.
              <span>Nenhuma tarefa atrasada e todos os clientes no último fechamento.</span>
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.metade} rv`} style={{ animationDelay: "700ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Últimas importações</h2>
            <Link href="/importar" aria-label="Ver importações" className={`${ui.roundBtn} press`}>
              <IconArrowUpRight size={18} />
            </Link>
          </div>
          <ol className={styles.timeline}>
            {importacoes.map((imp) => (
              <li key={imp.id}>
                <span className={styles.tlIcone}>
                  <IconFile size={17} />
                </span>
                <span className={styles.textoLinha}>
                  <strong className={styles.arquivo}>{imp.arquivo}</strong>
                  <span className={ui.muted}>
                    {dataHora(imp.enviado_em)} · {imp.resumo.clientes.na_planilha} clientes,{" "}
                    {imp.resumo.clientes.novos} novos
                  </span>
                </span>
                <span className={`${ui.chip} ${imp.resumo.avisos.length ? ui.chipButter : ""}`}>
                  {imp.resumo.avisos.length
                    ? `${imp.resumo.avisos.length} ${imp.resumo.avisos.length === 1 ? "aviso" : "avisos"}`
                    : "Sem avisos"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
