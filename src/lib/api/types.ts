/**
 * Tipos das respostas e entradas da API, para o front.
 *
 * Derivados das funções que montam as respostas no servidor (só `import type`,
 * nada de código do servidor vai para o bundle). Assim, se uma rota mudar,
 * o typecheck do front acusa na hora.
 */
import type { z } from "zod";
import type { ImportSummary } from "@/lib/import/apply-import";
import type {
  clientDetail,
  clientSummary,
  dashboard,
  Distribution,
  presentationView,
} from "@/lib/metrics";
import type { createTaskSchema, noteDto, taskDto, updateTaskSchema } from "@/lib/tasks";

export type { Distribution, ImportSummary };

/** Classes da diversificação: "rf" | "rv" | "ci" | "int". */
export type AssetClass = keyof Distribution;

/** Valores em reais por classe. */
export type ValueByClass = Record<AssetClass, number>;

// --- Erros ---

export type ApiErrorBody = {
  erro: string;
  /** Só nos 400 de validação. */
  detalhes?: { campo: string; mensagem: string }[];
};

// --- Dashboard ---

export type Dashboard = ReturnType<typeof dashboard>;
export type EvolutionPoint = Dashboard["evolucao"][number];

// --- Clientes ---

export type ClientSummary = ReturnType<typeof clientSummary>;

export type ClientList = {
  data_referencia: string | null;
  total: number;
  clientes: ClientSummary[];
};

export type ClientListParams = {
  /** Busca por nome ou código. */
  q?: string;
  ativo?: boolean;
  /** `variacao` ordena pelo percentual, não pelo valor em reais. */
  ordenar?: "nome" | "saldo" | "variacao";
  ordem?: "asc" | "desc";
};

export type HistoryPoint = ReturnType<typeof clientDetail>["historico"][number];

/** Visão interna completa (`GET /api/clients/:id`). */
export type ClientDetail = ReturnType<typeof clientDetail> & {
  /** Aqui `cliente_nome` vem null: use o `nome` do próprio cliente. */
  tarefas: Task[];
  /** Mais recentes primeiro. */
  notas: Note[];
};

/** Modo apresentação: só o que o cliente pode ver. */
export type ClientPresentation = ReturnType<typeof presentationView>;

// --- Importação ---

export type ImportHistory = {
  importacoes: { id: string; arquivo: string; enviado_em: string; resumo: ImportSummary }[];
};

// --- Tarefas ---

export type Task = ReturnType<typeof taskDto>;
export type TaskStatus = Task["status"];

export type TaskListParams = {
  /** Padrão: "open". */
  status?: TaskStatus | "todas";
  /** Id de um cliente, ou "geral" para as tarefas sem cliente. */
  cliente_id?: string;
};

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

// --- Notas ---

export type Note = ReturnType<typeof noteDto>;
