import "server-only";
import { and, count, desc, eq, isNotNull, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { getDb, tables } from "@/db";
import type { ImportSummary } from "@/lib/import/apply-import";
import { clientDetail, dashboard, listClients, presentationView } from "@/lib/metrics";
import { loadClients, loadReferenceDate } from "@/lib/queries";
import { noteDto, sortTasks, taskDto, todayInSaoPaulo } from "@/lib/tasks";

/**
 * Leitura de dados para os Server Components. Monta as mesmas respostas que a
 * API (mesmas funções de @/lib/metrics), mas sem passar por HTTP.
 * Toda função confere a sessão antes de tocar no banco.
 */

async function requireSession() {
  if (!(await auth())?.user) redirect("/login");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getDashboard() {
  await requireSession();
  const clients = await loadClients(getDb());
  return { resumo: dashboard(clients), lista: listClients(clients, { sort: "saldo", desc: true }) };
}

export async function getClientList() {
  await requireSession();
  return listClients(await loadClients(getDb()), { sort: "saldo", desc: true });
}

/**
 * Visão interna completa (com tarefas e notas), ou null se o id não existir.
 * Com cache por requisição: o título da página e a página usam a mesma consulta.
 */
export const getClientDetail = cache(async (id: string) => {
  await requireSession();
  if (!UUID.test(id)) return null;
  const db = getDb();
  const [[client], refDate, tarefas, notas] = await Promise.all([
    loadClients(db, id),
    loadReferenceDate(db),
    db.select().from(tables.tasks).where(eq(tables.tasks.clientId, id)),
    db
      .select()
      .from(tables.clientNotes)
      .where(eq(tables.clientNotes.clientId, id))
      .orderBy(desc(tables.clientNotes.createdAt)),
  ]);
  if (!client) return null;
  return {
    ...clientDetail(client, refDate),
    tarefas: sortTasks(tarefas.map((t) => taskDto(t))),
    notas: notas.map(noteDto),
  };
});

/** Só o que o cliente pode ver (mesmo filtro da rota de apresentação). */
export const getPresentation = cache(async (id: string) => {
  await requireSession();
  if (!UUID.test(id)) return null;
  const db = getDb();
  const [[client], refDate] = await Promise.all([loadClients(db, id), loadReferenceDate(db)]);
  return client ? presentationView(client, refDate) : null;
});

/** Todas as tarefas (abertas e concluídas), já ordenadas, com o nome do cliente. */
export async function getTasks() {
  await requireSession();
  const rows = await getDb()
    .select({ task: tables.tasks, clientName: tables.clients.name })
    .from(tables.tasks)
    .leftJoin(tables.clients, eq(tables.tasks.clientId, tables.clients.id));
  return sortTasks(rows.map(({ task, clientName }) => taskDto({ ...task, clientName })));
}

/** Clientes para os seletores (id e nome), em ordem alfabética. */
export async function getClientOptions() {
  await requireSession();
  const rows = await getDb()
    .select({ id: tables.clients.id, nome: tables.clients.name })
    .from(tables.clients);
  return rows.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quantas tarefas abertas estão atrasadas (para o aviso no topo). */
export async function getLateTaskCount() {
  await requireSession();
  const [row] = await getDb()
    .select({ n: count() })
    .from(tables.tasks)
    .where(
      and(
        eq(tables.tasks.status, "open"),
        isNotNull(tables.tasks.dueOn),
        lt(tables.tasks.dueOn, todayInSaoPaulo()),
      ),
    );
  return row?.n ?? 0;
}

export async function getImports(limit = 50) {
  await requireSession();
  const rows = await getDb()
    .select()
    .from(tables.imports)
    .orderBy(desc(tables.imports.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    arquivo: r.filename,
    enviado_em: r.createdAt.toISOString(),
    resumo: r.summary as ImportSummary,
  }));
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
export type ClientDetailData = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;
export type PresentationData = NonNullable<Awaited<ReturnType<typeof getPresentation>>>;
export type ImportItem = Awaited<ReturnType<typeof getImports>>[number];
