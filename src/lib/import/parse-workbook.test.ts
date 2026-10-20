import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseWorkbook, WorkbookFormatError } from "./parse-workbook";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Planilha sintética com o mesmo layout da `Planilha2` real. */
async function buildWorkbook(
  rows: (ExcelJS.CellValue[] | null)[],
  dates: string[] = ["2026-09-11", "2026-10-09"],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Planilha1").getCell("A1").value = "visão derivada";
  const ws = wb.addWorksheet("Planilha2");
  ws.getCell("B1").value = "Código";
  ws.getCell("C1").value = "Clientes";
  ws.getCell("D1").value = "Data abertura de conta";
  ws.getCell("E1").value = "DIVERSIFICAÇÃO";
  ws.getCell("L1").value = "SALDO";
  ws.getCell("C2").value = "Nome";
  ["RF", "RV", "CI", "INT."].forEach((h, i) => (ws.getCell(2, 5 + i).value = h));
  dates.forEach((iso, i) => (ws.getCell(2, 12 + i).value = d(iso)));
  rows.forEach((cells, i) => {
    if (!cells) return;
    cells.forEach((v, c) => {
      if (v !== undefined) ws.getCell(3 + i, 2 + c).value = v;
    });
  });
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// colunas: B código, C nome, D abertura, E RF, F RV, G CI, H INT, I-K vazias, L.. saldos
const row = (
  code: number | null,
  name: string,
  opened: string | null,
  alloc: (number | undefined)[],
  balances: (number | undefined)[],
): ExcelJS.CellValue[] => [
  code,
  name,
  opened ? d(opened) : undefined,
  ...[0, 1, 2, 3].map((i) => alloc[i]), // sempre 4 colunas: RF, RV, CI, INT
  undefined,
  undefined,
  undefined,
  ...balances,
];

describe("parseWorkbook (planilha sintética)", () => {
  it("lê clientes, saldos por data e diversificação", async () => {
    const buf = await buildWorkbook([
      row(101, "  Ana  Teste ", "2024-01-15", [0.6, 0.4], [1000.126, 1100]),
      row(102, "Bia Teste", null, [], [0, undefined]),
    ]);
    const r = await parseWorkbook(buf);

    expect(r.snapshotDates).toEqual(["2026-09-11", "2026-10-09"]);
    expect(r.clients).toMatchObject([
      { code: "101", name: "Ana Teste", openedOn: "2024-01-15" },
      { code: "102", name: "Bia Teste", openedOn: null },
    ]);
    expect(r.balances).toEqual([
      { code: "101", asOf: "2026-09-11", balance: 1000.13 },
      { code: "101", asOf: "2026-10-09", balance: 1100 },
      // 0 explícito é saldo; célula vazia (102 em 10/09) não gera linha
      { code: "102", asOf: "2026-09-11", balance: 0 },
    ]);
    // diversificação é associada à data de fechamento mais recente
    expect(r.allocations).toEqual([
      { code: "101", asOf: "2026-10-09", rf: 0.6, rv: 0.4, ci: 0, intl: 0 },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("aceita fórmulas (usa o resultado) e novas colunas de data à direita", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Dados");
    ws.getCell("B1").value = "Código";
    ws.getCell("L1").value = "SALDO";
    ws.getCell("L2").value = d("2026-09-11");
    ws.getCell("M2").value = d("2026-10-09");
    ws.getCell("N2").value = d("2026-11-10");
    ws.getCell("B3").value = 5;
    ws.getCell("C3").value = "Cli Formula";
    ws.getCell("L3").value = { formula: "A1", result: 10 };
    ws.getCell("N3").value = "1.234,56"; // texto pt-BR
    const r = await parseWorkbook(new Uint8Array(await wb.xlsx.writeBuffer()));
    expect(r.snapshotDates).toHaveLength(3);
    expect(r.balances).toEqual([
      { code: "5", asOf: "2026-09-11", balance: 10 },
      { code: "5", asOf: "2026-11-10", balance: 1234.56 },
    ]);
  });

  it("ignora linha de total e avisa de problemas por linha", async () => {
    const buf = await buildWorkbook([
      row(1, "Ok", null, [0.5, 0.5], [10, 20]),
      row(1, "Duplicado", null, [], [1, 1]),
      row(null, "Sem Codigo", null, [], [1, 1]),
      row(3, "Soma errada", null, [0.5, 0.2], [5, 5]),
      row(4, "Alloc fora", null, [63.47], [5, 5]),
      row(5, "Negativo", null, [], [-5, 5]),
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 99, 99], // total
    ]);
    const r = await parseWorkbook(buf);
    expect(r.clients.map((c) => c.code)).toEqual(["1", "3", "4", "5"]);
    const msgs = r.warnings.map((w) => w.message).join("\n");
    expect(msgs).toMatch(/repetido/);
    expect(msgs).toMatch(/sem código/);
    expect(msgs).toMatch(/soma 70\.00%/);
    expect(msgs).toMatch(/Diversificação inválida/);
    expect(msgs).toMatch(/Saldo negativo/);
    expect(r.allocations.map((a) => a.code)).toEqual(["1", "3"]);
    expect(r.balances.find((b) => b.code === "5" && b.asOf === "2026-09-11")).toBeUndefined();
  });

  it("rejeita arquivo que não é planilha de dados", async () => {
    await expect(parseWorkbook(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(
      WorkbookFormatError,
    );
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("X").getCell("A1").value = "nada";
    const buf = new Uint8Array(await wb.xlsx.writeBuffer());
    await expect(parseWorkbook(buf)).rejects.toThrow(/aba de dados/);
  });
});

// A planilha real tem dados de clientes e não vai para o git: só roda se existir.
const realFile = path.resolve(__dirname, "../../../planilha-dados-caio.xlsx");
describe.skipIf(!existsSync(realFile))("parseWorkbook (planilha real, local)", () => {
  it("lê a Planilha2 do Caio", async () => {
    const r = await parseWorkbook(new Uint8Array(readFileSync(realFile)));
    expect(r.clients).toHaveLength(24);
    expect(r.snapshotDates).toEqual(["2026-09-11", "2026-10-09"]);

    // confere contra a linha de total da própria planilha (soma feita pelo Excel)
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(realFile);
    const sheet = wb.getWorksheet("Planilha2")!;
    const excelTotal = (cell: string) => Number((sheet.getCell(cell).value as { result: number }).result);
    const total = (date: string) =>
      r.balances.filter((b) => b.asOf === date).reduce((s, b) => s + b.balance, 0);
    expect(total("2026-09-11")).toBeCloseTo(excelTotal("L27"), 1);
    expect(total("2026-10-09")).toBeCloseTo(excelTotal("M27"), 1);
    expect(r.allocations.length).toBeGreaterThan(0);
  });
});
