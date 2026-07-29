## Why

O dashboard atual mistura módulos operacionais do aplicativo, gestão comercial e ferramentas técnicas na mesma navegação, enquanto várias telas comerciais ainda funcionam apenas como listagens mínimas. O TCS precisa de um console interno claro e funcional para donos e programadores administrarem clientes, assinaturas, suporte e a saúde técnica da plataforma sem expor esse backoffice aos clientes finais.

## What Changes

- Reorganizar o dashboard web como console exclusivamente interno, separado conceitualmente do futuro portal do cliente.
- Criar um shell responsivo com navegação agrupada em Principal, Negócio, Desenvolvimento e Governança.
- Exibir uma visão executiva para donos e uma visão técnica para programadores, com indicadores e ações adequados a cada perfil.
- Transformar organizações e contas individuais em uma área central de Clientes, com detalhe comercial, operacional e técnico por cliente.
- Mover ocorrências, mapa, agendamentos, usuários e laudos para o contexto do cliente quando usados para suporte ou diagnóstico interno.
- Completar os fluxos de planos, assinaturas, consumo, suporte, sessões e auditoria com estados de carregamento, sucesso, erro, confirmação e rastreabilidade.
- Criar operações técnicas para versões do aplicativo, builds, formulários, regras de risco, sincronização, armazenamento, logs e erros.
- Separar permissões internas de dono e programador, deixando espaço para perfis futuros de suporte e auditoria.
- Padronizar busca, filtros, tabelas, badges, estados vazios, acessibilidade e comportamento responsivo.
- Preparar componentes e fronteiras de autorização que possam ser reutilizados por um futuro portal do cliente, sem implementar esse portal nesta mudança.
- **BREAKING**: remover o acesso ao dashboard interno baseado apenas nos papéis municipais `admin` ou `master_admin`; o acesso dependerá de vínculo interno explícito e ativo.

## Capabilities

### New Capabilities

- `internal-console-experience`: shell, navegação, dashboards por perfil, contexto de cliente, responsividade e padrões de interação do console interno.
- `internal-staff-access`: identidades internas, papéis de dono e programador, permissões por ação e proteção das rotas e operações administrativas.
- `internal-console-workflows`: gestão funcional de clientes, planos, assinaturas, consumo, suporte, sessões, auditoria e operações técnicas da plataforma.

### Modified Capabilities

Nenhuma especificação base existente será modificada. A mudança complementa a fundação ainda ativa de planos, organizações e assinaturas sem redefinir seus contratos de dados.

## Impact

- Dashboard React/Vite em `dashboard/src`, especialmente rotas, shell, sidebar, contexto de autenticação, páginas, hooks e componentes compartilhados.
- Supabase Auth e Postgres para papéis internos, políticas RLS, RPCs administrativas, auditoria e consultas agregadas do dashboard.
- Tabelas e funções criadas pela mudança ativa `criar-planos-assinatura-e-gestao-municipal`, que devem ser reutilizadas em vez de duplicadas.
- Edge Functions relacionadas a builds, arquivamento e futuras consultas técnicas.
- Testes do dashboard para autorização, navegação, mutations administrativas e isolamento de dados.
- Documentação do dashboard, que deverá refletir o acesso exclusivamente interno e a separação do futuro portal do cliente.

## Extensão: detalhe operacional do agente

- Tornar cada usuário da aba Clientes > Usuários navegável para um detalhe próprio, preservando o cliente selecionado como fronteira de autorização.
- Exibir todas as vistorias do agente por paginação server-side, sem o limite silencioso das 50 vistorias recentes atualmente retornadas no detalhe do cliente.
- Reunir no detalhe do agente os módulos Visão geral, Vistorias, Mapa, Agendamentos, Documentos e Acesso/atividade.
- Compartilhar período e filtros entre indicadores, lista e mapa para que os totais representem exatamente o mesmo conjunto de vistorias.
- Aproveitar dados já existentes de vistorias, risco, coordenadas, documentos, agendamentos, sessões e eventos técnicos; nenhuma métrica poderá ser simulada quando a fonte não existir.
- Manter dados pessoais, coordenadas e documentos sujeitos ao modo de suporte auditado e às permissões internas já definidas.
