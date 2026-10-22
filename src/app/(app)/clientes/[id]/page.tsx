import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconPlus, IconScreen, IconWarning } from "@/components/icons";
import { TaskItem } from "@/components/tasks/task-item";
import { CountUp } from "@/components/ui/count-up";
import { DistributionBlocks } from "@/components/ui/distribution";
import { EvolutionChart } from "@/components/ui/evolution-chart";
import ui from "@/components/ui/ui.module.css";
import { corAvatar } from "@/lib/avatar";
import { getClientDetail } from "@/lib/data";
import { brl, brlCompacto, brlSinal, data, iniciais, nomeProprio, pctSinal } from "@/lib/format";
import { ClienteTabs } from "./cliente-tabs";
import { NotesPanel } from "./notes-panel";
import styles from "./cliente.module.css";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const c = await getClientDetail((await params).id);
  return { title: c ? nomeProprio(c.nome) : "Cliente" };
}

export default async function ClientePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const c = await getClientDetail(id);
  if (!c) notFound();

  const nome = nomeProprio(c.nome);
  const situacao = c.saldo_desatualizado
    ? { texto: "Saldo desatualizado", classe: ui.chipTomato }
    : c.ativo
      ? { texto: "Ativo", classe: ui.chipPine }
      : { texto: "Zerado", classe: "" };
  const historico = c.historico;

  const geral = (
    <div className={styles.painel}>
      {c.saldo_desatualizado && c.data_saldo && (
        <p className={`${styles.aviso} rv`}>
          <IconWarning size={18} strokeWidth={2} />
          Este cliente não veio no último fechamento da planilha. O saldo mostrado é o de {data(c.data_saldo)}.
        </p>
      )}

      <div className={ui.row}>
        <section className={`${ui.card} ${styles.patrimonio} rv`} style={{ animationDelay: "340ms" }}>
          <h2 className={ui.cardTitle}>Patrimônio</h2>
          <div className={styles.destaque}>
            <span className={ui.bigNumber}>
              {c.saldo_atual === null ? "—" : <CountUp value={c.saldo_atual} format="brl" />}
            </span>
            <span className={ui.muted}>
              {c.data_saldo ? `em ${data(c.data_saldo)}` : "sem saldo informado"} · {historico.length}{" "}
              {historico.length === 1 ? "fechamento" : "fechamentos"}
            </span>
          </div>
          <EvolutionChart
            pontos={historico.map((h) => ({ data: h.data, valor: h.saldo }))}
            descricao={`Saldo de ${nome} por fechamento${c.saldo_atual !== null ? `; último: ${brlCompacto(c.saldo_atual)}` : ""}.`}
          />
        </section>

        <div className={styles.lado}>
          <div className={`${styles.bloco} ${styles.pine} lift rv`} style={{ animationDelay: "420ms" }}>
            <span className={styles.blocoTopo}>
              <strong>Variação no último fechamento</strong>
              {c.variacao_saldo_pct !== null && !c.saldo_desatualizado && (
                <span className={styles.blocoChip}>{pctSinal(c.variacao_saldo_pct)}</span>
              )}
            </span>
            <span className={styles.blocoBase}>
              <span className={styles.blocoValor}>
                {c.variacao_saldo === null || c.saldo_desatualizado ? "—" : brlSinal(c.variacao_saldo)}
              </span>
              <span>Inclui aportes e resgates, não é rentabilidade</span>
            </span>
          </div>
          <div className={`${styles.bloco} ${styles.ink} lift rv`} style={{ animationDelay: "480ms" }}>
            <strong>Saldo anterior</strong>
            <span className={styles.blocoBase}>
              <span className={styles.blocoValor}>{c.saldo_anterior === null ? "—" : brl(c.saldo_anterior)}</span>
              <span>{c.data_saldo_anterior ? `Fechamento de ${data(c.data_saldo_anterior)}` : "Sem fechamento anterior"}</span>
            </span>
          </div>
        </div>
      </div>

      <div className={ui.row}>
        <section className={`${ui.card} ${styles.terco} rv`} style={{ animationDelay: "540ms" }}>
          <h2 className={ui.cardTitle}>Distribuição</h2>
          {c.distribuicao ? (
            <DistributionBlocks dist={c.distribuicao} valores={c.valor_por_classe} />
          ) : (
            <p className={ui.empty}>
              Sem diversificação informada.
              <span>Ela vem da planilha, no fechamento mais recente.</span>
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.terco} rv`} style={{ animationDelay: "600ms" }}>
          <div className={ui.cardHead}>
            <h2 className={ui.cardTitle}>Tarefas</h2>
            <Link href={`/tarefas?cliente=${c.id}`} className={`${ui.inkBtn} press`} style={{ height: 40 }}>
              <IconPlus size={15} strokeWidth={2.2} /> Nova
            </Link>
          </div>
          {c.tarefas.length > 0 ? (
            <ul className={styles.lista}>
              {c.tarefas.map((t) => (
                <TaskItem key={t.id} tarefa={t} mostrarCliente={false} podeExcluir />
              ))}
            </ul>
          ) : (
            <p className={ui.empty}>
              Nenhuma tarefa para este cliente.
              <span>Crie uma para lembrar da próxima conversa.</span>
            </p>
          )}
        </section>

        <section className={`${ui.card} ${styles.terco} rv`} style={{ animationDelay: "660ms" }}>
          <NotesPanel clienteId={c.id} notas={c.notas} />
        </section>
      </div>
    </div>
  );

  const tabelaHistorico = (
    <div className={`${styles.tabelaBox} rv`}>
      {historico.length === 0 ? (
        <p className={ui.empty}>Nenhum fechamento para este cliente.</p>
      ) : (
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th scope="col">Fechamento</th>
              <th scope="col">Saldo</th>
              <th scope="col">Variação</th>
              <th scope="col">Variação %</th>
            </tr>
          </thead>
          <tbody>
            {[...historico].reverse().map((h) => (
              <tr key={h.data}>
                <td>{data(h.data)}</td>
                <td>
                  <strong>{brl(h.saldo)}</strong>
                </td>
                <td className={h.variacao_saldo === null ? "" : h.variacao_saldo >= 0 ? styles.pos : styles.neg}>
                  {h.variacao_saldo === null ? "—" : brlSinal(h.variacao_saldo)}
                </td>
                <td>
                  {h.variacao_saldo_pct === null ? (
                    "—"
                  ) : (
                    <span className={`${ui.chip} ${h.variacao_saldo_pct >= 0 ? ui.chipPine : ui.chipTomato}`}>
                      {pctSinal(h.variacao_saldo_pct)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <Link href="/clientes" className={`${styles.voltar} rv press`}>
        <IconArrowLeft size={16} strokeWidth={2} /> Clientes
      </Link>

      <div className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={`${ui.avatar} ${styles.avatar}`} style={corAvatar(c.id)}>
            {iniciais(c.nome)}
          </span>
          <div className={styles.nomeBloco}>
            <div className={styles.nomeLinha}>
              <h1 className={styles.nome}>
                <span className="ln">
                  <span style={{ animationDelay: "60ms" }}>{nome}</span>
                </span>
              </h1>
              <span className={`${ui.chip} ${situacao.classe} rv`} style={{ animationDelay: "300ms" }}>
                {situacao.texto}
              </span>
            </div>
            <p className={`${ui.muted} rv`} style={{ fontSize: 15, animationDelay: "220ms" }}>
              Cód. {c.codigo}
              {c.data_abertura && ` · cliente desde ${data(c.data_abertura)}`}
            </p>
          </div>
        </div>
        <div className={`${styles.acoes} rv`} style={{ animationDelay: "260ms" }}>
          <Link href={`/apresentacao/${c.id}`} className={`${ui.inkBtn} press`} style={{ height: 48, fontSize: 15 }}>
            <IconScreen size={17} strokeWidth={2} /> Modo apresentação
          </Link>
        </div>
      </div>

      <ClienteTabs geral={geral} historico={tabelaHistorico} />
    </>
  );
}
