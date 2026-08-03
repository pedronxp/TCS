# Baseline de implementação

## Limite do produto

O sistema Web é o portal administrativo e operacional que complementa o aplicativo TCS. Ele não é uma loja. A contratação self-service cria uma identidade de cliente e uma solicitação/trial; a ativação comercial definitiva continua sendo um evento explícito e auditável.

## Estado encontrado

- `auth.users` é a fonte de identidade, mas o trigger legado ainda confiava em `raw_user_meta_data.role` e `raw_user_meta_data.municipio` para autorizar o perfil.
- `public.users` é o perfil de compatibilidade consumido pelo aplicativo; `organization_members` é a fonte canônica de autorização organizacional.
- `owner_admins` e `internal_staff` pertencem ao console interno TCS e nunca podem ser criados por cadastro público, Google, bootstrap de cliente ou convite municipal.
- Há dois modelos de convite: `invite_tokens`, usado pelo cadastro mobile legado, e `organization_invites`, usado pelo portal e já aceito por RPC atômica.
- `portal_ensure_individual_profile` existia como ativação automática sem termos/plano; foi desativada em favor do bootstrap transacional.
- Organizações, memberships, planos, assinaturas, onboarding organizacional, limites e auditoria comercial já existem no banco. Falta orquestrar esses recursos em uma jornada única para o primeiro cliente/administrador.

## Papéis canônicos

| Escopo | Papel canônico | Compatibilidade temporária no app |
| --- | --- | --- |
| Organização | `owner` | `admin` |
| Organização | `coordinator` | `admin` |
| Organização | `supervisor` | `supervisor` |
| Organização | `agent` | `agent` |
| Operação interna TCS | `internal_staff.role` | sem equivalência pública |
| Superadmin da plataforma | `owner_admins` | sem equivalência pública |

Novas decisões de autorização devem usar membership e escopo de organização. `users.role` e `users.municipio` permanecem somente como ponte de compatibilidade até a migração completa das policies e telas legadas.

## Política provisória de entrada

- Individual: trial de 14 dias, e-mail verificado, perfil `agent`, sem organização. A flag de bootstrap controla a abertura pública.
- Municipal: trial/onboarding de 30 dias, organização provisória e exatamente um primeiro membership `owner`. A flag de bootstrap controla a abertura pública.
- Dados mínimos municipais: nome de exibição, município, UF, responsável, e-mail verificado e aceite dos termos versionados. CNPJ e referência contratual podem ser concluídos antes da ativação definitiva.
- A ativação definitiva exige decisão comercial server-side. O cliente nunca envia `active`, plano, papel ou aprovação como autoridade.

## Feature flags

As flags ficam em `subscription_settings` e começam desligadas, exceto o endurecimento de Auth, que é correção de segurança e entra ligado:

- `hardened_auth_enabled = true`
- `google_customer_auth_enabled = false`
- `password_recovery_enabled = false`
- `individual_bootstrap_enabled = false`
- `municipal_bootstrap_enabled = false`
- `authoritative_audit_enabled = false`

## Métricas e alertas

- taxa de signup iniciado/concluído por provider, sem registrar e-mail ou token;
- claims de convite preparados, consumidos, expirados e rejeitados;
- perfis neutros pendentes por idade e identidades sem perfil;
- bootstrap iniciado/concluído/falhado por modalidade;
- primeiro owner criado e tentativas concorrentes rejeitadas;
- recuperação solicitada/concluída e vínculo Google, sempre sem enumeração;
- alertas para falha do trigger de Auth, crescimento de órfãos, rejeições anormais e qualquer tentativa de criar papel interno por fluxo público.

## Coortes e rollback

O rollout será por ambiente e coorte, usando as flags acima. Desligar uma flag impede novas entradas, mas nunca remove identidades, organizações, memberships, assinaturas ou eventos de auditoria já criados. O endurecimento de Auth não volta a confiar em metadados do usuário; rollback funcional usa o convite compatível server-side ou atendimento controlado.
