# Runbook de rollout de autenticação do cliente

## Implementado no código

- OAuth Google via navegador do sistema no mobile, callback PKCE e troca única de código.
- OAuth Google no portal Web com PKCE.
- Callback mobile `tcs://auth/callback` e recuperação `tcs://auth/reset-password`.
- Recuperação Web em `/recuperar-senha` e callback `/redefinir-senha`.
- Recuperação por `resetPasswordForEmail`; o OTP de login não é mais usado como recuperação pública.
- Sessão de recuperação marcada por tempo limitado, atualização de senha, opção de encerrar outras sessões e auditoria server-side.
- Primeira identidade Google permanece neutra e segue para escolha individual/municipal.
- Conta com senha e e-mail confirmado pode vincular Google a partir de Perfil/Segurança; conflito com identidade pertencente a outra conta nunca mescla papéis ou memberships.
- Portal e aplicativo permitem escolher cliente individual ou implantação municipal sem contato obrigatório com suporte.
- O bootstrap municipal cria organização provisória, trial e exatamente um primeiro owner; ativação comercial definitiva permanece separada.
- Checklist persistido acompanha identidade, organização, plano, equipe, configuração e primeira vistoria entre dispositivos.
- Câmera e localização são solicitadas somente ao abrir a funcionalidade que precisa delas.

## Estados apresentados ao cliente

- `creating`: identidade confirmada, dados iniciais ainda incompletos;
- `under_review`: implantação institucional recebida/em análise;
- `trial`: avaliação operacional liberada, sem equivaler a contratação definitiva;
- `contracting_pending`: operação preparada, aguardando formalização;
- `active`: ativação comercial concluída pelo servidor;
- `blocked`: acesso suspenso/expirado ou onboarding bloqueado.

O cliente não envia estado, papel, organização ativa nem aprovação. Esses valores são derivados no servidor.

## Configuração externa obrigatória por ambiente

Antes de ligar as flags:

1. No Supabase Auth, habilitar Google usando credenciais próprias do ambiente.
2. No Google Auth Platform, concluir branding, domínio verificado, política de privacidade e público de teste/produção.
3. Manter clientes OAuth separados para Web, Android e iOS quando forem usados fluxos nativos; para o fluxo hospedado atual, registrar corretamente o cliente Web do Supabase.
4. Adicionar à allowlist de redirects do Supabase:
   - `tcs://auth/callback`
   - `tcs://auth/reset-password`
   - `https://<portal-homologacao>/entrar`
   - `https://<portal-homologacao>/redefinir-senha`
   - equivalentes exatos de produção, sem wildcard amplo.
   - para uma validação temporária no Expo Go, adicionar a URL `exp://.../--/auth/callback`
     exibida pelo Metro; remover após o teste e usar development build para o fluxo estável.
5. Confirmar que o callback autorizado no cliente Google é o callback do projeto Supabase exibido no painel do provider.
6. Configurar templates de recuperação e confirmação sem expor se a conta existe.

## Ordem das flags

1. Aplicar migrations e manter todas as flags novas desligadas.
2. Publicar explicitamente `individual_basic` e/ou `municipal_basic` somente após aprovação comercial.
3. Ligar `password_recovery_enabled` em homologação e validar link expirado, reutilizado e outro dispositivo.
4. Ligar `google_customer_auth_enabled` para contas de teste e validar Android/iOS em development build.
5. Ligar `individual_bootstrap_enabled` para a coorte piloto.
6. Ligar `municipal_bootstrap_enabled` apenas quando o atendimento comercial estiver pronto para acompanhar trials provisórios.
7. Ligar `authoritative_audit_enabled` somente depois de executar pgTAP, advisors e a consulta de timeline em homologação.

## Critérios de aceite

- Metadata forjada nunca altera papel, município, organização ou aprovação.
- Callback repetido não cria identidade, perfil, organização ou assinatura adicional.
- Conta Google sem membership chega ao onboarding, não ao painel nem ao console interno.
- Recuperação inválida não abre o formulário e a resposta inicial não enumera contas.
- Bootstrap repetido retorna o mesmo contexto.
- Bootstrap municipal cria uma organização `pilot`, trial de 30 dias e exatamente um owner.
- Checklist não permite ao cliente marcar identidade, plano ou primeira operação manualmente.
- A primeira vistoria conclui sua etapa por trigger server-side.
- Eventos autoritativos não aceitam update/delete e a timeline não retorna metadata sensível.
- Desligar uma flag impede novas entradas sem apagar dados existentes.

## Relatório e reconciliação

Executar `supabase/diagnostics/customer_identity_migration_report.sql` com conexão administrativa. O relatório não mostra e-mail, nome, token ou conteúdo de vistoria e separa:

1. perfis sem membership;
2. administradores legados divergentes;
3. convites pendentes/expirados;
4. identidades Auth sem perfil.

Não reconciliar organização ambígua automaticamente. Registrar a decisão e usar operação administrativa controlada.

Antes do piloto, executar também `supabase/operations/customer_auth_dry_run.sql`. O resultado deve ter zero identidades órfãs, zero contextos organizacionais múltiplos e toda exceção de convite legado deve possuir decisão humana registrada. Somente então encerrar a compatibilidade com:

```sql
UPDATE public.subscription_settings
SET legacy_invite_compatibility_enabled = false
WHERE singleton;
```

## Validações adiadas neste ambiente

O app TypeScript, os testes Jest direcionados e o build de produção do dashboard podem ser executados sem Docker. Migrations, pgTAP, concorrência, advisors e geração automática dos tipos exigem o runtime Docker/Supabase local e permanecem bloqueadores antes de ligar qualquer flag em homologação ou produção.

## Rollback operacional

Executar `supabase/operations/rollback_customer_public_entry.sql` para desligar Google, recuperação e os dois bootstraps em uma transação verificada. O script mantém Auth endurecido, auditoria e compatibilidade de convite inalterados, e não apaga identidades, organizações, memberships ou assinaturas. Em incidente de bootstrap, preservar o estado e reconciliar pela chave idempotente.
