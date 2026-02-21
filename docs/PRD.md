PRD — Rentabilidade: Google Sheets → Supabase (DB) → React Dashboards

Versão: 10/10 (agent-ready)
Owner: Gabriel Zimmermann P
Data: 2026-02-21
Stack obrigatório: TypeScript end-to-end + ESLint
Front: React (Vite) + TailwindCSS + shadcn/ui
Backend: Supabase (Postgres + Auth + Edge Functions + Cron)

0) REGRA SUPREMA (GATE ÚNICO)
✅ CHECKPOINT A — PIPELINE VIÁVEL (GO/NO-GO) — PRIMEIRA COISA DO PROJETO

Se não passar esse checkpoint, o projeto é descontinuado.

PASSA se (em produção no Supabase):

Edge Function consegue obter token de service account e ler o Google Sheets.

Consegue ler somente a aba “Planilha de Rentabilidade” e retornar uma matriz de valores (rows/cols).

Consegue transformar o input (blocos por mês) para o formato do expected_trated_data_table (tabela normalizada).

Consegue atualizar o Postgres de forma:

idempotente (rodar 10x dá o mesmo resultado, sem duplicar)

atômica (não deixa DB “meio atualizado”)

com lock (não roda duas sync ao mesmo tempo)

Consegue rodar:

manual (Sync Now via HTTP)

automático (cron 1x/h via Supabase)

Registra sync_runs com status e mensagem de erro quando falhar.

FALHA (NO-GO) se:

Não for possível autenticar/ler o Sheets de forma estável

A transformação não ficar determinística/confiável

Não conseguirmos publicar no banco com idempotência + atomicidade

1) Contexto do Produto (resumo)

O cliente atualiza manualmente (várias vezes ao dia) uma planilha no Google Sheets.
Apenas a aba “Planilha de Rentabilidade” será consumida pelo sistema para gerar dashboards.

A aba de entrada é visual, por blocos mensais.
O sistema precisa manter no banco uma tabela normalizada como expected_trated_data_table, atualizada:

automaticamente 1x/h

e manualmente (Sync Now)

2) Contrato de Dados
2.1 Entrada (Google Sheets) — aba “Planilha de Rentabilidade”

Características observadas nos exemplos (user_*):

Linha de header:

Col A: Mês

Col B: Descrição

Cols C..: ativos/ações (ex.: “Tesouro Alexa”, “SALDOS”, …, “Patrimônio”)

Existe uma coluna @ (ignorar) e colunas vazias (ignorar).

A planilha é organizada em blocos por mês:

a primeira linha do bloco tem Mês = YYYY-MM-01 (ou data equivalente)

as linhas seguintes do bloco deixam a coluna Mês vazia

a coluna Descrição define “qual métrica é aquela linha”

O usuário só preenche o próximo mês quando o mês virar; meses futuros podem estar vazios.

2.2 Saída (tabela no banco) — igual ao expected

A tabela tratada deve conter (no mínimo) as colunas abaixo (as mesmas do expected “principal”):

Campos de identificação

periodo (date, nullable) — preenchido apenas em 1 linha por mês (regra abaixo)

acao (text)

mes (date) — referência do mês no formato adotado (regra abaixo)

Métricas (numéricas)

valor_base

investimento

resgate

recebimento_proventos

valor_final_mes

rentabilidade_mes

nao_mexer

ativo_pl

Observação: o arquivo expected_trated_data_table tem colunas extras “Unnamed:*” por causa de layout/áreas laterais; o sistema ignora tudo que não estiver na lista acima.

3) Regras de Transformação (o coração do projeto)
3.1 Mapeamento “Descrição” → coluna tratada

No bloco mensal, cada linha tem Descrição. Mapear assim:

Valor em 31/12/2024 → valor_base

Valor-base → valor_base

Investimento (+) → investimento

Resgate (-) → resgate

Rebecimento de proventos (-) → recebimento_proventos

(aceitar variação corrigida: Recebimento de proventos (-))

Valor final no mês → valor_final_mes

Rentabilidade (ao mês) → rentabilidade_mes

Não mexer → nao_mexer

Ativo/PL → ativo_pl

Regras:

Trim em Descrição

Comparação case-sensitive não é confiável: usar normalize (lowercase + remover espaços duplicados)

3.2 Seleção de colunas de ativos (ações)

A lista de ações vem do header (linha 0), colunas a partir de C (índice 2):

Parar ao encontrar @ (não incluir @)

Ignorar colunas vazias (NaN/“”)

Incluir “Patrimônio” se estiver no header (é usado nos gráficos)

Normalização do nome da ação (acao)

trim

converter múltiplos espaços em 1

opcional: aplicar dicionário de aliases (ex.: remover trailing space em “CDB - SANTANDER ”)

Nota: O expected atual tem inconsistências (“CDB - SANTANDER ” e “CDB - SANTANDER”). O sistema deve padronizar para uma forma única (sem espaços no fim). Se precisar manter compatibilidade, criar uma VIEW de compat.

3.3 Como detectar blocos mensais

Percorrer as linhas a partir da linha 1:

Quando a célula na coluna Mês (col A) for uma data válida → começa um novo bloco mensal.

O bloco termina na linha anterior ao próximo “Mês válido”.

3.4 Regra de mes (coluna “Mês” na saída)

Para compatibilidade com seu expected principal (que usa dia 25), definir:

mes = mês_inicial + 24 dias
Ex.: se entrada é 2025-01-01, saída mes = 2025-01-25

3.5 Regra de periodo

periodo = mes + 1 dia

Somente 1 linha por mês terá periodo preenchido:

regra determinística: preencher periodo na primeira ação na ordem do header (normalmente “Tesouro Alexa”).

todas as demais linhas do mesmo mês: periodo = null

3.6 Regra de “mês iniciado” (ignorar meses futuros)

Um mês deve ser publicado somente se:

existir pelo menos uma ação com valor_final_mes não nulo e diferente de 0.

Se o mês não estiver iniciado:

não inserir/atualizar nada desse mês no banco

3.7 Parsing numérico (robusto)

Como Google Sheets pode retornar string formatada:

aceitar:

1234.56

1.234,56

R$ 1.234,56

(1.234,56) como negativo

- ou vazio → null

converter para number (JS) e depois salvar como numeric no Postgres

4) Banco de Dados (Supabase Postgres)
4.1 Tabelas (DDL)
public.sync_runs

id uuid primary key default gen_random_uuid()

started_at timestamptz not null default now()

finished_at timestamptz

status text not null check (status in ('running','success','error','skipped'))

trigger text not null check (trigger in ('manual','cron'))

message text

rows_written int

source_hash text (hash do raw para debug)

public.rentabilidade_treated

mes date not null

acao text not null

periodo date (nullable)

valor_base numeric

investimento numeric

resgate numeric

recebimento_proventos numeric

valor_final_mes numeric

rentabilidade_mes numeric

nao_mexer numeric

ativo_pl numeric

updated_at timestamptz not null default now()

Constraint

unique (mes,acao)

public.rentabilidade_staging

Mesmas colunas de rentabilidade_treated +:

run_id uuid not null

public.raw_snapshots (recomendado)

id uuid primary key default gen_random_uuid()

created_at timestamptz not null default now()

sheet_id text not null

tab_name text not null

range_a1 text not null

raw jsonb not null

hash text not null

4.2 Funções SQL (lock + publish atômico)
Lock (advisory lock)

Criar RPC:

public.acquire_sync_lock(lock_key bigint) returns boolean

retorna true se lock adquirido, false se já estava rodando

public.release_sync_lock(lock_key bigint) returns void

Publish atômico (staging → final)

Criar RPC:

public.apply_rentabilidade_run(p_run_id uuid, p_months date[]) returns void

em transação:

delete de rentabilidade_treated onde mes in p_months

insert select do staging onde run_id=p_run_id

delete do staging run_id=p_run_id

Motivo: upsert linha-a-linha pode deixar estado parcial se falhar no meio. O apply atômico garante “tudo ou nada”.

4.3 RLS / Segurança (mínimo)

Habilitar RLS em rentabilidade_treated e sync_runs depois que login existir.

Durante o Checkpoint A, pode manter leitura restrita (ou só via service role), mas escrita sempre via service role.

5) Edge Function (Supabase) — sync-rentabilidade
5.1 Objetivo

Ler Sheets → transformar → publicar no DB → registrar sync_runs.

5.2 Secrets necessários (Supabase)

GOOGLE_SHEETS_SPREADSHEET_ID

GOOGLE_SERVICE_ACCOUNT_EMAIL

GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (com quebras de linha preservadas)

SHEETS_TAB_NAME = Planilha de Rentabilidade

SHEETS_RANGE_A1 (ex.: Planilha de Rentabilidade!A1:AL250)

SYNC_LOCK_KEY (ex.: 20250221)

SYNC_ADMIN_SECRET (apenas durante fase sem login)

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (já disponíveis em runtime)

5.3 Contrato HTTP (para agente implementar)

Endpoint: POST /functions/v1/sync-rentabilidade

Headers aceitos:

Authorization: Bearer <jwt> (quando login pronto)

OU x-admin-secret: <SYNC_ADMIN_SECRET> (fase inicial)

x-trigger: manual|cron (cron envia cron, front envia manual)

Response JSON (sempre):

{
  "ok": true,
  "status": "success",
  "run_id": "uuid",
  "months_published": 12,
  "rows_written": 420
}

Em erro:

{
  "ok": false,
  "status": "error",
  "run_id": "uuid",
  "message": "human readable",
  "details": {}
}
5.4 Implementação: passos internos (obrigatórios)

Criar sync_runs com status=running.

acquire_sync_lock(SYNC_LOCK_KEY)

se false: atualizar run como skipped e retornar 409.

Buscar token OAuth service account e ler Sheets API:

usar spreadsheets.values.get com valueRenderOption apropriado (para reduzir formatação)

(Opcional) salvar raw_snapshots (sempre ou somente em erro).

Rodar transform(raw):

extrair header de ações

detectar blocos mensais

mapear descrições para métricas

gerar linhas normalizadas

filtrar meses não iniciados

Inserir tudo em rentabilidade_staging com run_id.

Rodar apply_rentabilidade_run(run_id, months[]) para publicar atômico.

release_sync_lock.

Atualizar sync_runs para success com rows_written.

Em qualquer exceção:

atualizar sync_runs=error com message

garantir release_sync_lock em finally

5.5 Observabilidade mínima

Logs (console) devem incluir:

run_id

trigger

tempo de leitura do Sheets

meses encontrados / meses publicados

rows_written

erro detalhado (sem vazar private key)

5.6 Deploy e versionamento da Function (regra obrigatória)

Sempre que houver atualização da sync:

primeiro atualizar o código local em supabase/functions/sync-rentabilidade/

depois fazer deploy da MESMA função no Supabase

comando de referência: supabase functions deploy sync-rentabilidade

não criar nova function para cada ajuste (evita drift de ambiente, secrets duplicados e confusão operacional)

6) Cron (1x por hora) + Manual Sync
6.1 Cron Supabase

Criar job que faz HTTP POST para a Edge Function 1x/h.

Requisito: usar pg_cron + pg_net (modo recomendado) para invocar Edge Functions.
O cron precisa enviar autenticação segura (ex.: service role token armazenado em Vault).

6.2 Manual Sync (botão)

No MVP (antes do login), pode chamar com x-admin-secret.
Depois do login, chamar via supabase.functions.invoke('sync-rentabilidade') (o supabase-js já manda Authorization quando logado).

7) Front-end (React + Tailwind + shadcn)
7.1 Páginas

/ → redirect para /dashboard se logado, senão /login

/login → login Supabase Auth

/dashboard → visão geral da carteira (gráficos, status e Sync Now)

/ativo (ou /ativos) → análise detalhada de um ativo da carteira

7.2 Página 1 — Visão geral da carteira

Componentes base:

Card: “Última sincronização” (query sync_runs latest)

Badge: status (success/error/running/skipped)

Botão “Sync Now”

Gráficos principais (escopo funcional da página):

Evolução do patrimônio ao longo do tempo

Rentabilidade ao longo do tempo

Retorno acumulado ao longo do tempo

Rentabilidade da carteira vs IBOV vs CDI ao longo do tempo

Distribuição da carteira por alocação no mês mais recente

Nota de produto: esses gráficos começam com versão funcional e, em seguida, evoluem com filtros, interações e refinamentos visuais.

7.3 Regras de dados para os gráficos da visão geral

Preferência para séries de carteira: usar acao='Patrimônio' quando existir, pois representa o consolidado.

Patrimônio (evolução):

x: mes

y: valor_final_mes

filtro: acao='Patrimônio'

Rentabilidade (mensal):

x: mes

y: rentabilidade_mes

filtro: acao='Patrimônio'

Retorno acumulado:

calcular no front (acumulado multiplicativo):

acc = Π(1 + rentabilidade_mes) − 1

Comparativo IBOV/CDI:

plotar 3 séries no mesmo período: carteira, IBOV e CDI

fonte de IBOV/CDI pode vir de tabela dedicada no Postgres (recomendado) populada por job/ingest

se necessário no MVP, aceitar carga manual inicial de benchmark até automatizar

Distribuição da carteira (alocação):

usar o mês mais recente com dados

calcular participação percentual por acao com base em valor_final_mes

excluir linhas agregadas/técnicas quando aplicável (ex.: "Patrimônio"), conforme regra implementada

Se não existir “Patrimônio” no header, então:

Patrimônio = soma de valor_final_mes das ações por mês

Rentabilidade da carteira pode ser derivada em etapa posterior

7.4 Página 2 — Análise por ativo da carteira

Objetivo: permitir ao usuário selecionar um ativo que ele possui/possuiu e comparar duas visões lado a lado.

Gráfico esquerdo (ativo na carteira):

filtrar coluna acao pelo ativo selecionado

plotar evolução de valor_final_mes ao longo do tempo (desde a primeira ocorrência relevante)

Gráfico direito (mercado, 2 anos):

exibir preço/série do mesmo ativo nos últimos 2 anos (ex.: provedor externo como Google Finance ou equivalente)

uso inicial pode ser via integração simples; evoluir depois para provider robusto com cache

Escopo de dados:

não é obrigatório armazenar ativos que o usuário nunca comprou

universo inicial pode ser somente ativos presentes na carteira; expansão sob demanda

7.5 Interatividade (segunda fase)

Adicionar filtros por período, ativo, classe/setor e benchmark, além de interação (hover, zoom, comparação de janelas e toggles de séries).

7.6 Direção visual da aplicação (obrigatório)

Referências visuais oficiais do projeto:

refs/referencia1.jpg

refs/referencia2.jpg

Objetivo: o visual da aplicação final deve ser o mais próximo possível dessas referências (look-and-feel), mantendo apenas a diferença de layout/disposição dos gráficos conforme as necessidades deste produto.

Pilares visuais a seguir:

estética clean, clara e profissional (tema claro como base)

cards com cantos arredondados, bordas suaves e separação visual nítida

sidebar lateral fixa + topbar com busca/ações de usuário

hierarquia com blocos de KPIs no topo e áreas analíticas em grid

gráficos com paleta azul/neutra e bom contraste sem poluição visual

Uso de tecnologia para atingir o visual:

manter TailwindCSS + shadcn/ui como base principal (já definido no stack)

não usar Bootstrap como base do layout (evitar conflito de design system e aparência genérica)

permitido usar biblioteca de gráficos com boa customização visual (ex.: Recharts, ECharts ou similar)

Sistema de design mínimo (tokens CSS) obrigatório:

definir variáveis de cor, raio, sombra, borda e espaçamento em nível global

padronizar estados de hover/focus/active para botões, cards, inputs e itens de navegação

padronizar tipografia (escala de tamanhos/pesos para título, subtítulo, corpo e legenda)

estabelecer grid responsivo desktop-first com comportamento claro para tablet/mobile

Diretrizes práticas de UI:

usar cards com fundo claro e variações sutis por contexto (KPI, gráfico, tabela, alertas)

usar ícones discretos e consistentes (sem excesso de cores)

legendas e tooltips de gráfico devem ser legíveis e consistentes em todos os módulos

manter densidade visual equilibrada para páginas com muitos gráficos/interações

Responsividade mínima exigida:

desktop >= 1280px: layout completo com sidebar fixa e múltiplas colunas

tablet: redução de colunas e reorganização dos cards sem perda de contexto

mobile: priorizar leitura dos principais KPIs e gráficos com navegação simplificada

Critério de aceite visual:

antes de concluir B2/B3/B5, comparar telas implementadas com refs/referencia1.jpg e refs/referencia2.jpg e validar proximidade estética (paleta, espaçamento, bordas, tipografia e composição geral)

8) ESLint / Qualidade (obrigatório desde o primeiro commit)

TS strict em todo lugar

ESLint configurado no web e nas functions

Scripts:

lint

typecheck

9) CHECKLIST DE IMPLEMENTAÇÃO (passo a passo) — para IA agente
✅ Checkpoint A (GO/NO-GO) — Pipeline
A1 — Criar base no Supabase

 Criar projeto Supabase

 Criar migrations SQL com:

 tabelas sync_runs, rentabilidade_treated, rentabilidade_staging, raw_snapshots

 constraints e índices (unique mes+acao)

 RPCs: acquire_sync_lock, release_sync_lock, apply_rentabilidade_run

A2 — Edge Function

 Criar function sync-rentabilidade

 Configurar secrets (Sheets + service account + lock key + range)

 Implementar leitura Sheets via REST (spreadsheets.values.get)

 Implementar transform(raw) -> treatedRows[] com regras do item 3

 Inserir staging + aplicar publish atômico

 Registrar sync_runs (running → success/error)

A3 — Validação do Checkpoint A

 Rodar manualmente 10 vezes → sem duplicar linhas (idempotência)

 Rodar 2 chamadas simultâneas → 1 executa, 1 retorna “busy”

 Forçar erro de parsing → DB não fica meio atualizado; sync_runs=error

 Confirmar meses futuros vazios não entram

A4 — Cron 1x/h

 Criar cron job que chama a Edge Function

 Confirmar sync_runs.trigger='cron'

✅ Se A1–A4 passarem: GO. Se não: NO-GO.

Depois do GO — Aplicação e dashboards (valor rápido)
B1 — App React + UI

 Criar React Vite TS

 Instalar Tailwind e shadcn/ui

 ESLint + TS strict

B2 — Dashboard: visão geral da carteira

 Mostrar última sync + status

 Sync Now chamando Edge Function

 Gráfico de evolução do patrimônio

 Gráfico de rentabilidade

 Gráfico de retorno acumulado

 Gráfico comparativo carteira vs IBOV vs CDI

 Gráfico de distribuição/alocação da carteira no mês mais recente

B3 — Página de análise por ativo

 Criar tela /ativo (ou /ativos) com seletor de ativo

 Gráfico esquerdo: evolução do ativo na carteira (valor_final_mes ao longo do tempo)

 Gráfico direito: ativo no mercado nos últimos 2 anos (provider externo)

B4 — Interatividade e filtros (fase 2)

 Filtros por período, ativo e benchmark

 Interações de gráfico (zoom/hover/toggle)

 Melhorias de UX para exploração da carteira

B5 — Direção visual e design system

 Implementar UI com forte aderência às referências refs/referencia1.jpg e refs/referencia2.jpg

 Definir tokens de estilo globais (cores, tipografia, borda, raio, sombra, espaçamento)

 Validar responsividade desktop/tablet/mobile para páginas /dashboard e /ativo

Depois — Login
C1 — Supabase Auth

 Login/logout

 Proteger /dashboard

 Proteger Sync Now (somente autenticado/admin)

10) Milestones (acompanhamento com checkboxes)

- [x] Checkpoint A (GO/NO-GO): pipeline viável validado em Supabase
- [x] A1 — Base Supabase (tabelas + constraints + RPCs)
- [x] A2 — Edge Function de sync (Sheets -> transform -> staging -> publish)
- [x] A3 — Validação de idempotência, lock e atomicidade
- [ ] A4 — Cron 1x/h configurado via pg_cron + pg_net em produção
- [ ] B1 — App React (Vite TS) + Tailwind + shadcn + ESLint/TS strict
- [ ] B2 — Página /dashboard com visão geral completa da carteira
- [ ] B3 — Comparativo carteira vs IBOV vs CDI com fonte de benchmark estável
- [ ] B4 — Distribuição de carteira (alocação) com base no mês mais recente
- [ ] B5 — Página /ativo com 2 gráficos (carteira histórica + mercado 2 anos)
- [ ] B6 — Direção visual aderente às referências (cards, grid, tipografia, paleta)
- [ ] B7 — Filtros e interatividade dos gráficos (fase 2)
- [ ] C1 — Supabase Auth (login/logout + proteção de rotas)
- [ ] C2 — RLS final e hardening de segurança

11) Resumo para leigo (bem simples)

Primeiro criamos um “robô” no Supabase que entra no Google Sheets, pega a aba “Planilha de Rentabilidade”, organiza os dados e salva no banco no formato certo.

Se esse robô não funcionar de forma confiável, o projeto acaba.

Quando funcionar, fazemos uma visão geral completa da carteira e também uma tela de análise por ativo.

Depois colocamos login para proteger.

Notas técnicas (decisões ancoradas em documentação)

Supabase agenda Edge Functions via pg_cron + pg_net.

Secrets em Edge Functions: lidos via runtime Deno.

Limites de Edge Functions (tempo/memória) precisam ser respeitados.

Edge Functions são TypeScript server-side no runtime Deno.

Google Sheets spreadsheets.values.get + valueRenderOption e escopos.

Instalação shadcn/ui em Vite + TS + Tailwind.

Supabase Auth quickstart com React/Vite.

Invocação de Edge Function via supabase-js (functions.invoke).

RLS com Supabase Auth (quando for travar acesso).
