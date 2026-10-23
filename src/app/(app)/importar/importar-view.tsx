"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconAlert, IconArrowRight, IconCheck, IconFile, IconUpload } from "@/components/icons";
import ui from "@/components/ui/ui.module.css";
import { ApiError, api } from "@/lib/api/client";
import type { ImportSummary } from "@/lib/api/types";
import { data, dataHora } from "@/lib/format";
import styles from "./importar.module.css";

type Envio = { id: string; arquivo: string; enviado_em: string; resumo: ImportSummary };

type Estado =
  | { tipo: "parado" }
  | { tipo: "enviando"; arquivo: string }
  | { tipo: "ok"; resumo: ImportSummary }
  | { tipo: "erro"; mensagem: string; tentativa: number };

const MAX = 5 * 1024 * 1024;

export function ImportarView({ importacoes }: { importacoes: Envio[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const [arrastando, setArrastando] = useState(false);

  const falhar = (mensagem: string) =>
    setEstado((e) => ({ tipo: "erro", mensagem, tentativa: (e.tipo === "erro" ? e.tentativa : 0) + 1 }));

  async function enviar(arquivo: File) {
    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) return falhar("Envie uma planilha no formato .xlsx.");
    if (arquivo.size === 0 || arquivo.size > MAX) return falhar("O arquivo está vazio ou passa de 5 MB.");

    setEstado({ tipo: "enviando", arquivo: arquivo.name });
    try {
      const resumo = await api.imports.upload(arquivo);
      setEstado({ tipo: "ok", resumo });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.unauthorized) return router.push("/login");
      falhar(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const enviando = estado.tipo === "enviando";

  return (
    <div className={styles.layout}>
      <div className={styles.principal}>
        <label
          htmlFor="arquivo"
          className={`${styles.drop} rv`}
          data-arrastando={arrastando || undefined}
          data-erro={estado.tipo === "erro" || undefined}
          key={estado.tipo === "erro" ? estado.tentativa : 0}
          style={{ animationDelay: "260ms" }}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files[0];
            if (f && !enviando) void enviar(f);
          }}
        >
          <input
            ref={input}
            id="arquivo"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviar(f);
            }}
          />
          <span className={styles.dropIcone}>
            <IconUpload size={28} />
          </span>
          <span className={styles.dropTitulo}>{arrastando ? "Pode soltar" : "Arraste a planilha aqui"}</span>
          <span className={ui.muted} style={{ fontSize: 15 }}>
            ou <u>escolha um arquivo</u> · .xlsx de até 5 MB
          </span>
        </label>

        {estado.tipo === "enviando" && (
          <div className={`${styles.enviando} rv`} role="status">
            <span className={styles.enviandoTopo}>
              <strong>{estado.arquivo}</strong>
              <span className={ui.muted}>Lendo a planilha…</span>
            </span>
            <span className={styles.trilho}>
              <span className={styles.listras} />
            </span>
          </div>
        )}

        {estado.tipo === "erro" && (
          <p role="alert" className={styles.erro}>
            <IconAlert size={20} strokeWidth={2} />
            <span>
              <strong>Não foi possível importar.</strong> {estado.mensagem}
            </span>
          </p>
        )}

        {estado.tipo === "ok" && <Resumo resumo={estado.resumo} />}
      </div>

      <section className={`${ui.card} ${styles.historico} rv`} style={{ animationDelay: "340ms" }}>
        <h2 className={ui.cardTitle}>Envios anteriores</h2>
        {importacoes.length === 0 ? (
          <p className={ui.muted}>Nenhuma planilha enviada ainda.</p>
        ) : (
          <ol className={styles.timeline}>
            {importacoes.map((imp, i) => (
              <li key={imp.id}>
                <span className={styles.tlIcone} data-ultimo={i === 0 || undefined}>
                  <IconFile size={17} />
                </span>
                <span className={styles.tlTexto}>
                  <strong>{imp.arquivo}</strong>
                  <span className={ui.muted}>
                    {dataHora(imp.enviado_em)} · {imp.resumo.clientes.novos} novos, {imp.resumo.clientes.atualizados}{" "}
                    atualizados
                  </span>
                  <span className={`${ui.chip} ${imp.resumo.avisos.length ? ui.chipButter : ""}`}>
                    {imp.resumo.ja_importado
                      ? "Arquivo repetido"
                      : imp.resumo.avisos.length
                        ? `${imp.resumo.avisos.length} ${imp.resumo.avisos.length === 1 ? "aviso" : "avisos"}`
                        : "Sem avisos"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Resumo({ resumo }: { resumo: ImportSummary }) {
  const datas = resumo.datas_fechamento;
  return (
    <section aria-label="Resumo da importação" className={styles.resumo}>
      <div className={`${styles.status} rv`}>
        <span className={styles.statusIcone} data-repetido={resumo.ja_importado || undefined}>
          <IconCheck size={20} strokeWidth={2.6} className="pop" />
        </span>
        <span className={styles.tlTexto}>
          <strong>{resumo.ja_importado ? "Este arquivo já tinha sido enviado. Nada foi duplicado." : "Planilha importada"}</strong>
          <span className={ui.muted}>
            {resumo.arquivo}
            {datas.length > 0 && ` · ${datas.length === 1 ? "fechamento de" : "fechamentos de"} ${datas.map(data).join(", ")}`}
          </span>
        </span>
        <Link href="/" className={`${ui.inkBtn} press`}>
          Ver visão geral <IconArrowRight size={15} strokeWidth={2.2} />
        </Link>
      </div>

      <div className={styles.tiles}>
        <div className={`${styles.tile} lift rv`} data-tom="ink" style={{ animationDelay: "80ms" }}>
          <span>Clientes na planilha</span>
          <strong>{resumo.clientes.na_planilha}</strong>
          <span>
            {resumo.clientes.novos} novos · {resumo.clientes.atualizados} atualizados
          </span>
        </div>
        <div className={`${styles.tile} lift rv`} data-tom="pine" style={{ animationDelay: "140ms" }}>
          <span>Saldos novos</span>
          <strong>{resumo.saldos.novos}</strong>
          <span>
            {resumo.saldos.alterados} alterados · {resumo.saldos.inalterados} iguais
          </span>
        </div>
        <div className={`${styles.tile} lift rv`} data-tom="butter" style={{ animationDelay: "200ms" }}>
          <span>Diversificações</span>
          <strong>{resumo.diversificacoes}</strong>
          <span>{datas.length > 0 ? `valem para ${data(datas[datas.length - 1])}` : "da data mais recente"}</span>
        </div>
        <div className={`${styles.tile} lift rv`} data-tom={resumo.avisos.length ? "tomato" : "glass"} style={{ animationDelay: "260ms" }}>
          <span>Avisos</span>
          <strong>{resumo.avisos.length}</strong>
          <span>{resumo.avisos.length ? "linhas para conferir" : "nenhuma linha com problema"}</span>
        </div>
      </div>

      {resumo.avisos.length > 0 && (
        <div className={`${ui.card} rv`} style={{ animationDelay: "320ms", padding: 8, gap: 0 }}>
          <span className={styles.avisosTitulo}>Linhas ignoradas ou suspeitas</span>
          {resumo.avisos.map((a, i) => (
            <div key={i} className={ui.listRow}>
              <span className={`${ui.chip} ${ui.chipButter}`}>{a.linha === null ? "Geral" : `Linha ${a.linha}`}</span>
              <span>{a.mensagem}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
