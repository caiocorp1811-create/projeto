import { z } from "zod";
import { getDb } from "@/db";
import { protectedRoute } from "@/lib/api/route";
import { listClients } from "@/lib/metrics";
import { loadClients } from "@/lib/queries";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  ativo: z.enum(["true", "false"]).optional(),
  ordenar: z.enum(["nome", "saldo", "variacao"]).optional(),
  ordem: z.enum(["asc", "desc"]).optional(),
});

export const GET = protectedRoute(async (req) => {
  const p = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const clients = await loadClients(getDb());
  return Response.json(
    listClients(clients, {
      q: p.q,
      ativo: p.ativo === undefined ? undefined : p.ativo === "true",
      sort: p.ordenar,
      desc: p.ordem === "desc",
    }),
  );
});
