# Produção gradual e comunidades WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o TCS em produção piloto segura, com 40 prefeituras e liberação gradual, preservando Supabase como núcleo gerenciado e preparando o modelo de comunicados por município e bairro.

**Architecture:** O Supabase Cloud permanece responsável por Postgres, Auth, RLS, Storage e Edge Functions. Uma VPS separada hospeda somente serviços contínuos, monitoramento e o painel web (`dashboard/`, app Vite/React com `PrivateApp.tsx` e `PortalApp.tsx`) quando necessário; arquivos nunca usam o disco local da VPS como fonte de verdade. O canal WhatsApp é tratado como dependência externa: a publicação em Comunidade existente não integra a entrega desta fase sem API oficialmente autorizada.

**Tech Stack:** Expo/React Native (`app/`), dashboard React (`dashboard/`), Supabase Cloud, Supabase Storage, Edge Functions, DigitalOcean VPS, Backblaze B2 para cópia externa de arquivos, pgTAP (`supabase/tests/*.sql`) para testes de RLS, scripts operacionais Node em `scripts/*.mjs`.

## Global Constraints

- A produção piloto deve começar no Supabase Pro; o plano Free não é aceitável para operação institucional.
- Manter RLS em toda tabela exposta e nunca expor `service_role` no aplicativo, dashboard ou integração de terceiros.
- Fotos, PDFs e documentos permanecem em buckets privados (`fotos`, `laudos`, `document-evidence`, geridos por `services/StorageService.ts`); o app usa URLs assinadas via Edge Function `inspection-upload-authorize`.
- Um backup de banco não substitui backup de Storage; arquivos exigem cópia externa.
- Não implementar automação que contorne a API ou os controles do WhatsApp; ela não é um canal de produção aprovado.
- Acesso é segregado por prefeitura; admin municipal não pode ler ou enviar conteúdo de outra prefeitura.
- Toda nova tabela com RLS exige teste pgTAP correspondente em `supabase/tests/` (padrão `extensions.plan`/`extensions.ok` sobre `pg_policies`), seguindo os ~22 arquivos `_test.sql` existentes.
- Ações externas com dono humano (upgrade Supabase Pro, provisionamento VPS/Backblaze, confirmação com Meta/BSP) são checkpoints marcados com **[HUMANO]**: o agente prepara artefatos e checklists, mas não executa.

---

### Task 1: Preparar o Supabase para o piloto

**Files:**
- Modify: configuração do projeto Supabase no Dashboard **[HUMANO]**
- Create: `scripts/storage-audit.mjs` (verifica privacidade dos buckets e uso de URL assinada via admin API)
- Inspect: `supabase/migrations/`, `services/StorageService.ts`

**Interfaces:**
- Consumes: projeto Supabase atual, buckets `fotos`, `laudos` e `document-evidence`.
- Produces: projeto Pro ativo, métricas de uso registradas em `docs/runbooks/baseline-supabase.md`, lista de políticas RLS revisadas.

- [ ] **[HUMANO]** Subir o projeto atual do Free para o Pro antes da primeira prefeitura entrar.
- [ ] Registrar baseline no Dashboard (tamanho do banco, Storage por bucket, usuários ativos, egress, CPU, conexões, erros de Auth) e versionar em `docs/runbooks/baseline-supabase.md`.
- [ ] Implementar `scripts/storage-audit.mjs` (padrão `scripts/*.mjs`): lista buckets, sinaliza qualquer bucket público e qualquer download sem URL assinada; rodar contra os buckets usados por `services/StorageService.ts`.
- [ ] Executar os advisors do Supabase e corrigir alertas de segurança antes da liberação externa.
- [ ] **[HUMANO]** Criar alerta operacional no Dashboard para 70% e 85% de Storage, egress e capacidade de banco.

### Task 2: Estabelecer backup e recuperação

**Files:**
- Create: `docs/runbooks/backup-e-restauracao.md`
- Create: `scripts/backup-verify.mjs` (valida presença e integridade dos pontos de retenção no B2)
- Modify: configuração de backup do Supabase e do provedor de object storage **[HUMANO]**

**Interfaces:**
- Consumes: backups diários do banco Supabase e buckets privados de arquivos.
- Produces: cópia externa criptografada, versionada e procedimento de restauração testado.

- [ ] Manter os backups diários do banco no Supabase Pro, com retenção de sete dias.
- [ ] **[HUMANO]** Criar bucket externo exclusivo para backup em Backblaze B2, sem leitura pública, com chave restrita a gravação e Object Lock/versionamento quando contratado.
- [ ] Agendar espelhamento incremental noturno de `fotos`, `laudos` e `document-evidence`; reter ao menos quatro pontos semanais e três mensais.
- [ ] Fazer dump lógico do banco semanal para o armazenamento externo, criptografado antes do envio.
- [ ] Implementar `scripts/backup-verify.mjs`: confere contagem de pontos de retenção, tamanho mínimo esperado por bucket e idade do último dump; sai com erro se algo faltar (usável por cron/monitoramento).
- [ ] Documentar e executar restauração de teste em ambiente isolado (checklist no runbook): uma amostra de banco, uma foto, um PDF e uma URL assinada devem ser recuperados corretamente.

### Task 3: Adicionar VPS de produção sem mover o banco

**Files:**
- Create: `infra/production/README.md`
- Create: `infra/production/docker-compose.yml`
- Create: `docs/runbooks/vps-operacao.md`

**Interfaces:**
- Consumes: variáveis públicas do painel (`dashboard/`) e credenciais de serviço mantidas fora do repositório.
- Produces: VPS endurecida, monitorada e recuperável, conectada ao Supabase somente por HTTPS.

- [ ] **[HUMANO]** Provisionar uma DigitalOcean VPS inicial de 2 vCPU, 4 GB RAM e 80 GB SSD; não usar o disco para fotos, banco ou backup primário.
- [ ] Hardening documentado no runbook com comandos concretos: atualizações automáticas de segurança, firewall restrito a HTTP/HTTPS/SSH com chave, usuário sem privilégios e MFA na conta do provedor.
- [ ] `docker-compose.yml` com serviços separados: proxy HTTPS (Caddy/Traefik), painel `dashboard/` quando necessário, e agentes de monitoramento (uptime + alertas).
- [ ] Guardar segredos no provedor/Supabase, nunca no repositório ou imagem Docker.
- [ ] Configurar health check externo, alerta de indisponibilidade, CPU, memória, disco, expiração TLS e falha do backup (integrado ao `scripts/backup-verify.mjs` da Task 2).

### Task 4: Liberar produção de forma gradual

**Files:**
- Create: `docs/runbooks/piloto-producao.md`
- Inspect: `services/SyncService.ts` (retry `MAX_TENTATIVAS_SYNC = 5`, batches de 20, task `DEFESA_CIVIL_SYNC`), `context/NotificationContext.tsx`, `services/StorageService.ts`

**Interfaces:**
- Consumes: usuários municipais aprovados e métricas dos serviços.
- Produces: expansão por ondas com critérios explícitos de pausa e reversão.

- [ ] Semana 1: liberar equipe interna e 1 prefeitura piloto; validar login, envio offline, sincronização, upload de foto e geração de PDF.
- [ ] Semana 2: adicionar até 5 prefeituras; acompanhar diariamente erros de sincronização, Storage e tempo de resposta contra o baseline da Task 1.
- [ ] Semana 3 em diante: dobrar o número de prefeituras somente após sete dias sem incidente crítico e com restauração de backup validada (Task 2).
- [ ] Suspender novas liberações quando ocorrer perda de dados, falha de isolamento entre municípios, autenticação indisponível ou taxa de erro de sincronização acima do baseline definido.
- [ ] Manter canal de suporte, registro de incidente e comunicação de manutenção para os usuários piloto (modelo de registro no runbook).

### Task 5: Preparar o modelo de comunicados por cidade e bairro

**Files:**
- Create: `supabase/migrations/<timestamp>_communications.sql`
- Create: `supabase/tests/communications_test.sql` (pgTAP)
- Create: módulo de comunicados no app em `app/(panel)/` e página no painel em `dashboard/src/pages/`

**Interfaces:**
- Consumes: município, bairro, usuários autorizados (`auth.users` + roles existentes da série `backend_authoritative_*`) e canais habilitados.
- Produces: comunicado auditável com destino por município/bairro e entrega em app/painel/push.

- [ ] Migration `<timestamp>_communications.sql` criando `municipio`, `bairro`, `comunicado`, `comunicado_destino`, `comunicado_leitura` e `canal_externo` com UUIDs como PK/FK (nunca apenas nomes), `created_at`/`updated_at` e índices por município.
- [ ] RLS por escopo municipal no mesmo padrão da série `backend_authoritative_*`: somente Master cria municípios/canais; admin municipal cria/comunica apenas no próprio município; morador tem somente leitura dos comunicados destinados ao seu município/bairro.
- [ ] `supabase/tests/communications_test.sql` em pgTAP: verificar em `pg_policies` cada policy criada e o comportamento de isolamento (admin do município A não lê o município B).
- [ ] Entregar os comunicados no app (`app/(panel)/`), no painel (`dashboard/src/pages/`) e por push (via `context/NotificationContext.tsx`) antes de adicionar qualquer canal externo.
- [ ] Registrar autor, data, conteúdo, destino, status e motivo de falha em cada disparo (`comunicado_destino` com status e `erro`).

### Task 6: Tratar WhatsApp como decisão externa de conformidade

**Files:**
- Create: `docs/decisions/whatsapp-comunidades.md`

**Interfaces:**
- Consumes: Comunidades criadas no aplicativo WhatsApp e número institucional administrador.
- Produces: decisão documentada de canal e contingência operacional.

- [ ] **[HUMANO]** Confirmar com Meta/BSP se há acesso oficialmente aprovado para publicar no tipo de Comunidade desejado; registrar a resposta e a data no documento de decisão.
- [ ] Se não houver capacidade oficial, manter o TCS como fonte oficial de avisos e a Comunidade WhatsApp como canal manual complementar.
- [ ] Não incluir no escopo de produção bot open source que imite cliente WhatsApp ou WhatsApp Web; não há SLA, suporte nem garantia de continuidade para esse mecanismo.
- [ ] Definir procedimento de contingência: push/app/painel continuam ativos caso o WhatsApp esteja indisponível.

### Task 7: Planejar API de integrações externas após estabilizar o piloto (fase futura)

> **Não implementar nesta fase.** Depende da estabilização do piloto (Task 4) e só entra em execução por decisão explícita. Os itens abaixo são design notes.

**Files:**
- Create: `docs/api/v1-overview.md` (design note)
- Create (futuro): Edge Function ou serviço VPS `api-v1`
- Create (futuro): tabelas `api_clients`, `api_key_hashes`, `api_scopes`, `webhook_subscriptions`, `webhook_deliveries` + testes pgTAP correspondentes

**Interfaces:**
- Consumes: credencial de parceiro, escopo, município e payload validado.
- Produces: API `/v1`, webhooks HMAC e logs de entrega auditáveis.

- [ ] Criar chaves por parceiro com hash, expiração, rotação e revogação; nunca entregar chave do Supabase.
- [ ] Implementar escopos por recurso e município, rate limit e logs de uso.
- [ ] Publicar contratos OpenAPI e ambiente de testes antes de liberar produção para terceiros.
- [ ] Assinar webhooks com HMAC, implementar retentativas exponenciais e painel de falhas.

## Verificação e testes

- RLS de comunicados (Task 5): rodar pgTAP em `supabase/tests/communications_test.sql` contra um projeto de staged (`supabase db test` ou CLI equivalente).
- Scripts operacionais: `node scripts/storage-audit.mjs` e `node scripts/backup-verify.mjs` devem sair com código 0 em ambiente saudável.
- App/painel: `npm test` (jest) na raiz e testes do `dashboard/` (vitest + Playwright) após as telas de comunicados.

## Revisão

- Cobertura: produção gradual, Supabase Pro, VPS, banco, Storage, backup, escala municipal, WhatsApp e API externa estão cobertos.
- Escopo: a automação não oficial de WhatsApp é explicitamente excluída; sua ausência não bloqueia app, painel, push ou comunicados oficiais. A API v1 é fase futura pós-piloto.
- Segurança: RLS com teste pgTAP obrigatório, buckets privados, ausência de `service_role` em cliente, cópia externa e teste de restauração são exigidos.
- Executabilidade: ações somente possíveis fora do repositório estão marcadas **[HUMANO]**; o que pode ser versionado (runbooks, scripts `.mjs`, migrations, testes) tem arquivo de destino concreto.
