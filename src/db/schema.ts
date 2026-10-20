import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** Clientes. `code` é o código XP vindo da planilha (chave natural). */
export const clients = pgTable("clients", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  openedOn: date("opened_on", { mode: "string" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Registro de cada upload de planilha (auditoria). */
export const imports = pgTable("imports", {
  id: id(),
  filename: text("filename").notNull(),
  fileHash: text("file_hash").notNull(),
  summary: jsonb("summary").notNull(),
  createdAt: createdAt(),
});

/** Saldo de um cliente em uma data de fechamento. Uma linha por (cliente, data). */
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    asOf: date("as_of", { mode: "string" }).notNull(),
    balance: numeric("balance", { precision: 16, scale: 2 }).notNull(),
    importId: uuid("import_id").references(() => imports.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("balance_snapshots_client_date_uq").on(t.clientId, t.asOf),
    index("balance_snapshots_as_of_idx").on(t.asOf),
  ],
);

/**
 * Diversificação da carteira (frações de 0 a 1). Classes da planilha:
 * RF, RV, CI, INT (CI e INT: significado a confirmar com o Caio).
 */
export const allocationSnapshots = pgTable(
  "allocation_snapshots",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    asOf: date("as_of", { mode: "string" }).notNull(),
    rf: numeric("rf", { precision: 8, scale: 6 }).notNull().default("0"),
    rv: numeric("rv", { precision: 8, scale: 6 }).notNull().default("0"),
    ci: numeric("ci", { precision: 8, scale: 6 }).notNull().default("0"),
    intl: numeric("intl", { precision: 8, scale: 6 }).notNull().default("0"),
    importId: uuid("import_id").references(() => imports.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [unique("allocation_snapshots_client_date_uq").on(t.clientId, t.asOf)],
);

/** To-do interno. `clientId` nulo = tarefa geral. */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    dueOn: date("due_on", { mode: "string" }),
    status: text("status").notNull().default("open"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("tasks_status_ck", sql`${t.status} in ('open', 'done')`),
    index("tasks_client_idx").on(t.clientId),
  ],
);

/** Observações internas do Caio. Nunca saem no modo apresentação. */
export const clientNotes = pgTable(
  "client_notes",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("client_notes_client_idx").on(t.clientId)],
);
