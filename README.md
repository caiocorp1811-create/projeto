# Hub do Caio — back-end

API de acompanhamento de clientes (patrimônio, evolução, distribuição) alimentada
pela planilha mensal do Caio. Next.js 16 + TypeScript, Postgres no Neon, Drizzle
e Auth.js (usuário único). O contrato da API está em
[docs/api-contract.md](docs/api-contract.md).

## Primeiros passos

1. `npm install`
2. Crie um projeto no [Neon](https://neon.com) e copie a connection string.
3. `cp .env.example .env.local` e preencha:
   - `DATABASE_URL`: a connection string do Neon.
   - `AUTH_SECRET`: `npx auth secret` (ou `openssl rand -base64 32`).
   - `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH`: rode `npm run hash-password` e cole o resultado.
     No `.env.local` o `$` do hash precisa de barra (`\$`); o script já imprime assim.
4. `npm run db:migrate` (cria as tabelas no Neon).
5. `npm run dev`, depois entre em `/api/auth/signin`.

Na Vercel, cadastre as mesmas 4 variáveis (o hash vai sem barras) e rode
`npm run db:migrate` uma vez com o `DATABASE_URL` de produção.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Testes (parser, cálculos e integração com Postgres em memória) |
| `npm run typecheck` / `lint` | Verificações estáticas |
| `npm run db:generate` | Gera migration a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrations em `drizzle/` no banco |
| `npm run hash-password` | Gera o hash da senha do login |

## Estrutura

- `src/db/schema.ts`: tabelas (clientes, saldos, diversificação, tarefas, notas, uploads).
- `src/lib/import/`: leitura da planilha (`parse-workbook`) e gravação idempotente (`apply-import`).
- `src/lib/metrics.ts`: cálculos (funções puras) e o filtro do modo apresentação.
- `src/app/api/`: rotas. Todas passam por `protectedRoute` (exige login).

## Dados de clientes

Planilhas (`*.xlsx`, `*.csv`) e `.env*` estão no `.gitignore`. Nunca versionar
dados reais de clientes.

## Pendências de negócio

- Confirmar com o Caio o significado de **CI** e **INT.** na diversificação.
- Aportes planejados × realizados, objetivos e rentabilidade real dependem de
  dados que a planilha não tem (fora do escopo desta versão).
