import { desc } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError, protectedRoute } from "@/lib/api/route";
import { applyImport, fileHash } from "@/lib/import/apply-import";
import { parseWorkbook } from "@/lib/import/parse-workbook";

const MAX_BYTES = 5 * 1024 * 1024;

/** Envia a planilha mensal (multipart, campo `arquivo`). Devolve o resumo do que mudou. */
export const POST = protectedRoute(async (req) => {
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Envie o arquivo como multipart/form-data no campo `arquivo`.");
  });
  const file = form.get("arquivo");
  if (!(file instanceof File)) throw new HttpError(400, "Campo `arquivo` ausente.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new HttpError(400, "Envie uma planilha no formato .xlsx.");
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    throw new HttpError(400, "Arquivo vazio ou maior que 5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseWorkbook(bytes);
  const summary = await applyImport(getDb(), parsed, { name: file.name, hash: fileHash(bytes) });
  return Response.json(summary, { status: 201 });
});

/** Histórico dos últimos uploads. */
export const GET = protectedRoute(async () => {
  const rows = await getDb()
    .select()
    .from(tables.imports)
    .orderBy(desc(tables.imports.createdAt))
    .limit(50);
  return Response.json({
    importacoes: rows.map((r) => ({
      id: r.id,
      arquivo: r.filename,
      enviado_em: r.createdAt.toISOString(),
      resumo: r.summary,
    })),
  });
});
