import { createHash, randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Database, tables } from "@/db";
import type { ParseResult } from "./parse-workbook";

const { clients, imports, balanceSnapshots, allocationSnapshots } = tables;

export type ImportSummary = {
  importacao_id: string;
  arquivo: string;
  ja_importado: boolean;
  datas_fechamento: string[];
  clientes: { na_planilha: number; novos: number; atualizados: number };
  saldos: { novos: number; alterados: number; inalterados: number };
  diversificacoes: number;
  avisos: { linha: number | null; mensagem: string }[];
};

export const fileHash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/**
 * Grava o resultado do parser. A planilha é a fonte da verdade para saldo e
 * diversificação: reenviar o mesmo arquivo não duplica nada (upsert por
 * cliente+data) e fechamentos antigos que não vierem no arquivo são mantidos.
 * Tudo roda em um único lote atômico.
 */
export async function applyImport(
  db: Database,
  parsed: ParseResult,
  file: { name: string; hash: string },
): Promise<ImportSummary> {
  const codes = parsed.clients.map((c) => c.code);

  const existingClients = await db
    .select({ id: clients.id, code: clients.code })
    .from(clients)
    .where(inArray(clients.code, codes));
  const idByCode = new Map(existingClients.map((c) => [c.code, c.id]));
  const novos = parsed.clients.filter((c) => !idByCode.has(c.code)).length;
  for (const c of parsed.clients) if (!idByCode.has(c.code)) idByCode.set(c.code, randomUUID());

  const existingIds = existingClients.map((c) => c.id);
  const existingBalances = existingIds.length
    ? await db
        .select({
          clientId: balanceSnapshots.clientId,
          asOf: balanceSnapshots.asOf,
          balance: balanceSnapshots.balance,
        })
        .from(balanceSnapshots)
        .where(inArray(balanceSnapshots.clientId, existingIds))
    : [];
  const before = new Map(existingBalances.map((b) => [`${b.clientId}|${b.asOf}`, Number(b.balance)]));

  let saldosNovos = 0;
  let saldosAlterados = 0;
  let saldosInalterados = 0;
  for (const b of parsed.balances) {
    const prev = before.get(`${idByCode.get(b.code)}|${b.asOf}`);
    if (prev === undefined) saldosNovos++;
    else if (prev !== b.balance) saldosAlterados++;
    else saldosInalterados++;
  }

  const [sameFile] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(eq(imports.fileHash, file.hash))
    .limit(1);

  const importId = randomUUID();
  const summary: ImportSummary = {
    importacao_id: importId,
    arquivo: file.name,
    ja_importado: Boolean(sameFile),
    datas_fechamento: parsed.snapshotDates,
    clientes: { na_planilha: parsed.clients.length, novos, atualizados: parsed.clients.length - novos },
    saldos: { novos: saldosNovos, alterados: saldosAlterados, inalterados: saldosInalterados },
    diversificacoes: parsed.allocations.length,
    avisos: parsed.warnings.map((w) => ({ linha: w.row, mensagem: w.message })),
  };

  const statements: BatchItem<"pg">[] = [
    db.insert(imports).values({ id: importId, filename: file.name, fileHash: file.hash, summary }),
    db
      .insert(clients)
      .values(
        parsed.clients.map((c) => ({
          id: idByCode.get(c.code)!,
          code: c.code,
          name: c.name,
          openedOn: c.openedOn,
        })),
      )
      .onConflictDoUpdate({
        target: clients.code,
        set: {
          name: sql`excluded.name`,
          // não apaga uma data de abertura já conhecida se a célula vier vazia
          openedOn: sql`coalesce(excluded.opened_on, ${clients.openedOn})`,
          updatedAt: sql`now()`,
        },
      }),
  ];
  if (parsed.balances.length > 0) {
    statements.push(
      db
        .insert(balanceSnapshots)
        .values(
          parsed.balances.map((b) => ({
            clientId: idByCode.get(b.code)!,
            asOf: b.asOf,
            balance: b.balance.toFixed(2),
            importId,
          })),
        )
        .onConflictDoUpdate({
          target: [balanceSnapshots.clientId, balanceSnapshots.asOf],
          set: { balance: sql`excluded.balance`, importId: sql`excluded.import_id` },
        }),
    );
  }
  if (parsed.allocations.length > 0) {
    statements.push(
      db
        .insert(allocationSnapshots)
        .values(
          parsed.allocations.map((a) => ({
            clientId: idByCode.get(a.code)!,
            asOf: a.asOf,
            rf: String(a.rf),
            rv: String(a.rv),
            ci: String(a.ci),
            intl: String(a.intl),
            importId,
          })),
        )
        .onConflictDoUpdate({
          target: [allocationSnapshots.clientId, allocationSnapshots.asOf],
          set: {
            rf: sql`excluded.rf`,
            rv: sql`excluded.rv`,
            ci: sql`excluded.ci`,
            intl: sql`excluded.intl`,
            importId: sql`excluded.import_id`,
          },
        }),
    );
  }

  await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return summary;
}
