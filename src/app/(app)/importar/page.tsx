import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import ui from "@/components/ui/ui.module.css";
import { getImports } from "@/lib/data";
import { ImportarView } from "./importar-view";

export const metadata: Metadata = { title: "Importar planilha" };

export default async function ImportarPage() {
  const importacoes = await getImports();

  return (
    <>
      <PageHeader linhas={["Importar", "planilha"]}>
        <p className={`${ui.muted} rv`} style={{ maxWidth: 460, fontSize: 16, lineHeight: 1.5, animationDelay: "220ms" }}>
          A planilha é a fonte dos saldos e da diversificação. Reenviar o mesmo arquivo não duplica nada.
        </p>
      </PageHeader>
      <ImportarView importacoes={importacoes} />
    </>
  );
}
