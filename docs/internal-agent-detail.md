# Detalhe operacional do agente

O detalhe do agente usa a rota `/app/clientes/:customerId/usuarios/:userId/:userSection?`. O `customerId` continua sendo a fronteira de autorização: todas as RPCs recebem e validam o par `customer_id + user_id` antes de consultar atividade.

## Composição da interface

A página usa o cabeçalho contextual, tokens semânticos, métricas compartilhadas, toolbar de tabela e navegação responsiva do console. Os filtros de período, risco, status, formulário e busca permanecem na URL e são preservados ao trocar de módulo. Em telas estreitas, os módulos quebram em linhas para manter todas as ações acessíveis; tabelas extensas continuam contidas em sua própria região rolável.

A composição foi verificada em 1440, 1024, 768 e 390 px sem overflow de página. O mapa autorizado sempre mantém a lista textual equivalente, e o estado sem permissão explica quais dados permanecem protegidos.

## Limites anteriores e responsabilidade atual

- `get_internal_customer_detail` retorna somente as 50 vistorias mais recentes do cliente. Esse conjunto serve ao resumo do cliente e não representa o histórico completo de um agente.
- `get_internal_customer_operations` retorna até 250 pontos no mapa do cliente, 100 agendamentos e 100 laudos. Ele permanece como resumo de compatibilidade no nível do cliente.
- `list_internal_agent_inspections` é a fonte canônica para o histórico individual completo. Ela informa o total filtrado e usa cursor composto por data e ID, com páginas de 25, 50 ou 100 itens.
- `get_internal_agent_summary` e `get_internal_agent_map` recebem os mesmos filtros de período, risco, status, formulário e texto. Assim, KPIs, lista e mapa descrevem o mesmo conjunto.

## Segurança e dados sensíveis

As RPCs exigem `customer.read`. Organização e usuário são vinculados por `organization_members`; uma conta individual só aceita o próprio `user_id` do `customer_id`. Falhas de vínculo retornam o mesmo erro genérico para não revelar a existência de outro usuário.

Donos recebem dados sensíveis pela permissão existente. Programadores precisam de um `internal_sensitive_access` ativo e auditado. A validade é reavaliada em toda consulta; o dashboard atualiza as superfícies a cada 30 segundos. Sem acesso, agregados permanecem visíveis, mas contato, endereço, coordenadas e downloads são omitidos.

Downloads passam pela Edge Function `internal-agent-document`. Ela valida o JWT, chama `authorize_internal_agent_document` novamente e cria uma URL assinada de no máximo 60 segundos. A lista nunca retorna a URL persistida do arquivo.

Operações de bloquear/liberar, encerrar sessão e redefinir senha usam `mutate_internal_agent_access`. A função exige papel com `customer.write`, AAL2, justificativa e ID idempotente; o servidor registra antes/depois, revoga sessões aplicáveis e rejeita chamadas diretas de programadores.

## Reconciliação legada

A migração `20260718234037_internal_agent_operational_detail.sql` preenche `organization_id` somente quando o `agenteUid` possui exatamente um vínculo persistido em `organization_members`. Nenhum nome ou município textual é usado para atribuição.

Casos ausentes, inválidos, ambíguos ou incompatíveis ficam em `private.inspection_ownership_audit`, sem acesso pela Data API. A equipe deve revisar esse relatório diretamente no banco antes de considerar o histórico legado completo. Registros ambíguos permanecem sem atribuição.

## Publicação e verificação

1. Aplicar a migração e executar os advisors de segurança/performance do Supabase.
2. Publicar `internal-agent-document` com autenticação JWT habilitada e os segredos padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Regenerar `dashboard/src/types/supabase.ts` a partir do projeto remoto depois da migração.
4. Executar `npm run test:agent-detail` na raiz e `npm run lint`, `npm test` e `npm run build` em `dashboard`.
5. Validar manualmente desktop, tablet e tela estreita, incluindo foco por teclado, linha “Ver agente”, tabs e a lista textual equivalente ao mapa.

Rollback de interface: remover temporariamente a rota e os links do agente. A migração é aditiva; não apagar eventos de auditoria nem o relatório de reconciliação durante rollback.
