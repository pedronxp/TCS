## 1. Aprovação do produto

- [ ] 1.1 Confirmar preços, período de teste, status de assinatura, carência e política de excedentes com os proprietários
- [ ] 1.2 Confirmar catálogo inicial de modelos, incluindo ARV e modo treinamento
- [ ] 1.3 Confirmar limites iniciais por plano e quais valores serão personalizados por prefeitura
- [ ] 1.4 Confirmar canais, horário e metas contratuais de suporte
- [ ] 1.5 Definir a primeira prefeitura piloto e o coordenador responsável

## 2. Modelo de dados e migração

- [x] 2.1 Criar migração para organizações, membros, funções e status de vínculo
- [x] 2.2 Criar migração para planos, recursos, limites, versões e assinaturas
- [x] 2.3 Criar migração para contadores de uso por período e escopo individual/organizacional
- [x] 2.4 Criar migração para sessões ativas, heartbeat, timeout e encerramento
- [x] 2.5 Criar migração para convites vinculados a organization_id, função, expiração e uso único
- [x] 2.6 Criar migração para chamados de suporte e eventos de auditoria
- [x] 2.7 Criar índices, constraints e políticas RLS para impedir acesso entre organizações
- [x] 2.8 Mapear contas existentes e documentar a migração para organização de compatibilidade

## 3. Autorização e convites

- [x] 3.1 Implementar resolução server-side de organização a partir do membership
- [x] 3.2 Implementar RPC ou Edge Function para criar convite com validação de papel e vaga
- [x] 3.3 Implementar validação atômica de convite, expiração, uso único e vínculo organizacional
- [x] 3.4 Impedir que município enviado pelo cliente altere autorização ou membership
- [x] 3.5 Implementar papéis owner/coordinator, supervisor e agent com testes negativos
- [x] 3.6 Testar que convite de Cataguases não cria acesso em Ubá

## 4. Planos e entitlements

- [x] 4.1 Implementar resolução do plano ativo para conta individual e organização
- [x] 4.2 Implementar verificação de recursos por código de feature
- [x] 4.3 Implementar verificação atômica de limites de usuários, vistorias, convites e armazenamento
- [x] 4.4 Implementar alertas de consumo em 80% e 100% configuráveis
- [x] 4.5 Garantir que limite bloqueie criação sem bloquear histórico e exportação autorizados
- [x] 4.6 Implementar estados de trial, active, grace, past_due, canceled e expired conforme decisão comercial
- [x] 4.7 Criar testes de concorrência para duas requisições disputando o último limite

## 5. Sessão única

- [x] 5.1 Registrar session_id, dispositivo, plataforma, último heartbeat e organização
- [x] 5.2 Implementar decisão atômica para permitir, bloquear ou substituir sessão
- [x] 5.3 Adicionar heartbeat e expiração de sessão abandonada com tolerância offline
- [x] 5.4 Integrar AuthContext aos eventos SIGNED_IN, SIGNED_OUT e TOKEN_REFRESHED
- [x] 5.5 Implementar encerramento remoto de sessão com auditoria
- [x] 5.6 Testar login simultâneo, perda de conexão, reinstalação e troca de aparelho

## 6. Aplicativo iOS/Android

- [x] 6.1 Criar contexto/hooks para assinatura, organização, permissões e consumo
- [x] 6.2 Criar tela Minha assinatura e consumo por recurso
- [x] 6.3 Exibir bloqueio de modelos e módulos com ação de upgrade/suporte
- [x] 6.4 Criar fluxo de convite e mensagens de organização, expiração e uso único
- [x] 6.5 Criar telas de coordenação municipal para agentes, sessões e convites
- [x] 6.6 Preservar acesso a histórico e permitir conclusão segura de vistoria iniciada
- [x] 6.7 Validar comportamento offline e sincronização após atingir limite

## 7. Dashboard web interno

- [x] 7.1 Criar autenticação e autorização separadas para proprietários
- [x] 7.2 Criar telas de planos, recursos, limites, versões e status
- [x] 7.3 Criar telas de organizações, contatos, contratos, agentes e consumo
- [x] 7.4 Criar telas de assinaturas, carência, bloqueios e alterações auditadas
- [x] 7.5 Criar gestão de sessões, encerramento remoto e histórico
- [x] 7.6 Criar visão de indicadores comerciais e operacionais
- [x] 7.7 Criar fila de suporte com filtros por plano, prioridade e organização

## 8. Suporte e implantação

- [x] 8.1 Implementar abertura e acompanhamento de chamados associados a conta ou organização
- [x] 8.2 Implementar prioridade, responsável, status, metas de resposta e escalonamento
- [x] 8.3 Criar checklist de implantação municipal e treinamento do coordenador
- [x] 8.4 Criar central de ajuda com convites, sessões, limites e modelos
- [x] 8.5 Criar processo de piloto e avaliação após 30 dias

## 9. Qualidade, segurança e lançamento

- [x] 9.1 Criar testes unitários para entitlements, limites, memberships e sessões
- [x] 9.2 Criar testes de integração para RLS e isolamento entre duas prefeituras
- [x] 9.3 Revisar exposição de dados sensíveis, logs e eventos de auditoria
- [x] 9.4 Executar migração em ambiente de teste e validar rollback por configuração
- [ ] 9.5 Executar piloto controlado com usuários individuais e uma prefeitura
- [ ] 9.6 Medir conversão, consumo, erros e suporte durante o piloto
- [ ] 9.7 Aprovar publicação comercial somente após validação técnica e comercial dos proprietários
