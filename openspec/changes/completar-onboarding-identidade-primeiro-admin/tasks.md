## 1. Baseline, decisões e proteção do rollout

- [x] 1.1 Congelar inventário de Auth, perfis, papéis, memberships, convites, organizações, assinaturas e fluxos de entrada existentes
- [x] 1.2 Definir nomes finais dos papéis organizacionais e a compatibilidade temporária com `admin`, `supervisor` e `agent`
- [x] 1.3 Aprovar política de trial individual e municipal, dados obrigatórios e condição de ativação definitiva
- [x] 1.4 Definir feature flags para Auth endurecido, Google mobile, recuperação, bootstrap individual, bootstrap municipal e auditoria server-side
- [x] 1.5 Definir métricas, coortes, alertas e procedimento de rollback

## 2. Segurança de identidade e autorização

- [x] 2.1 Criar testes que demonstrem que `raw_user_meta_data.role`, município, organização e aprovação não concedem acesso
- [x] 2.2 Alterar `handle_new_auth_user` para criar somente perfil neutro/pending com atributos de apresentação sanitizados
- [x] 2.3 Remover do cadastro mobile o envio autoritativo de `role` e `municipio`
- [x] 2.4 Inventariar e corrigir policies/RPCs que autorizam por `users.role`, `users.municipio` ou metadados editáveis
- [x] 2.5 Garantir que nenhum fluxo público crie `master_admin`, `owner_admins` ou `internal_staff`
- [ ] 2.6 Executar advisors e testes negativos de RLS/BOLA entre dois indivíduos, duas organizações e staff interno
- [ ] 2.7 Regenerar tipos Supabase e validar grants explícitos para objetos novos usados pela Data API

## 3. Bootstrap de cliente e primeiro administrador

- [x] 3.1 Criar migration por `supabase migration new` para o estado idempotente de bootstrap e suas restrições
- [x] 3.2 Implementar contexto server-side `get_customer_entry_context`
- [x] 3.3 Implementar bootstrap individual transacional e idempotente
- [x] 3.4 Implementar solicitação/bootstrap municipal com organização provisória e primeiro membership owner/coordinator
- [x] 3.5 Vincular bootstrap municipal a `organization_onboarding` e à assinatura/trial aplicável
- [x] 3.6 Impedir segundo primeiro owner em chamadas concorrentes
- [x] 3.7 Criar reconciliação para identidade órfã e retry seguro após falha parcial
- [ ] 3.8 Testar repetição, corrida, rollback e retomada em outro dispositivo

## 4. Convites e continuidade administrativa

- [x] 4.1 Substituir o registro atual por aceite de convite atômico no servidor
- [x] 4.2 Exigir e-mail autenticado/verificado correspondente, token hash, expiração, papel permitido, assinatura e assentos
- [x] 4.3 Marcar convite e criar membership na mesma transação
- [x] 4.4 Implementar reenvio, revogação, expiração e mensagens sem enumeração de contas
- [x] 4.5 Mapear o primeiro owner e memberships para a área administrativa mobile existente
- [x] 4.6 Garantir que administrador municipal nunca receba `internal_*` nem acesso ao console TCS
- [ ] 4.7 Migrar convites ativos e desativar o caminho legado após a janela de compatibilidade

## 5. Google no aplicativo e no portal do cliente

- [x] 5.1 Verificar a documentação/changelog vigente e escolher PKCE ou ID Token por plataforma
- [ ] 5.2 Configurar clientes Google Web, Android e iOS, branding, domínios e redirect allowlist por ambiente
- [x] 5.3 Adicionar dependências Expo necessárias com versões compatíveis e lockfile atualizado
- [x] 5.4 Implementar Google no mobile com sessão do sistema e callback `tcs://auth/callback`
- [x] 5.5 Implementar Google nas entradas do portal do cliente sem reutilizar o provider do console interno
- [x] 5.6 Implementar vínculo seguro com conta de senha preexistente e tratamento de conflito
- [ ] 5.7 Testar cancelamento, callback repetido/expirado, offline, conta pendente e tentativa de acesso interno
- [ ] 5.8 Validar em development build Android e iOS, não apenas Expo Go

## 6. Recuperação de senha

- [x] 6.1 Trocar o fluxo público de OTP por `resetPasswordForEmail`
- [ ] 6.2 Criar callbacks mobile e Web e configurar redirects permitidos por ambiente
- [x] 6.3 Permitir atualização somente durante sessão de recuperação válida
- [x] 6.4 Oferecer encerramento das demais sessões após redefinição
- [x] 6.5 Registrar evento de segurança server-side sem revelar se o e-mail existia
- [ ] 6.6 Testar link expirado, reutilizado, aberto em outro dispositivo e conta Google sem senha

## 7. Jornada de onboarding real

- [x] 7.1 Manter `@onboarding_done` apenas para apresentação e criar estado persistido por conta
- [x] 7.2 Implementar escolha individual/organização e retomada da etapa server-side
- [x] 7.3 Implementar dados mínimos, termos versionados e validações institucionais
- [x] 7.4 Implementar estados de criação, análise, trial, contratação pendente, ativo e bloqueado
- [x] 7.5 Implementar checklist do primeiro administrador: identidade, organização, plano, equipe, configuração e primeira operação
- [x] 7.6 Solicitar câmera/localização/notificações no contexto de uso, sem bloquear a criação da conta
- [x] 7.7 Cobrir loading, vazio, erro, retry, offline e retomada multiplataforma
- [x] 7.8 Instrumentar funil sem armazenar conteúdo sensível de vistorias

## 8. Autoria e auditoria confiáveis

- [x] 8.1 Inventariar eventos atuais em `audit_logs`, auditoria de assinatura, eventos internos, autoria de documentos e ciência
- [x] 8.2 Definir contrato único mínimo de evento autoritativo e política de retenção/acesso
- [x] 8.3 Registrar bootstrap, primeiro admin, convite, papel, recuperação, vínculo Google e ativação na mesma transação da operação
- [x] 8.4 Tornar eventos autoritativos append-only e bloquear update/delete por clientes
- [x] 8.5 Preservar ator, organização, request id, horário do servidor, resultado e justificativa
- [x] 8.6 Reclassificar `utils/auditLogger.ts` como telemetria auxiliar ou migrar chamadas críticas para RPCs
- [x] 8.7 Criar consulta autorizada para timeline sem expor payload sensível
- [ ] 8.8 Testar falha de auditoria: operação crítica deve fazer rollback, não seguir silenciosamente

## 9. Migração, QA e entrega

- [x] 9.1 Gerar relatório de perfis sem membership, admins legados, convites ativos e identidades órfãs
- [ ] 9.2 Executar migração dry-run e reconciliar exceções sem inferir organização ambígua
- [ ] 9.3 Rodar TypeScript, Jest, Vitest, build dashboard, pgTAP/SQL e testes de concorrência
- [x] 9.4 Adicionar CI para migrations, RLS/BOLA, contratos de Auth e build das duas aplicações
- [ ] 9.5 Validar deep links, Google e recuperação em Android/iOS/Web de homologação
- [ ] 9.6 Pilotar com contas de teste e uma organização controlada mantendo flags desligáveis
- [ ] 9.7 Exercitar rollback sem remover identidades, memberships, organizações, assinaturas ou auditoria
- [x] 9.8 Documentar operação, suporte, incidentes e critérios de ativação pública
- [ ] 9.9 Obter aceite de segurança/produto antes de abrir cadastro ou trial ao público

## 10. Identidade e experiência pública Web

- [x] 10.1 Alinhar marca, favicon e paleta Web à identidade bege/marrom do aplicativo
- [x] 10.2 Remover promessas e rótulos comerciais não aprovados da página inicial
- [x] 10.3 Exibir a jornada mobile antes do login, no onboarding e durante a operação
- [x] 10.4 Informar armazenamento, logs técnicos de IP e preferências de privacidade no primeiro acesso
- [x] 10.5 Destacar canais de contato e validar a responsividade Web de 390 a 1366 pixels
