# TCS Console Web

Aplicação React/Vite que reúne a experiência Comercial pública e o console interno para `owner` e `developer`.

## Rotas

- `/`: Comercial público, sem providers ou consultas internas.
- `/login`: autenticação da equipe interna.
- `/app/*`: console protegido e filtrado por permissão.
- aliases como `/clientes/*`, `/planos` e `/desenvolvimento/*`: redirecionam temporariamente para o equivalente em `/app`.

## Stack e interface

- React 18, TypeScript strict, Vite 5 e React Router 6.
- TanStack Query/Table, Supabase, Recharts, MapLibre e Lucide.
- shadcn/ui versionado em `src/components/ui`, configurado por `components.json`.
- Tailwind CSS 3.4 com tokens semânticos em `src/index.css`.

Componentes seguem quatro camadas:

```text
src/components/ui/        primitivas shadcn
src/components/layout/    PublicLayout, ConsoleShell, AppSidebar e AppHeader
src/components/domain/    cabeçalhos, métricas, status, risco e contexto
src/components/data/      toolbar, ordenação, visualização e paginação
src/components/states/    loading, vazio, erro e retry
src/components/security/  confirmação de alta garantia
```

A rota interna `/app/referencia-ui` apresenta tokens, variantes e estados disponíveis.

## Tokens e convenções

Páginas novas devem usar tokens como `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-success`, `bg-warning`, `bg-destructive` e `bg-info`. Risco persistido usa `risk-r1` até `risk-r4` junto de rótulo textual.

- Reutilize `Button`, `Input`, `Select`, `Dialog`, `Table` e demais primitivas antes de criar estilos locais.
- Mantenha tabelas específicas do domínio; compartilhe toolbar, paginação e cabeçalho de coluna.
- Toda consulta deve cobrir loading, vazio, erro e retry.
- Ações críticas devem informar alvo, impacto, justificativa e assurance, preservando a autorização server-side.
- Não altere hooks, query keys, payloads ou contratos Supabase durante uma migração exclusivamente visual.

## Catálogo público

`src/config/publicPlans.ts` é a fonte sanitizada do site Comercial e reflete `../docs/planos-comerciais-aprovados.md`. A página pública não consulta RPCs protegidas e não substitui indisponibilidade por planos demonstrativos.

## Execução local

```bash
cd dashboard
npm install
npm run dev
```

Variáveis necessárias para Login e console:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Nunca versione credenciais. O site Comercial funciona sem sessão privilegiada.

## Qualidade

```bash
npm run design:validate
npm run lint
npm run test
npm run test:visual
npm run build
npm audit --omit=dev
```

`design:validate` compara o roteador com `design/route-manifest.mjs` e bloqueia o crescimento de cores literais ou primitivas paralelas nas páginas migradas.

`test:visual` compara Comercial, Login e as 21 composições internas em 1440, 1024, 768 e 390 px com referências versionadas. As rotas protegidas usam uma sessão e respostas determinísticas exclusivas do Playwright; nenhum bypass ou dado privilegiado entra no bundle. Use `npm run test:visual:update` somente quando uma mudança visual tiver sido comparada com o board correspondente no Penpot e aprovada.

Antes de aprovar uma rota, valide 1440 px, 1024 px, 768 px e 390 px; teclado, foco visível, labels, contraste, zoom e `prefers-reduced-motion`.

Para validar o contrato de restauração segura a partir da raiz do repositório:

```bash
npm run test:archive-restore
```

As convenções de novas rotas, migrations, acessibilidade e revisão Penpot estão em [CONTRIBUTING.md](./CONTRIBUTING.md). O contrato de templates e manifesto está em `../docs/ui-route-governance.md`; os boards aprovados possuem registro executável em `design/penpot-handoff.mjs` e documentação em `../docs/penpot-handoff.md`. A operação de retenção, publicação e rollback está em `../docs/archive-restoration-operations.md`.

## Rollout

A nova interface está ativa por padrão. Para restaurar temporariamente o shell anterior:

```env
VITE_NEW_CONSOLE_UI=false
```

O rollback é apenas visual e não remove `/app`, aliases, dados, RLS, auditoria ou operações administrativas. Veja `../docs/nova-ui-console-baseline.md` para decisões, capturas e sequência de rollout.
