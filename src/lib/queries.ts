import { eq, max } from "drizzle-orm";
import { type Database, tables } from "@/db";
import type { ClientData, Distribution } from "@/lib/metrics";

const { clients, balanceSnapshots, allocationSnapshots } = tables;

/** Carrega clientes com saldos (crescente por data) e a diversificação mais recente. */
export async function loadClients(db: Database, onlyId?: string): Promise<ClientData[]> {
  const rows = await db.select().from(clients).where(onlyId ? eq(clients.id, onlyId) : undefined);
  if (rows.length === 0) return [];

  const snapQuery = db
    .select({
      clientId: balanceSnapshots.clientId,
      asOf: balanceSnapshots.asOf,
      balance: balanceSnapshots.balance,
    })
    .from(balanceSnapshots);
  const allocQuery = db.select().from(allocationSnapshots);
  const [snaps, allocs] = await Promise.all([
    onlyId ? snapQuery.where(eq(balanceSnapshots.clientId, onlyId)) : snapQuery,
    onlyId ? allocQuery.where(eq(allocationSnapshots.clientId, onlyId)) : allocQuery,
  ]);

  const snapsBy = new Map<string, ClientData["snapshots"]>();
  for (const s of snaps) {
    const list = snapsBy.get(s.clientId) ?? [];
    list.push({ asOf: s.asOf, balance: Number(s.balance) });
    snapsBy.set(s.clientId, list);
  }
  const latestAlloc = new Map<string, { asOf: string; dist: Distribution }>();
  for (const a of allocs) {
    const cur = latestAlloc.get(a.clientId);
    if (!cur || a.asOf > cur.asOf) {
      latestAlloc.set(a.clientId, {
        asOf: a.asOf,
        dist: { rf: Number(a.rf), rv: Number(a.rv), ci: Number(a.ci), int: Number(a.intl) },
      });
    }
  }

  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    openedOn: c.openedOn,
    snapshots: (snapsBy.get(c.id) ?? []).sort((a, b) => a.asOf.localeCompare(b.asOf)),
    allocation: latestAlloc.get(c.id)?.dist ?? null,
  }));
}

/** Fechamento mais recente de toda a base (referência para "saldo desatualizado"). */
export async function loadReferenceDate(db: Database): Promise<string | null> {
  const [row] = await db.select({ d: max(balanceSnapshots.asOf) }).from(balanceSnapshots);
  return row?.d ?? null;
}
