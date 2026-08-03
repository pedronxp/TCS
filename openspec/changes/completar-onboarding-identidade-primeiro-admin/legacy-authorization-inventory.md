# Inventário de autorização legada

## Fonte canônica adotada

- Organização e papel: `organization_members` ativo.
- Titular individual: bootstrap + assinatura individual vinculada ao `auth.uid()`.
- Operação interna TCS: `internal_staff` e `owner_admins`, sem equivalência pública.
- `public.users.role`, `public.users.municipio` e `public.users.organization_id`: projeção temporária para compatibilidade do aplicativo.

## Pontos encontrados

| Área | Dependência legada | Situação |
| --- | --- | --- |
| Trigger de criação Auth | `raw_user_meta_data.role/municipio` | Corrigido: perfil neutro; metadata só para apresentação |
| Bootstrap/convite | projeção em `public.users` | Mantida somente depois da autorização server-side |
| Portal do cliente | contexto derivado de membership/assinatura | Corrigido |
| Console interno | `internal_staff`/`owner_admins` | Separado do cliente |
| Funções de compatibilidade municipal | `private.can_access_legacy_municipality` | Corrigida: localiza dado histórico pelo município, mas autoriza somente membership canônico ativo |
| Policies antigas de Storage (`fotos`/`laudos`) | papel aprovado em `public.users` | Corrigidas: novos paths usam `users/<auth.uid>/...`; leitura exige owner, membership da mesma organização ou vistoria histórica comprovadamente no escopo |
| RPCs internos de consulta histórica | leitura de `users.role/municipio` | Permitida para apresentação/relatório, não para conceder autoridade nova |

## Condição para remover a compatibilidade

1. Executar `supabase/diagnostics/customer_identity_migration_report.sql`.
2. Resolver perfis sem membership e divergências sem inferência ambígua.
3. Monitorar a migração gradual dos paths antigos de Storage para `users/<id>/...`; novos uploads já rejeitam prefixo de outro usuário.
4. Executar o pgTAP de Storage/BOLA entre duas organizações antes do rollout.
5. Remover `private.can_access_legacy_municipality` somente depois de não haver linhas legadas dependentes.

As flags públicas permanecem desligadas enquanto a etapa de Storage/RLS não for validada com Docker, pgTAP e advisors.
