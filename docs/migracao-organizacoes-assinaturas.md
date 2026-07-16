# Migração para organizações e assinaturas

## Princípio de autorização

`organization_members` é a fonte de verdade. O texto `municipio` continua disponível para exibição e busca, mas não concede acesso. A coluna `users.organization_id` é apenas um cache de compatibilidade e deve refletir o vínculo ativo.

## Preparação do piloto

1. Criar a prefeitura piloto em `organizations` com `status = 'pilot'`.
2. Revisar manualmente os usuários institucionais existentes e inserir um vínculo por pessoa em `organization_members`.
3. Atualizar `users.organization_id` somente depois da revisão.
4. Preencher `organization_id` em `vistorias`, `agendamentos` e convites legados usando o usuário criador/agente validado, nunca apenas o texto do município.
5. Criar uma assinatura de compatibilidade ou municipal para o período do piloto.
6. Validar isolamento com dois usuários de organizações diferentes.
7. Ativar `entitlement_enforcement_enabled` e `session_enforcement_enabled` separadamente em ambiente de teste.

Exemplo de backfill após revisão:

```sql
begin;

update public.users u
set organization_id = om.organization_id
from public.organization_members om
where om.user_id = u.uid
  and om.status = 'active';

update public.vistorias v
set organization_id = om.organization_id
from public.organization_members om
where om.user_id = v."agenteUid"
  and om.status = 'active'
  and v.organization_id is null;

update public.agendamentos a
set organization_id = om.organization_id
from public.organization_members om
where om.user_id = coalesce(a.agente_uid, a.criado_por_uid)
  and om.status = 'active'
  and a.organization_id is null;

commit;
```

## Rollback operacional

O rollback não apaga dados. Desative os dois flags em `subscription_settings`, preserve organizações, vínculos, auditoria e sessões, e mantenha o plano de compatibilidade enquanto o piloto é corrigido.
