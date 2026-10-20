import { getDb } from "@/db";
import { type IdContext, idParam, notFound, protectedRoute } from "@/lib/api/route";
import { presentationView } from "@/lib/metrics";
import { loadClients, loadReferenceDate } from "@/lib/queries";

/**
 * Modo apresentação: dados que o cliente pode ver. O filtro é feito aqui no
 * servidor. Esta rota nem consulta notas ou tarefas, então não há como vazarem.
 */
export const GET = protectedRoute<IdContext>(async (_req, ctx) => {
  const id = await idParam(ctx);
  const db = getDb();
  const [[client], refDate] = await Promise.all([loadClients(db, id), loadReferenceDate(db)]);
  if (!client) throw notFound("Cliente");
  return Response.json(presentationView(client, refDate));
});
