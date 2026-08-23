# Remoção de modos simulados do aplicativo de produção

## Objetivo

Garantir que os fluxos operacionais autenticados do aplicativo publicado exibam apenas dados reais obtidos do backend ou dados locais reais do próprio usuário em modo offline. Falhas de integração devem produzir estados de erro ou vazio explícitos, nunca conteúdo fictício.

## Escopo

- Remover do runtime do aplicativo os modos técnicos ativados por `local_test_mode` e `developer_demo`.
- Remover ramificações de autenticação, perfil, dashboard, módulos, inspeções, sincronização, notificações, sessão e assinatura que dependam desses modos.
- Excluir serviços utilitários usados exclusivamente para dados temporários desses modos.
- Preservar o Preview público para usuários sem cadastro, com limite e isolamento próprios.
- Preservar o módulo de Treinamento para capacitação de agentes vinculados a organizações ou à população.
- Preservar fixtures e mocks dentro de testes automatizados; eles não fazem parte do bundle nem dos dados de produção.
- Preservar migrations históricas de defesa em profundidade. Migrations já aplicadas não serão reescritas ou apagadas.

## Comportamento esperado

Contas operacionais autenticadas sempre usam os contratos reais do Supabase. Sem resposta válida, a interface apresenta carregamento, estado vazio ou erro recuperável. O modo offline continua usando registros operacionais locais destinados à sincronização, sem inventar registros de exemplo.

Preview e Treinamento continuam isolados da operação oficial e identificados visualmente. Seus dados locais não são sincronizados como dados operacionais.

## Alterações de arquitetura

1. O contexto de autenticação deixa de expor `localTestMode` e `developerMode`.
2. A detecção baseada em `app_metadata.local_test_mode` e no tipo `developer_demo` é removida do cliente.
3. Consumidores deixam de ignorar sincronização, heartbeat, notificações ou contexto comercial por causa desses modos técnicos.
4. Telas deixam de apresentar banners, permissões ou conjuntos de módulos próprios desses modos.
5. O fluxo formal de Treinamento permanece controlado pelo `TrainingContext`; o Preview permanece controlado por sua sessão explícita.

## Tratamento de erros e segurança

- Erros de API não recebem coleções de exemplo como fallback.
- Dados offline reais permanecem disponíveis conforme a estratégia offline-first existente.
- Marcas antigas no JWT deixam de alterar o comportamento do cliente.
- Proteções existentes no banco contra gravações de antigas contas técnicas permanecem por compatibilidade e defesa em profundidade.

## Verificação

- Testes unitários passam a provar que JWTs com as marcas antigas não ativam comportamento simulado.
- Testes dos fluxos afetados confirmam o uso normal dos contratos reais.
- Preview e Treinamento mantêm seus testes de isolamento.
- TypeScript, testes do app, testes do dashboard, build de produção e regressão visual devem passar.
- O PR deve terminar com descrição atualizada, commits restritos ao escopo e todos os checks obrigatórios verdes.

## Fora de escopo

- Remover Preview ou Treinamento.
- Remover mocks e fixtures dos testes.
- Alterar dados reais já existentes no banco.
- Reescrever migrations históricas.
