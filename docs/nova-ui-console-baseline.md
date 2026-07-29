# Baseline e decisões da nova UI do console

Registro realizado em 21/07/2026 antes da substituição da fundação visual.

## Baseline visual

As capturas preservam o estado anterior do Login em 1440 px, 1024 px, 768 px e 390 px, além do editor/catálogo de planos em desktop e tela estreita:

- `docs/ui-baseline/login-desktop.png`
- `docs/ui-baseline/login-tablet.png`
- `docs/ui-baseline/login-compact.png`
- `docs/ui-baseline/login-narrow.png`
- `docs/ui-baseline/plans-desktop.png`
- `docs/ui-baseline/plans-narrow.png`

No baseline, build, lint e 11 testes automatizados estavam passando. O Login usava mapa decorativo em movimento e estilos literais; o console usava sidebar fixa/off-canvas, busca global, permissões filtradas e páginas funcionais com padrões repetidos de tabela, filtro, botão, badge e estados assíncronos.

## Inventário anterior

- 27 páginas no dashboard.
- 6 arquivos de UI compartilhada antes da migração.
- 326 referências diretas a cores literais Tailwind em páginas e componentes.
- Controles nativos e composições repetidas de filtros, tabelas, paginação, diálogos, estados de carregamento/erro/vazio e ações críticas.
- Contratos funcionais já centralizados em hooks, TanStack Query, RPCs e Edge Functions; eles permanecem fora do escopo visual.

## Decisões confirmadas

- Um único hostname serve o site público em `/`, o Login em `/login` e o console em `/app/*`.
- Rotas internas antigas redirecionam temporariamente para `/app/*`, preservando busca, parâmetros e fragmentos.
- `VITE_NEW_CONSOLE_UI=false` restaura o shell anterior como rollback da onda do console; a ausência da variável ativa a interface nova.
- O catálogo público é estático, sanitizado e versionado em `src/config/publicPlans.ts`, derivado de `docs/planos-comerciais-aprovados.md`; não usa sessão nem API interna.
- shadcn/ui usa preset New York, base Stone quente, CSS variables, Lucide e Tailwind CSS 3.4 já estável no projeto.
- A primeira entrega usa tema claro como referência e superfícies escuras específicas no Comercial e Login. O conjunto de tokens também permite evolução futura para tema escuro global.

## Rollout e rollback

1. Validar Comercial, Login e aliases públicos.
2. Ativar shell, sidebar e header para equipe interna.
3. Migrar páginas por domínio mantendo hooks e payloads.
4. Comparar os viewports 1440/1024/768/390 e fluxos por teclado.
5. Remover aliases e o shell anterior somente depois da aprovação de todas as rotas.

Rollback da onda: configurar `VITE_NEW_CONSOLE_UI=false`, reconstruir o dashboard e manter as rotas `/app`/aliases. Nenhuma migration de banco ou reversão de dados é necessária.

## Evidências da implementação

O Comercial e o Login foram verificados sem overflow horizontal em 1440 px, 1024 px, 768 px e 390 px. As capturas de viewport finais estão em:

- `docs/ui-final/commercial-1440-viewport.png`
- `docs/ui-final/commercial-390-viewport.png`
- `docs/ui-final/login-1440-viewport.png`
- `docs/ui-final/login-390-viewport.png`

A rota pública foi carregada sem configuração Supabase, sem requests internos e sem erros de console. O chunk privado é carregado somente ao acessar `/login`, `/app/*` ou um alias legado.
