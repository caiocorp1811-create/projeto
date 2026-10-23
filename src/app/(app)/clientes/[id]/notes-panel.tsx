"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconTrash } from "@/components/icons";
import ui from "@/components/ui/ui.module.css";
import { ApiError, api } from "@/lib/api/client";
import type { Note } from "@/lib/api/types";
import { dataHora } from "@/lib/format";
import styles from "./cliente.module.css";

/** Notas internas do cliente: criar e excluir. Nunca aparecem no modo apresentação. */
export function NotesPanel({ clienteId, notas }: { clienteId: string; notas: Note[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const falhou = (e: unknown) => {
    if (e instanceof ApiError && e.unauthorized) router.push("/login");
    else setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
  };

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    startTransition(async () => {
      try {
        await api.clients.addNote(clienteId, texto.trim());
        setTexto("");
        router.refresh();
      } catch (e) {
        falhou(e);
      }
    });
  };

  const excluir = (n: Note) => {
    if (!confirm("Excluir esta nota?")) return;
    startTransition(async () => {
      try {
        await api.notes.remove(n.id);
        router.refresh();
      } catch (e) {
        falhou(e);
      }
    });
  };

  return (
    <>
      <div className={ui.cardHead}>
        <h2 className={ui.cardTitle}>Notas internas</h2>
        <span className={`${ui.chip} ${ui.chipButter}`}>Só você vê</span>
      </div>
      <form onSubmit={salvar} className={styles.notaForm}>
        <label htmlFor="nova-nota" className="sr-only">
          Nova nota
        </label>
        <textarea
          id="nova-nota"
          rows={2}
          placeholder="Escreva uma nota sobre o cliente"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={10000}
        />
        {erro && (
          <p role="alert" className={styles.erro}>
            {erro}
          </p>
        )}
        <button type="submit" className={`${ui.ghostBtn} press`} disabled={pendente || !texto.trim()}>
          {pendente ? "Salvando…" : "Salvar nota"}
        </button>
      </form>
      {notas.length === 0 ? (
        <p className={ui.muted}>Nenhuma nota ainda.</p>
      ) : (
        <ul className={styles.notas}>
          {notas.map((n) => (
            <li key={n.id} className="rv">
              <span className={styles.notaTopo}>
                <span>{dataHora(n.criada_em)}</span>
                <button type="button" className={`${styles.notaLixo} press`} onClick={() => excluir(n)} aria-label="Excluir nota">
                  <IconTrash size={15} />
                </button>
              </span>
              <span className={styles.notaTexto}>{n.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
