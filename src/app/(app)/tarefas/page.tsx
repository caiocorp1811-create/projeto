import type { Metadata } from "next";
import { IconChecklist } from "@/components/icons";
import { HeaderStat, PageHeader } from "@/components/page-header";
import ui from "@/components/ui/ui.module.css";
import { getClientOptions, getTasks } from "@/lib/data";
import { nomeProprio } from "@/lib/format";
import { TarefasView } from "./tarefas-view";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TarefasPage({ searchParams }: PageProps<"/tarefas">) {
  const { cliente } = await searchParams;
  const [tarefas, opcoes] = await Promise.all([getTasks(), getClientOptions()]);
  const clientes = opcoes.map((c) => ({ id: c.id, nome: nomeProprio(c.nome) }));
  const preSelecionado = typeof cliente === "string" && clientes.some((c) => c.id === cliente) ? cliente : "";
  const abertas = tarefas.filter((t) => t.status === "open");
  const atrasadas = abertas.filter((t) => t.atrasada).length;

  return (
    <>
      <PageHeader linhas={["Suas", "tarefas"]}>
        <HeaderStat
          icon={<IconChecklist />}
          valor={abertas.length}
          selo={atrasadas > 0 && <span className={`${ui.chip} ${ui.chipTomato}`}>{atrasadas} atrasadas</span>}
          legenda="Tarefas abertas"
        />
      </PageHeader>
      <TarefasView tarefas={tarefas} clientes={clientes} clienteInicial={preSelecionado} />
    </>
  );
}
