# Fluxo documental e ciência web — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir a liberação prematura dos PDFs e permitir iniciar, concluir e administrar a ciência pela versão web sem criar um segundo sistema de evidências.

**Architecture:** app e web usarão `generated_documents`, `document_acknowledgement_requests` e `document_acknowledgement_events` como fonte comum. Um helper puro decidirá quando o app pode compartilhar; wrappers RPC específicos do portal aplicarão assinatura, permissão e escopo antes de criar ou revogar links.

**Tech Stack:** Expo Router, React Native, React/Vite, Vitest, Jest, Supabase Postgres/RLS e Edge Functions.

**Spec:** `docs/superpowers/specs/2026-08-26-fluxo-documental-ciencia-web-design.md`

## Global Constraints

- O destinatário deve visualizar a versão final antes de registrar o resultado.
- O agente não pode registrar `acknowledged` em nome do destinatário.
- Recusa e impossibilidade são resultados finais daquela versão.
- Documento técnico e comprovante permanecem artefatos separados e imutáveis.
- Nenhuma migration desta branch será aplicada em produção antes da revisão e merge.
- Toda mudança de comportamento começa por um teste que falha pelo motivo esperado.

---

### Task 1: Contrato seguro de links no Portal

**Files:**
- Create: `supabase/migrations/<timestamp>_portal_document_acknowledgement_actions.sql`
- Create: `supabase/tests/portal_document_acknowledgement_actions.sql`
- Modify: `supabase/migrations/README.md` somente se o repositório exigir registro manual

**Interfaces:**
- Produces: `portal_create_document_acknowledgement_link(p_document_id uuid, p_expires_in_hours integer) -> jsonb`
- Produces: `portal_revoke_document_acknowledgement_link(p_document_id uuid) -> jsonb`
- Produces: campos de capacidade e expiração em `portal_list_acknowledgements()`

- [ ] **Step 1: criar a migration pelo CLI**

Run: `npx --yes supabase@2.110.0 migration new portal_document_acknowledgement_actions --workdir .`

- [ ] **Step 2: escrever testes SQL que falham antes do contrato existir**

Cobrir sessão sem acesso, assinatura bloqueada, documento de outro escopo, documento com resultado final, criação válida, revogação válida e segunda revogação sem efeito.

- [ ] **Step 3: executar os testes e confirmar RED**

Run: `cd dashboard && npm run test:supabase`

Expected: FAIL porque as duas funções do portal ainda não existem.

- [ ] **Step 4: implementar os wrappers e enriquecer a listagem**

As funções devem validar `auth.uid()`, `get_portal_access_context()`, `document.read`, `creation_allowed`, escopo da versão, estado final e expiração. Revogar execução de `PUBLIC, anon` e conceder apenas a `authenticated`.

- [ ] **Step 5: executar testes SQL e advisors**

Run: `cd dashboard && npm run test:supabase`

Run: `npx --yes supabase@2.110.0 db lint --local --workdir .`

Expected: PASS sem política permissiva nova ou função pública sem autorização explícita.

- [ ] **Step 6: commit da entrega de banco**

```bash
git add -- supabase/migrations/<arquivo-gerado>.sql supabase/tests/portal_document_acknowledgement_actions.sql
git commit -m "feat: habilitar ações web de ciência"
```

### Task 2: Gestão e coleta da ciência no Portal

**Files:**
- Modify: `dashboard/src/pages/portal/PortalAcknowledgementsPage.test.tsx`
- Modify: `dashboard/src/pages/portal/PortalAcknowledgementsPage.tsx`
- Create: `dashboard/src/lib/documentAcknowledgementLinks.ts`
- Create: `dashboard/src/lib/documentAcknowledgementLinks.test.ts`

**Interfaces:**
- Consumes: RPCs da Task 1
- Produces: `buildAcknowledgementUrl(token: string, origin: string): string`
- Produces: `parseAcknowledgementLinkResult(value: unknown): { token: string; expiresAt: string } | null`

- [ ] **Step 1: trocar o teste do placeholder por testes do fluxo real**

Os testes devem esperar chamada de criação, URL `/ciencia/:token`, cópia, abertura para coleta presencial, revogação, bloqueio por assinatura e ausência de nova emissão em estados finais.

- [ ] **Step 2: executar os testes e confirmar RED**

Run: `cd dashboard && npm test -- PortalAcknowledgementsPage.test.tsx documentAcknowledgementLinks.test.ts`

Expected: FAIL porque a página ainda retorna “backend indisponível”.

- [ ] **Step 3: implementar parser e construtor seguro de URL**

Rejeitar token fora de `^[a-f0-9]{64}$`, data inválida e origem fora de HTTP/HTTPS. Usar `encodeURIComponent` no segmento.

- [ ] **Step 4: integrar criar, abrir, copiar e revogar**

Manter o token somente no estado de memória. “Coletar pela web” abre a rota pública; “Gerar link remoto” mostra e copia o link; “Revogar” chama o RPC e atualiza a listagem. Estados finais não oferecem nova ciência.

- [ ] **Step 5: executar testes e acessibilidade**

Run: `cd dashboard && npm test -- PortalAcknowledgementsPage.test.tsx documentAcknowledgementLinks.test.ts`

Expected: PASS, incluindo `vitest-axe`.

- [ ] **Step 6: commit da entrega web**

```bash
git add -- dashboard/src/pages/portal/PortalAcknowledgementsPage.tsx dashboard/src/pages/portal/PortalAcknowledgementsPage.test.tsx dashboard/src/lib/documentAcknowledgementLinks.ts dashboard/src/lib/documentAcknowledgementLinks.test.ts
git commit -m "feat: concluir ciência pelo portal web"
```

### Task 3: Estado de liberação do documento no aplicativo

**Files:**
- Create: `services/DocumentReleaseWorkflow.ts`
- Create: `services/__tests__/DocumentReleaseWorkflow.test.ts`

**Interfaces:**
- Produces: `resolveDocumentRelease(preparation): 'collect_acknowledgement' | 'share' | 'blocked'`
- Produces: `documentReleaseMessage(result): { title: string; message: string }`

- [ ] **Step 1: escrever testes da decisão de liberação**

Casos: versão criada exige coleta antes do compartilhamento; recurso desabilitado permite compartilhar; preparação habilitada que falhou bloqueia liberação.

- [ ] **Step 2: executar e confirmar RED**

Run: `npm test -- services/__tests__/DocumentReleaseWorkflow.test.ts --runInBand`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: implementar o helper mínimo**

O helper não acessa UI, Storage ou Supabase. Ele aceita `{ documentId, enabled, errorMessage }` e devolve somente a decisão e a mensagem institucional.

- [ ] **Step 4: executar e confirmar GREEN**

Run: `npm test -- services/__tests__/DocumentReleaseWorkflow.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: commit do contrato móvel**

```bash
git add -- services/DocumentReleaseWorkflow.ts services/__tests__/DocumentReleaseWorkflow.test.ts
git commit -m "fix: definir liberação segura de documentos"
```

### Task 4: Corrigir relatório, laudo e resultado

**Files:**
- Modify: `app/(panel)/inspecoes/resultado.tsx`
- Modify: `app/(panel)/inspecoes/laudo.tsx`
- Modify: `app/(panel)/inspecoes/relatorio.tsx`
- Modify: `app/(panel)/inspecoes/ciencia.tsx`
- Modify: `context/ReportContext.tsx` se necessário para preservar o snapshot editado

**Interfaces:**
- Consumes: `resolveDocumentRelease` da Task 3
- Consumes: `prepareGeneratedDocument` e rota `/(panel)/inspecoes/ciencia?documentId=`
- Produces: fluxo uniforme sem `Sharing.shareAsync` antes da coleta quando a ciência está habilitada

- [ ] **Step 1: adicionar testes de caracterização do encadeamento**

Os testes devem falhar se `share` ocorrer antes de `prepare`/`collect`, e devem confirmar que relatório usa os valores editados no snapshot.

- [ ] **Step 2: executar e confirmar RED**

Run: `npm test -- --runInBand`

Expected: os novos testes reproduzem a inversão atual.

- [ ] **Step 3: integrar o estado de liberação em `resultado.tsx` e `laudo.tsx`**

Após gerar e persistir, navegar para ciência quando houver `documentId`; compartilhar imediatamente apenas quando o recurso estiver desabilitado; bloquear e permitir nova tentativa quando a preparação falhar.

- [ ] **Step 4: integrar `relatorio.tsx` ao documento versionado**

Construir o snapshot com `condutaRecomendada`, `observacoesTecnicas`, `cargo` e demais valores editados, preparar a versão antes da liberação e encaminhar à mesma tela de ciência.

- [ ] **Step 5: ajustar a tela de ciência para saída explícita**

Depois do resultado, disponibilizar “Compartilhar documento e comprovante” e “Voltar à vistoria”. Não gerar outra versão ao compartilhar.

- [ ] **Step 6: executar testes móveis**

Run: `npm test -- --runInBand`

Expected: PASS.

- [ ] **Step 7: commit da correção móvel**

```bash
git add -- 'app/(panel)/inspecoes/resultado.tsx' 'app/(panel)/inspecoes/laudo.tsx' 'app/(panel)/inspecoes/relatorio.tsx' 'app/(panel)/inspecoes/ciencia.tsx' context/ReportContext.tsx
git commit -m "fix: coletar ciência antes de liberar documento"
```

### Task 5: Verificação integrada e PR

**Files:**
- Modify: `docs/ciencia-eletronica-documentos.md`
- Modify: `docs/superpowers/plans/2026-08-26-fluxo-documental-ciencia-web.md`

**Interfaces:** nenhuma nova.

- [ ] **Step 1: documentar as rotas e regras finais**

Registrar `/portal/municipal/ciencias`, `/portal/individual/ciencias` e `/ciencia/:token`, incluindo expiração, revogação, estados finais e limitação jurídica da assinatura manuscrita.

- [ ] **Step 2: executar verificação completa**

Run: `npm test -- --runInBand`

Run: `cd dashboard && npm test`

Run: `cd dashboard && npm run build`

Run: `git diff --check`

- [ ] **Step 3: revisar segurança Supabase**

Executar advisors de segurança e desempenho no projeto `vobcapzssxchdckazfnr`. Não aplicar a migration em produção.

- [ ] **Step 4: revisar diff e segredos**

Run: `git status --short && git diff --stat && git diff --check`

Confirmar que somente arquivos da entrega serão staged e que nenhum token puro, chave ou dado pessoal entrou no commit.

- [ ] **Step 5: publicar branch e abrir PR em rascunho**

```bash
git push -u origin codex/fluxo-laudos-ciencia-web
```

Criar PR para `main` com resumo de comportamento, migrations aditivas, testes executados e riscos de rollout.

