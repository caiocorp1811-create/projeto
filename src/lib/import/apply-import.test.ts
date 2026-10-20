import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import { dashboard } from "@/lib/metrics";
import { loadClients } from "@/lib/queries";
import { applyImport } from "./apply-import";
import type { ParseResult } from "./parse-workbook";

// Postgres real em memória (PGlite) rodando a migration de verdade.
// O driver do PGlite não tem `batch` (o do Neon tem); aqui ele roda os comandos em sequência.
async function freshDb() {
  const client = new PGlite();
  const dir = path.resolve(import.meta.dirname, "../../../drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  const db = drizzle(client, { schema });
  Object.assign(db, {
    batch: async (stmts: PromiseLike<unknown>[]) => {
      for (const s of stmts) await s;
    },
  });
  return db as unknown as Database & typeof db;
}

const file = (n: number) => ({ name: `mes${n}.xlsx`, hash: `hash-${n}` });

const parsed = (over: Partial<ParseResult> = {}): ParseResult => ({
  clients: [
    { code: "101", name: "Ana", openedOn: "2024-01-15", row: 3 },
    { code: "102", name: "Bia", openedOn: null, row: 4 },
  ],
  balances: [
    { code: "101", asOf: "2026-09-11", balance: 1000 },
    { code: "101", asOf: "2026-10-09", balance: 1100.5 },
    { code: "102", asOf: "2026-09-11", balance: 0 },
    { code: "102", asOf: "2026-10-09", balance: 500 },
  ],
  allocations: [
    { code: "101", asOf: "2026-10-09", rf: 0.6, rv: 0.4, ci: 0, intl: 0 },
    { code: "102", asOf: "2026-10-09", rf: 1, rv: 0, ci: 0, intl: 0 },
  ],
  snapshotDates: ["2026-09-11", "2026-10-09"],
  warnings: [],
  ...over,
});

let db: Awaited<ReturnType<typeof freshDb>>;
beforeEach(async () => {
  db = await freshDb();
});

const counts = async () => ({
  clients: (await db.select({ n: count() }).from(schema.clients))[0].n,
  balances: (await db.select({ n: count() }).from(schema.balanceSnapshots))[0].n,
  allocations: (await db.select({ n: count() }).from(schema.allocationSnapshots))[0].n,
});

describe("applyImport (Postgres real em memória)", () => {
  it("grava clientes, saldos e diversificação e devolve o resumo", async () => {
    const s = await applyImport(db, parsed(), file(1));
    expect(s).toMatchObject({
      ja_importado: false,
      clientes: { na_planilha: 2, novos: 2, atualizados: 0 },
      saldos: { novos: 4, alterados: 0, inalterados: 0 },
      diversificacoes: 2,
    });
    expect(await counts()).toEqual({ clients: 2, balances: 4, allocations: 2 });
  });

  it("reenviar o mesmo arquivo não duplica nada", async () => {
    await applyImport(db, parsed(), file(1));
    const s = await applyImport(db, parsed(), file(1));
    expect(s).toMatchObject({
      ja_importado: true,
      clientes: { novos: 0, atualizados: 2 },
      saldos: { novos: 0, alterados: 0, inalterados: 4 },
    });
    expect(await counts()).toEqual({ clients: 2, balances: 4, allocations: 2 });
  });

  it("mês novo acrescenta, valor corrigido altera e o histórico antigo é mantido", async () => {
    await applyImport(db, parsed(), file(1));
    const s = await applyImport(
      db,
      parsed({
        // 2ª planilha: só 09/10 corrigido e 10/11 novo (09/09 não vem mais no arquivo)
        balances: [
          { code: "101", asOf: "2026-10-09", balance: 1200 },
          { code: "101", asOf: "2026-11-10", balance: 1300 },
        ],
        allocations: [{ code: "101", asOf: "2026-11-10", rf: 0.5, rv: 0.5, ci: 0, intl: 0 }],
        snapshotDates: ["2026-10-09", "2026-11-10"],
      }),
      file(2),
    );
    expect(s.saldos).toEqual({ novos: 1, alterados: 1, inalterados: 0 });
    expect(await counts()).toEqual({ clients: 2, balances: 5, allocations: 3 });

    const ana = (await loadClients(db)).find((c) => c.code === "101")!;
    expect(ana.snapshots.map((x) => [x.asOf, x.balance])).toEqual([
      ["2026-09-11", 1000],
      ["2026-10-09", 1200],
      ["2026-11-10", 1300],
    ]);
    // diversificação vigente = a mais recente
    expect(ana.allocation).toEqual({ rf: 0.5, rv: 0.5, ci: 0, int: 0 });
  });

  it("célula de abertura vazia não apaga a data já conhecida; nome é atualizado", async () => {
    await applyImport(db, parsed(), file(1));
    await applyImport(
      db,
      parsed({ clients: [{ code: "101", name: "Ana Maria", openedOn: null, row: 3 }], balances: [], allocations: [] }),
      file(2),
    );
    const ana = (await loadClients(db)).find((c) => c.code === "101")!;
    expect(ana).toMatchObject({ name: "Ana Maria", openedOn: "2024-01-15" });
  });

  it("os dados lidos do banco alimentam o dashboard", async () => {
    await applyImport(db, parsed(), file(1));
    const d = dashboard(await loadClients(db));
    expect(d).toMatchObject({
      data_referencia: "2026-10-09",
      patrimonio_total: 1600.5,
      clientes_ativos: 2,
    });
    expect(d.evolucao.map((e) => e.patrimonio)).toEqual([1000, 1600.5]);
  });

  it("o banco recusa status de tarefa inválido e aceita tarefa geral", async () => {
    await db.insert(schema.tasks).values({ title: "Geral" });
    await expect(
      db.insert(schema.tasks).values({ title: "x", status: "talvez" }),
    ).rejects.toThrow();
  });
});
