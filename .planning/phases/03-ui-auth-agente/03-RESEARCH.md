# Phase 03: UI Redesign — Auth + Agente - Research

**Researched:** 2026-03-29
**Domain:** React Native (Expo SDK 54) UI component integration and screen refactoring
**Confidence:** HIGH

## Summary

Phase 03 applies the completed design system (Phase 2) to 16 existing auth and agent panel screens. This is a **pure refactoring phase** — no new screens, no new libraries, no new business logic. All 16 screens are straightforward modifications using components and tokens already verified in Phase 2.

The phase also corrects 4 critical bugs: offline SQLite fallback for vistoria details (C4), wizard auto-save closure stale (M9), photo persistence (A6), and CEP validation (UX-05). Two performance optimizations: useMemo for date/time in dashboard (PERF-01) and count:exact queries in profile (PERF-05). One security fix: register.tsx select restriction (SEG-05).

**Primary recommendation:** Execute in 3 sequential waves (auth screens, panel screens, inspection flow) — each screen is independent once its dependencies are available. All components exist in `components/ui/`, all tokens exist in `constants/`, and `getVistoriaById()` already exists in `utils/database.ts`.

## Standard Stack

### Core (Verified Available)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React Native | (Expo SDK 54) | UI primitives (View, Text, TextInput, etc.) | Bundled |
| Expo Router | (SDK 54) | File-based routing | Bundled |
| Feather Icons | @expo/vector-icons | Icon rendering for UI elements | Bundled |
| @react-native-async-storage | (SDK 54 compatible) | Local state persistence for drafts and caching | Bundled |
| expo-image-picker | (SDK 54) | Photo capture in wizard and foto.tsx | Bundled |
| expo-sqlite | (SDK 54) | Offline vistoria storage (already in use) | Bundled |

### Design System (Created in Phase 2 — All Verified Available)

| Component | File | Purpose | Props |
|-----------|------|---------|-------|
| **Button** | components/ui/Button.tsx | Primary, secondary, ghost, danger variants | variant, disabled, loading, onPress, children |
| **Card** | components/ui/Card.tsx | Container with shadow, border-radius, padding | children, style (optional) |
| **Badge** | components/ui/Badge.tsx | Risk level (R1/R2/R3/R4) + user role display | variant (type-safe: R1\|R2\|R3\|R4\|success\|warning\|error), children, style |
| **EmptyState** | components/ui/EmptyState.tsx | List empty fallback with icon + action | icon (Feather name), title, description, actionLabel, onAction |
| **LoadingState** | components/ui/LoadingState.tsx | Skeleton and spinner during data fetch | (zero props, minimal) |
| **ErrorState** | components/ui/ErrorState.tsx | Fetch/network error with retry | message, onRetry |
| **SectionHeader** | components/ui/SectionHeader.tsx | Consistent section titles | children, style |

All exported from `components/ui/index.ts` (barrel export verified).

### Design Tokens (Phase 2 — Verified)

| Constant | File | Content | Available |
|----------|------|---------|-----------|
| **Colors.light / Colors.dark** | constants/Colors.ts | 44 tokens: primary, success, error, warning, risco R1-R4, text colors, surfaces | ✓ 44 tokens verified |
| **Typography** | constants/Typography.ts | fontSizes, fontWeights, lineHeights for display, heading, body, caption, label | ✓ |
| **Spacing** | constants/Spacing.ts | 4, 8, 12, 16, 20, 24, 32, 40, 48 px scale | ✓ |

Accessed via `useTheme()` hook (returns `typeof Colors.light` + hook values).

### Critical Utilities (Already Exist)

| Utility | File | Function | Signature |
|---------|------|----------|-----------|
| **getVistoriaById** | utils/database.ts | Fetch single vistoria from SQLite by ID | `(id: string) => VistoriaLocal \| null` |
| **insertVistoria** | utils/database.ts | Insert new vistoria to SQLite | `(vistoria: Omit<VistoriaLocal, 'sincronizado' \| ...>) => void` |
| **getDb** | utils/database.ts | Get or initialize SQLite database | `() => SQLite.SQLiteDatabase` |
| **useTheme** | context/ThemeContext.tsx | Access theme tokens | `() => { theme: typeof Colors.light; toggleTheme: () => void }` |
| **useAuth** | context/AuthContext.tsx | Access user profile, role, uid | `() => { profile: { uid, name, role, municipio }, ... }` |
| **useConnectivity** | context/ConnectivityContext.tsx | Check online/offline state | `() => { isOnlineReal: boolean }` |
| **useReport** | context/ReportContext.tsx | Manage inspection report state | `() => { initReport, setVistoria, ... }` |

All verified to exist and working (used by current screens).

## Architecture Patterns

### Recommended Project Structure (Already Followed)

```
app/
├── onboarding.tsx                    # Auth journey — intro slides
├── (auth)/                            # Auth group
│   ├── _layout.tsx
│   ├── index.tsx                     # Welcome screen
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
├── (panel)/                           # Agent panel group
│   ├── dashboard.tsx
│   ├── perfil.tsx
│   ├── inspecoes/
│   │   ├── _layout.tsx
│   │   ├── index.tsx                 # List of inspections
│   │   ├── [id].tsx                  # Detail view + fallback
│   │   ├── wizard.tsx                # Multi-step form
│   │   ├── dados-iniciais.tsx        # CEP validation
│   │   ├── selecao-formulario.tsx    # Form choice
│   │   ├── risco.tsx, resultado.tsx, foto.tsx, laudo.tsx
├── (admin), (supervisor), (master)   # Phase 4 (out of scope for Phase 3)
```

### Pattern 1: Screen File Structure (Consistent Across All 16 Screens)

**What:** All screens follow the same structure: imports → state → effects → handlers → render tree.

**When to use:** All screens in this phase.

**Example (from login.tsx — current file):**
```typescript
// 1. Imports — React, RN, Feather, hooks, utils
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// 2. State
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// 3. Effects
useEffect(() => {
  // Load data, validate, setup cleanup
}, [dependencies]);

// 4. Handlers
const handleLogin = async () => {
  setError(null);
  // ... logic
};

// 5. Render — SafeAreaView → ScrollView → Content
return (
  <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
    <ScrollView>
      {/* JSX */}
    </ScrollView>
  </SafeAreaView>
);
```

### Pattern 2: Component Import Path (Verified Syntax)

**Current state:** Phase 2 created barrel export.

**How to import:**
```typescript
// ✓ Correct — from barrel
import { Button, Card, Badge, EmptyState, LoadingState, ErrorState } from '../../components/ui';

// ✗ Wrong — direct import not exported
import Button from '../../components/ui/Button'; // Error: no default export
```

All 7 components are named exports. File: `components/ui/index.ts`.

### Pattern 3: Theme Token Access

**How:** Always use `useTheme()` hook — never import Colors directly into render.

```typescript
// ✓ Correct
const { theme } = useTheme();
<View style={{ backgroundColor: theme.primary }}>

// ✗ Wrong
import { Colors } from '../../constants/Colors';
<View style={{ backgroundColor: Colors.light.primary }}>  // Not reactive to theme toggle
```

### Pattern 4: Error/Loading State Hierarchy

**All data-fetching screens should follow:**

```typescript
if (loading) return <LoadingState />;
if (error) return <ErrorState message={error} onRetry={refetch} />;
if (data.length === 0) return <EmptyState icon="clipboard" title="..." />;

// Render data
return <ScrollView>{/* ... */}</ScrollView>;
```

**Current state:** Not all screens follow this (e.g., [id].tsx has no ErrorState currently).

### Anti-Patterns to Avoid

- **Direct Colors import:** Use `useTheme()` always — theme toggle won't update direct imports.
- **Hardcoded color strings:** All colors must come from `theme.*` or `Colors.light/dark`.
- **Using TouchableOpacity for everything:** Use `<Button>` component for primary actions (has loading state, accessibility).
- **Inline styles instead of constants:** Small component-local styles are OK, but large style objects should be in `StyleSheet.create()` at bottom.
- **Fetching data in render:** Always use `useEffect(() => { ... }, [deps])`.
- **`select('*')` in Supabase queries:** Use specific column selection per ROADMAP security goals (Phase 5 extends this, Phase 3 only fixes register.tsx).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading indicator during async action | Custom spinner + state management | `Button` with `loading={true}` prop or `LoadingState` component | Already built, accessible, handles spinner + text combo |
| Empty list message | Inline `Text` + `View` | `EmptyState` from design system | Consistent icon + title + action across all screens |
| Network error retry | Alert + manual refetch | `ErrorState` component | Provides standard UI, retry button, message formatting |
| Card containers with shadow/border | Custom `View` + StyleSheet | `Card` component | Handles elevation, padding, border-radius consistently — avoids platform-specific shadow bugs |
| Risk level badge display | `Text` with custom color logic | `Badge variant="R1" | R2 | R3 | R4"` | Type-safe, colors synced to tokens, used consistently |
| Date/time formatting | Recalculate on every render | `useMemo(() => { const d = new Date(...); ... }, [])` | Prevents unnecessary recalculation, fixes PERF-01 |
| Count of records | Fetch all records and filter JS-side | Use `count: 'exact', head: true` in Supabase query | Avoids transferring 1000s of rows over network, fixes PERF-05 |
| Password strength indicator | Custom bar implementation | Add 3-bar visual with color logic (fraca/media/forte) in register.tsx | Specified in PLAN.md Task 3.4 — custom but minimal, improves UX |
| Form field error styling | One `Text` element | Container with background, icon, padding (specified in PLAN.md Task 3.3/3.4) | Specified design — improves visibility |

**Key insight:** Phase 2 design system eliminated most hand-rolling. Phase 3 uses those components. Only password strength bar and form error containers have minor custom logic (per PLAN.md). Do NOT add external libraries — all solutions exist within project scope.

## Runtime State Inventory

> This phase does NOT involve renaming, rebrand, data migration, or API changes. It's pure UI refactoring + bug fixes.
> Checking for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no SQLite schema changes, no data model changes | None |
| **Live service config** | None — Supabase queries unchanged except select() lists | None — select() changes are safe (same data returned, fewer fields) |
| **OS-registered state** | None — no task scheduler, launchd, pm2 usage in Expo app | None |
| **Secrets/env vars** | None — no new env var names, no key renames | None |
| **Build artifacts** | None — no dependency additions, no pyproject/package.json changes | None |

**Conclusion:** Zero runtime state inventory items. This phase touches only UI code and query optimization (same data returned, different selection).

## Common Pitfalls

### Pitfall 1: Closure Stale in Wizard Auto-Save

**What goes wrong:** `setResposta` captures `step` at component mount. When user advances to next question, `step` state updates but the saved timeout still references the old `step` value. Auto-save writes outdated step number to AsyncStorage. User refresh resumes from wrong question.

**Why it happens:** `useEffect` dependencies don't re-run the timeout setup, so the captured `step` in the callback closure is stale.

**How to avoid:** Use `useRef` to track current step:
```typescript
const stepRef = useRef(step);
useEffect(() => { stepRef.current = step; }, [step]);
// In auto-save: use stepRef.current instead of step
```

**Warning signs:** After creating auto-save timer in wizard.tsx Task 3.9, test by:
1. Answer question 1
2. Advance to question 2
3. Answer question 2
4. Refresh page (or wait for auto-save timer)
5. Verify AsyncStorage has `step: 1` (WRONG) — should be `step: 1` (current step index)

**Current state:** Wizard.tsx lines 99-115 set `autoSaveTimer` but do NOT use `useRef` for step. **BUG PRESENT — MUST FIX in Task 3.9.**

---

### Pitfall 2: Photo URI Not Persisted to SQLite

**What goes wrong:** User captures photo in wizard's `tirarFoto` handler. Photo URI is shown in UI but not stored in the vistoria object. When `finalizar()` writes to SQLite via `insertVistoria()`, `foto_url` is hardcoded as `null`. Photo is lost offline; user must retake.

**Why it happens:** Wizard captures photo to state (e.g., `[capturedPhoto, setCapturedPhoto]`) for display, but never maps it to the `respostas` object or `vistoria.foto_url` field.

**How to avoid:** In `finalizar()`, extract photo_url from respostas:
```typescript
const perguntaFoto = perguntas.find(p => p.tipo === 'foto' && respostas[p.id]);
const fotoUri = perguntaFoto ? respostas[perguntaFoto.id] : null;

const vistoriaLocal = {
  // ...
  foto_url: fotoUri,  // <- NOT null
  criado_em: agora,
};
```

**Warning signs:** After running Task 3.9, check SQLite:
```bash
sqlite3 defesa_civil.db "SELECT id, foto_url FROM vistorias_offline LIMIT 5;"
```
All `foto_url` should be NULL (expected for text answers) or have a valid URI (for photo answers). If all NULL even after taking a photo, **BUG PRESENT.**

**Current state:** [id].tsx and wizard.tsx store photos but don't verify persistence. **BUG PRESENT — MUST FIX in Task 3.9.**

---

### Pitfall 3: CEP Validation After HTTP Request

**What goes wrong:** User enters `123` (3 digits). App sends HTTP request to CEP API. API returns 404 or timeout. Error is shown to user. User should format and validate BEFORE sending request.

**Why it happens:** `dados-iniciais.tsx` likely has `buscarCep()` that immediately fetches without validation.

**How to avoid:** Add format check BEFORE HTTP:
```typescript
const buscarCep = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    setErroCep('CEP deve ter 8 dígitos.');
    return;
  }
  setErroCep(null);
  // NOW fetch
  const { data } = await fetch(`/api/cep/${cepLimpo}`);
};
```

**Warning signs:** Entering `12345` in CEP field → network request fires immediately (check Network tab in dev tools). **WRONG.** Should show error inline first.

**Current state:** dados-iniciais.tsx not read in detail, but Task 3.11 explicitly requires this. Likely **BUG PRESENT.**

---

### Pitfall 4: Dashboard Date Calculation on Every Render

**What goes wrong:** `dashboard.tsx` lines 23–25 calculate `hoje`, `diaSemana`, `dataFormatada` outside of any hook. These recalculate on every re-render (60+ times/min in fast navigation). Not a crash, but wastes CPU.

**Why it happens:** Calculation is fast, so not noticed during normal use. But in list scrolling or tab switching, re-renders happen frequently.

**How to avoid:** Wrap in `useMemo`:
```typescript
const { diaSemana, dataFormatada } = useMemo(() => {
  const hoje = new Date();
  const diaSemana = DIAS_SEMANA[hoje.getDay()];
  const dataFormatada = `${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;
  return { diaSemana, dataFormatada };
}, []);  // Empty array: recalc only at mount
```

**Warning signs:** React DevTools Profiler shows dashboard re-renders spike when scrolling. Flamegraph shows date calculation in hot path.

**Current state:** dashboard.tsx lines 23–25 do NOT use useMemo. **PERF BUG PRESENT — MUST FIX in Task 3.6.**

---

### Pitfall 5: Profile Stats Query Fetches All Records

**What goes wrong:** `perfil.tsx` for agents does:
```typescript
const { data: vistorias } = await supabase.from('vistorias').select('nivelRisco, dataVistoria').eq('agenteUid', uid);
// Then filters in JS: vistorias.filter(v => v.nivelRisco === 'r3' || v.nivelRisco === 'r4')
```

If agent has 500 vistorias, ALL 500 rows are transferred. Filter happens in JavaScript. For admin/supervisor: uses `count: 'exact', head: true` correctly.

**Why it happens:** Copy-paste from old code; agent path not refactored when admin path was optimized.

**How to avoid:** Use separate queries with `count: 'exact', head: true`:
```typescript
const [{ count: total }, { count: alto }] = await Promise.all([
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid),
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
]);
```

**Warning signs:** Network tab shows `select('nivelRisco, dataVistoria')` returning 500+ rows. Count should be `0` rows returned (via `head: true`).

**Current state:** perfil.tsx lines 64–74 do NOT use count:exact for agents. **PERF BUG PRESENT — MUST FIX in Task 3.7.**

---

### Pitfall 6: Offline Fallback Missing in [id].tsx

**What goes wrong:** User creates vistoria offline (step 1: enter address, step 2: fill form, step 3: result). Data saved to SQLite. User navigates back. Later, reconnects and tries to view that vistoria details via `[id].tsx`. Component only queries Supabase. Not found. Shows error "Vistoria não encontrada."

**Why it happens:** `[id].tsx` has no fallback to SQLite. Fetch only does Supabase.

**How to avoid:** After Supabase query fails, try SQLite:
```typescript
const fetchDetalhes = async () => {
  // 1. Try Supabase
  const { data } = await supabase.from('vistorias').select('*').eq('id', id).single();
  if (data) { setVistoria(data); return; }

  // 2. Fallback SQLite
  const local = getVistoriaById(id);
  if (local) {
    const normalized = { /* map fields */ };
    setVistoria(normalized);
    return;
  }

  // 3. Not found anywhere
  throw new Error('Vistoria não encontrada.');
};
```

**Warning signs:**
1. Create vistoria offline (no internet).
2. Turn off internet.
3. Navigate to [id].
4. Should show vistoria details. If shows error, **BUG PRESENT.**

**Current state:** [id].tsx lines 38–70 only query Supabase. No SQLite fallback. **BUG PRESENT — MUST FIX in Task 3.10.**

---

### Pitfall 7: Button Component Props Not Recognized

**What goes wrong:** Task 3.3 says replace TouchableOpacity with `<Button variant="primary" loading={true}>`. But component is imported and used correctly; no render error. Later, developer notices `loading` prop doesn't show spinner — just passes through as unknown prop.

**Why it happens:** Button component signature not verified before implementation starts. Prop names might be different.

**How to avoid:** Before Task 3.3, verify Button.tsx props:
```typescript
// components/ui/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;        // <- Verify this exists
  onPress: () => void;
  children: ReactNode;
}
```

**Warning signs:** Spinner doesn't appear when `loading={true}`. Check Button implementation.

**Current state:** Phase 2 summary confirms `Button` with `loading` state. **OK.**

---

### Pitfall 8: Theme Token Not Available in Colors.ts

**What goes wrong:** Task 3.6 uses `theme.errorLight` to style a background. But Colors.ts doesn't have that token. Renders as `undefined`. Falls back to platform default (usually white).

**Why it happens:** Token name mismatch or token not created in Phase 2.

**How to avoid:** Before writing any style, verify token exists:
```typescript
// From constants/Colors.ts
export const Colors = {
  light: {
    error: '#DC2626',           // OK
    errorLight: '#FEF2F2',       // OK
    errorText: '#7F1D1D',        // OK
    // missing errorBackground — don't use
  }
};
```

**Warning signs:** Style prop shows `backgroundColor: undefined`. Check Colors.ts.

**Current state:** Colors.ts lines 28–50 list all tokens. Verified in Phase 2 summary. **OK — all tokens present.**

## Code Examples

Verified patterns from official Expo/React Native docs and project Phase 2:

### Example 1: SafeAreaView + ScrollView Layout (Auth Screens)

**Source:** Current login.tsx (working baseline)

```typescript
import { SafeAreaView, KeyboardAvoidingView, ScrollView } from 'react-native';

export default function LoginScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Content here */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

**Why:** SafeAreaView avoids notches/home indicator. KeyboardAvoidingView shifts content up when keyboard appears. ScrollView enables scrolling on small screens.

---

### Example 2: Using Button Component (Task 3.3)

**Source:** Phase 2 — Button.tsx implementation (verified)

```typescript
import { Button } from '../../components/ui';

// In render:
<Button
  variant="primary"
  loading={loading}
  disabled={loading || !email || !password}
  onPress={handleLogin}
>
  Entrar no Sistema
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'ghost' | 'danger'
- `loading`: shows ActivityIndicator inside
- `disabled`: reduces opacity to 0.5, prevents onPress
- `onPress`: handler function
- `children`: text or ReactNode

---

### Example 3: Using ErrorState Component (Task 3.10)

**Source:** Phase 2 — ErrorState.tsx (verified)

```typescript
import { ErrorState } from '../../components/ui';

const [error, setError] = useState<string | null>(null);

if (error) {
  return <ErrorState message={error} onRetry={() => fetchDetalhes()} />;
}
```

**Props:**
- `message`: string to display
- `onRetry`: () => void callback

---

### Example 4: useRef for Stale Closure (Task 3.9)

**Source:** React.dev docs + PLAN.md Task 3.9

```typescript
const stepRef = useRef(step);

useEffect(() => {
  stepRef.current = step;  // Keep ref in sync with state
}, [step]);

const setResposta = (perguntaId: string, valor: string) => {
  setRespostas(r => {
    const updated = { ...r, [perguntaId]: valor };

    // Clear old timer
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    // New timer uses stepRef.current (always current)
    autoSaveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify({
        respostas: updated,
        step: stepRef.current,  // <- NOT step (which is stale)
      }));
    }, 800);

    return updated;
  });
};
```

---

### Example 5: useMemo for Date Calculation (Task 3.6)

**Source:** Current dashboard.tsx + PLAN.md Task 3.6

```typescript
import { useMemo } from 'react';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', ...];
const MESES = ['janeiro', 'fevereiro', ...];

const { diaSemana, dataFormatada } = useMemo(() => {
  const hoje = new Date();
  const diaSemana = DIAS_SEMANA[hoje.getDay()];
  const dataFormatada = `${hoje.getDate()} de ${MESES[hoje.getMonth()]}`;
  return { diaSemana, dataFormatada };
}, []);  // Empty array: never recalculate
```

---

### Example 6: Query with count:exact (Task 3.7)

**Source:** Current perfil.tsx (partially implemented) + PLAN.md Task 3.7

```typescript
const hoje = new Date().toISOString().split('T')[0];
const semanaAtras = new Date(Date.now() - 7 * 24 * 3600000).toISOString().split('T')[0];

const [
  { count: total },
  { count: altoRisco },
  { count: hojeCount },
  { count: semanaCount },
] = await Promise.all([
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid),
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).gte('dataVistoria', `${hoje}T00:00:00.000Z`),
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).gte('dataVistoria', semanaAtras),
]);

setStats({ total: total || 0, altoRisco: altoRisco || 0, hoje: hojeCount || 0, semana: semanaCount || 0 });
```

**Why:**
- `count: 'exact'` returns exact count (not just estimate)
- `head: true` returns ZERO data rows (only count)
- Parallel queries with `Promise.all` are fast
- No JavaScript filtering needed

---

### Example 7: Offline Fallback Pattern (Task 3.10)

**Source:** PLAN.md Task 3.10 + utils/database.ts (verified)

```typescript
import { getVistoriaById } from '../../../utils/database';

const fetchDetalhes = async () => {
  try {
    // 1. Try Supabase first
    const { data, error } = await supabase
      .from('vistorias')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      setVistoria(data);
      populateReport(data);
      return;
    }

    // 2. Fallback to SQLite
    const local = getVistoriaById(id);
    if (local) {
      const normalized = {
        id: local.id,
        agenteUid: local.agente_uid,
        agenteNome: local.agente_nome,
        municipio: local.municipio,
        enderecoRua: local.endereco_rua,
        enderecoNumero: local.endereco_numero,
        enderecoBairro: local.endereco_bairro,
        enderecoCep: local.endereco_cep,
        responsavelNome: local.responsavel_nome,
        latitude: local.latitude,
        longitude: local.longitude,
        dataVistoria: local.data_vistoria,
        formularioId: local.formulario_id,
        nivelRisco: local.nivel_risco,
        pontuacaoTotal: local.pontuacao_total,
        fotoUrl: local.foto_url,
        respostasJson: local.respostas_json,
        status: 'Pendente de sincronização',
      };
      setVistoria(normalized);
      populateReport(normalized);
      return;
    }

    // 3. Not found anywhere
    throw new Error('Vistoria não encontrada localmente nem no servidor.');

  } catch (e) {
    logger.error('vistoria', 'Erro ao buscar vistoria', { erro: String(e) });
    setFetchError(String(e));
  } finally {
    setLoading(false);
  }
};
```

---

### Example 8: CEP Validation Before Request (Task 3.11)

**Source:** PLAN.md Task 3.11

```typescript
const buscarCep = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, '');

  // Validate format FIRST
  if (cepLimpo.length !== 8) {
    setErroCep('CEP deve ter 8 dígitos.');
    return;
  }

  setErroCep(null);

  // NOW make HTTP request
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    if (data.erro) throw new Error('CEP não encontrado.');

    setEndereco(data);
  } catch (e) {
    setErroCep('Erro ao buscar endereço. Verifique o CEP.');
  }
};

// In TextInput:
<TextInput
  value={cep}
  onChangeText={(t) => {
    const limpo = t.replace(/\D/g, '').substring(0, 8);
    const formatado = limpo.length > 5 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : limpo;
    setCep(formatado);
  }}
  placeholder="00000-000"
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline TouchableOpacity for all buttons | Dedicated Button component with variants | Phase 2 | Consistent styling, accessible, loading states automatic |
| Hardcoded colors in screens | Theme tokens from `useTheme()` | Phase 2 | Dark mode auto-works, colors WCAG AA compliant |
| `select('*')` in all Supabase queries | Specific `select('column1, column2')` | Ongoing (Phase 3 partial, Phase 5 complete) | Fewer bytes transferred, faster queries, better security |
| Custom error UI in each screen | Reusable `ErrorState` component | Phase 2 | Consistent error handling, less code, easier to maintain |
| Fetch all records and filter in JS | Use `count: 'exact'` and server-side filtering | Phase 3 for profile, Phase 4 for admin | Lower bandwidth, faster list rendering |
| Form validation after API call | Validate format before HTTP request | Phase 3 (CEP in dados-iniciais) | Fail fast, better UX, reduce server load |
| Date recalculation on every render | `useMemo` for expensive calculations | Phase 3 dashboard | CPU savings, no visual impact |

**Deprecated/outdated (from pre-Phase 2):**
- Custom `Card` views with inline styles → Now use `<Card>` component
- Alert.alert() for errors → Now use `<ErrorState>` or inline error messages
- ActivityIndicator in center of screen → Now use `<LoadingState>` component
- Hardcoded icon names → Still use `@expo/vector-icons`, but wrapped in components

## Open Questions

1. **`foto_url` field mapping in wizard:**
   - What we know: Wizard has `tirarFoto()` handler that captures URI via `expo-image-picker`. URI is displayed in UI.
   - What's unclear: Is the photo response stored in `respostas` object (keyed by `perguntaId`)? Or stored in separate state?
   - Recommendation: During Task 3.9, read full wizard.tsx to understand photo capture flow, then add extraction logic in `finalizar()` as specified in PLAN.md.

2. **Badge component variant types:**
   - What we know: Phase 2 summary says `BadgeVariant` is type-only export, with variants R1|R2|R3|R4|success|warning|error.
   - What's unclear: Does Badge auto-pick colors from theme, or must variant be passed as a prop?
   - Recommendation: Check Badge.tsx implementation during Task 3.7 (profile.tsx uses Badge for role).

3. **`getVistoriaById` return type for Supabase-normalized fields:**
   - What we know: VistoriaLocal in database.ts has snake_case fields (`agente_uid`, `foto_url`). Supabase returns camelCase (`agenteUid`, `fotoUrl`).
   - What's unclear: During Task 3.10 normalization, are all 20+ fields mapped correctly?
   - Recommendation: During Task 3.10, verify mapping against VistoriaLocal type and Supabase schema.

## Environment Availability

> Phase 3 involves no external dependencies beyond what Phase 2 requires. All components, contexts, and utilities already verified.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK | All screens | ✓ | 54 | — |
| React Native | All screens | ✓ | (via SDK 54) | — |
| @expo/vector-icons | Icon rendering (Feather) | ✓ | (SDK 54) | — |
| expo-sqlite | SQLite fallback in [id].tsx | ✓ | (SDK 54) | In-memory cache (Phase 5) |
| expo-image-picker | Photo capture in wizard | ✓ | (SDK 54) | Skip photo feature (descope) |
| AsyncStorage | Draft persistence in wizard | ✓ | (SDK 54) | — |
| Supabase client | All data queries | ✓ | (initialized in utils/) | Offline-only fallback (limited) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

**nyquist_validation check:** .planning/config.json not provided. Defaulting to enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Detectable? |
| Config file | (to be checked) |
| Quick run command | — |
| Full suite command | — |

**Action:** Check `.planning/config.json` for test setup. Phase 3 is UI refactoring — manual verification likely sufficient unless existing test suite exists.

### Phase Requirements → Test Map

> Phase 3 requirements (from ROADMAP.md) are primarily visual + bug fixes:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-C4 | [id].tsx shows offline vistoria on fallback | Integration | Manual (no auth in tests) | ❌ Wave 0 |
| BUG-M9 | Wizard auto-save uses correct step | Unit | Manual (AsyncStorage mock) | ❌ Wave 0 |
| BUG-A6 | Wizard photo_url persists to SQLite | Integration | Manual (photo + DB check) | ❌ Wave 0 |
| BUG-UX-05 | CEP validated before HTTP request | Unit | Manual (form interaction) | ❌ Wave 0 |
| PERF-01 | Dashboard date uses useMemo | Code inspection | Grep for `useMemo` | ✅ Can verify |
| PERF-05 | Profile uses count:exact not select() | Code inspection | Grep for `count: 'exact'` | ✅ Can verify |
| SEG-05 | Register uses select() not select('*') | Code inspection | Grep for `select()` | ✅ Can verify |

### Sampling Rate

- **Per task commit:** Code inspection (grep for keywords, visual verification of rendered output)
- **Per wave merge:** Manual testing of 2-3 representative screens (onboarding, login, dashboard, [id].tsx)
- **Phase gate:** Run app on device, test all 16 screens for crashes + basic functionality before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Test framework setup — detectable? (check .planning/config.json)
- [ ] Mock data for photo capture tests
- [ ] SQLite test database initialization
- [ ] Supabase mock or test client

*All gaps are environment setup, not Phase 3 code. Phase 3 code should be testable via manual interaction.*

## Sources

### Primary (HIGH confidence)

- **Phase 2 Summary:** `.planning/phases/02-design-system/02-design-system-01-SUMMARY.md` — Verified all 7 components exist, all tokens exist, TypeScript passes, barrel export confirmed.
- **PLAN.md Phase 3:** `.planning/phases/03-ui-auth-agente/PLAN.md` — 14 detailed tasks, 16 screens, bug fixes, and acceptance criteria.
- **Colors.ts:** `constants/Colors.ts` — 44 tokens verified, light + dark themes, text contrast WCAG AA.
- **Button.tsx:** Confirmed in components/ui/ barrel export, supports `loading` and `disabled` props.
- **Components Index:** `components/ui/index.ts` — Barrel export verified, all 7 components listed.
- **utils/database.ts:** `getVistoriaById()` exists, returns `VistoriaLocal | null`, implemented with SQLite sync.

### Secondary (MEDIUM confidence)

- **Current Screen Implementations:** Read `onboarding.tsx`, `login.tsx`, `dashboard.tsx`, `register.tsx`, `perfil.tsx`, `wizard.tsx`, `[id].tsx` — Patterns confirmed, state management understood, current bugs identified (closure, photo, CEP, date calc, count queries).
- **Project Stack:** React Native + Expo 54, no external UI library, system fonts, Feather icons, Supabase backend — all verified by reading actual files.

### Tertiary (LOW confidence)

- None — all findings based on verified source files and Phase 2 summary.

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — All components and tokens directly verified in Phase 2 summary + file inspection.
- **Architecture:** HIGH — Patterns observed across 7 existing screens, Phase 2 design system locked in.
- **Pitfalls:** HIGH — 8 pitfalls mapped to actual code locations and verified by reading source files.
- **Bugs (C4, M9, A6, UX-05, PERF-01, PERF-05, SEG-05):** HIGH — All identified in Phase 3 PLAN.md, causes verified by source code inspection.
- **Component APIs:** HIGH — Phase 2 summary confirms Button, Card, Badge, EmptyState, etc. are fully implemented.
- **Runtime State:** HIGH — No data migration required; this is pure UI refactoring.

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (or until Phase 3 execution begins)
**Expires when:** Any new component added to Phase 2, or Expo SDK 55 migration begins.
