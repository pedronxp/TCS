# TCS — Painel Administrativo

> Painel web para gestão do app **TCS - Relatório de Risco**, usado pela Defesa Civil.
> Acesso restrito a administradores aprovados (`admin` e `master_admin`).

---

## Visão geral

O painel centraliza todas as operações que os agentes de campo realizam no app mobile:

| Módulo | O que faz |
|--------|-----------|
| **Visão Geral** | Estatísticas em tempo real — vistorias, riscos, agendamentos e usuários |
| **Ocorrências** | Lista e filtros de todas as vistorias registradas, com fotos e nível de risco |
| **Usuários** | Aprovar/reprovar contas, invite tokens, redefinir senha, excluir com auditoria |
| **Agendamentos** | Calendário de vistorias agendadas com status e atribuição de agentes |
| **Mapa** | Mapa interativo com clusters por risco e busca por cidade/CEP |
| **Laudos** | Visualização e download de laudos em PDF gerados no app |
| **Relatórios** | Gráficos com Recharts + exportação CSV das vistorias |
| **Arquivamento** | Lifecycle de fotos e laudos: Supabase → Google Drive após 7 dias *(master_admin)* |
| **Builds APK** | Disparar build do app via EAS Build + GitHub Actions *(master_admin)* |
| **Configurações** | Variáveis do sistema e parâmetros globais *(master_admin)* |

---

## Stack

- **Vite 5** + **React 18** + **TypeScript** (strict)
- **Tailwind CSS** com tokens de design (cores de risco R1–R4)
- **TanStack Query v5** — cache, revalidação e estados de loading
- **TanStack Table v8** — tabelas server-side com paginação e filtros
- **Supabase JS v2** — mesmo backend do app mobile
- **React Router v6** — rotas protegidas por role
- **MapLibre GL JS** — mapa vetorial com tiles CartoDB
- **Recharts** — gráficos de distribuição de risco e tendências
- **Lucide React** — ícones

---

## Permissões

O gate de autenticação em `AuthContext.tsx` bloqueia qualquer conta sem `role IN ('master_admin', 'admin')` e `isApproved = true`.

| Role | Acesso |
|------|--------|
| `admin` | Todos os módulos do seu município |
| `master_admin` | Todos os módulos de todos os municípios + Arquivamento, Builds, Configurações |

---

## Rodando localmente

```bash
cd dashboard
cp .env.example .env   # preencher com URL e chave do Supabase
npm install
npm run dev            # abre em http://localhost:5173
```

Para testar somente o editor comercial com dados locais, não é necessário criar `.env`:

```bash
cd dashboard
npm run dev
# abra http://localhost:5173/planos?demo=1
```

O modo de demonstração cria versões apenas na memória do navegador e nunca grava no Supabase.

### Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

> O arquivo `.env` está no `.gitignore`. Nunca commitar credenciais reais.

---

## Deploy (Netlify)

O projeto está configurado para deploy automático via `netlify.toml` na raiz do repositório.

**Configurações do site no Netlify:**

| Campo | Valor |
|-------|-------|
| Base directory | `dashboard` |
| Build command | `npm install && npm run build` |
| Publish directory | `dashboard/dist` |

**Variáveis de ambiente** a configurar no painel do Netlify (`Site → Environment variables`):

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima pública do Supabase |

Após configurar as variáveis, o deploy é automático a cada push na `main`.

---

## Scripts disponíveis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Dev server com HMR em `localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Servir o build localmente |
| `npm run types:supabase` | Regenerar tipos TypeScript do schema Supabase |

---

## Estrutura de pastas

```
dashboard/
├── public/
│   └── app-icon.png          Ícone do app (favicon + logo)
├── src/
│   ├── components/
│   │   ├── ui/               Primitivos (Button, Input, Label, Badge...)
│   │   ├── AppLayout.tsx     Shell principal com sidebar responsiva
│   │   ├── ProtectedRoute    Gate de autenticação e role
│   │   └── Sidebar.tsx       Navegação lateral com suporte mobile
│   ├── contexts/
│   │   └── AuthContext       Sessão Supabase + perfil do usuário logado
│   ├── hooks/                Hooks reutilizáveis (useUsuarios, useTokens...)
│   ├── lib/
│   │   ├── supabase.ts       Cliente Supabase configurado
│   │   └── utils.ts          Helper cn() (clsx + tailwind-merge)
│   ├── pages/                Uma página por módulo do painel
│   ├── types/                Tipos TypeScript + schema gerado do Supabase
│   └── App.tsx               Definição de rotas
├── .env.example              Variáveis de ambiente necessárias
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

---

## Decisões técnicas

- **Vite + SPA** em vez de Next.js — painel interno não precisa de SSR; deploy estático é mais simples e barato.
- **Supabase como único backend** — reutiliza toda a infraestrutura do app mobile (tabelas, RLS, Edge Functions, Storage).
- **Signed URLs on-demand** — o painel nunca confia nas URLs persistidas no banco (TTL de 1h para fotos e 7d para laudos); sempre regenera via `createSignedUrl()` antes de exibir.
- **Edge Function `trigger-build`** — autenticação via JWT do usuário logado; o servidor verifica role antes de chamar a API do EAS.
- **Code splitting** — chunks separados por vendor (React, Supabase, Query, Recharts, MapLibre) para carregamento mais rápido.
