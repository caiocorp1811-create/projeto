import { eq, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { type IdContext, idParam, jsonBody, notFound, protectedRoute } from "@/lib/api/route";
import { noteDto, noteSchema } from "@/lib/tasks";

const { clientNotes } = tables;

export const PATCH = protectedRoute<IdContext>(async (req, ctx) => {
  const id = await idParam(ctx);
  const { texto } = noteSchema.parse(await jsonBody(req));
  const [row] = await getDb()
    .update(clientNotes)
    .set({ body: texto, updatedAt: sql`now()` })
    .where(eq(clientNotes.id, id))
    .returning();
  if (!row) throw notFound("Nota");
  return Response.json(noteDto(row));
});

export const DELETE = protectedRoute<IdContext>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const deleted = await getDb()
    .delete(clientNotes)
    .where(eq(clientNotes.id, id))
    .returning({ id: clientNotes.id });
  if (deleted.length === 0) throw notFound("Nota");
  return new Response(null, { status: 204 });
});
