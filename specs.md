# PRD — Investor Sheets Dashboard (Supabase-only, TypeScript E2E)

**Status:** v2 (revisado)  
**Owner:** Gabriel Zimmermann P  
**Data:** 2026-02-20  
**Stack obrigatório (MVP):** TypeScript de ponta a ponta + ESLint  
**Plataforma:** Supabase (DB + Edge Functions + Cron) + Next.js (front)

---

## 0) Regra número 1 (GO / NO-GO)

> **A PRIMEIRA COISA É O PIPELINE.**  
> Se **não** for possível:
> 1) conectar Supabase (Edge Function) no Google Sheets,  
> 2) ler os dados,  
> 3) transformar (transposição) corretamente,  
> 4) salvar no Supabase Postgres,  
> então **o projeto será descontinuado**.

Nada de login, nada de gráficos, nada de “infra bonitinha” antes disso.

---

## 1) Visão do produto

O cliente atualiza manualmente uma Google Sheet várias vezes ao dia.  
O produto é um web app que mostra dashboards (gráficos e tabelas) baseados nesses dados, com sincronização:
- automática (ex.: 1x/h)
- e manual (“Sync Now”)

---

## 2) Objetivos do MVP (em ordem certa)

1) **Validar viabilidade do pipeline** (GO/NO-GO)  
2) **Com dados tratados no banco**, entregar **primeiros gráficos úteis**:
   - Patrimônio total ao longo dos meses
   - Rentabilidade mensal
   - Retorno acumulado
3) **Depois**: login e proteção de acesso (Supabase Auth)

---

## 3) Não-objetivos (por enquanto)

- Importar PDF de nota de corretagem (futuro)
- Integração com preços de mercado externos (futuro, só se necessário)
- Multi-cliente / multi-tenant (futuro)

---

## 4) Arquitetura (MVP Supabase-only)

### Componentes
- **Next.js (TypeScript)**: UI, dashboards, botão “Sync Now”
- **Supabase Edge Function (TypeScript / Deno)**: `sync-sheets`
- **Supabase Postgres**: dados tratados + log de execuções
- **Supabase Cron**: chama `sync-sheets` automaticamente (1x/h)

### Fluxos
- **Manual:** Front → Edge Function `sync-sheets` → DB  
- **Automático:** Cron → Edge Function `sync-sheets` → DB  
- **Dashboards:** Front → DB (select em tabelas/views) → gráficos

---

## 5) Modelo de dados (mínimo necessário)

> **Importante:** O schema final segue o seu “treated format”. A ideia aqui é o mínimo para começar.

### 5.1 `sync_runs` (obrigatória)
Armazena o histórico das sincronizações.
- `id` (uuid, pk)
- `started_at` (timestamp)
- `finished_at` (timestamp, null)
- `status` (`running` | `success` | `error`)
- `trigger` (`manual` | `cron`)
- `message` (text, null)
- `rows_written` (int, null)

### 5.2 `treated_rows` (MVP rápido) **ou** tabelas tratadas reais
Você escolhe uma destas abordagens:

**A) Rápida (para provar valor):**
- `treated_rows` com `payload` jsonb + campos essenciais indexáveis  
  (depois você normaliza)

**B) Melhor (se o treated já está bem definido):**
- tabelas explícitas (ex.: `portfolio_snapshots`, `transactions`, `cashflows`, etc.)

✅ Para os gráficos pedidos (patrimônio, rentabilidade, retorno acumulado), o mais direto é ter:
- `portfolio_snapshots(date, total_value, invested_value?, profit?, ...)`  
Mesmo que isso venha “pronto” do treated.

---

## 6) Critérios de aceite (o que “funciona” de verdade)

### Para o Pipeline (GO)
- Edge Function consegue ler a planilha (Google Sheets API) **sempre**
- Transformação gera dados tratados **no formato esperado**
- Dados tratados são salvos no Postgres
- Existe registro do run em `sync_runs` com status `success`
- Pipeline pode ser disparado:
  - manualmente (HTTP)
  - automaticamente (Cron)
- Se duas sync tentarem rodar juntas → só uma executa (lock)

### Para os Gráficos (MVP)
- Gráfico de **patrimônio mensal** aparece e faz sentido com os dados
- Gráfico de **rentabilidade mensal** aparece e faz sentido
- Gráfico de **retorno acumulado** aparece e faz sentido
- UI mostra **“Última sincronização”** e **Status**

---

# 7) Milestones (do jeito que o projeto evolui de verdade)

## M0 — PIPELINE VIABILITY (GO/NO-GO) ✅ **PRIMEIRO OU NADA**
**Meta:** provar que dá pra conectar Supabase ↔ Google Sheets, ler, transformar (transposição) e salvar no DB.

### Entregáveis de M0
- Edge Function `sync-sheets` funcionando
- Dados tratados no banco
- Log de execução (`sync_runs`)
- Disparo manual e (opcional já aqui) cron 1x/h

### Tarefas (M0)
#### M0.1 Preparar Supabase (o mínimo necessário)
- [ ] Criar projeto no Supabase
- [ ] Criar tabelas: `sync_runs` + tabela(s) tratadas (mínimo)
- [ ] Habilitar RLS (pode deixar leitura aberta no MVP se for só você testando, mas **não** expor escrita)
- [ ] Criar policy mínima (pelo menos impedir escrita pelo client)

#### M0.2 Edge Function `sync-sheets` (o núcleo)
- [ ] Criar Edge Function `sync-sheets` (TypeScript)
- [ ] Configurar secrets no Supabase:
  - [ ] `GOOGLE_SHEETS_SPREADSHEET_ID`
  - [ ] credenciais do Google (service account)
  - [ ] (se precisar) ranges/abas em env
- [ ] Implementar autenticação com Google (service account) para acessar Sheets
- [ ] Implementar leitura do(s) range(s) necessário(s)
- [ ] Implementar transformação (transposição) → gerar o “treated” final
- [ ] Implementar escrita no Postgres:
  - [ ] estratégia “all-or-nothing” (não deixar dados pela metade)
- [ ] Implementar lock para evitar duas sync ao mesmo tempo
- [ ] Registrar execução em `sync_runs` (running → success/error)

#### M0.3 Disparo manual (pra você testar rápido)
- [ ] Permitir chamada HTTP manual da Edge Function (`POST /sync-sheets`)
- [ ] Proteger o endpoint de sync (mínimo):
  - [ ] exigir usuário autenticado **ou**
  - [ ] exigir `x-sync-secret` (guardado no server)  
  *(no MVP, pode ser “segredo” para não virar endpoint público)*

#### M0.4 Cron 1x/h (automatização)
- [ ] Criar agendamento (Supabase Cron) 1x/h chamando a Edge Function
- [ ] Salvar `trigger = cron` em `sync_runs`

### Checkpoint / Decisão (fim da M0)
- [ ] **GO:** pipeline roda 10 vezes seguidas sem falhar (ou falha com erro claro e recuperável)
- [ ] **NO-GO:** não conseguimos acessar Sheets / ou transformação não fica confiável → **projeto descontinuado**

---

## M1 — PRIMEIROS GRÁFICOS (com dados já tratados no banco)
**Meta:** com o DB alimentado pelo pipeline, construir a primeira página de insights.

### Entregáveis de M1
- Dashboard com:
  - Última sync (timestamp) + status
  - Botão “Sync Now”
  - 3 gráficos:
    1) Patrimônio total mensal
    2) Rentabilidade mensal
    3) Retorno acumulado

### Tarefas (M1)
#### M1.1 Next.js + UI mínima (sem frescura)
- [ ] Criar app Next.js (TypeScript)
- [ ] ESLint configurado e rodando (CI ou local)
- [ ] Página `/dashboard` (mesmo sem login por enquanto, pode ficar “dev mode”)
- [ ] Integrar Supabase client para leitura

#### M1.2 Dataset para gráficos (SQL simples)
- [ ] Garantir que os dados tratados tenham os campos necessários
  - [ ] `date`
  - [ ] `total_value` (ou equivalente do treated)
- [ ] Criar query (ou view) para “patrimônio por mês”
- [ ] Criar query (ou view) para “rentabilidade por mês”
- [ ] Criar query (ou view) para “retorno acumulado”

#### M1.3 Implementar gráficos
- [ ] Gráfico 1: patrimônio mensal (linha)
- [ ] Gráfico 2: rentabilidade mensal (barras)
- [ ] Gráfico 3: retorno acumulado (linha)
- [ ] Card: “Última sincronização” (buscando do `sync_runs`)
- [ ] Botão “Sync Now” chamando a Edge Function e atualizando a tela

---

## M2 — LOGIN (depois que já existe valor)
**Meta:** proteger o acesso do dashboard com Supabase Auth.

### Tarefas (M2)
- [ ] Configurar Supabase Auth (email/senha ou magic link)
- [ ] Implementar login/logout no Next.js
- [ ] Proteger rota `/dashboard` (redirect se não autenticado)
- [ ] Garantir que “Sync Now” só funcione logado (ou com secret server-side)

---

## M3 — ROBUSTEZ (quando começar a doer)
**Meta:** deixar o pipeline mais à prova de “planilha mudou”.

### Tarefas (M3)
- [ ] Sanity checks na Edge Function (ex.: range vazio, colunas esperadas)
- [ ] Melhorar logs (mensagens úteis, contagem de linhas)
- [ ] Opcional: salvar `raw_snapshot` quando falhar
- [ ] Ajustar performance (se necessário):
  - [ ] views/materialized views para agregações mais pesadas
  - [ ] refresh pós-sync

---

# 8) Qualidade (TypeScript + ESLint) — obrigatório

## Regras mínimas
- [ ] TypeScript `strict: true`
- [ ] ESLint com:
  - [ ] no-unused-vars
  - [ ] no-explicit-any (ou restringir ao mínimo)
  - [ ] prefer-const
  - [ ] imports ordenados

## CI (mínimo)
- [ ] Pipeline executa:
  - [ ] `lint`
  - [ ] `typecheck`

---

# 9) O que a IA agente deve checar a cada checkpoint

## Checkpoint M0
- Edge Function executa e escreve no DB
- `sync_runs` registra corretamente
- Dados tratados batem com o “treated exemplar”
- Cron rodando 1x/h (se implementado)

## Checkpoint M1
- Dashboard renderiza os 3 gráficos
- Última sync e status visíveis
- Botão Sync Now funciona

---

# 10) Próximo passo imediato (sem discussão)
**Começar pela M0.**  
Pipeline funcionando = projeto continua.  
Pipeline não funcionando = projeto para.
