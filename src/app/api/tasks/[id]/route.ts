import { eq, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError, type IdContext, idParam, jsonBody, notFound, protectedRoute } from "@/lib/api/route";
import { taskDto, updateTaskSchema } from "@/lib/tasks";

const { tasks, clients } = tables;

export const PATCH = protectedRoute<IdContext>(async (req, ctx) => {
  const id = await idParam(ctx);
  const body = updateTaskSchema.parse(await jsonBody(req));
  const db = getDb();

  if (body.cliente_id) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, body.cliente_id));
    if (!c) throw new HttpError(400, "cliente_id não corresponde a nenhum cliente.");
  }

  const [row] = await db
    .update(tasks)
    .set({
      ...(body.titulo !== undefined && { title: body.titulo }),
      ...(body.data_limite !== undefined && { dueOn: body.data_limite }),
      ...(body.cliente_id !== undefined && { clientId: body.cliente_id }),
      ...(body.status !== undefined && {
        status: body.status,
        completedAt: body.status === "done" ? sql`now()` : null,
      }),
      updatedAt: sql`now()`,
    })
    .where(eq(tasks.id, id))
    .returning();
  if (!row) throw notFound("Tarefa");

  const [c] = row.clientId
    ? await db.select({ name: clients.name }).from(clients).where(eq(clients.id, row.clientId))
    : [];
  return Response.json(taskDto({ ...row, clientName: c?.name ?? null }));
});

export const DELETE = protectedRoute<IdContext>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const deleted = await getDb().delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
  if (deleted.length === 0) throw notFound("Tarefa");
  return new Response(null, { status: 204 });
});
