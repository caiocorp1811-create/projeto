import ExcelJS from "exceljs";

export type ParsedClient = {
  code: string;
  name: string;
  openedOn: string | null;
  row: number;
};

export type ParsedBalance = { code: string; asOf: string; balance: number };

export type ParsedAllocation = {
  code: string;
  asOf: string;
  rf: number;
  rv: number;
  ci: number;
  intl: number;
};

export type ParseWarning = { row: number | null; message: string };

export type ParseResult = {
  clients: ParsedClient[];
  balances: ParsedBalance[];
  allocations: ParsedAllocation[];
  /** Datas de fechamento encontradas, em ordem crescente (YYYY-MM-DD). */
  snapshotDates: string[];
  warnings: ParseWarning[];
};

/** Erro que invalida o arquivo inteiro (layout fora do esperado). */
export class WorkbookFormatError extends Error {}

const ALLOCATION_HEADERS = { RF: "rf", RV: "rv", CI: "ci", INT: "intl" } as const;
type AllocationKey = (typeof ALLOCATION_HEADERS)[keyof typeof ALLOCATION_HEADERS];

/** "Código" -> "CODIGO", "INT." -> "INT". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Resolve fórmulas, rich text e erros do Excel para um valor simples. */
function plain(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined || value instanceof Date) {
    return value ?? null;
  }
  if (typeof value === "object") {
    if ("error" in value) return null;
    if ("result" in value) return plain(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text);
    return null;
  }
  return value;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "");
    if (cleaned === "") return null;
    // pt-BR: "1.234,56" -> 1234.56
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function toCode(value: unknown): string | null {
  const n = toNumber(value);
  if (n === null || !Number.isInteger(n) || n <= 0) return null;
  return String(n);
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function findDataSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  // A aba de dados é a que tem os cabeçalhos "Código" e "SALDO".
  for (const ws of workbook.worksheets) {
    const headers = new Set<string>();
    for (let r = 1; r <= Math.min(ws.rowCount, 5); r++) {
      ws.getRow(r).eachCell((cell) => {
        const v = plain(cell.value);
        if (typeof v === "string") headers.add(normalize(v));
      });
    }
    if (headers.has("CODIGO") && headers.has("SALDO")) return ws;
  }
  throw new WorkbookFormatError(
    'Não encontrei a aba de dados: ela precisa ter as colunas "Código" e "SALDO".',
  );
}

export async function parseWorkbook(
  data: ArrayBuffer | Uint8Array,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  } catch {
    throw new WorkbookFormatError("O arquivo não é um .xlsx válido.");
  }
  const ws = findDataSheet(workbook);

  // --- cabeçalhos ---------------------------------------------------------
  let codeCol = 0;
  let saldoCol = 0;
  const allocCols = new Map<AllocationKey, number>();
  let headerRows = 1;

  for (let r = 1; r <= Math.min(ws.rowCount, 5); r++) {
    ws.getRow(r).eachCell((cell, col) => {
      const v = plain(cell.value);
      if (typeof v !== "string") return;
      const key = normalize(v);
      if (key === "CODIGO" && !codeCol) codeCol = col;
      if (key === "SALDO" && !saldoCol) saldoCol = col;
      if (key in ALLOCATION_HEADERS) {
        allocCols.set(ALLOCATION_HEADERS[key as keyof typeof ALLOCATION_HEADERS], col);
        headerRows = Math.max(headerRows, r);
      }
    });
  }

  // Colunas de saldo: toda coluna a partir de "SALDO" cujo cabeçalho é uma data.
  const dateCols: { col: number; asOf: string }[] = [];
  let dateRow = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 5) && dateCols.length === 0; r++) {
    ws.getRow(r).eachCell((cell, col) => {
      if (col < saldoCol) return;
      const asOf = toIsoDate(plain(cell.value));
      if (asOf) dateCols.push({ col, asOf });
    });
    if (dateCols.length > 0) dateRow = r;
  }
  if (dateCols.length === 0) {
    throw new WorkbookFormatError(
      "Não encontrei colunas de saldo com data de fechamento no cabeçalho.",
    );
  }
  const seenDates = new Set<string>();
  for (const { asOf } of dateCols) {
    if (seenDates.has(asOf)) {
      throw new WorkbookFormatError(`Data de fechamento repetida no cabeçalho: ${asOf}.`);
    }
    seenDates.add(asOf);
  }

  const nameCol = codeCol + 1;
  const openedCol = codeCol + 2;
  const firstDataRow = Math.max(headerRows, dateRow) + 1;
  const snapshotDates = dateCols.map((d) => d.asOf).sort();
  const allocationDate = snapshotDates[snapshotDates.length - 1];

  // --- linhas -------------------------------------------------------------
  const result: ParseResult = {
    clients: [],
    balances: [],
    allocations: [],
    snapshotDates,
    warnings: [],
  };
  const seenCodes = new Set<string>();
  const warn = (row: number | null, message: string) =>
    result.warnings.push({ row, message });

  for (let r = firstDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = toCode(plain(row.getCell(codeCol).value));
    const name = cleanName(plain(row.getCell(nameCol).value));

    if (!code) {
      // Linha de total ou em branco passa em silêncio; cliente sem código avisa.
      if (name) warn(r, `Cliente "${name}" sem código válido: linha ignorada.`);
      continue;
    }
    if (!name) {
      warn(r, `Código ${code} sem nome: linha ignorada.`);
      continue;
    }
    if (seenCodes.has(code)) {
      warn(r, `Código ${code} repetido: linha ignorada.`);
      continue;
    }
    seenCodes.add(code);

    result.clients.push({
      code,
      name,
      openedOn: toIsoDate(plain(row.getCell(openedCol).value)),
      row: r,
    });

    // Célula vazia = sem fechamento naquela data (diferente de um 0 explícito).
    for (const { col, asOf } of dateCols) {
      const raw = plain(row.getCell(col).value);
      if (raw === null || raw === "") continue;
      const balance = toNumber(raw);
      if (balance === null) {
        warn(r, `Saldo inválido em ${asOf} para o código ${code}: ignorado.`);
      } else if (balance < 0) {
        warn(r, `Saldo negativo em ${asOf} para o código ${code}: ignorado.`);
      } else {
        result.balances.push({ code, asOf, balance: round2(balance) });
      }
    }

    // Diversificação é uma foto única; vale para a data de fechamento mais recente.
    const alloc: Record<AllocationKey, number> = { rf: 0, rv: 0, ci: 0, intl: 0 };
    let hasAlloc = false;
    let allocValid = true;
    for (const [key, col] of allocCols) {
      const raw = plain(row.getCell(col).value);
      if (raw === null || raw === "") continue;
      const n = toNumber(raw);
      if (n === null || n < 0 || n > 1) {
        allocValid = false;
        warn(r, `Diversificação inválida (${key}) para o código ${code}: ignorada.`);
        break;
      }
      alloc[key] = n;
      hasAlloc = true;
    }
    if (hasAlloc && allocValid) {
      const sum = alloc.rf + alloc.rv + alloc.ci + alloc.intl;
      if (Math.abs(sum - 1) > 0.01) {
        warn(r, `Diversificação do código ${code} soma ${(sum * 100).toFixed(2)}%, não 100%.`);
      }
      result.allocations.push({ code, asOf: allocationDate, ...alloc });
    }
  }

  if (result.clients.length === 0) {
    throw new WorkbookFormatError("Nenhum cliente encontrado na planilha.");
  }
  return result;
}
