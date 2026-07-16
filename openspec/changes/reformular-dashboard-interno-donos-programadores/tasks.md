## 1. Preparação e compatibilidade

- [x] 1.1 Revisar conflitos entre esta mudança e `criar-planos-assinatura-e-gestao-municipal`, registrando quais tabelas, RPCs e páginas serão reutilizadas
- [x] 1.2 Definir a matriz final de permissões de `owner` e `developer`, incluindo aprovação de build em produção e acesso a dados sensíveis
- [x] 1.3 Mapear cada rota atual do dashboard para manter, mover para Cliente, substituir ou remover
- [x] 1.4 Criar uma feature flag de ativação do novo shell interno e documentar o rollback para o shell atual

## 2. Identidade e autorização interna

- [x] 2.1 Criar migração para identidades internas com papel, status, criação, atualização e vínculo ao usuário autenticado
- [x] 2.2 Migrar proprietários ativos de `owner_admins` para o papel interno `owner` sem interromper o acesso existente
- [x] 2.3 Implementar helpers server-side para verificar identidade interna e permissão por ação
- [x] 2.4 Atualizar RLS, RPCs e Edge Functions administrativas para separar permissões de dono e programador
- [x] 2.5 Atualizar o AuthContext do dashboard para carregar o perfil interno sem confiar em papel municipal ou metadata editável
- [x] 2.6 Proteger rotas por permissão e registrar tentativas negadas apropriadas
- [x] 2.7 Exigir autenticação forte e confirmação nas ações internas classificadas como alto risco
- [x] 2.8 Criar testes negativos para usuário municipal, staff inativo, dono e programador chamando rotas e operações diretamente

## 3. Fundação frontend e tipos

- [x] 3.1 Gerar e versionar tipos reais do schema Supabase usado pelo dashboard
- [x] 3.2 Criar tipos de domínio para perfil interno, cliente, saúde, permissão, evento técnico e mutation administrativa
- [x] 3.3 Criar hooks TanStack Query por domínio e remover casts `as unknown as` das telas migradas
- [x] 3.4 Criar uma camada única para mutations com retorno tipado, operação idempotente, feedback e invalidação de cache
- [x] 3.5 Padronizar componentes de loading, vazio, erro, confirmação, sucesso, tabela, filtros e badge de status
- [x] 3.6 Configurar ESLint e um runner de testes do dashboard no pipeline local

## 4. Shell e experiência interna

- [x] 4.1 Implementar o novo AppLayout com sidebar agrupada, cabeçalho, ambiente, busca, alertas e ação principal
- [x] 4.2 Implementar a navegação do dono com Principal, Negócio e Governança
- [x] 4.3 Implementar a navegação do programador com Principal, Desenvolvimento e Governança
- [x] 4.4 Implementar dashboard executivo com clientes, renovações, assinaturas, suporte e implantação
- [x] 4.5 Implementar dashboard técnico com versão, builds, sincronização, armazenamento e erros
- [x] 4.6 Implementar sidebar recolhível e reflow responsivo para tablet e telas estreitas
- [x] 4.7 Garantir foco visível, navegação por teclado, rótulos acessíveis e dialogs com gerenciamento de foco
- [x] 4.8 Implementar busca global de cliente com resultados autorizados e navegação para o resumo

## 5. Clientes e escopo operacional

- [x] 5.1 Criar consulta paginada unificada de organizações e contas individuais com busca, filtros e saúde
- [x] 5.2 Implementar página Clientes com criação, edição, status, contato, plano, uso e última atividade
- [x] 5.3 Implementar rota `/clientes/:id` com abas Resumo, Assinatura, Consumo, Usuários, Sessões, Vistorias, Chamados, Implantação e Auditoria
- [x] 5.4 Implementar resumo do cliente com indicadores comerciais, operacionais e técnicos acionáveis
- [x] 5.5 Implementar edição de cadastro e implantação municipal com validação, confirmação e auditoria
- [x] 5.6 Mover ocorrências e detalhes de vistoria para o contexto do cliente com escopo resolvido server-side
- [x] 5.7 Mover mapa, agendamentos, usuários, laudos e relatórios para abas ou ações do cliente
- [x] 5.8 Redirecionar rotas operacionais globais antigas para seleção de cliente ou compatibilidade explicitamente identificada
- [x] 5.9 Testar que a troca de cliente não reutiliza cache, filtros ou resultados do cliente anterior

## 6. Planos, assinaturas e consumo

- [x] 6.1 Migrar o editor de planos existente para hooks tipados mantendo preço, trial, carência, recursos, limites, SLA e versões
- [x] 6.2 Implementar visualização somente leitura de entitlements de plano para programadores
- [x] 6.3 Implementar criação e atribuição de assinatura a cliente individual ou organização
- [x] 6.4 Implementar troca de plano, período, trial, carência, cancelamento, suspensão e reativação por operações auditadas
- [x] 6.5 Implementar overrides de recursos e limites com justificativa obrigatória e estado anterior preservado
- [x] 6.6 Implementar painel de consumo por recurso com limite, percentual, aviso e período
- [x] 6.7 Criar testes de concorrência, idempotência, validação e autorização das mutations comerciais

## 7. Suporte, sessões e auditoria

- [x] 7.1 Implementar fila de suporte com busca e filtros server-side por cliente, plano, prioridade, status, responsável e SLA
- [x] 7.2 Implementar detalhe do chamado com descrição, mensagens, notas internas, responsável, prazos e histórico de eventos
- [x] 7.3 Implementar mutations auditadas para prioridade, responsável, status, mensagem e nota interna
- [x] 7.4 Exibir violações de prazo e escalonamento no dashboard, na fila e no detalhe do cliente
- [x] 7.5 Implementar lista de sessões por cliente e internas com dispositivo, plataforma, heartbeat, status e filtros
- [x] 7.6 Implementar encerramento remoto com confirmação, motivo, feedback de falha e auditoria
- [x] 7.7 Implementar timeline global e por cliente para eventos comerciais, suporte, sessão, staff, build e configuração
- [x] 7.8 Sanitizar metadados de auditoria e impedir gravação de tokens, segredos ou dados pessoais desnecessários

## 8. Operações de desenvolvimento

- [x] 8.1 Implementar catálogo de versões com versão publicada, mínima, em desenvolvimento, adoção e changelog
- [x] 8.2 Migrar Builds para operação protegida por papel e ambiente, com status, logs permitidos e histórico
- [x] 8.3 Implementar política de aprovação para build ou publicação em produção conforme a matriz definida
- [x] 8.4 Implementar catálogo e editor versionado de formulários com validação, pré-visualização, publicação e rollback
- [x] 8.5 Implementar configuração versionada de regras de risco com simulação antes da publicação
- [x] 8.6 Criar contrato persistido de evento técnico sanitizado para versão, plataforma, cliente, categoria, severidade e correlação
- [x] 8.7 Instrumentar falhas de sincronização e armazenamento necessárias à primeira visão técnica
- [x] 8.8 Implementar página Logs e erros com filtros por cliente, versão, plataforma, período, categoria e severidade
- [x] 8.9 Implementar páginas Sincronização e Armazenamento com eventos acionáveis e acesso ao cliente relacionado
- [x] 8.10 Garantir que indisponibilidade da fonte técnica produza erro visível e nunca dados simulados em produção

## 9. Qualidade, segurança e entrega

- [x] 9.1 Criar testes unitários para resolução de menu, permissões, cliente, estados de query e mutations
- [x] 9.2 Criar testes de integração para login interno, RLS, RPCs, isolamento entre duas organizações e acesso por papel
- [x] 9.3 Criar testes de fluxo para cliente, assinatura, suporte, sessão, build e formulário
- [x] 9.4 Verificar responsividade e acessibilidade das páginas principais em desktop, tablet e tela estreita
- [x] 9.5 Executar build, lint, testes e análise de dependências sem erros bloqueantes
- [x] 9.6 Validar que não há chaves secretas, tokens, dados simulados ou logs sensíveis no bundle de produção
- [x] 9.7 Atualizar README e documentação de operação para acesso interno, papéis e recuperação de falhas
- [x] 9.8 Ativar o novo console para donos em piloto interno e validar os fluxos comerciais
- [x] 9.9 Ativar a visão de programador em piloto interno e validar diagnóstico, builds e permissões negativas
- [x] 9.10 Remover rotas de compatibilidade e o gate antigo somente após aprovação dos dois pilotos internos
