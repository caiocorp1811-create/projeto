import { desc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { type IdContext, idParam, notFound, protectedRoute } from "@/lib/api/route";
import { clientDetail } from "@/lib/metrics";
import { loadClients, loadReferenceDate } from "@/lib/queries";
import { noteDto, sortTasks, taskDto } from "@/lib/tasks";

/** Visão interna completa do cliente: inclui tarefas e notas. */
export const GET = protectedRoute<IdContext>(async (_req, ctx) => {
  const id = await idParam(ctx);
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
  if (!client) throw notFound("Cliente");

  return Response.json({
    ...clientDetail(client, refDate),
    tarefas: sortTasks(tarefas.map((t) => taskDto(t))),
    notas: notas.map(noteDto),
  });
});
