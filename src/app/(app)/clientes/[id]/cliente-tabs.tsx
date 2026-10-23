"use client";

import { type ReactNode, useState } from "react";
import ui from "@/components/ui/ui.module.css";

/** Abas da tela do cliente. Os dois painéis já vêm prontos do servidor. */
export function ClienteTabs({ geral, historico }: { geral: ReactNode; historico: ReactNode }) {
  const [aba, setAba] = useState<"geral" | "historico">("geral");

  return (
    <>
      <div role="tablist" aria-label="Seções do cliente" className={`${ui.segmented} rv`} style={{ alignSelf: "flex-start", animationDelay: "300ms" }}>
        <button type="button" role="tab" id="aba-geral" aria-controls="painel-geral" aria-selected={aba === "geral"} onClick={() => setAba("geral")}>
          Visão geral
        </button>
        <button
          type="button"
          role="tab"
          id="aba-historico"
          aria-controls="painel-historico"
          aria-selected={aba === "historico"}
          onClick={() => setAba("historico")}
        >
          Histórico de fechamentos
        </button>
      </div>
      <div role="tabpanel" id="painel-geral" aria-labelledby="aba-geral" hidden={aba !== "geral"}>
        {geral}
      </div>
      <div role="tabpanel" id="painel-historico" aria-labelledby="aba-historico" hidden={aba !== "historico"}>
        {aba === "historico" && historico}
      </div>
    </>
  );
}
