# TCS — Painel Administrativo

Dashboard desktop do app **TCS - Relatório de Risco**, restrito a usuários `master_admin` e `admin`.

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS** + tokens de design (cores de risco R1-R4)
- **TanStack Query** (cache de dados) + **TanStack Table** (tabelas server-side)
- **Supabase JS v2** (mesmo backend do app mobile)
- **React Router v6** (rotas protegidas)
- **Lucide React** (ícones)

## Setup

```bash
cd dashboard
cp .env.example .env  # editar com SUPABASE_URL e ANON_KEY do projeto
npm install
npm run dev           # http://localhost:5173
```

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Dev server com HMR em `http://localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Servir o build local |
| `npm run types:supabase` | Gerar tipos TS do schema Supabase (requer `supabase` CLI logado) |

## Variáveis de ambiente

Ver `.env.example`. Apenas duas variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`.env` está no `.gitignore` — nunca comitar credenciais reais.

## Estrutura

```
dashboard/
├── src/
│   ├── components/         Componentes reutilizáveis
│   │   ├── ui/             Primitivos (Button, Input, Label)
│   │   ├── AppLayout.tsx   Shell com sidebar
│   │   ├── ProtectedRoute  Gate de auth e role
│   │   └── Sidebar.tsx     Navegação lateral
│   ├── contexts/
│   │   └── AuthContext     Sessão Supabase + carga de profile
│   ├── lib/
│   │   ├── supabase.ts     Cliente Supabase
│   │   └── utils.ts        Helper cn() (clsx + tailwind-merge)
│   ├── pages/              Telas roteadas
│   ├── types/              Tipos TS (incluindo schema Supabase)
│   └── App.tsx             Rotas
├── index.html
└── vite.config.ts
```

## Acesso e permissões

O gate é feito em `AuthContext.tsx`:

- Login só passa pra usuários com `role IN ('master_admin', 'admin')`
- E com `isApproved = true` na tabela `users`
- Tentativas com outras roles são deslogadas e recebem mensagem clara

Telas marcadas `MASTER` na sidebar exigem `role = 'master_admin'`:

- Arquivamento (Fase 8)
- Builds APK (Fase 9)
- Configurações

## Roadmap

| Fase | Status | Entrega |
|------|--------|---------|
| 1 | ✅ | Setup + auth shell |
| 2 | ⏭️ | Usuários (tabela, aprovar, invite tokens) |
| 3 | | Ocorrências (vistorias com fotos via signed URL) |
| 4 | | Agendamentos |
| 5 | | Mapa (MapLibre + clusters + heatmap) |
| 6 | | Laudos (Edge Function `/document/{id}/{tipo}`) |
| 7 | | Relatórios (Recharts + export CSV/PDF) |
| 8 | | Storage Lifecycle (Drive — saga + quarentena) |
| 9 | | Builds APK (EAS Build + GitHub Actions) |
| 10 | | Polish + deploy |

## Decisões arquiteturais

- **Vite ao invés de Next.js** — admin interno não precisa SSR; deploy estático mais simples.
- **Grupos fora do v1** — hoje é offline-only no SQLite do app, exigiria sync antes; tratado como milestone separado.
- **Storage signed URL on-demand** — dashboard nunca confia nas URLs persistidas (TTL 1h fotos / 7d laudos); sempre regenera via `createSignedUrl()`.
- **Edge Function `/document/{id}/{tipo}`** (Fase 6) — endpoint unificado que resolve origem (Supabase ou Drive) sem o frontend precisar saber.
