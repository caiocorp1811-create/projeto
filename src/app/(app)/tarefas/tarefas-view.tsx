"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { IconPlus } from "@/components/icons";
import { TaskItem } from "@/components/tasks/task-item";
import ui from "@/components/ui/ui.module.css";
import { ApiError, api } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";
import { hojeSP, somaDias } from "@/lib/format";
import styles from "./tarefas.module.css";

type Aba = "open" | "done" | "todas";
type Opcao = { id: string; nome: string };

export function TarefasView({
  tarefas,
  clientes,
  clienteInicial,
}: {
  tarefas: Task[];
  clientes: Opcao[];
  clienteInicial: string;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("open");
  const [filtro, setFiltro] = useState<string>(clienteInicial || "todos");
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState(clienteInicial);
  const [prazo, setPrazo] = useState("");
  const [erros, setErros] = useState<{ geral?: string; titulo?: string; data_limite?: string }>({});
  const [pendente, startTransition] = useTransition();

  const doCliente = useMemo(
    () =>
      tarefas.filter((t) =>
        filtro === "todos" ? true : filtro === "geral" ? t.cliente_id === null : t.cliente_id === filtro,
      ),
    [tarefas, filtro],
  );
  const lista = doCliente.filter((t) => aba === "todas" || t.status === aba);
  const abertas = tarefas.filter((t) => t.status === "open");
  const concluidas = doCliente.filter((t) => t.status === "done").length;
  const hoje = hojeSP();
  const fimSemana = somaDias(hoje, 7);
  const resumo = {
    atrasadas: abertas.filter((t) => t.atrasada).length,
    semana: abertas.filter((t) => t.data_limite && t.data_limite >= hoje && t.data_limite <= fimSemana).length,
    semPrazo: abertas.filter((t) => !t.data_limite).length,
  };

  const criar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!titulo.trim()) {
      setErros({ titulo: "Informe o que precisa ser feito." });
      return;
    }
    setErros({});
    startTransition(async () => {
      try {
        await api.tasks.create({ titulo: titulo.trim(), cliente_id: cliente || null, data_limite: prazo || null });
        setTitulo("");
        setPrazo("");
        setAba("open");
        router.refresh();
      } catch (e) {
        if (e instanceof ApiError && e.unauthorized) return router.push("/login");
        const campo = (nome: string) =>
          e instanceof ApiError ? e.detalhes?.find((d) => d.campo === nome)?.mensagem : undefined;
        setErros({
          titulo: campo("titulo"),
          data_limite: campo("data_limite"),
          geral: e instanceof Error ? e.message : "Não foi possível criar a tarefa.",
        });
      }
    });
  };

  return (
    <div className={styles.layout}>
      <section className={`${ui.card} ${styles.listaCard} rv`} style={{ animationDelay: "260ms" }}>
        <div className={ui.cardHead}>
          <div role="group" aria-label="Filtrar por status" className={ui.segmented}>
            <button type="button" aria-pressed={aba === "open"} onClick={() => setAba("open")}>
              Abertas ({doCliente.filter((t) => t.status === "open").length})
            </button>
            <button type="button" aria-pressed={aba === "done"} onClick={() => setAba("done")}>
              Concluídas
            </button>
            <button type="button" aria-pressed={aba === "todas"} onClick={() => setAba("todas")}>
              Todas
            </button>
          </div>
          <span className={styles.filtroCliente}>
            <label htmlFor="filtro-cliente" className={ui.muted}>
              Cliente
            </label>
            <select id="filtro-cliente" className={ui.input} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="geral">Só tarefas gerais</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </span>
        </div>

        {doCliente.length > 0 && (
          <div className={styles.progresso}>
            <span className={ui.muted}>
              <strong>
                {concluidas} de {doCliente.length}
              </strong>{" "}
              concluídas
            </span>
            <span className={styles.trilho}>
              <span style={{ width: `${(concluidas / doCliente.length) * 100}%` }} />
            </span>
          </div>
        )}

        {lista.length > 0 ? (
          <ul className={styles.lista}>
            {lista.map((t) => (
              <TaskItem key={t.id} tarefa={t} podeExcluir />
            ))}
          </ul>
        ) : (
          <p className={ui.empty}>
            {tarefas.length === 0 ? "Nenhuma tarefa ainda." : "Nada por aqui."}
            <span>
              {tarefas.length === 0 ? "Use o formulário ao lado para criar a primeira." : "Nenhuma tarefa com esse filtro."}
            </span>
          </p>
        )}
      </section>

      <aside className={styles.lado}>
        <form onSubmit={criar} className={`${ui.card} ${styles.form} rv`} style={{ animationDelay: "340ms" }} noValidate>
          <h2 className={ui.cardTitle}>Nova tarefa</h2>
          <div className={styles.campo}>
            <label htmlFor="titulo">O que precisa ser feito</label>
            <input
              id="titulo"
              className={ui.input}
              placeholder="Ex.: Ligar para revisar a carteira"
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              aria-invalid={Boolean(erros.titulo) || undefined}
              aria-describedby={erros.titulo ? "erro-titulo" : undefined}
            />
            {erros.titulo && (
              <span id="erro-titulo" className={styles.erro}>
                {erros.titulo}
              </span>
            )}
          </div>
          <div className={styles.campo}>
            <label htmlFor="cliente">Cliente</label>
            <select id="cliente" className={ui.input} value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Geral (sem cliente)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.campo}>
            <label htmlFor="prazo">
              Prazo <span className={ui.muted}>(opcional)</span>
            </label>
            <input
              id="prazo"
              type="date"
              className={ui.input}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              aria-invalid={Boolean(erros.data_limite) || undefined}
            />
            {erros.data_limite && <span className={styles.erro}>{erros.data_limite}</span>}
          </div>
          {erros.geral && !erros.titulo && !erros.data_limite && (
            <p role="alert" className={styles.erro}>
              {erros.geral}
            </p>
          )}
          <button type="submit" className={`${ui.inkBtn} press`} style={{ height: 48, fontSize: 15 }} disabled={pendente}>
            <IconPlus size={16} strokeWidth={2.2} />
            {pendente ? "Adicionando…" : "Adicionar tarefa"}
          </button>
        </form>

        <div className={styles.tiles}>
          <div className={`${styles.tile} lift rv`} data-tom="tomato" style={{ animationDelay: "420ms" }}>
            <span>Atrasadas</span>
            <strong>{resumo.atrasadas}</strong>
          </div>
          <div className={`${styles.tile} lift rv`} data-tom="butter" style={{ animationDelay: "480ms" }}>
            <span>Próximos 7 dias</span>
            <strong>{resumo.semana}</strong>
          </div>
          <div className={`${styles.tile} lift rv`} data-tom="ink" style={{ animationDelay: "540ms" }}>
            <span>Sem prazo</span>
            <strong>{resumo.semPrazo}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
