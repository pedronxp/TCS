# Protocolo Oficial Pendente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que o aplicativo apresente um protocolo local derivado da cidade como se fosse o protocolo oficial antes de a alocação server-side existir.

**Architecture:** Um helper puro decide a apresentação do protocolo a partir do valor persistido. As telas de resultado e detalhe consomem esse helper e exibem um estado pendente acessível quando a vistoria ainda não recebeu número oficial. O gerador legado permanece temporariamente apenas para compatibilidade de documentos antigos; ele deixa de ser fallback das novas telas.

**Tech Stack:** TypeScript, Jest/Expo, Expo Router, React Native.

## Global Constraints

- O protocolo oficial vem somente do campo persistido pelo servidor.
- Ausência de protocolo significa `Protocolo pendente de sincronização`; nunca gerar número local para apresentação oficial.
- Não alterar nem renumerar protocolos persistidos existentes.
- Toda mudança de comportamento deve ter teste escrito e observado em falha antes da implementação.

---

### Task 1: Helper de apresentação de protocolo

**Files:**
- Create: `utils/protocoloDisplay.ts`
- Create: `utils/__tests__/protocoloDisplay.test.ts`

**Interfaces:**
- Produces: `protocolDisplay(protocolo?: string | null): { value: string; isOfficial: boolean }`
- Consumes: nenhuma dependência de aplicativo ou rede.

- [ ] **Step 1: Write the failing test**

```ts
import { protocolDisplay } from '../protocoloDisplay';

it('does not turn a missing persisted protocol into a local official number', () => {
  expect(protocolDisplay(null)).toEqual({
    value: 'Protocolo pendente de sincronização',
    isOfficial: false,
  });
});

it('keeps the server persisted protocol unchanged', () => {
  expect(protocolDisplay('PREF-CPS-2026-00001')).toEqual({
    value: 'PREF-CPS-2026-00001',
    isOfficial: true,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand utils/__tests__/protocoloDisplay.test.ts`

Expected: FAIL because module `../protocoloDisplay` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function protocolDisplay(protocolo?: string | null) {
  const value = protocolo?.trim();
  return value
    ? { value, isOfficial: true }
    : { value: 'Protocolo pendente de sincronização', isOfficial: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand utils/__tests__/protocoloDisplay.test.ts`

Expected: PASS.

### Task 2: Resultado e detalhe usam somente apresentação oficial

**Files:**
- Modify: `app/(panel)/inspecoes/[id].tsx`
- Modify: `app/(panel)/inspecoes/resultado.tsx`
- Test: `utils/__tests__/protocoloDisplay.test.ts`

**Interfaces:**
- Consumes: `protocolDisplay(protocolo)` from Task 1.
- Produces: telas que não exibem o fallback `generateProtocolo` para vistorias sem protocolo persistido.

- [ ] **Step 1: Extend the failing test**

```ts
it('treats whitespace-only persisted protocol as pending', () => {
  expect(protocolDisplay('   ')).toEqual({
    value: 'Protocolo pendente de sincronização',
    isOfficial: false,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand utils/__tests__/protocoloDisplay.test.ts`

Expected: FAIL because whitespace currently resolves as an official protocol.

- [ ] **Step 3: Apply the helper to both screens**

Replace each user-facing `vistoria.protocolo || generateProtocolo(...)` fallback in the detail/result screen with `protocolDisplay(vistoria.protocolo)`. Use `isOfficial` to avoid labelling a pending value as an issued number.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- --runInBand utils/__tests__/protocoloDisplay.test.ts`

Run: `npm test -- --runInBand`

Expected: focused and full suites PASS.

### Task 3: Record compatibility boundary

**Files:**
- Modify: `openspec/changes/evoluir-comercializacao-autenticacao-e-governanca/tasks.md`

**Interfaces:**
- Produces: implementation record that Task 2.5 began with presentation safety; server allocation remains the next P0 task.

- [ ] **Step 1: Mark the completed presentation-safety slice precisely**

Update task 2.5 with a completion note that states the mobile no longer fabricates a displayed official protocol, without marking server allocation complete.

- [ ] **Step 2: Validate the OpenSpec change**

Run: `openspec validate evoluir-comercializacao-autenticacao-e-governanca --strict`

Expected: PASS.
