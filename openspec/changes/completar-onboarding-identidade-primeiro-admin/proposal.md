## Why

O TCS já possui onboarding visual de primeira instalação, cadastro por convite, papéis administrativos, organizações, assinaturas e área administrativa dentro do aplicativo. Entretanto, essas peças não formam uma jornada segura e completa para um cliente novo.

Hoje o primeiro administrador depende de provisionamento prévio ou de um `master_admin`; o onboarding municipal é acompanhado internamente; o login Google existe apenas no console interno; a recuperação pública usa OTP em vez de redefinição de senha; e o gatilho de criação de perfil ainda aceita papel e município enviados em `raw_user_meta_data`. A autoria de vistorias e documentos existe, mas parte da auditoria administrativa é enviada pelo cliente em modo não bloqueante.

Sem corrigir essas lacunas, não é seguro abrir cadastro público, trial automático ou liberação autônoma de organizações.

## What Changes

- Criar um bootstrap transacional e idempotente para novo cliente, capaz de formar conta, perfil, organização, primeiro administrador, onboarding e assinatura inicial sem depender de alteração manual no banco.
- Separar explicitamente os fluxos de cliente individual, organização municipal e colaborador convidado.
- Impedir que `raw_user_meta_data`, parâmetros do frontend ou campos digitados decidam papel, organização, município, aprovação ou permissões.
- Substituir o cadastro por convite atual por aceite server-side atômico, preservando compatibilidade controlada durante a migração.
- Implementar login e cadastro Google no aplicativo mobile e no portal do cliente, com callback seguro, vínculo de identidade e tratamento de contas preexistentes.
- Implementar recuperação real de senha para mobile e Web, com redirect permitido, sessão de recuperação e atualização de senha.
- Transformar o onboarding visual em uma jornada por conta: identificação, tipo de cliente, organização, primeiro administrador, trial/contratação, configurações mínimas, equipe e primeira operação.
- Manter o onboarding de implantação municipal (`organization_onboarding`) como trilha operacional, vinculando-o ao bootstrap do cliente.
- Tornar autoria e auditoria de operações críticas server-side, transacionais, append-only e consultáveis, mantendo logs do cliente apenas como telemetria auxiliar.
- Preservar a área administrativa móvel existente, mas fazer o primeiro administrador chegar a ela por um vínculo organizacional confiável.
- Adicionar testes negativos de escalada de papel, troca de organização, reuso de convite, corrida de bootstrap e acesso cruzado.
- **BREAKING**: novos perfis não serão mais aprovados nem receberão papel/município a partir de `raw_user_meta_data`.
- **BREAKING**: o fluxo legado que cria `auth.users` antes de consumir o convite será descontinuado após a migração.

## Capabilities

### New Capabilities

- `secure-customer-identity`: identidade de cliente, Google, senha, recuperação, vínculo de provedores e autorização sem metadados editáveis.
- `customer-bootstrap-onboarding`: bootstrap idempotente e jornada de onboarding para cliente individual e organização municipal.
- `first-organization-administrator`: criação segura do primeiro administrador e continuidade da administração pelo app e portal.
- `authoritative-authorship-audit`: autoria e auditoria server-side de operações críticas, com integridade, escopo e consulta autorizada.

### Modified Capabilities

Nenhuma especificação-base está publicada em `openspec/specs/`. Esta mudança complementa, sem substituir:

- `criar-planos-assinatura-e-gestao-municipal`;
- `criar-portal-clientes-individual-municipal`;
- `unificar-identidade-e-experiencia-de-abertura`.

## Impact

- `app/(auth)/`, `app/onboarding.tsx`, `app/_layout.tsx` e `context/AuthContext.tsx`: autenticação, callbacks, recuperação e jornada de primeiro acesso.
- `app/(panel)/admin/` e `app/(panel)/master/`: continuidade do primeiro administrador, convites e estados de implantação.
- `dashboard/`: entrada do cliente, onboarding, callback Google e separação permanente do console interno.
- Supabase Auth, Postgres, RLS, RPCs e Edge Functions: bootstrap, convites, memberships, perfis, auditoria e estados de onboarding.
- `organization_onboarding`, `organizations`, `organization_members`, `subscriptions`, `organization_invites` e tabelas legadas de usuário/token: reconciliação e migração gradual.
- Testes: Auth mobile/Web, SQL/pgTAP, RLS/BOLA, concorrência, deep links, idempotência e regressão dos papéis existentes.

## Non-Goals

- Escolher ou implementar definitivamente o provedor de pagamento nesta mudança.
- Liberar automaticamente contratos municipais definitivos sem o processo comercial/administrativo aplicável.
- Reescrever todo o portal de clientes ou o console interno.
- Substituir o onboarding operacional de implantação por uma simples apresentação visual.
- Declarar assinatura digital qualificada ou registro legal de propriedade intelectual do software.

