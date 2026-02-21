# ZAI Financial Web

Frontend base do projeto, seguindo o PRD:

- React + Vite + TypeScript
- TailwindCSS + componentes base estilo shadcn
- Supabase Auth (login/logout)
- Base para dashboard e pagina de analise por ativo

## Requisitos

- Node.js 20+
- NPM 10+

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

3. Preencha as variaveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado)
- `VITE_SUPABASE_ANON_KEY` (legacy, opcional)
- `VITE_SYNC_ADMIN_SECRET` (opcional na fase inicial)

4. Rode em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`: ambiente de desenvolvimento
- `npm run lint`: lint
- `npm run typecheck`: checagem de tipos
- `npm run build`: build de producao
- `npm run preview`: preview local da build

## Estrutura principal

- `src/App.tsx`: roteamento e guards de autenticacao
- `src/context/AuthContext.tsx`: sessao e operacoes de auth
- `src/services/sync-service.ts`: leitura de `sync_runs` e trigger da sync
- `src/pages/Login.tsx`: tela de autenticacao
- `src/pages/Dashboard.tsx`: visao geral base para KPIs e graficos
- `src/pages/Asset.tsx`: base da pagina de analise por ativo

## Supabase Auth

No painel Supabase:

1. Authentication -> Providers
2. Habilitar Email/Password
3. Opcional: habilitar confirmacao por email
4. Para Google OAuth, habilitar provider Google e configurar:
   - Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Site URL/Redirect URLs para local e producao

## Deploy (Vercel)

Este repositorio usa `vercel.json` na raiz apontando para `web/`.

- Build command: `cd web && npm run build`
- Output: `web/dist`
- Install: `cd web && npm install`
