import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Data inválida.");

export const createTaskSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título.").max(200),
  data_limite: isoDate.nullish(),
  cliente_id: z.uuid().nullish(),
});

export const updateTaskSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    data_limite: isoDate.nullable(),
    cliente_id: z.uuid().nullable(),
    status: z.enum(["open", "done"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envie ao menos um campo para alterar.");

export const noteSchema = z.object({
  texto: z.string().trim().min(1, "A nota não pode ser vazia.").max(10_000),
});

/** Hoje (AAAA-MM-DD) no fuso do escritório, para decidir o que está atrasado. */
export function todayInSaoPaulo(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

type TaskRow = {
  id: string;
  clientId: string | null;
  clientName?: string | null;
  title: string;
  dueOn: string | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
};

export function taskDto(t: TaskRow, today = todayInSaoPaulo()) {
  return {
    id: t.id,
    titulo: t.title,
    data_limite: t.dueOn,
    status: t.status as "open" | "done",
    atrasada: t.status === "open" && t.dueOn !== null && t.dueOn < today,
    concluida_em: t.completedAt?.toISOString() ?? null,
    criada_em: t.createdAt.toISOString(),
    cliente_id: t.clientId,
    cliente_nome: t.clientName ?? null,
  };
}

/** Abertas primeiro; dentro delas, por data limite (sem data por último). */
export function sortTasks<T extends { status: string; data_limite: string | null; criada_em: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.data_limite !== b.data_limite) {
      if (a.data_limite === null) return 1;
      if (b.data_limite === null) return -1;
      return a.data_limite.localeCompare(b.data_limite);
    }
    return b.criada_em.localeCompare(a.criada_em);
  });
}

type NoteRow = { id: string; clientId: string; body: string; createdAt: Date; updatedAt: Date };

export const noteDto = (n: NoteRow) => ({
  id: n.id,
  cliente_id: n.clientId,
  texto: n.body,
  criada_em: n.createdAt.toISOString(),
  atualizada_em: n.updatedAt.toISOString(),
});
