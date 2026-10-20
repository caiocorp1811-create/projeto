# Contrato da API

Base: `/api`. Tudo é JSON, exceto o upload (`multipart/form-data`).
Valores em reais são **números** (`1234.56`); percentuais e distribuições são
**frações** de 0 a 1 (`0.6347` = 63,47%). Datas são `AAAA-MM-DD`. O formato
fica por conta do front.

## Autenticação

Login de usuário único (Auth.js, credenciais). Toda rota abaixo exige sessão;
sem ela a resposta é `401 {"erro": "Não autenticado."}`.

- Entrar: página padrão do Auth.js em `/api/auth/signin` (ou chamada própria via
  `signIn("credentials", { email, password })` do `next-auth/react`).
- Sessão por cookie, válida por 8 horas.

## Erros

`{ "erro": "mensagem" }` com 400 (entrada inválida; pode trazer `detalhes`),
401, 404, 422 (planilha fora do formato) ou 500.

## O que "variação" significa

`variacao_saldo` = saldo atual − saldo anterior. **Não é rentabilidade**: mistura
aportes/resgates com retorno. Só vira rentabilidade quando houver aportes
registrados (fora do escopo atual). `variacao_saldo_pct` é `null` quando não há
base de comparação (saldo anterior zero ou inexistente).

---

## `GET /api/dashboard`

```jsonc
{
  "data_referencia": "2026-10-09",     // fechamento mais recente da base
  "data_anterior": "2026-09-11",
  "total_clientes": 24,
  "clientes_ativos": 12,               // saldo > 0 na data de referência
  "clientes_zerados": 12,
  "patrimonio_total": 250000,
  "variacao_saldo": 10000,
  "variacao_saldo_pct": 0.041667,
  "evolucao": [                        // uma entrada por data de fechamento
    { "data": "2026-09-11", "patrimonio": 240000, "clientes_com_saldo": 24 }
  ],
  "distribuicao": { "rf": 0.7, "rv": 0.29, "ci": 0.01, "int": 0 },  // ponderada pelo saldo; null se ninguém tem
  "valor_por_classe": { "rf": 0, "rv": 0, "ci": 0, "int": 0 },
  "cobertura_distribuicao": 0.98       // fração do patrimônio que tem diversificação informada
}
```

## `GET /api/clients`

Query (todas opcionais): `q` (busca por nome ou código), `ativo=true|false`,
`ordenar=nome|saldo|variacao`, `ordem=asc|desc`.

```jsonc
{
  "data_referencia": "2026-10-09",
  "total": 24,
  "clientes": [{
    "id": "uuid", "codigo": "12345678", "nome": "…", "data_abertura": "2024-03-10",
    "saldo_atual": 10500.5, "data_saldo": "2026-10-09",
    "saldo_desatualizado": false,      // último fechamento do cliente é anterior ao da base
    "saldo_anterior": 10000, "data_saldo_anterior": "2026-09-11",
    "variacao_saldo": 500.5, "variacao_saldo_pct": 0.05005,
    "ativo": true,
    "distribuicao": { "rf": 0.6347, "rv": 0.3603, "ci": 0.0049, "int": 0 }  // ou null
  }]
}
```

## `GET /api/clients/:id`  (interno, completo)

Tudo da lista, mais:

```jsonc
{
  "valor_por_classe": { "rf": 0, "rv": 0, "ci": 0, "int": 0 },   // ou null
  "historico": [
    { "data": "2026-09-11", "saldo": 10000, "variacao_saldo": null, "variacao_saldo_pct": null }
  ],
  "tarefas": [ /* ver Tarefas */ ],
  "notas":   [ /* ver Notas, mais recentes primeiro */ ]
}
```

## `GET /api/clients/:id/presentation`  (modo apresentação)

Só o que o cliente pode ver. O filtro é feito **no servidor**: a rota nem
consulta notas ou tarefas, e o código interno (`codigo`) também não vai.

```jsonc
{
  "id": "uuid", "nome": "…", "data_abertura": "2024-03-10",
  "saldo_atual": 10500.5, "data_saldo": "2026-10-09",
  "variacao_saldo": 500.5, "variacao_saldo_pct": 0.05005,
  "distribuicao": { … }, "valor_por_classe": { … },
  "historico": [ … ]
}
```

---

## Upload da planilha

### `POST /api/imports`
`multipart/form-data`, campo **`arquivo`** (.xlsx, até 5 MB). Responde `201`:

```jsonc
{
  "importacao_id": "uuid", "arquivo": "mes-novembro.xlsx",
  "ja_importado": false,                       // este mesmo arquivo já tinha sido enviado
  "datas_fechamento": ["2026-09-11", "2026-10-09"],
  "clientes": { "na_planilha": 24, "novos": 1, "atualizados": 23 },
  "saldos": { "novos": 24, "alterados": 0, "inalterados": 24 },
  "diversificacoes": 12,
  "avisos": [{ "linha": 12, "mensagem": "…" }]  // linhas ignoradas ou suspeitas
}
```
Regras: a planilha é a fonte da verdade para saldo e diversificação. Reenviar o
mesmo arquivo não duplica nada; datas antigas que não vierem no arquivo são
mantidas; célula de saldo vazia = sem fechamento (diferente de 0). A
diversificação da planilha vale para a data de fechamento mais recente dela.

### `GET /api/imports`
Últimos 50 uploads: `{ "importacoes": [{ "id", "arquivo", "enviado_em", "resumo" }] }`.

---

## Tarefas (internas)

Objeto:
```jsonc
{ "id": "uuid", "titulo": "…", "data_limite": "2026-11-05",   // ou null
  "status": "open",            // "open" | "done"
  "atrasada": false,           // aberta e com data limite no passado (fuso de São Paulo)
  "concluida_em": null, "criada_em": "…",
  "cliente_id": "uuid",        // null = tarefa geral
  "cliente_nome": "…" }
```

- `GET /api/tasks?status=open|done|todas&cliente_id=<uuid>|geral` (padrão `status=open`).
  Abertas primeiro, por data limite (sem data por último).
- `POST /api/tasks` `{ titulo, data_limite?, cliente_id? }` → `201`.
- `PATCH /api/tasks/:id` com qualquer de `{ titulo, data_limite, cliente_id, status }`.
  `status: "done"` conclui; `"open"` reabre.
- `DELETE /api/tasks/:id` → `204`.

## Notas internas

Nunca aparecem no modo apresentação.
```jsonc
{ "id": "uuid", "cliente_id": "uuid", "texto": "…", "criada_em": "…", "atualizada_em": "…" }
```
- `GET /api/clients/:id/notes` → `{ "notas": [...] }`
- `POST /api/clients/:id/notes` `{ texto }` → `201`
- `PATCH /api/notes/:id` `{ texto }`
- `DELETE /api/notes/:id` → `204`
