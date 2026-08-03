## Context

O aplicativo já apresenta cinco telas de onboarding e grava `@onboarding_done` localmente. Esse marcador representa apenas que a apresentação foi vista no dispositivo; não representa que uma conta, organização ou implantação foi concluída.

O modelo novo já contém organizações, memberships, onboarding municipal, assinaturas e convites. O console interno consegue criar e acompanhar clientes. A área administrativa mobile já diferencia `master_admin`, `admin`, `supervisor` e `agent`. Porém, não existe uma operação única que transforme uma identidade recém-criada em titular individual ou primeiro administrador municipal.

O gatilho `handle_new_auth_user` ainda lê `raw_user_meta_data.role` e cria perfis aprovados para papéis não administrativos. O cadastro por convite cria o usuário Auth antes de consumir o token; em caso de falha, pode deixar uma identidade órfã. O login Google está restrito ao console interno e o fluxo público de recuperação usa `signInWithOtp`.

## Goals / Non-Goals

**Goals:**

- Permitir que uma pessoa crie uma identidade com Google ou e-mail sem receber autoridade por dados enviados pelo cliente.
- Criar individual/organização, primeiro administrador, onboarding e trial de forma atômica e repetível.
- Manter clientes fora do console interno e preservar `internal_staff` como domínio separado.
- Fazer recuperação de senha e deep links funcionarem em Android, iOS e Web.
- Tornar operações críticas rastreáveis por ator, organização, entidade, horário do servidor e request id.
- Migrar usuários e convites legados sem interromper clientes atuais.

**Non-Goals:**

- Cobrança final e emissão fiscal.
- Múltiplas organizações por usuário na primeira versão.
- Transferência autônoma de titularidade municipal.
- Uso de claims editáveis para evitar consultas ao banco.

## Decisions

### 1. Identidade não concede autoridade

O gatilho de `auth.users` criará, no máximo, um perfil neutro e pendente. Ele poderá copiar somente atributos de apresentação, como nome e avatar, após sanitização.

O gatilho não aceitará de `raw_user_meta_data`:

- papel;
- organização;
- município;
- aprovação;
- plano;
- permissões internas.

Autoridade será derivada de `organization_members`, `owner_admins`/`internal_staff`, assinatura e operações server-side. `app_metadata` poderá carregar indicadores derivados, mas o banco continuará sendo a fonte de verdade e toda mutação sensível revalidará o estado atual.

### 2. Três jornadas de entrada

Após autenticar, `get_customer_entry_context` resolverá exatamente um dos estados:

| Estado | Destino |
| --- | --- |
| Staff interno ativo | console interno, sem bootstrap de cliente |
| Membership ou titular individual existente | portal/app correspondente |
| Convite pendente para o e-mail verificado | aceite do convite |
| Onboarding incompleto | retomar etapa persistida |
| Identidade nova sem contexto | escolher individual ou organização |
| Perfil bloqueado/suspenso | tela de estado, sem criação automática |

O frontend não escolhe diretamente o destino privilegiado; ele apresenta o contexto retornado pelo servidor.

### 3. Bootstrap idempotente

O backend manterá uma solicitação de bootstrap com:

- `user_id`;
- tipo de cliente;
- chave de idempotência;
- estado e etapa;
- organização/assinatura resultantes;
- versão dos termos;
- origem (`web`, `android`, `ios`, `invite`);
- timestamps e erro sanitizado.

Uma chave ativa por usuário e tipo impedirá organizações duplicadas. Repetir uma requisição concluída devolverá o mesmo resultado.

Para individual, a transação criará ou reconciliará perfil, sujeito individual, assinatura `trial` quando aplicável e onboarding.

Para município, a primeira fase criará uma organização provisória e o membership `owner`/`coordinator` do solicitante, com status controlado. A assinatura poderá ser `trial` conforme política publicada. A ativação contratual definitiva continuará sendo evento comercial auditado.

### 4. Primeiro administrador

O primeiro administrador municipal não será um `admin` solto em `public.users`. Ele será o primeiro membership autorizado da organização, com papel organizacional `owner` ou `coordinator`.

Compatibilidade mobile mapeará esse vínculo para a experiência administrativa existente, mas as decisões de acesso migrarão progressivamente de `users.role`/`municipio` para membership e permissões efetivas.

Regras:

- somente o bootstrap server-side cria o primeiro owner;
- depois do primeiro owner, novos administradores entram por convite;
- não existe endpoint público para criar `master_admin`, `owner_admins` ou `internal_staff`;
- e-mail institucional, CNPJ/município e eventuais aprovações serão validados conforme a política do plano;
- tentativa concorrente de criar dois primeiros owners resultará em exatamente um vínculo inicial.

### 5. Convite atômico

O convite persistirá somente hash do token, organização imutável, papel permitido, e-mail normalizado, expiração e estado.

O aceite ocorrerá depois de autenticação e confirmação do e-mail. A mesma transação validará token, e-mail, organização, assentos, assinatura e papel; criará o membership; marcará o convite como aceito; e registrará auditoria.

O fluxo legado permanecerá somente durante janela de migração e não poderá criar novos papéis privilegiados.

### 6. Google em mobile e portal

O portal do cliente e o aplicativo usarão o provedor Google do Supabase. Mobile abrirá uma sessão de autenticação do sistema com callback baseado no scheme `tcs`; Web retornará para uma rota pública de callback.

Requisitos:

- PKCE ou ID Token conforme o cliente adotado e a documentação vigente;
- `redirectTo` em allowlist por ambiente;
- estado/nonce quando aplicável;
- troca de código uma única vez;
- callback não decide papel nem organização;
- conta Google com e-mail verificado deverá vincular ou orientar vínculo com identidade existente sem duplicar cliente;
- console interno continuará exigindo `internal_staff` ativo após o OAuth.

### 7. Recuperação de senha

`signInWithOtp` deixará de representar “esqueci minha senha”. A solicitação usará `resetPasswordForEmail` com resposta genérica.

O link abrirá:

- `tcs://auth/reset-password` no aplicativo;
- `/recuperar-senha/confirmar` no Web.

Somente uma sessão de recuperação válida poderá atualizar a senha. Após sucesso, a aplicação oferecerá encerramento das demais sessões e registrará evento de segurança no servidor.

### 8. Onboarding por conta

O flag local continuará controlando apenas a apresentação. Um onboarding persistido no servidor controlará a jornada real:

1. identidade confirmada;
2. tipo de cliente;
3. dados pessoais/institucionais mínimos;
4. organização e primeiro administrador, quando municipal;
5. trial ou situação contratual;
6. configurações iniciais;
7. convite da equipe;
8. primeira agenda/vistoria ou importação;
9. conclusão e próximos passos.

Etapas poderão ser retomadas em outro dispositivo. Permissões de câmera, localização e notificações serão solicitadas no momento de uso, não como condição para criar a conta.

`organization_onboarding` continuará registrando piloto, treinamento e revisão operacional; a conclusão do bootstrap apenas inicia essa implantação.

### 9. Autoria e auditoria autoritativas

Campos existentes como `agenteUid`, `created_by`, hashes e protocolos serão preservados. Operações críticas passarão a registrar auditoria dentro da mesma transação server-side.

Cada evento autoritativo terá, quando aplicável:

- ator autenticado e papel efetivo;
- organização/sujeito;
- ação e resultado;
- entidade e identificador;
- request/idempotency id;
- horário do servidor;
- origem/plataforma;
- hash ou resumo de antes/depois sem segredos;
- justificativa para ação de alto impacto.

Eventos serão append-only. O logger do aplicativo continuará útil para diagnóstico, mas não será evidência obrigatória da operação.

### 10. Compatibilidade e migração

1. Inventariar perfis sem membership, papéis legados, convites ativos e identidades órfãs.
2. Adicionar o novo contexto e bootstrap com enforcement desligado.
3. Migrar/reconciliar clientes conhecidos com evidência e relatório de exceções.
4. Alterar o gatilho Auth para perfil neutro.
5. Ativar novo convite e onboarding por coorte.
6. Desabilitar criação privilegiada pelo fluxo legado.
7. Remover dependências de autorização em `users.role` e `municipio` somente após testes e métricas.

Rollback: desativar a entrada pública e manter login de clientes existentes. Não apagar identidades, memberships, organizações, assinaturas ou auditoria. Solicitações de bootstrap incompletas permanecem retomáveis.

## Risks / Trade-offs

- [Usuário atual perde acesso durante migração] → modo de compatibilidade, relatório de reconciliação e rollout por coorte.
- [Google duplica uma conta de senha] → normalização, e-mail verificado, teste de identity linking e fluxo explícito de vínculo.
- [Dois requests criam duas organizações] → índice único, transação e idempotência.
- [Primeiro administrador vira acesso interno TCS] → domínios de permissão separados e teste negativo `/app/*`.
- [Trial municipal é confundido com contratação] → status e mensagens distintos; ativação definitiva exige evento comercial.
- [Auditoria contém dados pessoais excessivos] → payload mínimo, hashes, retenção e acesso restrito.
- [Deep link funciona no Expo Go e falha no build] → validar development build e binários Android/iOS reais.
- [Novo modelo depende de tabela pública não exposta] → grants explícitos somente quando necessários, RLS e preferência por RPC/Edge Function.

## Open Questions

- Trial municipal será imediato para qualquer domínio ou dependerá de aprovação cadastral?
- O primeiro administrador municipal será chamado “Titular”, “Coordenador” ou “Administrador da organização” na interface?
- Quais dados institucionais são obrigatórios antes do trial: CNPJ, domínio, município, cargo e telefone?
- O cliente individual recebe trial automaticamente ou precisa iniciar checkout antes da primeira vistoria?
- Qual política encerra sessões após redefinição de senha?
- Por quanto tempo solicitações de bootstrap incompletas e eventos de auditoria serão retidos?

