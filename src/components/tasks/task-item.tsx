"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { IconTrash } from "@/components/icons";
import { ApiError, api } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";
import { corAvatar } from "@/lib/avatar";
import { diaMes, hojeSP, iniciais, nomeCurto, somaDias } from "@/lib/format";
import styles from "./task-item.module.css";

/** Selo do prazo: concluída, atrasada, vence nesta semana, mais adiante ou sem prazo. */
function prazo(t: Task, feita: boolean) {
  if (feita) return { texto: "Concluída", classe: styles.feita };
  if (!t.data_limite) return { texto: "Sem prazo", classe: "" };
  const hoje = hojeSP();
  if (t.data_limite < hoje) return { texto: `Venceu ${diaMes(t.data_limite)}`, classe: styles.atrasada };
  if (t.data_limite <= somaDias(hoje, 7)) return { texto: `Até ${diaMes(t.data_limite)}`, classe: styles.semana };
  return { texto: `Até ${diaMes(t.data_limite)}`, classe: "" };
}

/**
 * Uma tarefa com caixa de concluir (muda na hora e grava pela API) e,
 * opcionalmente, cliente e botão de excluir.
 */
export function TaskItem({
  tarefa,
  mostrarCliente = true,
  podeExcluir = false,
}: {
  tarefa: Task;
  mostrarCliente?: boolean;
  podeExcluir?: boolean;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [feita, setFeita] = useOptimistic(tarefa.status === "done");

  const tratarErro = (e: unknown) => {
    if (e instanceof ApiError && e.unauthorized) router.push("/login");
    else alert(e instanceof Error ? e.message : "Não foi possível salvar.");
  };

  const alternar = () =>
    startTransition(async () => {
      setFeita(!feita);
      try {
        await (feita ? api.tasks.reopen(tarefa.id) : api.tasks.complete(tarefa.id));
        router.refresh();
      } catch (e) {
        tratarErro(e);
      }
    });

  const excluir = () => {
    if (!confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return;
    startTransition(async () => {
      try {
        await api.tasks.remove(tarefa.id);
        router.refresh();
      } catch (e) {
        tratarErro(e);
      }
    });
  };

  const selo = prazo(tarefa, feita);
  const cliente = tarefa.cliente_nome;

  return (
    <li className={styles.item} data-pendente={pendente || undefined}>
      <button
        type="button"
        className={`${styles.check} press`}
        onClick={alternar}
        aria-pressed={feita}
        aria-label={`${feita ? "Reabrir" : "Concluir"}: ${tarefa.titulo}`}
      >
        <span className={styles.caixa} data-feita={feita || undefined}>
          {feita && (
            <svg className="pop" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5l9-10" />
            </svg>
          )}
        </span>
      </button>
      <span className={styles.texto}>
        <span className={styles.titulo} data-feita={feita || undefined}>
          {tarefa.titulo}
        </span>
        {mostrarCliente && (
          <span className={styles.meta}>
            {cliente && tarefa.cliente_id ? (
              <Link href={`/clientes/${tarefa.cliente_id}`} className={styles.cliente}>
                <span className={styles.mini} style={corAvatar(tarefa.cliente_id)}>
                  {iniciais(cliente)}
                </span>
                {nomeCurto(cliente)}
              </Link>
            ) : (
              <span className={styles.cliente}>Geral</span>
            )}
          </span>
        )}
      </span>
      <span className={`${styles.selo} ${selo.classe}`}>{selo.texto}</span>
      {podeExcluir && (
        <button type="button" className={`${styles.lixo} press`} onClick={excluir} aria-label={`Excluir: ${tarefa.titulo}`}>
          <IconTrash size={17} />
        </button>
      )}
    </li>
  );
}
