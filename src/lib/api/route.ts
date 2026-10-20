import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { WorkbookFormatError } from "@/lib/import/parse-workbook";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Recurso") => new HttpError(404, `${what} não encontrado.`);

function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ erro: e.message }, { status: e.status });
  if (e instanceof WorkbookFormatError) return Response.json({ erro: e.message }, { status: 422 });
  if (e instanceof ZodError) {
    return Response.json(
      {
        erro: "Dados inválidos.",
        detalhes: e.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
      },
      { status: 400 },
    );
  }
  // não vaza detalhes internos (SQL, caminhos, credenciais) para o cliente
  console.error(e);
  return Response.json({ erro: "Erro interno." }, { status: 500 });
}

/**
 * Envolve um handler: exige sessão ANTES de qualquer acesso a dados e
 * padroniza as respostas de erro. Toda rota da API deve passar por aqui.
 */
export function protectedRoute<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user) throw new HttpError(401, "Não autenticado.");
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export type IdContext = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function idParam(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(400, "Identificador inválido.");
  return id;
}

export async function jsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição não é um JSON válido.");
  }
}
