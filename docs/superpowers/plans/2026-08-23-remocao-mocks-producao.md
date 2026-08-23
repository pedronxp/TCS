# Remoção de Mocks da Produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover os modos técnicos `local_test_mode` e `developer_demo` do aplicativo publicado, mantendo Preview, Treinamento, operação offline real e fixtures exclusivas dos testes.

**Architecture:** O cliente autenticado passa a ter um único caminho operacional, sempre baseado na sessão, no perfil e nos contratos reais do Supabase. Preview e Treinamento continuam como ambientes explícitos e isolados por `TrainingContext`; testes continuam usando fixtures próprias fora do código executável.

**Tech Stack:** Expo 54, React Native 0.81, React 19, TypeScript 5.9, Supabase JS 2.112, Jest 29; dashboard Vite/React 18, Vitest 4 e Playwright 1.62.

## Global Constraints

- Preview público para usuários sem cadastro deve permanecer funcional e limitado.
- Treinamento para agentes de organizações ou população deve permanecer funcional e isolado da operação.
- Fixtures e mocks são permitidos somente em testes automatizados.
- Fluxos autenticados normais devem mostrar dados reais, estado vazio ou erro explícito; nunca dados fictícios.
- Dados offline operacionais reais e sua posterior sincronização devem permanecer funcionais.
- Migrations históricas não devem ser removidas ou reescritas.
- A alteração local preexistente em `app/(panel)/_layout.tsx` deve ser preservada e não incluída acidentalmente em commits deste plano.

---

### Task 1: Tornar a sincronização invariável a marcas técnicas antigas

**Files:**
- Modify: `services/__tests__/SyncService.test.ts`
- Modify: `services/SyncService.ts`

**Interfaces:**
- Consumes: `syncPendentes(): Promise<{ sucesso: number; falha: number }>` e `getVistoriasNaoSincronizadas()`.
- Produces: sincronização que não consulta `isCurrentSessionLocalTest()` e sempre processa a fila real quando há conectividade.

- [ ] **Step 1: Escrever o teste que representa o contrato de produção**

Remover o mock de `../../utils/localTestMode`, a variável `mockIsCurrentSessionLocalTest` e o teste que espera o bloqueio da fila. Adicionar:

```ts
it('processa a fila operacional sem consultar marcadores de conta técnica', async () => {
  mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

  await expect(syncPendentes()).resolves.toEqual({ sucesso: 1, falha: 0 });

  expect(mockGetVistoriasNaoSincronizadas).toHaveBeenCalledTimes(1);
  expect(mockMarkSincronizado).toHaveBeenCalledWith('v-1');
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `npm test -- services/__tests__/SyncService.test.ts --runInBand`

Expected: FAIL porque `SyncService.ts` ainda importa o módulo removido pelo teste ou mantém o desvio de `isCurrentSessionLocalTest()`.

- [ ] **Step 3: Remover o desvio técnico da sincronização**

Em `services/SyncService.ts`, remover:

```ts
import { isCurrentSessionLocalTest } from '../utils/localTestMode';
```

e remover o bloco:

```ts
if (await isCurrentSessionLocalTest()) {
  logger.info('sync', 'Modo de teste local ativo - sincronização bloqueada');
  return { sucesso: 0, falha: 0 };
}
```

- [ ] **Step 4: Executar o teste e confirmar GREEN**

Run: `npm test -- services/__tests__/SyncService.test.ts --runInBand`

Expected: PASS para todos os testes do arquivo.

- [ ] **Step 5: Commitar a unidade**

```powershell
git add -- services/SyncService.ts services/__tests__/SyncService.test.ts
git commit -m "refactor: remover modo técnico da sincronização"
```

---

### Task 2: Unificar autenticação e serviços no caminho operacional real

**Files:**
- Delete: `utils/localTestMode.ts`
- Delete: `utils/__tests__/localTestMode.test.ts`
- Delete: `services/LocalTestDataService.ts`
- Modify: `context/AuthContext.tsx`
- Modify: `context/SubscriptionContext.tsx`
- Modify: `services/SessionService.tsx`
- Modify: `services/NotificationService.ts`

**Interfaces:**
- Consumes: sessão real do Supabase, `fetchAuthorizedProfile()`, `fetchProfile()` e `useAuth()`.
- Produces: `AuthContextData` com `{ session, profile, loading, signOut, refreshProfile }`, sem flags de simulação.

- [ ] **Step 1: Remover flags do contrato de autenticação**

Em `context/AuthContext.tsx`, remover imports de `localTestMode` e `LocalTestDataService`, remover `localTestMode` e `developerMode` da interface e do valor padrão, apagar `preparedLocalUsers`, `activeLocalUser`, `prepareLocalSession`, a renovação condicional da conta demo e as limpezas locais no login/logout. O provider final deve ser:

```tsx
<AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile }}>
  {children}
</AuthContext.Provider>
```

e `signOut` deve ser:

```ts
const signOut = async () => {
  await supabase.auth.signOut();
};
```

- [ ] **Step 2: Remover exceções dos serviços autenticados**

Em `context/SubscriptionContext.tsx`, usar apenas:

```ts
const { session } = useAuth();
if (!session) {
  setContext(null);
  setError(null);
  return;
}
```

e manter `[session]` como dependência do callback.

Em `services/SessionService.tsx`, usar:

```ts
const { session, signOut } = useAuth();
if (!session) return;
```

com `[session?.access_token, signOut]` nas dependências.

Em `services/NotificationService.ts`, remover o import de `isLocalTestSession` e trocar a guarda por:

```ts
if (!session) return;
```

- [ ] **Step 3: Excluir utilitários exclusivos dos modos simulados**

Excluir `utils/localTestMode.ts`, `utils/__tests__/localTestMode.test.ts` e `services/LocalTestDataService.ts`. Não alterar `TrainingContext`, `TrainingService` ou `PreviewAccessService`.

- [ ] **Step 4: Verificar referências residuais dessa unidade**

Run: `rg -n "isLocalTest|isDeveloperSession|isDeveloperUser|LocalTestDataService" context services utils`

Expected: nenhuma ocorrência em código executável ou testes.

- [ ] **Step 5: Executar TypeScript para obter a lista RED dos consumidores restantes**

Run: `npx tsc --noEmit`

Expected: FAIL apenas nas telas que ainda leem `localTestMode` ou `developerMode` de `useAuth()`.

- [ ] **Step 6: Commitar a unidade de serviços**

```powershell
git add -- context/AuthContext.tsx context/SubscriptionContext.tsx services/SessionService.tsx services/NotificationService.ts utils/localTestMode.ts utils/__tests__/localTestMode.test.ts services/LocalTestDataService.ts
git commit -m "refactor: unificar serviços no runtime de produção"
```

---

### Task 3: Remover comportamentos simulados das telas autenticadas

**Files:**
- Modify: `app/(panel)/_layout.tsx`
- Modify: `app/(panel)/dashboard.tsx`
- Modify: `app/(panel)/perfil.tsx`
- Modify: `app/(panel)/modulos.tsx`
- Modify: `app/(panel)/master/index.tsx`
- Modify: `app/(panel)/inspecoes/index.tsx`
- Modify: `app/(panel)/inspecoes/wizard.tsx`
- Modify: `app/(panel)/inspecoes/resultado.tsx`
- Test: `context/__tests__/TrainingContext.test.ts`
- Test: `services/__tests__/PreviewAccessService.test.ts`

**Interfaces:**
- Consumes: novo retorno de `useAuth()` e o isolamento formal de `useTraining()`.
- Produces: telas normais sempre operacionais; Preview/Treinamento continuam isolados por `isTrainingActive` e `trainingProfile`.

- [ ] **Step 1: Manter somente Treinamento como modo isolado do painel**

Em `app/(panel)/_layout.tsx`, remover `localTestMode` e definir:

```ts
const { isTrainingActive } = useTraining();
const isolatedMode = isTrainingActive;
```

Preservar integralmente as mudanças locais já existentes em `ROUTE_ROLES` e `useRouteGuard`; no commit, adicionar apenas o hunk relativo a `localTestMode`.

- [ ] **Step 2: Remover métricas e banners de teste do dashboard**

Em `app/(panel)/dashboard.tsx`, remover `localTestMode`, `loadLocalMetrics`, seus desvios em `useEffect`/`onRefresh` e o banner “Ambiente local de testes”. Manter o banner de offline real e a consulta `fetchMetrics(profile.uid)`.

- [ ] **Step 3: Remover permissões e apresentação de contas demo**

Em `app/(panel)/perfil.tsx`, remover `localTestMode` e `developerMode`; `saveName` e `savePhone` devem sempre chamar as RPCs reais; o vínculo Google deve ser desabilitado somente por `googleLinked || googleLinking || !isOnlineReal`; o papel exibido deve vir de:

```ts
const roleLabel = ROLE_LABELS[authProfile?.role ?? ''] || authProfile?.role || 'Usuário';
```

Em `app/(panel)/modulos.tsx`, mudar `sectionsForRole` para aceitar apenas `role`, excluir o catálogo especial de desenvolvedor e calcular:

```ts
const sections = useMemo(() => sectionsForRole(userProfile?.role), [userProfile?.role]);
```

Em `app/(panel)/master/index.tsx`, remover o bypass de exclusão, o banner “Ambiente desenvolvedor” e os rótulos condicionais. O badge usa sempre `shield` e `Master`.

- [ ] **Step 4: Manter inspeções locais somente para Preview/Treinamento**

Em `app/(panel)/inspecoes/index.tsx`, remover a prop `localTestMode`; definir `isolatedMode = formalTrainingMode`; usar `treinamento: '1'` apenas na navegação de inspeções formais de treinamento; o subtítulo isolado deve ser “Histórico do treinamento”.

Em `app/(panel)/inspecoes/wizard.tsx`, remover `localTestDraftKey`, `localTestMode` e `testeLocal`; definir `isolatedMode = formalTrainingMode`; a chave de rascunho de treinamento deve permanecer vinculada à sessão formal existente.

Em `app/(panel)/inspecoes/resultado.tsx`, remover `localTestMode`, `testeLocal` e mensagens de “vistoria de teste local”; usar somente `formalTrainingMode`, `trainingProfile?.uid` e os estados de erro do treinamento ou da operação real.

- [ ] **Step 5: Confirmar ausência de marcas simuladas no runtime**

Run: `rg -n "localTestMode|developerMode|local_test_mode|developer_demo|testeLocal|Ambiente local de testes|Ambiente desenvolvedor" app context services utils --glob "!**/__tests__/**"`

Expected: nenhuma ocorrência. Ocorrências nas migrations históricas não entram nessa busca e permanecem intactas.

- [ ] **Step 6: Confirmar Preview e Treinamento**

Run: `npm test -- context/__tests__/TrainingContext.test.ts services/__tests__/PreviewAccessService.test.ts --runInBand`

Expected: PASS, incluindo expiração/revalidação de Treinamento e consumo do limite de Preview.

- [ ] **Step 7: Confirmar TypeScript e testes do aplicativo**

Run: `npx tsc --noEmit`

Expected: PASS.

Run: `npm test -- --runInBand`

Expected: todas as suítes PASS.

- [ ] **Step 8: Commitar somente os hunks do plano**

Usar `git add -p -- "app/(panel)/_layout.tsx"` para selecionar apenas a remoção de `localTestMode`, preservando os hunks preexistentes de guarda de rota fora do índice. Depois:

```powershell
git add -- 'app/(panel)/dashboard.tsx' 'app/(panel)/perfil.tsx' 'app/(panel)/modulos.tsx' 'app/(panel)/master/index.tsx' 'app/(panel)/inspecoes/index.tsx' 'app/(panel)/inspecoes/wizard.tsx' 'app/(panel)/inspecoes/resultado.tsx'
git commit -m "refactor: remover dados simulados do app publicado"
```

---

### Task 4: Finalizar a correção da regressão visual do dashboard

**Files:**
- Modify: `dashboard/tests/visual/authenticated-fixture.ts`
- Modify: `dashboard/tests/visual/__screenshots__/internal-routes.spec.ts/{1440,1024,768,390}/*.png`

**Interfaces:**
- Consumes: contrato RPC `get_internal_session_workspace` usado por `SessionsPage`.
- Produces: fixture de teste com `{ items, total, overview }` e baselines visuais correspondentes à interface atual.

- [ ] **Step 1: Confirmar o contrato do fixture de sessões**

Manter no `switch` de `rpcResponse`:

```ts
case 'get_internal_session_workspace':
  return {
    items: [],
    total: 0,
    overview: { active_total: 0, platforms: { web: 0, android: 0, ios: 0 } },
  };
```

- [ ] **Step 2: Validar todas as rotas internas sem regenerar imagens**

Run: `cd dashboard; npx playwright test tests/visual/internal-routes.spec.ts`

Expected: 96 passed.

- [ ] **Step 3: Revisar o conjunto exato de baselines**

Run: `git diff --stat -- dashboard/tests/visual`

Expected: `authenticated-fixture.ts` e somente os snapshots que falharam no CI por mudanças intencionais de layout, incluindo quatro snapshots de `sessions`.

- [ ] **Step 4: Commitar a correção visual**

```powershell
git add -- dashboard/tests/visual/authenticated-fixture.ts dashboard/tests/visual/__screenshots__/internal-routes.spec.ts
git commit -m "test: atualizar contratos e snapshots visuais"
```

---

### Task 5: Verificação final e atualização do PR #82

**Files:**
- Verify: todos os arquivos rastreados nos commits deste plano
- Update remotely: descrição do PR #82 e branch `feat/producao-gradual-e-comunidades`

**Interfaces:**
- Consumes: commits das Tasks 1–4 e checks do GitHub Actions/Netlify.
- Produces: PR com descrição fiel, branch enviada e checks obrigatórios verdes.

- [ ] **Step 1: Verificar limpeza e escopo do diff**

Run: `git diff --check`

Expected: sem erros.

Run: `git status --short`

Expected: apenas alterações locais preexistentes e arquivos não rastreados do usuário; nenhuma alteração prevista por este plano deve ficar sem commit.

- [ ] **Step 2: Revalidar dashboard unitário e build de produção**

Run: `cd dashboard; npm test`

Expected: todas as suítes Vitest PASS.

Run: `cd dashboard; npm run build`

Expected: TypeScript, validações de design e Vite build PASS.

- [ ] **Step 3: Enviar a branch**

Run: `git push origin feat/producao-gradual-e-comunidades`

Expected: push concluído sem rejeição.

- [ ] **Step 4: Atualizar a descrição do PR**

Consultar os números atuais com:

```powershell
gh pr view 82 --repo pedronxp/TCS --json commits,changedFiles,statusCheckRollup
```

Editar a descrição com `gh pr edit 82 --repo pedronxp/TCS --body $prBody`, incluindo: objetivo, produção gradual/comunicados/WhatsApp, migrations, remoção de `local_test_mode` e `developer_demo`, preservação de Preview/Treinamento, validações executadas e checklist atualizado.

- [ ] **Step 5: Acompanhar checks até o estado terminal**

Run: `gh pr checks 82 --repo pedronxp/TCS --watch --interval 30`

Expected: checks obrigatórios PASS; jobs condicionais podem aparecer como SKIPPED.

- [ ] **Step 6: Verificação remota fresca antes da conclusão**

Run: `gh pr checks 82 --repo pedronxp/TCS`

Expected: nenhuma falha ou check obrigatório pendente.

Run: `gh pr view 82 --repo pedronxp/TCS --json url,body,headRefOid,commits,changedFiles,statusCheckRollup`

Expected: descrição estruturada, HEAD correspondente ao último commit enviado e PR aberto em `https://github.com/pedronxp/TCS/pull/82`.
