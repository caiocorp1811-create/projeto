import { getDb } from "@/db";
import { protectedRoute } from "@/lib/api/route";
import { dashboard } from "@/lib/metrics";
import { loadClients } from "@/lib/queries";

export const GET = protectedRoute(async () => {
  return Response.json(dashboard(await loadClients(getDb())));
});
