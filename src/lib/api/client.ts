/**
 * Cliente tipado da API, para usar no navegador (client components).
 *
 * Usa caminhos relativos e o cookie de sessão do Auth.js, então só funciona na
 * mesma origem da API. Em server components, chame as funções de `@/lib` direto.
 */
import type {
  ApiErrorBody,
  ClientDetail,
  ClientList,
  ClientListParams,
  ClientPresentation,
  CreateTaskInput,
  Dashboard,
  ImportHistory,
  ImportSummary,
  Note,
  Task,
  TaskListParams,
  UpdateTaskInput,
} from "./types";

/** Erro devolvido pela API (`{ erro, detalhes? }`) ou falha de rede (status 0). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes: ApiErrorBody["detalhes"] = undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Sessão ausente ou expirada: mande para o login. */
  get unauthorized() {
    return this.status === 401;
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function withQuery(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(res.status, err?.erro ?? `Erro ${res.status}.`, err?.detalhes);
  }
  return body as T;
}

export const api = {
  dashboard: () => request<Dashboard>("/dashboard"),

  clients: {
    list: (params: ClientListParams = {}) => request<ClientList>(withQuery("/clients", params)),
    get: (id: string) => request<ClientDetail>(`/clients/${id}`),
    presentation: (id: string) => request<ClientPresentation>(`/clients/${id}/presentation`),
    notes: (id: string) => request<{ notas: Note[] }>(`/clients/${id}/notes`),
    addNote: (id: string, texto: string) =>
      request<Note>(`/clients/${id}/notes`, { method: "POST", json: { texto } }),
  },

  notes: {
    update: (id: string, texto: string) =>
      request<Note>(`/notes/${id}`, { method: "PATCH", json: { texto } }),
    remove: (id: string) => request<void>(`/notes/${id}`, { method: "DELETE" }),
  },

  tasks: {
    list: (params: TaskListParams = {}) =>
      request<{ tarefas: Task[] }>(withQuery("/tasks", params)),
    create: (input: CreateTaskInput) => request<Task>("/tasks", { method: "POST", json: input }),
    update: (id: string, input: UpdateTaskInput) =>
      request<Task>(`/tasks/${id}`, { method: "PATCH", json: input }),
    complete: (id: string) => api.tasks.update(id, { status: "done" }),
    reopen: (id: string) => api.tasks.update(id, { status: "open" }),
    remove: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  },

  imports: {
    /** Planilha .xlsx de até 5 MB. */
    upload: (arquivo: File) => {
      const form = new FormData();
      form.set("arquivo", arquivo);
      return request<ImportSummary>("/imports", { method: "POST", body: form });
    },
    list: () => request<ImportHistory>("/imports"),
  },
};
