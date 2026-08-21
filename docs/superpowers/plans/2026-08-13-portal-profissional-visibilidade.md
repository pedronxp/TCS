# Visibilidade do Portal Profissional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir as vistorias sincronizadas e os relatórios no portal Profissional, encaminhar pessoas internas ao Console TCS, tornar os termos legíveis no cadastro e filtrar formulários nos mapas web e móvel.

**Architecture:** A função Supabase `portal_get_workspace` volta a fornecer as seções operacionais no escopo autorizado, acrescentando a identificação do formulário aos registros de mapa. O dashboard usa essa informação para relatórios, filtros e marcadores; o app móvel aplica o filtro de formulário sobre os marcadores já carregados. A decisão de entrada interna é centralizada no parser de contexto já usado pela autenticação web.

**Tech Stack:** PostgreSQL/Supabase RPC e pgTAP; React, TypeScript, React Query, Vitest e Testing Library; React Native/Expo.

## Global Constraints

- Não recriar, reenviar ou duplicar vistorias existentes: corrigir somente a leitura do workspace.
- Preservar o escopo individual/municipal e o bloqueio de acesso do RPC para dados de outro usuário ou município.
- Tratar `reports`, `reports_basic` e `reports_advanced` como permissões válidas de relatórios.
- O filtro de formulário deve existir no mapa web e no app, iniciar em “Todos os formulários” e combinar-se aos filtros existentes.
- Manter ícones específicos para bueiro/drenagem, incêndio em vegetação, inundação e árvore; os demais conservam o pin atual.
- Não alterar arquivos já modificados fora deste escopo.

---

### Task 1: Restaurar dados operacionais do workspace autorizado

**Files:**
- Create: `supabase/migrations/<timestamp>_restore_portal_workspace_sections.sql`
- Modify: `supabase/tests/customer_portals_test.sql`
- Modify: `dashboard/src/types/supabase.ts` (somente se a geração de tipos mudar o contrato)

**Interfaces:**
- Consumes: `public.get_portal_access_context() jsonb`, `private.portal_agent_allowed(uuid, text, uuid) boolean`, tabelas `public.vistorias` e `public.support_tickets`.
- Produces: `public.portal_get_workspace(p_section text) returns jsonb`, com `items` contendo `formulario_id` para `vistorias`, `mapa` e `documentos`; `relatorios` com resumo do mesmo escopo.

- [ ] **Step 1: Escrever o caso de regressão do RPC**

  Em `supabase/tests/customer_portals_test.sql`, criar uma vistoria individual com `organization_id = NULL`, `"agenteUid"` igual ao usuário autenticado de teste, coordenadas e `"formularioId" = 'inspecao_bueiro_drenagem_v1'`. Sob a JWT desse usuário, chamar as quatro seções:

  ```sql
  SELECT is(
    (public.portal_get_workspace('mapa')->'items'->0->>'id')::uuid,
    v_inspection_id,
    'mapa retorna a vistoria individual sincronizada'
  );
  SELECT is(
    public.portal_get_workspace('mapa')->'items'->0->>'formulario_id',
    'inspecao_bueiro_drenagem_v1',
    'mapa expõe o formulário do registro autorizado'
  );
  SELECT is(
    (public.portal_get_workspace('relatorios')->'summary'->>'inspections')::int,
    1,
    'relatórios contam a vistoria do mesmo escopo'
  );
  ```

- [ ] **Step 2: Executar o teste e confirmar a falha atual**

  Run: `npx --yes supabase@2.110.0 test db --local supabase/tests/customer_portals_test.sql`

  Expected: falha porque a função atual retorna `items = []` para `mapa` e não gera o resumo de `relatorios`.

- [ ] **Step 3: Criar a migration pelo CLI**

  Run: `npx --yes supabase@2.110.0 migration new restore_portal_workspace_sections`

  A migration deve redefinir `public.portal_get_workspace` com `SECURITY DEFINER`, `SET search_path = ''`, validação de seção e chamada obrigatória a `public.get_portal_access_context()`. Restaurar as ramificações de vistorias/mapa/documentos, agenda, equipe, convites, consumo, assinatura, perfil e configurações da função de fundação, mas incorporar o formato detalhado de suporte da migration `20260813153041_portal_support_details.sql`.

- [ ] **Step 4: Implementar a leitura segura de vistorias e relatórios**

  Na nova função, usar a mesma cláusula de escopo para todas as seções de vistoria:

  ```sql
  (v_org IS NULL
    AND inspection.organization_id IS NULL
    AND inspection."agenteUid"::text = v_user::text)
  OR (v_org IS NOT NULL
    AND inspection.organization_id = v_org
    AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))
  ```

  Incluir `formulario_id`, `latitude`, `longitude`, `protocol`, endereço e disponibilidade de documento no item. `documentos` filtra somente `laudo_url IS NOT NULL`; `relatorios` retorna pelo menos `inspections` e `generated_at`, calculados com a mesma cláusula.

- [ ] **Step 5: Executar os testes locais e gerar o contrato de tipos se necessário**

  Run: `npx --yes supabase@2.110.0 db reset --local`

  Run: `npx --yes supabase@2.110.0 test db --local supabase/tests/customer_portals_test.sql`

  Expected: teste novo e suíte existente verdes. Caso o contrato RPC gerado mude, executar `npm run types:supabase` em `dashboard` e revisar somente o trecho de `portal_get_workspace`.

- [ ] **Step 6: Revisar segurança da migration e publicar**

  Run: `npx --yes supabase@2.110.0 migration list --local`

  Usar o MCP do Supabase para aplicar a mesma migration no projeto remoto e executar uma consulta de verificação com o usuário de Cataguases: três itens em `mapa` e um resumo de relatórios maior que zero.

- [ ] **Step 7: Commit**

  ```powershell
  git add supabase/migrations/<timestamp>_restore_portal_workspace_sections.sql supabase/tests/customer_portals_test.sql dashboard/src/types/supabase.ts
  git commit -m "fix: restaurar workspace operacional do portal"
  ```

### Task 2: Liberar Relatórios do plano Profissional e entrada das contas internas

**Files:**
- Modify: `dashboard/src/pages/portal/PortalModulePage.tsx`
- Modify: `dashboard/src/pages/portal/PortalModulePage.test.tsx`
- Modify: `dashboard/src/lib/portal.ts`
- Modify: `dashboard/src/lib/portal.test.ts`

**Interfaces:**
- Consumes: `PortalAccessContext.features: Record<string, boolean>` e perfil interno `{ role, status }` vindo de `get_internal_staff_profile`.
- Produces: `hasPortalReports(features): boolean` e `parseInternalCustomerEntryContext(value): PortalCustomerEntryContext | null` aceitando todos os papéis internos ativos previstos.

- [ ] **Step 1: Escrever o teste de acesso a relatórios do Profissional**

  Em `PortalModulePage.test.tsx`, configurar `features = { reports_basic: true }`, renderizar `section="relatorios"` e afirmar que a tela apresenta “Recorte disponível”, não “Relatórios não incluídos neste plano”. Repetir a expectativa com `reports_advanced: true`.

- [ ] **Step 2: Executar o teste e confirmar a falha**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalModulePage.test.tsx`

  Expected: falha mostrando o bloqueio, pois o código atual lê somente `features.reports`.

- [ ] **Step 3: Implementar o predicado de relatórios e usá-lo no módulo**

  Adicionar uma função pura, exportada, em `PortalModulePage.tsx`:

  ```ts
  export function hasPortalReports(features: Record<string, boolean> | undefined) {
    return features?.reports === true
      || features?.reports_basic === true
      || features?.reports_advanced === true;
  }
  ```

  Substituir a condição de `locked` por `!hasPortalReports(access?.features)`.

- [ ] **Step 4: Executar o teste verde**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalModulePage.test.tsx`

  Expected: todos os cenários do módulo passam, incluindo o bloqueio quando nenhuma das três chaves é verdadeira.

- [ ] **Step 5: Escrever o teste de conta interna de suporte e auditoria**

  Em `dashboard/src/lib/portal.test.ts`, substituir a expectativa atual de `support` nulo por entrada interna válida e acrescentar `auditor` ativo. Manter `suspended` inválido.

- [ ] **Step 6: Executar o teste e confirmar a falha**

  Run: `npm --prefix dashboard test -- --run src/lib/portal.test.ts`

  Expected: falha porque `parseInternalCustomerEntryContext` só reconhece `owner` e `developer`.

- [ ] **Step 7: Aceitar todos os papéis internos ativos no parser**

  Em `dashboard/src/lib/portal.ts`, validar `role` contra `owner`, `developer`, `support` e `auditor`, exigindo `status === 'active'`. Não criar um contexto de cliente para qualquer outro valor.

- [ ] **Step 8: Verificar entrada direta no Console**

  Run: `npm --prefix dashboard test -- --run src/lib/portal.test.ts src/pages/portal/PortalModulePage.test.tsx`

  Expected: os perfis internos são devolvidos como `accountKind: 'internal'`; `PortalAuthContext` já dá prioridade a esse resultado antes do perfil cliente e o redirecionamento existente do `PortalAuthPage` leva ao Console.

- [ ] **Step 9: Commit**

  ```powershell
  git add dashboard/src/pages/portal/PortalModulePage.tsx dashboard/src/pages/portal/PortalModulePage.test.tsx dashboard/src/lib/portal.ts dashboard/src/lib/portal.test.ts
  git commit -m "fix: liberar relatórios e acesso interno ao console"
  ```

### Task 3: Exibir Termos de Uso e Política de Privacidade antes do aceite

**Files:**
- Modify: `dashboard/src/components/auth/TermsPrivacyDialog.tsx`
- Modify: `dashboard/src/pages/portal/PortalAuthPage.tsx`
- Modify: `dashboard/src/pages/portal/PortalAuthPage.test.tsx`

**Interfaces:**
- Consumes: checkbox `#portal-terms` e componentes de diálogo Radix já usados pelo dashboard.
- Produces: links independentes “Termos de Uso” e “Política de Privacidade” que abrem conteúdo legível sem alterar o estado do aceite.

- [ ] **Step 1: Escrever o teste de visualização dos documentos**

  Em `PortalAuthPage.test.tsx`, no modo de criação de conta, clicar no link “Termos de Uso” e esperar por um `dialog` com título correspondente; fechar e repetir com “Política de Privacidade”. Após abrir/fechar, afirmar que a caixa de aceite continua desmarcada.

- [ ] **Step 2: Executar o teste e confirmar a falha**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalAuthPage.test.tsx`

  Expected: falha porque só há um gatilho de diálogo e o texto de Política é um `label` não clicável.

- [ ] **Step 3: Separar os gatilhos mantendo um diálogo acessível**

  Atualizar `TermsPrivacyDialog` para receber `document: 'terms' | 'privacy'` e renderizar título, descrição e seções do documento escolhido. No formulário, montar a frase com dois botões semânticos:

  ```tsx
  <span>Li e aceito os </span>
  <TermsPrivacyDialog document="terms" />
  <span> e a </span>
  <TermsPrivacyDialog document="privacy" />
  <span> vigentes.</span>
  ```

  Os botões não podem alternar `termsAccepted`; somente o input/label do checkbox o faz.

- [ ] **Step 4: Executar os testes do fluxo de autenticação**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalAuthPage.test.tsx`

  Expected: visualização e obrigatoriedade de aceite verdes.

- [ ] **Step 5: Commit**

  ```powershell
  git add dashboard/src/components/auth/TermsPrivacyDialog.tsx dashboard/src/pages/portal/PortalAuthPage.tsx dashboard/src/pages/portal/PortalAuthPage.test.tsx
  git commit -m "feat: permitir leitura dos termos no cadastro"
  ```

### Task 4: Filtrar formulários e identificar marcadores no mapa web

**Files:**
- Modify: `dashboard/src/pages/portal/PortalMapPage.tsx`
- Modify: `dashboard/src/pages/portal/PortalMapPage.test.tsx`
- Modify: `dashboard/src/components/portal/PortalMap.tsx`

**Interfaces:**
- Consumes: itens de `portal_get_workspace('mapa')` com `formulario_id`.
- Produces: `PortalMapPoint.formularioId`, query string `formulario`, seletor “Todos os formulários” e marcador DOM com o símbolo correspondente.

- [ ] **Step 1: Escrever o teste de filtro por formulário**

  Em `PortalMapPage.test.tsx`, incluir dois registros, um com `formulario_id: 'inspecao_bueiro_drenagem_v1'` e outro com `formulario_id: 'risco_inundacao_v1'`. Selecionar “Bueiro e drenagem” e afirmar que a alternativa textual e o mapa contêm apenas o primeiro, com URL `?formulario=inspecao_bueiro_drenagem_v1`.

- [ ] **Step 2: Executar o teste e confirmar a falha**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalMapPage.test.tsx`

  Expected: falha porque o seletor e `PortalMapPoint.formularioId` ainda não existem.

- [ ] **Step 3: Implementar o contrato e o filtro local**

  Converter `item.formulario_id` para `formularioId` na página. Criar uma tabela local de apresentação para os quatro IDs especiais, usar `formulario` nos `URLSearchParams` e filtrar por igualdade junto de busca/status. Só exibir opções de formulários existentes no recorte carregado, mais “Todos os formulários”.

- [ ] **Step 4: Implementar o marcador visual do mapa web**

  Estender `PortalMapPoint` e substituir o marcador genérico por um elemento DOM com texto seguro para `▦`, `🔥`, `💧` e `♣` nos quatro formulários. Para IDs não mapeados, continuar usando o pin padrão de MapLibre. Incluir `formularioId` em `markerSignature` para atualizar o marcador quando necessário.

- [ ] **Step 5: Executar testes e checagens do dashboard**

  Run: `npm --prefix dashboard test -- --run src/pages/portal/PortalMapPage.test.tsx`

  Run: `npm --prefix dashboard run build`

  Expected: teste, verificação de design, TypeScript e build verdes.

- [ ] **Step 6: Commit**

  ```powershell
  git add dashboard/src/pages/portal/PortalMapPage.tsx dashboard/src/pages/portal/PortalMapPage.test.tsx dashboard/src/components/portal/PortalMap.tsx
  git commit -m "feat: filtrar formulários no mapa do portal"
  ```

### Task 5: Filtrar formulários no mapa móvel sem alterar os ícones aprovados

**Files:**
- Create: `utils/inspectionFormPresentation.ts`
- Create: `utils/__tests__/inspectionFormPresentation.test.ts`
- Modify: `app/(panel)/mapas.tsx`

**Interfaces:**
- Produces: `getInspectionFormPresentation(formularioId?: string | null): { label: string; icon: 'grid' | 'fire' | 'droplet' | 'git-branch' | null }` e `matchesInspectionForm(formularioId, selectedForm)`.
- Consumes: `VistoriaMarker.formularioId` já carregado em `app/(panel)/mapas.tsx`.

- [ ] **Step 1: Escrever testes unitários da apresentação de formulário**

  Em `utils/__tests__/inspectionFormPresentation.test.ts`, cobrir os IDs especiais e um formulário de edifício:

  ```ts
  expect(getInspectionFormPresentation('inspecao_bueiro_drenagem_v1')).toMatchObject({
    label: 'Bueiro e drenagem', icon: 'grid',
  });
  expect(matchesInspectionForm('risco_inundacao_v1', 'inspecao_bueiro_drenagem_v1')).toBe(false);
  expect(matchesInspectionForm('risco_edificio_v1', 'todos')).toBe(true);
  ```

- [ ] **Step 2: Executar o teste e confirmar a falha**

  Run: `npm test -- --runInBand utils/__tests__/inspectionFormPresentation.test.ts`

  Expected: falha porque o módulo de apresentação ainda não existe.

- [ ] **Step 3: Implementar o módulo de apresentação sem emojis novos no app**

  Criar o helper com os quatro IDs aprovados. Para formulário desconhecido, retornar rótulo “Outros formulários” e `icon: null`; `matchesInspectionForm` retorna verdadeiro para `todos` ou igualdade de ID.

- [ ] **Step 4: Executar o teste verde**

  Run: `npm test -- --runInBand utils/__tests__/inspectionFormPresentation.test.ts`

  Expected: todos os IDs e o fallback passam.

- [ ] **Step 5: Integrar a segunda faixa de filtros no app**

  Em `app/(panel)/mapas.tsx`, substituir o `switch` local de `getInspectionMarkerIcon` pela apresentação compartilhada. Adicionar estado `formularioFilter` iniciado em `todos`; derivar os chips de formulário a partir de `markers`; e aplicar `matchesInspectionForm` dentro de `filteredMarkers`, junto de risco e período. Renderizar a faixa “Formulários” abaixo dos filtros já existentes em `ScrollView` horizontal, sem mudar as constantes de ícone/marcador nem os filtros de risco/período.

- [ ] **Step 6: Executar a suíte e a checagem de tipos**

  Run: `npm test -- --runInBand utils/__tests__/inspectionFormPresentation.test.ts`

  Run: `npx tsc --noEmit`

  Expected: filtro isolado e projeto TypeScript passam, com os quatro ícones preservados.

- [ ] **Step 7: Commit**

  ```powershell
  git add utils/inspectionFormPresentation.ts utils/__tests__/inspectionFormPresentation.test.ts "app/(panel)/mapas.tsx"
  git commit -m "feat: filtrar formulários no mapa móvel"
  ```

### Task 6: Verificação integrada e entrega

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-portal-profissional-visibilidade-design.md` (somente se a implementação revelar mudança de requisito)

**Interfaces:**
- Consumes: migrations publicadas, dashboard construído e aplicativo compilado.
- Produces: evidência verificável de que Cataguases exibe as três vistorias sem reenviá-las.

- [ ] **Step 1: Executar a suíte regressiva do dashboard**

  Run: `npm --prefix dashboard test`

  Run: `npm --prefix dashboard run build`

  Expected: testes e build do dashboard verdes.

- [ ] **Step 2: Executar os testes e tipos do aplicativo**

  Run: `npm test -- --runInBand utils/__tests__/subscriptionSync.test.ts utils/__tests__/inspectionFormPresentation.test.ts`

  Run: `npx tsc --noEmit`

  Expected: sincronização e filtro de formulário verdes.

- [ ] **Step 3: Verificar dados remotos de Cataguases sem mutação**

  Pelo MCP Supabase, consultar a conta Individual Profissional e confirmar: três vistorias sincronizadas, três itens retornados por `portal_get_workspace('mapa')`, coordenadas válidas e resumo de relatórios não vazio. Confirmar que a contagem de vistorias não aumentou durante a correção.

- [ ] **Step 4: Verificar fluxos manualmente no navegador**

  Com uma sessão Profissional, abrir `/portal/individual/vistorias`, `/portal/individual/mapa` e `/portal/individual/relatorios`; validar as três vistorias, o filtro por formulário e o relatório. Em sessões internas ativas, validar chegada ao Console. Na criação de conta, abrir os dois documentos antes de marcar o aceite.

- [ ] **Step 5: Commit final de verificação, se necessário**

  ```powershell
  git status --short
  ```

  Não incluir alterações de terceiros. Se houver somente documentação de requisito atualizada, criar um commit separado com mensagem `docs: registrar verificação do portal profissional`.
