import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, tables } from "@/db";
import { HttpError, jsonBody, protectedRoute } from "@/lib/api/route";
import { createTaskSchema, sortTasks, taskDto } from "@/lib/tasks";

const { tasks, clients } = tables;

const querySchema = z.object({
  status: z.enum(["open", "done", "todas"]).default("open"),
  // um id de cliente, ou "geral" para tarefas sem cliente
  cliente_id: z.union([z.uuid(), z.literal("geral")]).optional(),
});

export const GET = protectedRoute(async (req) => {
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await getDb()
    .select({ task: tasks, clientName: clients.name })
    .from(tasks)
    .leftJoin(clients, eq(tasks.clientId, clients.id));

  const list = rows
    .filter(({ task }) => q.status === "todas" || task.status === q.status)
    .filter(({ task }) =>
      q.cliente_id === undefined
        ? true
        : q.cliente_id === "geral"
          ? task.clientId === null
          : task.clientId === q.cliente_id,
    )
    .map(({ task, clientName }) => taskDto({ ...task, clientName }));
  return Response.json({ tarefas: sortTasks(list) });
});

export const POST = protectedRoute(async (req) => {
  const body = createTaskSchema.parse(await jsonBody(req));
  const db = getDb();

  let clientName: string | null = null;
  if (body.cliente_id) {
    const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, body.cliente_id));
    if (!c) throw new HttpError(400, "cliente_id não corresponde a nenhum cliente.");
    clientName = c.name;
  }

  const [row] = await db
    .insert(tasks)
    .values({ title: body.titulo, dueOn: body.data_limite ?? null, clientId: body.cliente_id ?? null })
    .returning();
  return Response.json(taskDto({ ...row, clientName }), { status: 201 });
});
