## Context

O dashboard é uma aplicação React 18 com Vite, React Router, Tailwind CSS 3, TanStack Query, TanStack Table, Supabase e Lucide. O repositório já inclui `class-variance-authority`, `clsx` e `tailwind-merge`, mas não possui `components.json` nem uma instalação shadcn completa. A inspeção encontrou 27 páginas, apenas seis arquivos em `components/ui`, mais de cem botões e controles de formulário nativos e centenas de referências diretas a cores Tailwind.

Os fluxos funcionais e de autorização do console foram implementados pela mudança `reformular-dashboard-interno-donos-programadores`. Esta mudança trata a UI como uma camada sobre esses contratos. O design aprovado no Penpot cobre fundações, componentes, dashboard, clientes, suporte, planos, autenticação e áreas técnicas com uma identidade minimalista.

## Goals / Non-Goals

**Goals:**

- Implantar uma fundação shadcn/ui consistente e adaptada à identidade TCS.
- Criar uma jornada pública coerente de Comercial para Login e, após autenticação, Console.
- Reduzir repetição de classes e controles sem criar componentes genéricos excessivamente rígidos.
- Manter as diferenças de tarefas, indicadores e permissões entre owner e developer.
- Preservar comportamento, dados, estados assíncronos e segurança durante a migração.
- Garantir desktop, tablet, tela estreita, teclado, leitor de tela, contraste e movimento reduzido.
- Cobrir todas as rotas atuais e estabelecer um contrato verificável para que rotas futuras usem o mesmo design.
- Fazer do Penpot a fonte de verdade visual, sem substituição criativa de paleta, branding, tipografia, copy, composição ou densidade.

**Non-Goals:**

- Refatorar hooks de domínio que não sejam afetados pela composição visual.
- Redesenhar o aplicativo móvel Expo.
- Criar uma segunda aplicação para o site comercial.
- Migrar todas as páginas no mesmo pull request.

## Decisions

### 1. Uma aplicação Vite com duas fronteiras de layout

A mesma aplicação servirá o conteúdo público e o console interno. `/` será a página Comercial, `/login` será a autenticação e `/app/*` será protegido por `ProtectedRoute`. O console terá seu próprio layout e providers, enquanto as páginas públicas não montarão sidebar, busca global ou consultas internas.

Rotas internas antigas receberão redirecionamentos temporários para equivalentes em `/app/*`. Links gerados, breadcrumbs e testes serão atualizados antes da remoção dos aliases.

### 2. shadcn/ui como código do projeto, não dependência visual opaca

O CLI será inicializado no projeto Vite existente. Os componentes gerados permanecerão em `src/components/ui` e poderão receber ajustes locais controlados. Será adotado o preset visual atual compatível com Vite, variáveis CSS, base neutra quente e Lucide.

A migração de Tailwind 3 para a versão exigida pelo preset atual ocorrerá isoladamente na fase de fundação, com build e comparação visual antes da migração de páginas. Tokens específicos de risco e gráficos serão preservados.

### 3. Tokens semânticos em vez de cores literais nas páginas

Os pares `background/foreground`, `card/card-foreground`, `primary/primary-foreground`, `secondary`, `accent`, `muted`, `destructive`, `border`, `input` e `ring` serão a interface visual principal. Serão adicionados tokens de sucesso, alerta, informação, risco R1–R4, sidebar e gráficos.

O tema claro será a referência inicial. Superfícies escuras serão usadas intencionalmente em hero, login e painéis técnicos, sem exigir um modo escuro global na primeira entrega.

### 4. Primitivas shadcn e componentes de domínio terão responsabilidades separadas

Primitivas como Button, Input, Dialog, Sheet, Tabs, Table e Sidebar não conhecerão Supabase ou regras do produto. Componentes de domínio como `PageHeader`, `MetricCard`, `CustomerContextBar`, `RiskBadge`, `AuditTimeline`, `AsyncBoundary` e `HighAssuranceDialog` traduzirão os padrões do console.

Não haverá um único DataTable universal. Cada tabela manterá colunas, filtros, seleção e paginação adequados ao domínio, reutilizando apenas toolbar, paginação, cabeçalho de coluna e estado vazio.

### 5. O conteúdo comercial refletirá o catálogo real

A seção Planos usará as audiências Individual e Municipal, com os níveis e preços vindos do catálogo permitido ou de configuração pública sanitizada. A página não exibirá recursos simulados nem carregará APIs internas protegidas. Valores personalizados e Enterprise/Municipal Completo serão apresentados como proposta comercial quando aplicável.

### 6. Migração por ondas e feature flag

A nova fundação será introduzida antes das páginas. Depois serão migrados entrada pública, shell, clientes, negócio, operações e desenvolvimento. Durante cada onda, a rota nova poderá ser ativada por feature flag ou alias, permitindo comparação e rollback sem desfazer dados.

Hooks, mutations e contratos existentes serão preservados. Alterações de lógica encontradas durante a migração serão registradas separadamente e não serão escondidas dentro de refatorações visuais.

### 7. Estados e ações críticas fazem parte do design system

Toda superfície de dados deve exibir loading, vazio, erro e retry. Mutations devem apresentar progresso, sucesso ou erro preservando o estado anterior. Ações de alto risco usarão `AlertDialog` ou diálogo especializado com impacto, justificativa, assurance necessária e resultado auditável.

### 8. Responsividade orientada à tarefa

Desktop usará sidebar recolhível e tabelas densas. Tablet reduzirá colunas e priorizará ações. Em telas estreitas, a sidebar será off-canvas, filtros irão para Sheet/Drawer e tabelas críticas oferecerão uma apresentação alternativa sem ocultar ações necessárias.

### 9. Penpot como contrato visual executável

O arquivo Penpot `TCS — Web Dashboard` é a fonte de verdade visual. A implementação deve reproduzir a composição, hierarquia, branding, copy aprovada, dimensões, alinhamentos, densidade, tokens, estados e componentes representados no board correspondente. Alterações necessárias por dados reais, acessibilidade ou comportamento responsivo devem ser registradas no design antes de serem incorporadas ao código.

A fundação aprovada parte dos seguintes valores:

- Background `#FAF8F5`, surface `#FFFFFF` e foreground `#1C1917`.
- Secondary `#F3EFE9`, border `#E7E0D8`, primary `#6F513A` e warm accent `#D7C3AA`.
- Info `#EAF4FB` e info strong `#2F6F96`.
- Tipografia Inter, escala de espaçamento 4/8/12/16/24/32 px e raios 6/10/14/24 px.

Cores de risco, sucesso, alerta e erro continuam semânticas, mas não substituem a identidade visual de marca. Cores literais ficam restritas aos arquivos de tokens, ilustrações aprovadas e casos documentados.

### 10. Matriz obrigatória de cobertura rota → design

Cada rota deve possuir uma entrada de manifesto contendo caminho, papel/permissão, board Penpot, template, estados obrigatórios, breakpoints e status de aprovação visual.

| Rota | Referência Penpot | Situação de design |
| --- | --- | --- |
| `/` | `08 · Comercial público` | Existe; requer correção de fidelidade |
| `/login` | `09 · Login` | Existe; requer correção de fidelidade |
| `/app` owner | `03 · Dashboard` | Existe; requer correção de fidelidade |
| `/app` developer | Novo board `Dashboard técnico` | Ausente |
| `/app/clientes` | `04 · Clientes` | Existe; requer correção de fidelidade |
| `/app/clientes/:customerId/:section?` | `05 · Detalhe do cliente` | Existe; implementação pendente |
| `/app/clientes/:customerId/usuarios/:userId/:userSection?` | Novo board `Detalhe do agente` | Ausente |
| `/app/planos` | `07 · Planos` | Existe; implementação pendente |
| `/app/assinaturas` | `10 · Assinaturas` | Existe; implementação pendente |
| `/app/sessoes` | `11 · Sessões` | Existe; requer correção de fidelidade |
| `/app/suporte` | `06 · Suporte` | Existe; implementação pendente |
| `/app/staff` | `12 · Equipe interna` | Existe; implementação pendente |
| `/app/auditoria` | `13 · Auditoria` | Existe; requer correção de fidelidade |
| `/app/desenvolvimento/versoes` | `14 · Versões` | Existe; implementação pendente |
| `/app/desenvolvimento/builds` | `15 · Builds` | Existe; implementação pendente |
| `/app/desenvolvimento/formularios` | `16 · Formulários` | Aprovado e implementado; regras responsivas registradas |
| `/app/desenvolvimento/regras-risco` | `17 · Regras de risco` | Aprovado e implementado; simulação obrigatória preservada |
| `/app/desenvolvimento/sincronizacao` | `18 · Sincronização` | Aprovado e implementado; filtros independentes |
| `/app/desenvolvimento/armazenamento` | `19 · Armazenamento` | Aprovado e implementado; filtros independentes |
| `/app/desenvolvimento/logs` | `20 · Logs e erros` | Aprovado e implementado; filtros independentes |
| `/app/governanca/configuracoes` | `21 · Configurações` | Aprovado e implementado; somente leitura até existir contrato de mutação |
| `/app/governanca/arquivamento` | `22 · Arquivamento` | Aprovado e implementado; retenção e restauração segura |
| `/app/referencia-ui` | `01 · Foundations` e `02 · Components` | Derivada do design system |

Aliases legados não são telas independentes e herdam o destino em `/app/*`.

### 11. Templates obrigatórios para rotas atuais e futuras

O design system disponibilizará templates aprovados para: página pública, autenticação, dashboard, listagem, detalhe contextual, timeline/auditoria, formulário/editor, configurações e operação técnica. Uma rota futura deve:

1. possuir board aprovado ou derivação explícita de um desses templates;
2. ser registrada no manifesto de rotas;
3. usar apenas tokens e componentes compartilhados para estrutura visual;
4. incluir loading, vazio, erro, retry, sucesso e estados de permissão aplicáveis;
5. passar regressão visual, acessibilidade e viewports antes do merge.

### 12. Gate de fidelidade por rota

Uma rota só pode ser marcada como migrada quando:

- a captura da implementação em 1440 px foi comparada lado a lado com o board aprovado;
- diferenças de layout, cor, tipografia, conteúdo e componentes foram corrigidas ou documentadas;
- 1024, 768 e 390 px foram validados contra variantes responsivas ou regras aprovadas;
- fluxos reais, permissões, estados assíncronos e ações críticas foram testados;
- não há cores literais ou componentes paralelos não autorizados;
- build, lint, testes e acessibilidade estão aprovados.

A auditoria MCP realizada em 26 de julho de 2026 encontrou divergências relevantes em Foundations, Comercial, Login, Dashboard, Clientes, Sessões e Auditoria. Essas rotas retornam ao estado pendente até cumprirem este gate.

## Component Architecture

```text
src/components/ui/          Primitivas shadcn
src/components/layout/      PublicLayout, ConsoleShell, AppSidebar, AppHeader
src/components/domain/      PageHeader, MetricCard, StatusBadge, RiskBadge
src/components/data/        DataTableToolbar, Pagination, ColumnHeader
src/components/states/      AsyncBoundary, EmptyState, ErrorState
src/components/security/    HighAssuranceDialog, PermissionNotice
src/pages/public/            CommercialPage, LoginPage
src/pages/app/               Rotas autenticadas migradas
```

## Migration Plan

1. Congelar o inventário de rotas e completar no Penpot os boards e variantes ausentes.
2. Corrigir Foundations e Components para os valores exatos do Penpot.
3. Refazer Comercial e Login e aprovar a comparação visual da entrada pública.
4. Refazer AppLayout, Sidebar, Header e Dashboard por papel.
5. Refazer Clientes, Sessões e Auditoria e migrar detalhe do cliente e detalhe do agente.
6. Migrar Planos, Assinaturas, Suporte e Equipe.
7. Migrar Versões, Builds, Formulários, Risco, Eventos, Configurações e Arquivamento.
8. Validar todas as rotas pela matriz de cobertura e pelos gates de fidelidade.
9. Ativar as ondas por feature flag e remover aliases e componentes anteriores somente após aprovação.

Rollback: desativar a feature flag da nova onda e restaurar os aliases para a UI anterior. Nenhuma migration de banco será necessária para o rollback visual.

## Risks / Trade-offs

- [Atualização de Tailwind altera estilos existentes] → isolar a atualização, preservar tokens e comparar páginas antes de avançar.
- [Mudança de `/` para `/app` quebra links] → manter aliases, centralizar geração de rotas e monitorar navegação.
- [Componente compartilhado fica rígido demais] → compartilhar primitivas e padrões, mantendo composição por domínio.
- [Migração visual altera comportamento sensível] → preservar handlers e hooks, adicionar testes antes de substituir cada rota.
- [Site público consulta dados internos] → usar conteúdo estático aprovado ou endpoint público sanitizado sem sessão privilegiada.
- [Cards reduzem densidade operacional] → reservar cards para síntese e manter tabelas/listas para investigação.
- [Implementação deriva criativamente do Penpot] → bloquear conclusão sem comparação visual e registrar toda divergência aprovada no board ou no manifesto.
- [Rota futura quebra consistência] → exigir template, manifesto, componentes compartilhados e regressão visual no CI.
- [Rota existente não possui design] → criar e aprovar o board antes da migração; consistência inferida não é suficiente para declarar fidelidade.

## Open Questions

- O catálogo público de planos será estático versionado no frontend ou fornecido por uma função pública sanitizada?
- O domínio público e o console usarão o mesmo hostname ou o console será movido posteriormente para um subdomínio?
- A primeira entrega incluirá modo escuro global ou apenas superfícies escuras específicas do design aprovado?
