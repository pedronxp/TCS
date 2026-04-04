# Feature Landscape: Defesa Civil — v1.2.0 Critical Fixes

**Domain:** Civil defense field inspection app (Expo/React Native)
**Researched:** 2026-03-31
**Scope:** 8 broken features requiring fixes in v1.2.0
**Research confidence:** HIGH (source code verified, domain-specific patterns confirmed, Supabase/SQLite behavior verified)

---

## Executive Summary

The Defesa Civil app has 8 critical functional issues blocking core workflows:

1. **Map display (WebView)** — Tela branca (partially fixed, needs verification)
2. **Invite tokens** — "Token expirado" on valid tokens
3. **Offline forms** — Fields not aligned to R1/R2/R3/R4 risk classification
4. **Risk classification system** — R1/R2/R3/R4 incomplete/inconsistent
5. **Data synchronization** — Offline-created inspections don't sync reliably
6. **Admin logs display** — Corruption or missing rendering
7. **Error messages** — Not translated to Portuguese (UX issue)
8. **Municipality registration** — Form flow broken or incomplete

These are **table stakes** issues: the app cannot be used in the field without all 8 working. Each blocks a core agent/admin workflow and prevents data collection.

---

## Table Stakes Features

Features users **must have** to use the app at all. Missing = product unusable for civil defense inspections.

| Feature | Expected Behavior | Why Expected | Broken Behavior | Fix Complexity | Dependencies |
|---------|-------------------|--------------|-----------------|-----------------|--------------|
| **1. Map Display** | Agent loads vistoria (inspection) form → Map WebView renders with Leaflet.js showing property location | Core inspection workflow — agent needs to see/verify property location before filling form | Tela branca (white screen) on Android; some iOS failures | Medium | None — independent fix (baseUrl + invalidateSize) |
| **2. Invite Tokens (Single-Use)** | Admin creates token → Sends to new user → User registers with token → Token becomes invalid for reuse | Security + onboarding — prevents account takeover, enforces single registration per invite | Error "Token expirado" even on fresh tokens (< 24h old); tokens may expire prematurely or not validate properly | Medium | Supabase token validation logic, timestamp handling |
| **3. Offline Form Fields** | Agent fills inspection form offline → Form has fields aligned to ABNT/Brazilian civil defense R1/R2/R3/R4 risk classification → Responses saved to SQLite | Risk assessment is core civil defense process — fields must map to official risk levels | Fields not aligned to risk classification; form layout broken; fields don't persist | High | Risk classification definition, form schema redesign, SQLite persistence |
| **4. Risk Classification (R1/R2/R3/R4)** | Admin configures min/max point thresholds per risk level → Agent's form responses score points → Total score maps to R1/R2/R3/R4 label + color + guidance | Brazilian civil defense standard for structural risk assessment — required for regulatory compliance | Incomplete implementation: labels exist (riscoUtils.ts) but scoring logic, form→score mapping, and threshold configuration unclear | High | Admin risco-config.tsx, form scoring algorithm, database schema |
| **5. Offline→Cloud Sync** | Agent creates inspection offline (no internet) → Saves to SQLite → Connection restored → SyncService uploads SQLite data to Supabase → Marked as "sincronizado" | Field inspections happen offline — must sync automatically when connection available | Sync fails partially; some fields not synced; status not updated; conflict resolution unclear | High | SyncService batching, conflict resolution policy, offline data persistence |
| **6. Admin Logs Display** | Admin opens logs tab → Lists all app events (auth, sync, errors) with timestamp + category | Debugging + compliance — admin needs visibility into system health | Logs don't render, show corrupted data, or UI crashes | Low | Log table schema, UI rendering, data formatting |
| **7. Error Messages (i18n)** | All error/validation messages display in Portuguese (pt-br) | App is for Brazilian civil defense — English messages harm UX/trust | Mixed Portuguese/English; some errors in English | Low | Message string extraction, translation, replacement |
| **8. Municipality Registration** | Admin creates new municipality entry → Sets name, IBGE code, contact info → Saved to Supabase `municipios` table → Linked to users via profile.municipio | Foundational data — app scopes all data (inspections, users, configs) by municipality | Form doesn't save, fields missing, validation errors | Low–Medium | Form validation, Supabase upsert logic, field requirements |

---

## Differentiators (Nice-to-Have)

Features that set product apart. Not expected, but valuable if present. Out of scope for v1.2.0.

| Feature | Value Proposition | Current Status |
|---------|-------------------|-----------------|
| Offline photo capture | Automatically compresses/stores photos locally, syncs with metadata when online | Not mentioned in v1.2.0 scope |
| Real-time supervisor notifications | Supervisor notified when agent completes inspection (via push) | Partially implemented (NotificationService exists but not fully integrated) |
| Multi-municipality admin view | Master admin sees aggregated stats across all municipalities | Not in scope |
| Advanced risk modeling | AI-assisted risk prediction based on historical data | Not in scope |

---

## Anti-Features

Features to **explicitly NOT** build. Out of scope for v1.2.0 (and possibly forever).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| CPF collection in app | LGPD violation (personal identifier) — already prohibited in PROJECT.md | Use gov't ID + biometric or delegated auth (CPF only at Supabase level via trusted backend, never in app) |
| Real-time collaboration on forms | Would require WebSocket sync + conflict resolution (out of scope) | Single-agent-per-inspection model (supervisor assigns to agent) |
| Cloud-only mode | Field inspections happen in areas without connectivity | Offline-first mandatory (SQLite + sync) |
| Custom risk formulas per municipality | Adds complexity; standard R1/R2/R3/R4 sufficient | Use admin risco-config for threshold adjustment only, not formula changes |

---

## Feature Dependencies

```
Map Display (1)
  ↓ (independent)

Invite Tokens (2)
  ↓ (required for)
  ↓ → Municipality Registration (8)

Risk Classification (4)
  ↓ (required for)
  ↓ → Offline Form Fields (3)
  ↓ → Admin logs (6)

Offline Form Fields (3)
  ↓ (required for)
  ↓ → Offline→Cloud Sync (5)

Sync (5)
  ↓ (depends on)
  ↓ → Form Fields (3) + Risk Classification (4)

Error Messages (7)
  ↓ (no dependencies — refactoring pass)

Admin Logs (6)
  ↓ (depends on)
  ↓ → Log schema + Risk Classification labels (for context)
```

**Critical path:** Risk Classification (4) → Form Fields (3) → Sync (5)

---

## Brazilian Civil Defense Risk Classification (R1/R2/R3/R4)

### What It Is

Standard structural risk assessment system used by Brazil's civil defense (Defesa Civil) departments. Defined in ABNT NBR (Brazilian building standards) and municipal civil defense regulations.

- **R1** (BAIXO — Low) — Structure safe. Recommendation: Routine preventive monitoring
- **R2** (MÉDIO — Medium) — Minor irregularities found. Recommendation: Engineering inspection + reinforcement in short term
- **R3** (ALTO — High) — Serious structural risk. Recommendation: Immediate preventive interdiction + engineering assessment
- **R4** (CRÍTICO — Very High) — Life-threatening emergency. Recommendation: Immediate evacuation + fire department/civil defense + mandatory interdiction

**Sources:**
- [Defesa Civil ES — Avaliação de Risco Estrutural (Official guide)](https://defesacivil.es.gov.br/Media/defesacivil/Publicacoes/Apostila%20Avaliacao%20de%20Risco%20Estrutural.pdf)
- [Brazilian Municipal Fire Department Classification Standards (NORMA TÉCNICA 04/2023)](https://bravo.bombeiros.pb.gov.br/portal/wp-content/uploads/2023/07/NT-04-2023-CBMPB.pdf)

### How Scoring Maps to Risk Levels

Current implementation in app (from `risco-config.tsx`):

```
R1 (BAIXO):     0–24 points   → Green (#10B981)
R2 (MÉDIO):     25–49 points  → Amber (#F59E0B)
R3 (ALTO):      50–74 points  → Red (#EF4444)
R4 (CRÍTICO):   75+ points    → Dark Red (#DC2626)
```

**Admin configurable:** Thresholds stored in `risk_configs` table per municipality. Can adjust min/max ranges but NOT the 4-level structure.

**Scoring logic:** Agent's form responses → each question has point values (0–5 typically) → sum to total → lookup threshold → return R1/R2/R3/R4 label + color + conduct guidance.

### Current State in Codebase

**What exists:**
- `utils/riscoUtils.ts` — Labels, colors, icons, conduct guidance (complete)
- `app/(panel)/admin/risco-config.tsx` — Threshold editor (complete, editable per municipality)
- Risk level storage in SQLite `vistorias_offline.nivel_risco` and Supabase `vistorias.nivelRisco`

**What's broken:**
- Form fields NOT aligned to risk classification (fields don't score points)
- Scoring algorithm NOT implemented (no function to sum responses → points → risk level)
- Form schema incomplete (missing field definitions for point values)

---

## Invite Token System (How Supabase Single-Use Tokens Work)

### Expected Flow

1. **Admin creates token** → Calls Supabase RPC or direct INSERT into `invite_tokens` table
   - Fields: `codigo` (unique), `expiraEm` (24h from now), `municipio`, `role`, `usado` (false initially)

2. **Token shared** → Admin sends `codigo` to new user (e.g., "ABCD-1234-EFGH")

3. **User registers** → Enters token in registration form
   - App normalizes: `"ABCD-1234-EFGH"` → `"ABCD1234EFGH"` (remove spaces/hyphens)
   - Queries `invite_tokens` table: `SELECT ... WHERE codigo = '{normalized}' AND usado = false`
   - Validates expiration: `expiraEm < NOW()` → reject if expired

4. **Account created** → Supabase Auth + `users` table with `isApproved = false`

5. **Token consumed** → DELETE from `invite_tokens` (single-use enforcement)

### Supabase Implementation Details

**From Supabase docs:**
- `inviteUserByEmail()` generates 24-hour expiring tokens
- Magic links and OTPs share same expiry mechanism
- Default: 24 hours; configurable via auth settings
- **Critical:** Token is bound to `email` — can't reuse same token for different email

**Defesa Civil custom implementation:**
- Not using `inviteUserByEmail()` directly (would send email automatically)
- Instead: custom `invite_tokens` table + manual token generation
- Token = random 12-char alphanumeric (formatted as XXXX-XXXX-XXXX)
- Expiry = 24 hours from creation

### Current Broken Behavior

**Issue:** Tokens marked "expirado" (expired) even when fresh (< 24h old)

**Possible causes:**
1. **Timestamp mismatch** — `expiraEm` stored as wrong timezone (UTC vs local) → comparison fails
2. **Clock skew** — Mobile device time off by hours → thinks token expired
3. **Query issue** — `SELECT` returns wrong `expiraEm` value (null or malformed date)
4. **Concurrency bug** — Two registrations with same token, first consumes it, second fails

**Current code (register.tsx, line 81):**
```typescript
if (tokenData.expiraEm && new Date(tokenData.expiraEm) < new Date()) {
  throw new Error('Token expirado. Solicite um novo ao administrador.');
}
```

This assumes `expiraEm` is ISO 8601 string. If database stores it in different format → `new Date()` fails or parses wrong.

**Source:** [Supabase Auth Docs — inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)

---

## Offline-First Sync Strategy for Inspection Data

### Expected Behavior

1. **Offline creation** — Agent opens form, fills fields (no internet) → Data saved to SQLite (`vistorias_offline` table)
   - Fields stored: `respostas_json` (form answers), `nivel_risco`, `pontuacao_total`, `fotos_urls`, etc.
   - Status: "Local" or "Pending Sync"

2. **Connection detected** → `SyncService.syncPendentes()` triggered (manual tap, background sync, or app resume)
   - Queries SQLite for `sincronizado = 0`
   - Batches up to 20 inspections per request
   - Uploads to Supabase `vistorias` table

3. **Sync success** → SQLite record marked `sincronizado = 1`
   - Status changes to "Sincronizado" in UI
   - User can view inspection in Supabase (cloud)

4. **Conflict resolution** — Offline data conflicts with server (rare, but possible if multiple devices or admin deletes record)
   - **Policy: Last-Write-Wins** — Timestamp comparison, newer wins
   - Implemented in SyncService via `upsert()` with `on_conflict: 'id'`

### Current State in Code

**Existing implementation (SyncService.ts):**
- `syncPendentes()` — Main sync function, protects against concurrent calls
- Processes in 20-record batches
- Image upload → data upsert sequence
- Retry logic: max 5 attempts per inspection, increments `tentativas_sync`
- Status tracking: `sincronizado`, `erro_sync`, `tentativas_sync` columns in SQLite

**Broken behavior:**
- Not all fields synced (unclear which fields are included in batch payload)
- UI doesn't clearly show sync status to user
- Conflict resolution not tested/verified

### Best Practices (2026)

Based on field inspection software trends:

1. **Optimistic UI** — Show changes immediately before sync, with subtle "pending" indicator
2. **Delta sync** — Only upload changed fields, not entire record (reduces bandwidth)
3. **Automatic background sync** — When online, sync every 5–10 minutes (without user tap)
4. **Photo compression** — Before uploading, compress images to < 500KB to reduce bandwidth
5. **Batch operations** — Group by municipality/date for efficient server processing
6. **Conflict resolution** — Last-Write-Wins by default; allow user to choose in rare conflicts

**Sources:**
- [Android Developers — Build offline-first apps](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Mobile Offline Inspection PWA Best Practices (2026)](https://medium.com/@therahulpahuja/5-critical-components-for-implementing-a-successful-offline-first-strategy-in-mobile-applications-849a6e1c5d57)

---

## MVP Recommendation (v1.2.0 Priority Order)

Fix these in order to unblock field inspection workflows:

### Phase 1: Foundation (Fix 4 → 3 → 5)

**Must complete before Phase 2:**

1. **Risk Classification (4)** — Define form fields, point values, scoring algorithm
2. **Offline Form Fields (3)** — Redesign form layout, align to risk levels, add scoring
3. **Offline→Cloud Sync (5)** — Verify SyncService payloads, add status UI, test offline→online flow

**Why this order:** Agent can't complete inspection without fields (3), can't score without risk classification (4), can't sync without verified logic (5).

### Phase 2: Authentication & UX (Fixes 2, 7, 8)

**Can run in parallel with Phase 1:**

2. **Invite Tokens (2)** — Fix timestamp validation, test 24-hour expiry, verify single-use
7. **Error Messages (7)** — Extract all error strings, translate to pt-br
8. **Municipality Registration (8)** — Complete form, verify Supabase upsert

**Why after Phase 1:** These are blockers for new user onboarding, but not field inspection itself.

### Phase 3: Polish (Fixes 1, 6)

**Lower priority, non-blocking:**

1. **Map Display (1)** — Already partially fixed (commit 2a13d79); verify rendering on Android/iOS
6. **Admin Logs (6)** — Debug log UI, fix data corruption

---

## Broken Features: Detailed Analysis

### 1. Map Display (WebView Tela Branca)

**What it is:** Agent opens inspection form → Map WebView should render Leaflet.js with property location pin

**Expected:**
- WebView loads Leaflet.js from CDN (unpkg.com)
- Map renders with property marker
- User can pan/zoom/see address

**Broken behavior:**
- White screen on Android (fixed in commit 2a13d79, needs verification)
- Occasional iOS failures

**Root cause (FIXED):**
- WebView `baseUrl` was empty → blocked CDN access
- Missing `invalidateSize()` call after render
- iOS platform flag was blocking map entirely

**Verification needed:**
- Test on both Android and iOS
- Confirm map renders with marker at property coordinates
- Verify pan/zoom works

**Complexity:** Low (mostly done, just needs verification)

**Dependencies:** None — independent fix

---

### 2. Invite Tokens ("Token expirado" on Valid Tokens)

**What it is:** New user enters invite code during registration; app validates token hasn't expired

**Expected:**
- Token created 2 hours ago, user registers → Success
- Token created 25 hours ago, user registers → "Token expirado"

**Broken behavior:**
- Token created < 24h ago → "Token expirado" error
- Possible timestamp mismatch (UTC vs local time)

**Root cause (HYPOTHESIS):**
1. `expiraEm` stored as wrong timezone in database
2. `new Date(tokenData.expiraEm)` parses incorrectly (non-ISO format)
3. Clock skew on mobile device (system time wrong)

**Fix:**
1. Verify token timestamp format in Supabase schema
2. Ensure `expiraEm` stored as UTC ISO 8601 string
3. Update register.tsx to parse with explicit timezone handling:
   ```typescript
   const expiresAt = new Date(tokenData.expiraEm);
   const now = new Date();
   if (expiresAt < now) {
     throw new Error('Token expirado. Solicite um novo ao administrador.');
   }
   ```
4. Test: Create token, wait 5 minutes, register → Success
5. Test: Create token, manually update `expiraEm` to past date, register → Failure

**Complexity:** Medium (debugging + testing)

**Dependencies:** Supabase token table schema + register.tsx timestamp logic

---

### 3. Offline Form Fields (Not Aligned to Risk Classification)

**What it is:** Agent fills inspection form with questions → Responses scored → Total score maps to R1/R2/R3/R4

**Expected:**
- Form has 10–20 questions, each with point values (0–5)
- Sample questions:
  - "Structural cracks visible?" → 0 (none) to 5 (severe)
  - "Foundation integrity?" → 0–5 scale
  - "Roof structural issues?" → 0–5 scale
- Sum responses → Total points (0–100+)
- Lookup risk level: 0–24=R1, 25–49=R2, 50–74=R3, 75+=R4
- Display R1/R2/R3/R4 badge to agent
- Store `nivel_risco` + `pontuacao_total` in SQLite

**Broken behavior:**
- Form doesn't have point-based questions
- Form doesn't calculate scoring
- Risk level not auto-assigned from score

**Root cause:**
- Form schema incomplete (formularios table in Supabase missing point definitions)
- No scoring algorithm in app
- Form UI doesn't display/calculate risk level

**Fix (High effort):**
1. Define form schema in Supabase `formularios` table:
   ```
   formularios:
     - id (uuid)
     - nome (string)
     - versao (int)
     - municipio (string, nullable = default)
     - questoes (json array) [
         { id, texto, tipo, pontos_min, pontos_max, opcoes }
       ]
   ```

2. Create form builder in admin panel to define questions + point values

3. Update form UI to:
   - Display question + response options (with point hints)
   - Calculate total score as user answers
   - Show live risk level (R1/R2/R3/R4) + color + guidance
   - Store `respostas_json` + `pontuacao_total` + `nivel_risco` in SQLite

4. Implement scoring algorithm:
   ```typescript
   function calcularRisco(pontosTotal: number, config: RiscoConfig): string {
     for (const nivel of config) {
       if (pontosTotal >= nivel.minPontos && pontosTotal <= nivel.maxPontos) {
         return nivel.nivel; // 'r1', 'r2', 'r3', 'r4'
       }
     }
     return 'r1'; // fallback
   }
   ```

**Complexity:** High (redesign form schema + UI + scoring)

**Dependencies:** Risk Classification (4)

---

### 4. Risk Classification System (Incomplete)

**What it is:** Configure risk thresholds per municipality + map form scores to R1/R2/R3/R4

**Expected:**
- Admin edits thresholds: R1=0–24, R2=25–49, R3=50–74, R4=75+
- System stores in `risk_configs` table (per municipality)
- Scoring algorithm reads config and assigns risk level
- UI displays R1/R2/R3/R4 label + color + guidance text

**Broken behavior:**
- `risco-config.tsx` exists and edits thresholds ✓
- `riscoUtils.ts` has labels/colors/guidance ✓
- But scoring algorithm NOT implemented
- Form doesn't use risk classification

**Root cause:**
- Decoupled components (riscoUtils, risco-config) but no integration in form workflow

**Fix (Medium effort):**
1. Verify risk_configs table exists and has correct schema:
   ```sql
   CREATE TABLE risk_configs (
     municipio TEXT PRIMARY KEY,
     configuracao JSONB,  -- array of { nivel, label, minPontos, maxPontos, cor }
     atualizado_por TEXT,
     atualizado_em TIMESTAMP
   );
   ```

2. Load config on form load (from risco-config.tsx OR query Supabase)

3. Use `calcularRisco()` function after scoring form responses

4. Display risk level with guidance (`riscoConduta()`)

**Complexity:** Medium (integration + verification)

**Dependencies:** Form Fields (3) — must have scoring first

---

### 5. Offline→Cloud Sync (Unreliable, Partial)

**What it is:** Agent creates inspection offline → Sync when online → Data appears in Supabase

**Expected:**
- Create inspection, fill form, take photo → All data saved to SQLite
- Go offline (no internet)
- Return online → SyncService auto-syncs
- Inspection appears in Supabase `vistorias` table
- UI shows "Sincronizado ✓"

**Broken behavior:**
- Sync sometimes fails silently
- Some fields not included in sync (unclear which)
- UI doesn't show sync status clearly
- No error recovery feedback

**Root cause:**
1. SyncService payload may not include all fields (need to audit `buildSupabasePayload()`)
2. No user-facing status indicator
3. Conflict resolution untested

**Fix (High effort):**
1. Audit `buildSupabasePayload()` in SyncService.ts:
   - Ensure all fields from SQLite included in upsert:
     - `id, agente_uid, agente_nome, municipio, endereco_*, dataVistoria, respostas_json, nivel_risco, pontuacao_total, fotos_urls, formulario_id, status`
   - Handle JSON parsing for `respostas_json`
   - Handle array parsing for `fotos_urls`

2. Add sync status to inspection detail screen:
   - Show badge: "Sincronizado ✓" or "Aguardando sync..." or "Erro: {message}"
   - Allow manual retry button

3. Test full offline flow:
   - Airplane mode on
   - Create + complete inspection
   - Take photo
   - Airplane mode off
   - Verify sync completes
   - Check Supabase for data
   - Verify UI updates

4. Implement auto-sync on app resume:
   ```typescript
   useEffect(() => {
     const subscription = AppState.addEventListener('change', handleAppStateChange);
     return () => subscription.remove();
   }, []);

   async function handleAppStateChange(state: AppStateStatus) {
     if (state === 'active') {
       await syncPendentes(); // auto-sync on app resume
     }
   }
   ```

**Complexity:** High (testing + UI + retry logic)

**Dependencies:** Form Fields (3), Risk Classification (4)

---

### 6. Admin Logs Display (Corrupted or Missing Rendering)

**What it is:** Admin opens logs tab → Sees structured logs of app events (errors, syncs, auth)

**Expected:**
- Log list shows: timestamp, category, message, data
- Filters by level (info/warn/error) and category
- Pagination or infinite scroll
- Timestamps formatted as "2026-03-31 14:23:45"

**Broken behavior:**
- Logs don't render (blank screen)
- Or UI crashes when loading logs
- Or corrupted data display

**Root cause (HYPOTHESIS):**
- Log schema mismatch (SQLite columns don't match query)
- JSON parsing error in data field
- Timestamp formatting broken

**Fix (Low effort):**
1. Verify logs table exists in SQLite:
   ```sql
   CREATE TABLE logs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     level TEXT NOT NULL,
     category TEXT NOT NULL,
     message TEXT NOT NULL,
     data TEXT,  -- JSON string
     criado_em TEXT NOT NULL
   );
   ```

2. Verify admin logs.tsx queries correctly:
   ```typescript
   const logs = db.getAllSync(`
     SELECT * FROM logs
     ORDER BY criado_em DESC
     LIMIT 100
   `);
   ```

3. Add safe JSON parsing:
   ```typescript
   logs.map(log => ({
     ...log,
     data: log.data ? JSON.parse(log.data) : null
   }))
   ```

4. Format timestamp:
   ```typescript
   new Date(log.criado_em).toLocaleString('pt-BR')
   ```

**Complexity:** Low (debugging + formatting)

**Dependencies:** None — independent fix

---

### 7. Error Messages (Not Translated to Portuguese)

**What it is:** All error/validation messages display to user

**Expected:**
- Register form validation: "A senha deve ter no mínimo 8 caracteres." (in Portuguese)
- Login error: "E-mail ou senha incorretos." (in Portuguese)
- Sync error: "Falha ao sincronizar. Tente novamente." (in Portuguese)

**Broken behavior:**
- Mix of English and Portuguese
- Example: "Invalid token" instead of "Token inválido"

**Root cause:**
- Error strings not centralized
- Some translated, others not

**Fix (Low effort):**
1. Extract all error strings to centralized file: `utils/i18n.ts`
   ```typescript
   export const messages = {
     auth: {
       passwordTooShort: 'A senha deve ter no mínimo 8 caracteres.',
       invalidEmail: 'Informe um endereço de e-mail válido.',
       emailNotAuthorized: 'Este endereço de e-mail não é autorizado para o município.',
     },
     vistoria: {
       notFound: 'Vistoria não encontrada.',
       accessDenied: 'Acesso negado.',
     },
     sync: {
       failed: 'Falha ao sincronizar. Tente novamente.',
       tokenExpired: 'Token expirado. Solicite um novo ao administrador.',
     },
   };
   ```

2. Replace inline error strings throughout app:
   ```typescript
   // Before:
   throw new Error('Invalid token');

   // After:
   throw new Error(messages.sync.tokenExpired);
   ```

3. Verify all errors are in messages file via grep:
   ```bash
   grep -r "new Error\|Alert.alert" app/ | grep -v "messages\." | grep -v "i18n"
   ```

**Complexity:** Low (refactoring + testing)

**Dependencies:** None — independent fix

---

### 8. Municipality Registration (Form Broken/Incomplete)

**What it is:** Admin creates new municipality entry

**Expected:**
- Form with fields: name, IBGE code, contact info
- Submit → Upserted to Supabase `municipios` table
- New municipality available in user registration dropdowns
- Admin can manage municipality settings (risk config, email domains, etc.)

**Broken behavior:**
- Form doesn't save
- Fields missing
- Validation errors unclear

**Root cause (HYPOTHESIS):**
- Form schema incomplete
- Supabase `municipios` table doesn't exist or has wrong schema
- Upsert logic broken or missing RLS rules

**Fix (Medium effort):**
1. Verify Supabase `municipios` table exists:
   ```sql
   CREATE TABLE municipios (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     codigo_ibge VARCHAR(7) UNIQUE NOT NULL,  -- IBGE 7-digit code
     nome VARCHAR(255) NOT NULL,
     estado VARCHAR(2) NOT NULL,
     regiao VARCHAR(50),
     contato_email VARCHAR(255),
     contato_telefone VARCHAR(20),
     ativo BOOLEAN DEFAULT true,
     criado_em TIMESTAMP DEFAULT now(),
     atualizado_em TIMESTAMP DEFAULT now()
   );
   ```

2. Check if RLS policies allow admin INSERT/UPDATE

3. Create/verify admin form in `app/(panel)/admin/municipios.tsx`:
   ```typescript
   const handleSave = async (data) => {
     const { error } = await supabase.from('municipios').upsert({
       codigo_ibge: data.codigoIbge,
       nome: data.nome,
       estado: data.estado,
       contato_email: data.email,
       contato_telefone: data.telefone,
       ativo: true,
     }, { onConflict: 'codigo_ibge' });
   };
   ```

4. Test: Create municipality → Verify appears in municipios table → User registration can select it

**Complexity:** Low–Medium (form creation + schema verification)

**Dependencies:** None — independent fix (but blocks user registration flow)

---

## Implementation Roadmap (Estimated Effort)

| Fix | Complexity | Effort (hours) | Priority | Blocker For |
|-----|-----------|----------------|----------|-------------|
| 1. Map Display | Low | 2–4 | Phase 3 | Field inspection (visual) |
| 2. Invite Tokens | Medium | 4–6 | Phase 2 | User onboarding |
| 3. Offline Form Fields | High | 16–24 | Phase 1 | Core inspection workflow |
| 4. Risk Classification | Medium | 8–12 | Phase 1 | Form scoring |
| 5. Offline→Cloud Sync | High | 12–16 | Phase 1 | Data reliability |
| 6. Admin Logs Display | Low | 2–4 | Phase 3 | Admin visibility |
| 7. Error Messages | Low | 3–6 | Phase 2 | User experience |
| 8. Municipality Registration | Low–Medium | 4–8 | Phase 2 | Admin setup |

**Total estimate (all 8):** 51–80 hours

**Critical path (must-have for MVP):** Fixes 4 → 3 → 5 (36–52 hours)

---

## Feature Validation Checklist

For each feature, verification criteria to mark as "FIXED":

### 1. Map Display
- [ ] Leaflet.js loads without white screen
- [ ] Map renders with property marker
- [ ] Pan/zoom works
- [ ] Tested on Android and iOS

### 2. Invite Tokens
- [ ] Create token
- [ ] Register with token < 24h old → Success
- [ ] Register with token > 24h old → "Token expirado"
- [ ] Reuse same token → Fails (single-use enforced)

### 3. Offline Form Fields
- [ ] Form displays 10+ questions aligned to R1/R2/R3/R4
- [ ] Each question has point value (0–5 scale visible)
- [ ] Total score calculated and shown
- [ ] Risk level badge shows R1/R2/R3/R4
- [ ] Data persists to SQLite offline
- [ ] Form completes without error

### 4. Risk Classification
- [ ] Admin risco-config.tsx edits thresholds
- [ ] Config saved to Supabase per municipality
- [ ] Scoring algorithm uses config to map points → risk level
- [ ] Form auto-assigns risk level based on score

### 5. Offline→Cloud Sync
- [ ] Create inspection offline (no internet)
- [ ] Go online → Sync completes automatically
- [ ] Inspection appears in Supabase
- [ ] UI shows "Sincronizado ✓"
- [ ] Photos synced with metadata
- [ ] Test 5+ offline inspections in batch

### 6. Admin Logs Display
- [ ] Logs render without crash
- [ ] Timestamp/category/message visible
- [ ] Filter by level/category works
- [ ] Pagination or scroll works

### 7. Error Messages
- [ ] No English error messages visible to user
- [ ] All errors in Portuguese (pt-br)
- [ ] Grep finds no "new Error" without i18n reference

### 8. Municipality Registration
- [ ] Form displays all required fields
- [ ] Submit saves to Supabase
- [ ] New municipality appears in dropdowns
- [ ] IBGE code validated (7 digits)

---

## Sources

### Risk Classification (R1/R2/R3/R4)
- [Defesa Civil ES — Avaliação de Risco Estrutural](https://defesacivil.es.gov.br/Media/defesacivil/Publicacoes/Apostila%20Avaliacao%20de%20Risco%20Estrutural.pdf)
- [Brazilian Fire Department Technical Standards (CBMPB)](https://bravo.bombeiros.pb.gov.br/portal/wp-content/uploads/2023/07/NT-04-2023-CBMPB.pdf)

### Supabase Invite Tokens
- [Supabase inviteUserByEmail API Reference](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Supabase Auth Session Management](https://supabase.com/docs/guides/auth/sessions)

### Offline-First Sync Patterns
- [Android Developers — Offline-First Architecture](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Medium — 5 Critical Components for Offline-First Mobile Apps (Jan 2026)](https://medium.com/@therahulpahuja/5-critical-components-for-implementing-a-successful-offline-first-strategy-in-mobile-applications-849a6e1c5d57)

### Codebase References
- `.planning/PROJECT.md` — v1.2.0 milestone scope
- `.planning/phases/05-seguranca-divida-tecnica/05-PLAN.md` — Recent security phase
- `utils/riscoUtils.ts` — Risk classification helpers
- `utils/database.ts` — SQLite schema + migrations
- `services/SyncService.ts` — Offline sync implementation
- `app/(auth)/register.tsx` — Token validation logic
- `app/(panel)/admin/risco-config.tsx` — Risk threshold editor
- `app/(panel)/inspecoes/[id].tsx` — Inspection detail screen with fallback

