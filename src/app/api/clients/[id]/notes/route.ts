import { desc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { type IdContext, idParam, jsonBody, notFound, protectedRoute } from "@/lib/api/route";
import { noteDto, noteSchema } from "@/lib/tasks";

const { clientNotes, clients } = tables;

async function assertClient(id: string) {
  const [c] = await getDb().select({ id: clients.id }).from(clients).where(eq(clients.id, id));
  if (!c) throw notFound("Cliente");
}

export const GET = protectedRoute<IdContext>(async (_req, ctx) => {
  const id = await idParam(ctx);
  await assertClient(id);
  const rows = await getDb()
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, id))
    .orderBy(desc(clientNotes.createdAt));
  return Response.json({ notas: rows.map(noteDto) });
});

export const POST = protectedRoute<IdContext>(async (req, ctx) => {
  const id = await idParam(ctx);
  const { texto } = noteSchema.parse(await jsonBody(req));
  await assertClient(id);
  const [row] = await getDb().insert(clientNotes).values({ clientId: id, body: texto }).returning();
  return Response.json(noteDto(row), { status: 201 });
});
