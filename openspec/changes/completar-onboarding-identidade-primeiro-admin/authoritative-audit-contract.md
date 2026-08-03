# Contrato de auditoria autoritativa

## Limite

`public.subscription_audit_events` registra evidência server-side de identidade, bootstrap, primeiro administrador, convite, recuperação, vínculo Google, onboarding e ativação comercial. `public.audit_logs` e `utils/auditLogger.ts` são somente telemetria auxiliar e nunca substituem o evento transacional.

## Inventário atual

| Fonte | Uso | Classificação |
| --- | --- | --- |
| `subscription_audit_events` | Assinatura, bootstrap, primeiro admin, Auth e onboarding | Evidência autoritativa do cliente |
| `internal_access_events` | Operações do console interno, MFA, justificativa e resultado | Evidência autoritativa interna |
| `audit_logs` / `utils/auditLogger.ts` | Diagnóstico de interface e operação mobile | Telemetria auxiliar |
| campos `agenteUid`, `created_by`, protocolo e hashes de documentos | Autoria da entidade e integridade documental | Atributos da entidade, preservados |
| eventos de ciência eletrônica | Aceite/ciência de documentos | Domínio autoritativo próprio, ligado ao documento |

Os domínios continuam separados para não transformar telemetria cliente em prova nem expor eventos internos ao cliente municipal.

## Campos mínimos

- `actor_id` e `actor_role`: identidade e papel efetivo no momento da operação;
- `organization_id`: escopo organizacional, quando houver;
- `event_type`, `entity_type` e `entity_id`: ação e alvo;
- `request_id`: idempotência/correlação, quando originado por requisição;
- `created_at`: horário do servidor;
- `outcome`: `allowed`, `denied` ou `failed`;
- `source`: `web`, `android`, `ios`, `invite`, `server` ou origem interna controlada;
- `reason`: justificativa sanitizada para ação de alto impacto;
- `metadata`: somente resumo mínimo, hashes e indicadores não sensíveis.

## Garantias

- A tabela é append-only; `UPDATE` e `DELETE` falham inclusive se um grant futuro for criado por engano.
- Clientes não recebem `INSERT`, `UPDATE` ou `DELETE` direto.
- RPCs críticas inserem a auditoria dentro da mesma transação; falha da inserção desfaz a operação.
- `request_id + event_type` impede duplicação do mesmo evento idempotente.
- A timeline pública retorna apenas campos mínimos e somente ao ator ou ao owner/coordinator da organização.
- Tokens, e-mails, nomes, conteúdo de vistoria e payloads de OAuth não entram no evento.

## Retenção provisória

Preservar eventos pelo prazo contratual/legal a ser aprovado. Até essa decisão, não executar expurgo automático. Uma futura política de retenção deve exportar evidências exigidas e registrar o próprio lote de retenção sem alterar eventos existentes.
