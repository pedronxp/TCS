## 1. Baseline e decisões finais

- [x] 1.1 Registrar screenshots e comportamento das rotas críticas atuais em desktop, tablet e tela estreita
- [x] 1.2 Inventariar componentes, estados e padrões duplicados por domínio antes da substituição
- [x] 1.3 Resolver a fonte pública do catálogo de planos sem expor APIs internas
- [x] 1.4 Confirmar estratégia de hostname, prefixo `/app`, aliases e feature flag de rollback
- [x] 1.5 Confirmar preset shadcn, versão Tailwind, fonte e suporte inicial a tema escuro

## 2. Fundação shadcn/ui

- [x] 2.1 Inicializar shadcn/ui no projeto Vite existente e versionar `components.json`
- [x] 2.2 Atualizar Tailwind e Vite conforme necessário, preservando alias `@`, build e testes existentes
- [x] 2.3 Implementar tokens semânticos de superfície, texto, marca, estado, risco, sidebar e gráficos em `index.css`
- [x] 2.4 Adicionar Button, Input, Label, Textarea, Select, Checkbox, Switch, Card, Badge, Separator e Tooltip
- [x] 2.5 Adicionar Dialog, AlertDialog, Sheet, Drawer, DropdownMenu, Command, Popover, Tabs e Breadcrumb
- [x] 2.6 Adicionar Table, Pagination, Skeleton, Progress, Alert, Sonner e Chart
- [x] 2.7 Criar uma página interna de referência dos tokens, variantes, estados e componentes
- [x] 2.8 Executar build, lint e testes antes de iniciar a migração de páginas

## 3. Componentes compartilhados do console

- [x] 3.1 Criar `PublicLayout`, `ConsoleShell`, `AppSidebar`, `AppHeader` e navegação móvel
- [x] 3.2 Criar `PageHeader`, `MetricCard`, `StatusBadge`, `RiskBadge`, `EnvironmentBadge` e `CustomerContextBar`
- [x] 3.3 Criar toolbar de filtros, cabeçalho de coluna, paginação e opções de visualização para tabelas TanStack
- [x] 3.4 Migrar Loading, Empty, Error e Retry para um padrão `AsyncBoundary` acessível
- [x] 3.5 Criar `HighAssuranceDialog` com impacto, confirmação, justificativa e feedback de operação
- [x] 3.6 Criar padrões de toast, formulário, validação, erro de campo e estado de envio
- [x] 3.7 Adicionar testes unitários das variantes e navegação por teclado dos componentes compartilhados

## 4. Entrada pública e autenticação

- [x] 4.1 Criar rota pública `/` e implementar hero, produto, prova de valor e CTAs do Comercial
- [x] 4.2 Implementar seções Soluções, Planos e Segurança conforme o design aprovado
- [x] 4.3 Representar corretamente planos Individual e Municipal sem dados simulados em produção
- [x] 4.4 Migrar o Login para a composição editorial aprovada preservando autenticação e mensagens de erro
- [x] 4.5 Mover o console para `/app/*` e criar aliases temporários para as rotas internas existentes
- [x] 4.6 Garantir que rotas públicas não montem providers ou consultas internas desnecessárias
- [x] 4.7 Testar Comercial → Login → Console, retorno autenticado, logout e deep links protegidos

## 5. Shell e dashboards

- [x] 5.1 Migrar sidebar para o componente shadcn recolhível/off-canvas mantendo filtragem por permissão
- [x] 5.2 Migrar cabeçalho com breadcrumb, busca global, ambiente, alertas e ação contextual
- [x] 5.3 Implementar dashboard executivo de owner conforme os dados reais disponíveis
- [x] 5.4 Implementar dashboard técnico de developer conforme os dados reais disponíveis
- [x] 5.5 Implementar preferências de densidade e estado recolhido sem prejudicar teclado ou telas pequenas
- [x] 5.6 Validar que navegação escondida não substitui autorização server-side

## 6. Clientes e agentes

- [x] 6.1 Migrar lista de Clientes com filtros, tabela, paginação, criação e estados assíncronos
- [x] 6.2 Migrar detalhe do cliente para workspace contextual com cabeçalho e abas persistentes
- [x] 6.3 Migrar resumo, assinatura, consumo, usuários, sessões, vistorias, chamados, implantação e auditoria do cliente
- [x] 6.4 Migrar detalhe do agente e seus módulos preservando filtros compartilhados e paginação server-side
- [x] 6.5 Validar isolamento de cliente, permissões sensíveis, links assinados e alternativas textuais ao mapa

## 7. Negócio, suporte e governança

- [x] 7.1 Migrar Planos e seu editor versionado para componentes shadcn sem alterar payloads
- [x] 7.2 Migrar Assinaturas, consumo e operações de ciclo de vida com confirmações auditáveis
- [x] 7.3 Migrar Suporte, detalhe do chamado, SLA e histórico
- [x] 7.4 Migrar Sessões e encerramento remoto com motivo e assurance
- [x] 7.5 Migrar Equipe interna, permissões e estados de acesso
- [x] 7.6 Migrar Auditoria, filtros e inspeção de metadados sanitizados

## 8. Desenvolvimento e operações técnicas

- [x] 8.1 Migrar Versões e changelog
- [x] 8.2 Migrar Builds, pipeline, logs permitidos e aprovação de produção
- [x] 8.3 Migrar Formulários, preview, publicação e rollback
- [x] 8.4 Migrar Regras de risco e simulador R1–R4
- [x] 8.5 Unificar a composição visual de Sincronização, Armazenamento e Logs sem misturar seus filtros
- [x] 8.6 Migrar Configurações e conjunto de mudanças pendentes
- [x] 8.7 Migrar Arquivamento, retenção e fila de restauração

## 9. Qualidade, rollout e limpeza

- [x] 9.1 Adicionar testes de fluxo das rotas públicas e autenticadas migradas
- [x] 9.2 Adicionar validação automatizada de acessibilidade nas páginas críticas
- [x] 9.3 Validar 1440 px, 1024 px, 768 px e 390 px sem overflow ou ações inacessíveis
- [x] 9.4 Validar teclado, leitor de tela, contraste, zoom, fontes ampliadas e movimento reduzido
- [x] 9.5 Executar regressão visual comparando implementação e design aprovado
- [x] 9.6 Executar build, lint, testes unitários, testes de integração e fluxos de permissão
- [ ] 9.7 Ativar cada onda por feature flag, coletar feedback interno e documentar rollback
  - Não executado por decisão do responsável pelo produto: homologação/rollout externo foi explicitamente recusado e permanece fora do escopo.
- [x] 9.8 Remover aliases, estilos literais e componentes substituídos somente após aprovação das rotas migradas
- [x] 9.9 Atualizar README e documentação de contribuição com tokens, componentes e convenções shadcn

## 10. Cobertura completa no Penpot

- [x] 10.1 Conectar ao arquivo `TCS — Web Dashboard` via MCP e inventariar suas 15 páginas
- [x] 10.2 Auditar Foundations, Comercial, Login, Dashboard, Clientes, Sessões e Auditoria contra a implementação
- [x] 10.3 Versionar a matriz rota → board/template → papel/permissão → estados → breakpoints
- [x] 10.4 Criar e aprovar board do Dashboard técnico de developer
  - Página `24 · Dashboard técnico` criada no arquivo `a1a9e568-e174-80fb-8008-5ce7be9647bc` com referências aprovadas em 1440, 1024, 768 e 390 px.
- [x] 10.5 Criar e aprovar boards de Detalhe do agente, Formulários e Regras de risco
  - Detalhe do agente aprovado na página 25 em quatro breakpoints; Formulários e Regras de risco permanecem cobertos pelas páginas 16 e 17.
- [x] 10.6 Criar e aprovar boards de Sincronização, Armazenamento e Logs e erros
- [x] 10.7 Criar e aprovar boards de Configurações e Arquivamento
- [x] 10.8 Adicionar variantes ou regras responsivas aprovadas para 1024 px, 768 px e 390 px
- [x] 10.9 Representar nos boards os estados loading, vazio, erro, retry, sucesso, permissão negada e ações críticas aplicáveis

## 11. Correção de fidelidade das telas já migradas

- [x] 11.1 Corrigir tokens para os valores exatos de `01 · Foundations`, incluindo Inter, escala de espaçamento e raios
- [x] 11.2 Corrigir primitivas e componentes compartilhados conforme `02 · Components`
- [x] 11.3 Refazer Comercial conforme `08 · Comercial público`, removendo branding, copy e estética azul/neon não aprovados
- [x] 11.4 Refazer Login conforme `09 · Login`, incluindo composição clara/escura, métricas, opções e SSO aprovados
- [x] 11.5 Corrigir sidebar de 232 px, header e shell conforme os boards internos
- [x] 11.6 Refazer Dashboard executivo incluindo saúde da operação e ações rápidas
- [x] 11.7 Implementar Dashboard técnico somente após aprovação do board específico
- [x] 11.8 Refazer Clientes incluindo indicadores, filtros, tabela e radar de implantação aprovados
- [x] 11.9 Refazer Sessões incluindo resumo, anomalias, política e listagem aprovados sem perder revogação segura
- [x] 11.10 Refazer Auditoria como timeline e painel de inspeção preservando sanitização e filtros reais
- [x] 11.11 Comparar cada tela corrigida lado a lado em 1440 px antes de avançar para a onda seguinte

## 12. Design obrigatório para rotas futuras

- [x] 12.1 Criar templates aprovados para página pública, autenticação, dashboard, listagem, detalhe, timeline, editor, configurações e operação técnica
  - Nove templates materializados e aprovados na página `23 · Templates operacionais`.
- [x] 12.2 Criar manifesto de rotas com referência Penpot, template, permissões, estados, breakpoints e aprovação visual
- [x] 12.3 Adicionar validação que detecte rotas sem entrada no manifesto
- [x] 12.4 Adicionar lint ou teste que bloqueie cores literais e primitivas paralelas fora das exceções aprovadas
- [x] 12.5 Adicionar regressão visual por rota e breakpoint ao pipeline de qualidade
  - Comercial, Login e 21 composições internas cobertos em 1440, 1024, 768 e 390 px com fixtures autenticadas isoladas do bundle.
- [x] 12.6 Documentar checklist de criação de novas rotas e exigir board ou derivação aprovada antes do merge
- [x] 12.7 Validar que todas as rotas atuais, incluindo `/app/referencia-ui`, possuem cobertura no manifesto
