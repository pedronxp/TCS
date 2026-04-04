# Architecture Patterns — Bug Fixes for v1.2.0

**Project:** Defesa Civil Expo — Critical Bug Fixes Milestone
**Researched:** 2026-03-31
**Mode:** Integration & Build Order Analysis
**Confidence:** HIGH (existing codebase analyzed, architecture documented in CONTEXT.md)

---

## Executive Summary

The v1.2.0 milestone fixes 8 critical bugs that prevent core features from functioning. These fixes integrate deeply with the existing offline-first architecture, specifically:

- **WebView-to-RN communication** for Leaflet map integration (already working baseUrl fix in place)
- **SQLite migration** (v5 → v6) to add R1/R2/R3/R4 form fields and offline form persistence
- **SyncService extension** to handle new form fields and admin logs
- **Supabase RPC patterns** for token validation (prevent "Token Expirado" false positives)
- **Admin logs query patterns** to display activity logs without SQLite bottlenecks

The suggested build order prioritizes **dependency minimization** and **regression risk reduction** by addressing database schema changes before data flow modifications.

---

## Integration Map Per Fix

### Fix 1: Leaflet Map WebView Communication (MAPA — Status: ✅ DONE)

**Bug:** White screen on Android — WebView couldn't load Leaflet.js
**Root cause:** Missing baseUrl parameter blocking CDN access
**Status:** Fixed in commit 384a11f, now loading from `https://unpkg.com`

**Components involved:**
- **Screen:** `app/(panel)/mapas.tsx` (source: line 146–250)
- **WebView:** `react-native-webview@6.x`
- **HTML source:** Generated in `buildHtml()` (inline, no external file)
- **Leaflet libraries:** CDN-loaded (unpkg.com/leaflet@1.9.4)

**Data flow:**
```
mapas.tsx (state: markers[], style, filters)
  ↓ buildHtml()
  ↓ HTML string → escapeHtml() for XSS protection
  ↓ WebView source={{ html, baseUrl: 'https://unpkg.com' }}
  ↓ Leaflet JS renders on native canvas
  ↓ onMessage: JSON.stringify({type:'tap', id:'...'})
  ↓ router.push(`/inspecoes/${id}`)
```

**RN-to-WebView communication:**
- **RN → Web:** Passing markers array via JavaScript template literals in HTML (safe via escapeHtml)
- **Web → RN:** Button click sends message via `window.ReactNativeWebView.postMessage()`
- **Listener:** `WebView onMessage={(e) => handleMarkerTap(e.nativeEvent.data)}`

**New components:** None (map screen fully implemented)
**Modified components:** None (fix already applied)
**Integration points:**
- Marker data from SQLite (`getVistoriasByAgente()`, `getVistoriasByMunicipio()`)
- Tap handling routes to detail screen

**Risk areas:** NONE — fix is complete and tested.

---

### Fix 2: Token Validation (TOKENS — Status: TO-DO)

**Bug:** Tokens showing "Token Expirado" even when just created
**Root cause:** Token expiry validation logic checking `expira_em` field incorrectly (likely timezone or comparison issue)
**Affected screens:** `app/(auth)/register.tsx` (token validation), `app/admin/tokens.tsx` (token list)

**Components involved:**
- **Auth screen:** `app/(auth)/register.tsx` (token consumption at line 57–100)
- **Admin screen:** `app/admin/tokens.tsx` (token listing + display of expiry)
- **Database:** `Supabase public.invite_tokens` table
- **Service:** Token validation in `register.tsx` line 96–110

**Database schema (Supabase):**
```sql
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL,
  criado_por UUID REFERENCES auth.users(id),
  municipio TEXT,
  usado BOOLEAN DEFAULT false,
  usado_por UUID REFERENCES auth.users(id),
  usado_em TIMESTAMPTZ
)
```

**Data flow (registration):**
```
register.tsx
  ↓ Input token code
  ↓ SELECT * FROM invite_tokens WHERE codigo=? AND usado=false
  ↓ Check: NOW() < expira_em (TIMEZONE ISSUE HERE)
  ↓ If expired: Show "Token Expirado"
  ↓ If valid: Proceed to signup
  ↓ Mark token: UPDATE invite_tokens SET usado=true, usado_em=NOW()
```

**Fix strategy:**
1. Ensure `expira_em` is stored as `TIMESTAMPTZ` in Supabase (server-side verified)
2. Use explicit timezone-aware comparison in Supabase RPC
3. Create RPC function `validate_token(codigo TEXT)` returning `{ valid: boolean, error?: string }`

**New RPC needed:**
```sql
CREATE OR REPLACE FUNCTION validate_token(p_codigo TEXT)
RETURNS TABLE (valid BOOLEAN, error_message TEXT, municipio TEXT)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (usado = false AND NOW() AT TIME ZONE 'America/Sao_Paulo' < expira_em) AS valid,
    CASE
      WHEN usado THEN 'Token já foi utilizado'::TEXT
      WHEN NOW() AT TIME ZONE 'America/Sao_Paulo' >= expira_em THEN 'Token expirado'::TEXT
      ELSE NULL::TEXT
    END AS error_message,
    invite_tokens.municipio
  FROM invite_tokens
  WHERE codigo = p_codigo;
END;
$$ LANGUAGE plpgsql;
```

**Modified components:**
- `app/(auth)/register.tsx`: Replace inline validation with RPC call
- `app/admin/tokens.tsx`: Fix token status display logic

**Integration points:**
- `supabase.rpc('validate_token', { codigo })` in register flow
- Admin list query to exclude expired tokens by default

**Risk areas:**
- Timezone handling across different device locales
- RPC transaction isolation (ensure no race conditions on token consumption)

---

### Fix 3: SQLite Migration (v5 → v6) for New Form Fields

**Bug:** Form fields for R1/R2/R3/R4 classification not persisted locally
**Scope:** Add new columns to `vistorias_offline` table for form field data

**Components involved:**
- **Database:** `utils/database.ts` (currently v5, needs v6 migration)
- **Schema:** `vistorias_offline` table (currently has: respostas_json, nivel_risco, pontuacao_total)
- **Form wizard:** `app/(panel)/inspecoes/wizard.tsx`
- **Detail view:** `app/(panel)/inspecoes/[id].tsx`

**Current schema (v5):**
```sql
CREATE TABLE vistorias_offline (
  id TEXT PRIMARY KEY,
  agente_uid TEXT NOT NULL,
  formulario_id TEXT,
  formulario_versao INTEGER,
  respostas_json TEXT,        -- All form answers as JSON object
  nivel_risco TEXT,            -- r1 | r2 | r3 | r4
  pontuacao_total INTEGER,
  sincronizado INTEGER DEFAULT 0,
  tentativas_sync INTEGER DEFAULT 0,
  erro_sync TEXT,
  criado_em TEXT NOT NULL
  ...
)
```

**Migration v6 additions needed:**
```sql
-- v6: Add R1/R2/R3/R4 classification tracking
ALTER TABLE vistorias_offline ADD COLUMN risco_r1 BOOLEAN;
ALTER TABLE vistorias_offline ADD COLUMN risco_r2 BOOLEAN;
ALTER TABLE vistorias_offline ADD COLUMN risco_r3 BOOLEAN;
ALTER TABLE vistorias_offline ADD COLUMN risco_r4 BOOLEAN;

-- v6: Add form field metadata (for offline form validation)
ALTER TABLE vistorias_offline ADD COLUMN campos_obrigatorios_json TEXT;

-- v6: Add draft status (for resumable forms)
ALTER TABLE vistorias_offline ADD COLUMN eh_rascunho INTEGER DEFAULT 0;

-- v6: Index for querying by risco classification
CREATE INDEX idx_vistorias_risco_flags ON vistorias_offline (risco_r1, risco_r2, risco_r3, risco_r4);
```

**Data structure change (respostas_json evolution):**

Current:
```typescript
{
  "pergunta_1": "opcao_a",
  "pergunta_2": "texto_livre",
  "foto_pergunta_3": "url_storage"
}
```

After migration (same structure, but with standardized field naming):
```typescript
{
  "p_estrutura_fundacao": "opcao_a",
  "p_paredes_fisuras": "opcao_b",
  "p_telhado_condicao": "opcao_a",
  "observacoes": "texto livre do agente",
  "fotos_estrutura": ["storage_url_1", "storage_url_2"]
}
```

**Migration code (utils/database.ts v6 addition):**

```typescript
if (currentVersion < 6) {
  // Add risco classification flags
  try {
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN risco_r1 INTEGER DEFAULT 0`);
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN risco_r2 INTEGER DEFAULT 0`);
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN risco_r3 INTEGER DEFAULT 0`);
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN risco_r4 INTEGER DEFAULT 0`);
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN campos_obrigatorios_json TEXT`);
    database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN eh_rascunho INTEGER DEFAULT 0`);
  } catch { /* columns already exist */ }

  // Index for risk level queries
  database.runSync(`
    CREATE INDEX IF NOT EXISTS idx_vistorias_risco_flags
    ON vistorias_offline (risco_r1, risco_r2, risco_r3, risco_r4)
  `);
}
```

**Modified components:**
- `utils/database.ts`: Add migration + update VistoriaLocal type
- `utils/database.ts`: Add setRiscoFlags() helper function
- `app/(panel)/inspecoes/wizard.tsx`: Capture risco flags during form completion
- `app/(panel)/inspecoes/risco.tsx`: Save r1-r4 classification to table
- `app/(panel)/inspecoes/[id].tsx`: Display risco flags in detail view

**VistoriaLocal type extension:**
```typescript
export interface VistoriaLocal {
  // ... existing fields ...
  risco_r1?: boolean;
  risco_r2?: boolean;
  risco_r3?: boolean;
  risco_r4?: boolean;
  campos_obrigatorios_json?: string;
  eh_rascunho?: boolean;
}
```

**New database functions:**
```typescript
export function setRiscoFlags(
  vistoriaId: string,
  flags: { r1: boolean; r2: boolean; r3: boolean; r4: boolean }
) {
  const db = getDb();
  db.runSync(
    `UPDATE vistorias_offline SET risco_r1=?, risco_r2=?, risco_r3=?, risco_r4=? WHERE id=?`,
    [flags.r1 ? 1 : 0, flags.r2 ? 1 : 0, flags.r3 ? 1 : 0, flags.r4 ? 1 : 0, vistoriaId]
  );
}

export function getRiscosummaryStat() {
  const db = getDb();
  return db.getAllSync(`
    SELECT
      SUM(CASE WHEN risco_r4=1 THEN 1 ELSE 0 END) as r4_count,
      SUM(CASE WHEN risco_r3=1 THEN 1 ELSE 0 END) as r3_count,
      SUM(CASE WHEN risco_r2=1 THEN 1 ELSE 0 END) as r2_count,
      SUM(CASE WHEN risco_r1=1 THEN 1 ELSE 0 END) as r1_count
    FROM vistorias_offline
    WHERE sincronizado=1
  `);
}
```

**Risk areas:**
- **Migration atomicity:** Ensure all v6 columns added in single transaction
- **Existing data:** NULL values for risco_r1-r4 in existing vistorias (handle with defaults)
- **Backward compatibility:** Old apps without v6 must not crash when syncing old data

---

### Fix 4: System Risk Classification (R1/R2/R3/R4)

**Bug:** Risk classification logic not properly tied to form responses
**Components involved:**
- **Scoring logic:** Currently simplified in wizard (line 150–200)
- **Risco screen:** `app/(panel)/inspecoes/risco.tsx`
- **Util:** `utils/riscoUtils.ts` (display only, no scoring)
- **Form config:** Asset-based (estrutural.json has `clasificacao.limites[]`)

**Current risk calculation (from wizard.tsx):**
```typescript
// Simplified: count selected high-risk options
const riscoCount = Object.values(respostas).filter(r => {
  const opcao = findOpcaoPorResposta(r);
  return opcao?.pesoRisco > 5;
}).length;

const nivel_risco = riscoCount >= 5 ? 'r4' : riscoCount >= 3 ? 'r3' : riscoCount >= 1 ? 'r2' : 'r1';
```

**New scoring logic needed (per form definition):**

Each form in `assets/formularios/*.json` has:
```json
{
  "classificacao": {
    "soma_total": true,
    "limites": [
      { "minimo": 0, "maximo": 20, "nivel": "r1" },
      { "minimo": 21, "maximo": 40, "nivel": "r2" },
      { "minimo": 41, "maximo": 60, "nivel": "r3" },
      { "minimo": 61, "maximo": 100, "nivel": "r4" }
    ]
  }
}
```

**New risco calculation function (riscoUtils.ts extension):**

```typescript
export interface RiscoLimite {
  minimo: number;
  maximo: number;
  nivel: string;
}

export function calcularNivelRisco(
  pontuacao: number,
  limites: RiscoLimite[]
): string {
  for (const limite of limites) {
    if (pontuacao >= limite.minimo && pontuacao <= limite.maximo) {
      return limite.nivel;
    }
  }
  return 'r1'; // Default fallback
}

export function calcularPontuacao(
  respostas: Record<string, string>,
  perguntas: PerguntaModel[]
): number {
  let total = 0;

  for (const pergunta of perguntas) {
    const respostaId = respostas[pergunta.id];
    const opcao = pergunta.opcoes.find(o => o.id === respostaId);
    if (opcao?.pesoRisco) {
      total += opcao.pesoRisco;
    }
  }

  return total;
}
```

**Modified components:**
- `utils/riscoUtils.ts`: Add calcularNivelRisco(), calcularPontuacao()
- `app/(panel)/inspecoes/wizard.tsx`: Use new functions after all answers collected
- `app/(panel)/inspecoes/risco.tsx`: Display detailed breakdown (per-pergunta points + total)

**Integration with risco screen:**
```
wizard.tsx (collect all respostas)
  ↓ Submit
  ↓ calcularPontuacao(respostas, perguntas) → 45 points
  ↓ calcularNivelRisco(45, limites) → 'r3'
  ↓ Save to local SQLite + set flags via setRiscoFlags()
  ↓ Navigate to risco.tsx
  ↓ Display: "Risco ALTO (R3) — 45 pontos"
  ↓ Show decision tree: "3 perguntas alta criticidade, 2 médias"
  ↓ Save to Supabase on sync
```

**Risk areas:**
- Form definition changes breaking scoring (validate schema changes)
- Rounding/precision in scoring across form types

---

### Fix 5: SyncService Extension for New Form Data

**Bug:** New form fields not included in sync batch
**Components involved:**
- **Sync service:** `services/SyncService.ts` (lines 90–150)
- **Database reads:** `getVistoriasNaoSincronizadas()` returns old schema
- **Supabase writes:** Inserting into vistorias table with new fields

**Current sync flow (SyncService):**
```
1. getVistoriasNaoSincronizadas() → reads local vistorias_offline
2. processarImagensVistoria(v) → uploads fotos to Storage
3. INSERT/UPDATE vistorias Supabase → with respostas_json, nivel_risco, pontuacao_total
4. markSincronizado(id) → sets sincronizado=1
```

**New fields to include in sync:**
```typescript
{
  nivel_risco: 'r3',         // Already synced
  pontuacao_total: 45,       // Already synced
  risco_r1: false,           // NEW
  risco_r2: false,           // NEW
  risco_r3: true,            // NEW
  risco_r4: false,           // NEW
  eh_rascunho: false,        // NEW
}
```

**Supabase vistorias table schema (must be updated):**
```sql
ALTER TABLE vistorias ADD COLUMN risco_r1 BOOLEAN DEFAULT false;
ALTER TABLE vistorias ADD COLUMN risco_r2 BOOLEAN DEFAULT false;
ALTER TABLE vistorias ADD COLUMN risco_r3 BOOLEAN DEFAULT false;
ALTER TABLE vistorias ADD COLUMN risco_r4 BOOLEAN DEFAULT false;
```

**Modified SyncService logic (services/SyncService.ts):**

```typescript
// Around line 130: Update upsert to include new fields
const { data, error } = await supabase
  .from('vistorias')
  .upsert(
    {
      id: v.id,
      agente_uid: v.agente_uid,
      respostas_json: v.respostas_json,
      nivel_risco: v.nivel_risco,
      pontuacao_total: v.pontuacao_total,
      // NEW FIELDS
      risco_r1: v.risco_r1 ?? false,
      risco_r2: v.risco_r2 ?? false,
      risco_r3: v.risco_r3 ?? false,
      risco_r4: v.risco_r4 ?? false,
      eh_rascunho: v.eh_rascunho ?? false,
      // ... other fields
    },
    { onConflict: 'id' }
  );
```

**Admin logs sync (NEW):**

Currently logs are written to local SQLite only. To sync admin activity logs:

1. Add new table `activity_logs_offline` to SQLite v6 migration:
```sql
CREATE TABLE activity_logs_offline (
  id TEXT PRIMARY KEY,
  admin_uid TEXT NOT NULL,
  municipio TEXT,
  tipo_acao TEXT NOT NULL,  -- 'criar_token', 'aprovar_usuario', 'editar_formulario'
  descricao TEXT,
  criado_em TEXT NOT NULL,
  sincronizado INTEGER DEFAULT 0
)
```

2. Add sync batch in SyncService:
```typescript
// After syncing vistorias, sync admin logs
const logsPendentes = db.getAllSync(`
  SELECT * FROM activity_logs_offline WHERE sincronizado=0
`);

for (const log of logsPendentes) {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      id: log.id,
      admin_uid: log.admin_uid,
      municipio: log.municipio,
      tipo_acao: log.tipo_acao,
      descricao: log.descricao,
      criado_em: log.criado_em,
    });

  if (!error) {
    markActivityLogSincronizado(log.id);
  }
}
```

**Modified components:**
- `services/SyncService.ts`: Update upsert to include risco_r1-r4, eh_rascunho
- `utils/database.ts`: Add activity_logs_offline table in v6
- `app/admin/logs.tsx`: Query local logs + sync status

**Integration points:**
- Admin log writes → log via notificarAcao() helper
- Sync reads all pending → batches to Supabase
- RPC for log statistics (admin dashboard)

**Risk areas:**
- Schema mismatch between local and Supabase (ensure v6 migration matches Supabase DDL)
- Sync ordering: admin logs must sync after vistorias for proper audit trail

---

### Fix 6: Admin Logs Display

**Bug:** Admin logs tab showing corrupted or truncated data
**Components involved:**
- **Admin logs screen:** `app/admin/logs.tsx`
- **Local logs table:** `logs` table in SQLite (v3+)
- **Supabase logs:** `system_logs` (master_admin) and `activity_logs` (admin)

**Current SQLite schema (v3):**
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  criado_em TEXT NOT NULL
)
```

**Data flow (logs.tsx):**
```
admin/logs.tsx
  ↓ On mount: queryLogsFromSQLite(nivel, categoria, dias)
  ↓ Fetch from local: SELECT * FROM logs WHERE level=? AND criado_em > ?
  ↓ Format table: show in FlatList (5 cols: nivel, categoria, mensagem, dados, hora)
  ↓ Click row: show full detail modal
```

**Common issues:**
1. **Unicode handling:** Portuguese characters (á, é, í, ó, ú) corrupted if not UTF-8
2. **Long messages truncated:** Field overflow in table view
3. **Timezone display:** Showing stored time without conversion
4. **Pagination:** No limit on queries → slow on large log sets

**Fix approach:**
1. Ensure all logger calls use UTF-8 safe strings
2. Add pagination/filtering to logs.tsx
3. Truncate message display with ellipsis (show full on modal)
4. Query optimization: add created_at index (already done in v4)

**Modified components:**
- `app/admin/logs.tsx`: Add pagination, proper UTF-8 display, modal detail view
- `utils/logger.ts`: Ensure all message sanitization is UTF-8 safe

**Schema enhancement (optional, for v6):**
```sql
-- v6: Add logging metadata
ALTER TABLE logs ADD COLUMN usuario_uid TEXT;
ALTER TABLE logs ADD COLUMN usuario_nome TEXT;
ALTER TABLE logs ADD COLUMN versao_app TEXT;

-- Index for common queries
CREATE INDEX idx_logs_usuario_data ON logs (usuario_uid, criado_em DESC);
```

**Risk areas:**
- Breaking existing log entries if structure changed
- Performance on devices with thousands of logs

---

### Fix 7: Form Field Persistence & Sync

**Bug:** Form fields (text inputs, selections) not saved locally during offline wizard
**Components involved:**
- **Wizard form:** `app/(panel)/inspecoes/wizard.tsx` (form state)
- **Auto-save:** Currently via AsyncStorage `@draft_wizard_${formularioId}`
- **Final save:** insertVistoria() to SQLite
- **Sync:** SyncService uploads respostas_json to Supabase

**Current flow (wizard.tsx):**
```typescript
const [respostas, setRespostas] = useState<Respostas>({});
const draftKey = `@draft_wizard_${params.formularioId}`;
const autoSaveTimer = useRef(null);

// Auto-save to AsyncStorage every 2s
useEffect(() => {
  autoSaveTimer.current = setTimeout(() => {
    AsyncStorage.setItem(draftKey, JSON.stringify({ respostas, step }));
  }, 2000);

  return () => clearTimeout(autoSaveTimer.current);
}, [respostas, step]);
```

**Issues:**
- AsyncStorage limited to ~10MB total (not suitable for many photo URIs)
- Draft not saved to SQLite → lost if app crashes
- Photos stored as URIs, not synced until final save

**New flow (after fix):**
```
1. Collect respostas in state (as now)
2. On every answer OR timer: Save to SQLite vistorias_offline with eh_rascunho=1
3. Photos during wizard:
   a. Compress with expo-image-manipulator
   b. Save local path to fotos_urls JSON array
   c. On final save: Upload all fotos_urls to Storage
4. On wizard complete: Update eh_rascunho=0, mark sincronizado=0
5. SyncService: Upload fotos + upsert vistoria with synced flag
```

**Modified components:**
- `app/(panel)/inspecoes/wizard.tsx`: Replace AsyncStorage with SQLite draft saves
- `app/(panel)/inspecoes/foto.tsx`: Ensure photos saved to Storage during sync, not during wizard
- `services/SyncService.ts`: Upload pending fotos_urls

**Database additions (v6):**
- `eh_rascunho` column (as noted in Fix 3)
- `fotos_urls` column (already exists in v2, use it)

**Risk areas:**
- Large form submissions causing SQLite query timeouts
- Photo upload order (must happen before marking vistoria as synced)

---

### Fix 8: Error Messages Localization (Pt-BR)

**Bug:** App showing English error messages instead of Portuguese
**Components involved:**
- **Error handling:** Throughout app (try/catch, Supabase responses)
- **Supabase errors:** Auth errors, DB errors, RPC errors
- **User feedback:** Alert(), Toast, ErrorState component text

**Current pattern (bad):**
```typescript
const { error } = await supabase.auth.signInWithPassword({ ... });
if (error) {
  Alert.alert('Error', error.message); // Shows English: "Invalid login credentials"
}
```

**Need localization dictionary:**

Create `utils/i18n.ts`:
```typescript
const errorMessages: Record<string, string> = {
  'Invalid login credentials': 'Credenciais inválidas',
  'User already registered': 'Usuário já registrado',
  'Invalid email': 'E-mail inválido',
  'Token expirado': 'Token expirado',
  'User is not approved': 'Usuário não aprovado pelo administrador',
  'Network error': 'Erro de conectividade',
  'Database connection failed': 'Falha ao conectar ao banco de dados',
  'Permission denied': 'Você não tem permissão para esta ação',
};

export function getLocalizedError(message: string): string {
  return errorMessages[message] ?? message;
}
```

**Affected screens (all showing error messages):**
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(panel)/inspecoes/wizard.tsx`
- `app/(panel)/inspecoes/foto.tsx`
- `app/admin/*.tsx` (all admin screens)

**Fix approach:**
1. Create `utils/i18n.ts` with error dictionary
2. Wrap all error.message → getLocalizedError()
3. Test all error paths (network, auth, validation)

**Modified components:**
- All screens with error handling: Replace `error.message` with `getLocalizedError(error.message)`
- Toast/Alert calls: Use localized messages

**Risk areas:**
- Incomplete localization → users still see English on edge cases
- Plural/conditional messages (some errors need context)

---

## Data Flow Architecture Changes

### Current Offline-First Flow (v1.1.0)

```
User fills form (wizard.tsx)
  ↓ respostas: Record<string, string> stored in state
  ↓ Auto-save to AsyncStorage every 2s
  ↓ User clicks "Salvar"
  ↓ insertVistoria() → SQLite vistorias_offline
  ↓ Display risco.tsx (nivel_risco calculated)
  ↓ Show resultado.tsx with print option
  ↓ App detects connectivity change
  ↓ SyncService.syncPendentes() triggered
  ↓ Upload fotos to Supabase Storage
  ↓ Upsert vistoria to Supabase.vistorias
  ↓ Mark sincronizado=1
  ↓ Notification sent
```

### New Flow After Fixes (v1.2.0)

```
User fills form (wizard.tsx)
  ↓ respostas: Record<string, string> with standardized field names
  ↓ Every answer → Save draft to SQLite (eh_rascunho=1)
  ↓ Photos → Compress + save local path to fotos_urls JSON
  ↓ User clicks "Finalizar"
  ↓ calcularPontuacao(respostas) → 45 points
  ↓ calcularNivelRisco(45, limites) → 'r3'
  ↓ insertVistoria() → SQLite with risco_r1-r4 flags + eh_rascunho=0
  ↓ Display risco.tsx (show point breakdown)
  ↓ Show resultado.tsx with PDF generation
  ↓ SyncService triggered:
    ├─ Upload fotos to Storage (from fotos_urls)
    ├─ Upload activity logs from SQLite
    ├─ Upsert vistoria with new fields
    ├─ Validate token status for future reads
    └─ Mark all as sincronizado=1
  ↓ Notification with sync status
```

### Admin Activity Logging

```
Admin action (approve user, create token, edit form)
  ↓ notificarAcao(tipo_acao, descricao) → logs both:
    ├─ SQLite activity_logs_offline (offline fallback)
    └─ Supabase activity_logs (immediate sync)
  ↓ SyncService also syncs activity_logs_offline on next batch
  ↓ Admin/logs.tsx queries both local + Supabase for complete history
```

---

## Component Boundaries (Before & After)

### New/Modified Components Map

| Component | Type | Change | Purpose |
|-----------|------|--------|---------|
| `utils/riscoUtils.ts` | Util | Extend | Add calcularNivelRisco(), calcularPontuacao() |
| `utils/i18n.ts` | Util | Create | Localized error messages |
| `utils/database.ts` | Util | Modify | Add v6 migration + new functions |
| `app/(auth)/register.tsx` | Screen | Modify | Use RPC validate_token() instead of inline logic |
| `app/(panel)/inspecoes/wizard.tsx` | Screen | Modify | Draft to SQLite + new scoring logic |
| `app/(panel)/inspecoes/risco.tsx` | Screen | Modify | Display point breakdown + risco flags |
| `app/(panel)/inspecoes/resultado.tsx` | Screen | No change | Already handles display |
| `app/(panel)/inspecoes/foto.tsx` | Screen | Modify | Compress before saving, track in fotos_urls |
| `app/admin/logs.tsx` | Screen | Modify | Pagination + proper display + UTF-8 |
| `app/admin/tokens.tsx` | Screen | Modify | Update token status display logic |
| `services/SyncService.ts` | Service | Modify | Include new fields + activity logs sync |
| `app/(panel)/mapas.tsx` | Screen | No change | Already fixed in v1.1.0 |
| `context/AuthContext.tsx` | Context | No change | No changes needed |

---

## Suggested Build Order

### Phase Structure (5 Phases, ~2-3 weeks)

**Rationale:** Database schema changes first (blocking), then data flow, then UI/display.

---

### Phase 01: Database Foundation (Days 1–2)

**Goal:** Add SQLite migration v6 + create new Supabase RPC functions

**Tasks:**
1. **01.1** — SQLite v6 migration
   - Add risco_r1-r4 columns + eh_rascunho + campos_obrigatorios_json
   - Add activity_logs_offline table
   - Create indices for new columns
   - Test migration on fresh + existing databases

2. **01.2** — Supabase DDL updates
   - ALTER vistorias table (add risco_r1-r4 + eh_rascunho columns)
   - ALTER activity_logs table (add sync status)
   - Create RPC validate_token() function
   - Create RPC log_admin_action() function

3. **01.3** — Database utility functions
   - Add setRiscoFlags() helper
   - Add getRiscoSummaryStat() helper
   - Add markActivityLogSincronizado() helper
   - Update VistoriaLocal type

**Acceptance criteria:**
- `npx tsc --noEmit` passes
- Migration runs without errors on test device
- New columns queryable in Supabase

**Risk areas:** Database locks during migration → test with large datasets

---

### Phase 02: Risk Classification (Days 3–4)

**Goal:** Implement R1-R4 scoring logic + integrate into wizard flow

**Tasks:**
1. **02.1** — Risk calculation utilities
   - Extend `utils/riscoUtils.ts` with calcularNivelRisco(), calcularPontuacao()
   - Add point breakdown helper
   - Unit tests for scoring logic

2. **02.2** — Wizard integration
   - Modify `wizard.tsx` to use new scoring functions
   - Save risco flags to SQLite on completion
   - Test with all form types (estrutural, deslizamento, etc.)

3. **02.3** — Risco screen enhancement
   - Display point breakdown in `risco.tsx`
   - Show individual question contributions
   - Add visual indicators per risco level

**Acceptance criteria:**
- Scoring matches form definition limites[]
- Risco flags persist in SQLite
- Risco screen shows correct breakdown

**Risk areas:** Different form definitions having different scoring rules → validate all 4 forms

---

### Phase 03: Sync & Data Flow (Days 5–7)

**Goal:** Extend SyncService to handle new form fields + activity logs

**Tasks:**
1. **03.1** — SyncService extension
   - Update upsert to include risco_r1-r4 + eh_rascunho
   - Add activity_logs_offline batching
   - Ensure atomicity (all-or-nothing per batch)

2. **03.2** — Draft form persistence
   - Replace AsyncStorage draft with SQLite saves in `wizard.tsx`
   - Auto-save every 2s or on answer change
   - Resume draft from SQLite on screen reopen

3. **03.3** — Photo upload integration
   - Ensure fotos_urls tracked correctly
   - Upload all pending photos in SyncService
   - Handle partial upload failures

4. **03.4** — SyncService testing
   - Test offline → online → sync flow
   - Verify atomicity (no partial syncs)
   - Test with large batches (50+ vistorias)

**Acceptance criteria:**
- All fields synced correctly to Supabase
- Activity logs appear in admin dashboard
- Photos uploaded with correct URIs
- No data loss on network interruption

**Risk areas:** Sync concurrency → ensure _syncInProgress guard still works

---

### Phase 04: Auth & Tokens (Days 8–9)

**Goal:** Fix token validation RPC + integrate into register flow

**Tasks:**
1. **04.1** — RPC token validation
   - Verify validate_token() RPC deployed to Supabase
   - Test timezone handling (São Paulo time)
   - Test expired vs. valid tokens

2. **04.2** — Register flow update
   - Replace inline validation with RPC call in `register.tsx`
   - Show localized error messages
   - Handle RPC timeout (fallback to inline check if RPC fails)

3. **04.3** — Admin token display
   - Fix token status in `admin/tokens.tsx`
   - Show expiry datetime in local timezone
   - Add bulk deletion for expired tokens

**Acceptance criteria:**
- New tokens don't show "Token Expirado"
- Expired tokens correctly identified
- Timezone-aware comparisons work

**Risk areas:** RPC latency → implement timeout handling

---

### Phase 05: UX & Localization (Days 10–11)

**Goal:** Localize error messages + fix admin logs display

**Tasks:**
1. **05.1** — Localization utilities
   - Create `utils/i18n.ts` with error dictionary
   - Add support for common Supabase errors
   - Test all error paths

2. **05.2** — Screen error message updates
   - Replace error.message → getLocalizedError() in all screens
   - Test auth errors, sync errors, validation errors
   - Handle edge case messages

3. **05.3** — Admin logs display
   - Add pagination to logs query
   - Fix UTF-8 encoding in display
   - Add timezone formatting
   - Create detail modal for full message

4. **05.4** — Integration testing
   - Test complete offline → online flow
   - Test all form types with new R1-R4 scoring
   - Test admin logs sync
   - Test token validation

**Acceptance criteria:**
- All error messages in Portuguese
- Admin logs display correctly
- Logs pagination works on large datasets
- E2E test: wizard → risco → sync → admin dashboard

---

### Phase 06: Regression & Release (Days 12–14)

**Goal:** Testing + release as v1.2.0

**Tasks:**
1. **06.1** — Regression testing
   - Test all existing features (mapas, inspecoes, admin panels)
   - Test offline mode thoroughly
   - Test with multiple user roles

2. **06.2** — Performance testing
   - Profile SyncService with 100+ pending vistorias
   - Test SQLite query performance with new indices
   - Test WebView with large marker counts

3. **06.3** — UAT preparation
   - Create test scenarios per fix
   - Prepare test data (tokens, forms, users)
   - Document known limitations

4. **06.4** — Release
   - Increment version to v1.2.0
   - Update CHANGELOG
   - Tag git commit
   - Build APK via EAS

**Acceptance criteria:**
- All regression tests pass
- Performance within acceptable bounds
- UAT sign-off from product owner

---

## Build Order Rationale

```
Database Schema (01) ← Must happen first, blocks all data flow changes
        ↓
Risk Scoring (02) ← Uses new schema columns
        ↓
Sync Integration (03) ← Depends on schema + scoring
        ↓
Auth/Tokens (04) ← Independent, can be parallel with 03
        ↓
UX/Localization (05) ← Depends on 03 for admin logs
        ↓
Testing & Release (06) ← Everything else complete
```

**Why this order:**
- **Schema first:** Can't insert risco flags without columns
- **Scoring before sync:** Must calculate scores before syncing
- **Sync before logs:** Activity logs sync uses same SyncService pattern
- **Auth independent:** Token validation works in parallel with sync
- **UX last:** Localization and display can wait until data flow works

---

## Risk Areas (Flagged for Phase-Specific Research)

### Critical Risks (Must Investigate Before Phase 02)

1. **Form Definition Variability**
   - Question: Do all 4 form types have `classificacao.limites[]` defined?
   - Action: Review `assets/formularios/*.json` to confirm schema
   - Blocker: If missing, must add before scoring logic

2. **Timezone Handling in Supabase**
   - Question: Does Supabase store datetimes in UTC or local?
   - Action: Verify invite_tokens.expira_em column type + existing data
   - Blocker: RPC comparison will fail if timezone-unaware

3. **Photo URI Persistence**
   - Question: How are photo URIs stored during wizard (currently)?
   - Action: Trace flow from expo-image-picker → Storage upload
   - Blocker: If photos cached in RAM, large forms will crash

### Moderate Risks (Can Investigate During Phase 03)

4. **SQLite Query Performance**
   - New indices help, but test with 1000+ vistorias
   - SyncService batch size may need adjustment

5. **Admin Activity Logging Completeness**
   - Which admin actions need to be logged? (approve user, create token, edit form)
   - Need list before implementing notificarAcao()

6. **Supabase RPC Error Handling**
   - How to handle RPC timeouts in register.tsx?
   - Need fallback strategy

### Minor Risks (Investigate During Phase 05)

7. **Error Message Coverage**
   - Are there other English messages not in dictionary?
   - Beta test with Portuguese speakers

---

## Deployment Checklist

Before releasing v1.2.0:

- [ ] SQLite v6 migration tested on 50+ devices
- [ ] All 4 form types produce correct R1-R4 scores
- [ ] SyncService syncs all fields without data loss
- [ ] Token validation RPC handles timezone correctly
- [ ] Admin logs display with proper pagination
- [ ] All error messages translated to Portuguese
- [ ] No regression in existing features (mapas, profiles, auth)
- [ ] Performance acceptable (sync < 5s for 20 vistorias)
- [ ] UAT passed by product owner

---

## Files to Create/Modify

**Create:**
- `.planning/research/ARCHITECTURE.md` (this file)

**Modify:**
- `utils/database.ts` — Add v6 migration + new types/functions
- `utils/riscoUtils.ts` — Add scoring functions
- `utils/i18n.ts` — Create localization utilities
- `app/(auth)/register.tsx` — Use RPC validate_token()
- `app/(panel)/inspecoes/wizard.tsx` — SQLite draft saves + new scoring
- `app/(panel)/inspecoes/risco.tsx` — Display point breakdown
- `app/(panel)/inspecoes/foto.tsx` — Track in fotos_urls
- `app/admin/logs.tsx` — Pagination + UTF-8 display
- `app/admin/tokens.tsx` — Fix status display
- `services/SyncService.ts` — Include new fields + activity logs

**No changes needed:**
- `app/(panel)/mapas.tsx` — Already fixed
- `context/AuthContext.tsx` — No changes
- `context/ThemeContext.tsx` — No changes

---

## Sources & References

**Existing codebase:**
- `CONTEXT.md` — Project overview + stack + business rules
- `PROJECT.md` — Current milestone v1.2.0 goals
- `.planning/phases/05-seguranca-divida-tecnica/05-PLAN.md` — Security tasks
- `app/(panel)/mapas.tsx` — WebView + Leaflet integration (working reference)
- `services/SyncService.ts` — Batch sync pattern (reference for activity logs)
- `utils/database.ts` — Current schema v5 (migration base)
- `utils/riscoUtils.ts` — Display utilities (extend with scoring)

**Deployment confidence:** HIGH
**Regression risk:** MEDIUM (schema changes affect all data reads)
**Timeline:** 2 weeks (14 days over 5 phases)
**Estimated effort:** 80–100 developer hours
