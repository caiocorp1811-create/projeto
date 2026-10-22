import type { Metadata } from "next";
import { IconTrend, IconUsers } from "@/components/icons";
import { HeaderStat, PageHeader } from "@/components/page-header";
import ui from "@/components/ui/ui.module.css";
import { getClientList } from "@/lib/data";
import { data } from "@/lib/format";
import { ClientesView, type Situacao } from "./clientes-view";

export const metadata: Metadata = { title: "Clientes" };

const SITUACOES: Situacao[] = ["todos", "ativos", "desatualizados", "zerados"];

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const { situacao } = await searchParams;
  const inicial = SITUACOES.includes(situacao as Situacao) ? (situacao as Situacao) : "todos";
  const lista = await getClientList();
  const ativos = lista.clientes.filter((c) => c.ativo && !c.saldo_desatualizado).length;
  const desatualizados = lista.clientes.filter((c) => c.saldo_desatualizado).length;

  return (
    <>
      <PageHeader linhas={["Seus", "clientes"]}>
        <HeaderStat
          icon={<IconUsers />}
          valor={lista.total}
          selo={desatualizados > 0 && <span className={`${ui.chip} ${ui.chipButter}`}>{desatualizados} desatualizados</span>}
          legenda="Clientes na carteira"
        />
        <HeaderStat
          icon={<IconTrend />}
          delay={280}
          valor={ativos}
          legenda={lista.data_referencia ? `Ativos no fechamento de ${data(lista.data_referencia)}` : "Ativos"}
        />
      </PageHeader>
      <ClientesView clientes={lista.clientes} situacaoInicial={inicial} />
    </>
  );
}
