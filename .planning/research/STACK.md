# Technology Stack — v1.2.0 Critical Bug Fixes

**Project:** Defesa Civil — App de Vistoria Técnica
**Researched:** 2026-03-31
**Scope:** Stack additions/changes required to fix 8 critical functional bugs
**Confidence:** MEDIUM-HIGH (versions verified with official docs, integration patterns researched)

---

## Executive Summary

The existing stack (Expo 54, React Native 0.81.5, Supabase, expo-sqlite) is **sound for all fixes**. No major library replacements needed. Issues are:
- **Mapa tela branca:** WebView height/layout (fix: `flex: 1` + explicit `minHeight` props, `onLoadStart`/`onLoadEnd` handlers)
- **Tokens expiring:** Supabase JWT refresh cycle misconfiguration (fix: verify `JWT expiry limit` setting, ensure `refreshSession()` called on app init)
- **Formulários offline:** SQLite persistence + sync (fix: implement outbox pattern, idempotency keys, last-write-wins conflict)
- **Sistema R1/R2/R3/R4:** Data structure & schema additions (no new deps)
- **Sincronização:** Outbox pattern + conflict detection (fix: sync state machine, SQLite transactions)
- **Logs admin:** Existing logging, display issue only
- **Mensagens pt-br:** String catalog, no code change
- **Cadastro municípios:** Data fetch/validation, no new deps

**New dependencies:** Optional Drizzle ORM (for structured migrations), otherwise manual SQL.

---

## 1. Mapa — react-native-webview + Leaflet.js (Tela Branca)

### Current Configuration
```typescript
// Existing (broken)
<WebView
  source={{ uri: leafletHtmlUrl }}
  style={{ flex: 1 }}
/>
```

### Root Cause Hypothesis
1. **Height = 0:** WebView receives `flex: 1` but container has no explicit height (parent View doesn't constrain space)
2. **Leaflet viewport:** HTML uses `height: 100vh` which resolves to 0px in WebView context (native platform limitation)
3. **Missing layout handlers:** No `onLoadStart`/`onLoadEnd` to trigger re-layout after Leaflet initializes
4. **Android WebView rendering:** Needs explicit `minHeight` or `height` in addition to flex

### Fix Approach

**A. Layout Fix (Primary)**
```typescript
// Wrap WebView in View with explicit height
<View style={{ flex: 1, height: '100%' }}>
  <WebView
    source={{ uri: leafletHtmlUrl }}
    style={{
      flex: 1,
      minHeight: 300,  // Fallback minimum
    }}
    onLoadStart={() => setLoading(true)}
    onLoadEnd={() => setLoading(false)}
    startInLoadingState
  />
</View>
```

**B. Leaflet HTML Fix (Server-side)**
```html
<!-- Instead of 100vh (breaks in WebView) -->
<html>
  <body style="height: 100%; margin: 0;">
    <div id="map" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
  </body>
</html>

<script>
  // After map init, notify React Native
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'MAP_READY',
    bounds: map.getBounds()
  }));
</script>
```

**C. WebView Configuration Props**
```typescript
interface WebViewProps {
  style: StyleProp<ViewStyle>;           // flex: 1
  onLoadStart?: () => void;              // Set loading state
  onLoadEnd?: () => void;                // Clear loading state
  onMessage?: (event: WebViewMessageEvent) => void;  // Handle Leaflet events
  onNavigationStateChange?: (state: WebViewNavigation) => void;  // Track errors
  injectedJavaScript?: string;           // Inject after DOM loads
  javaScriptEnabled: boolean;            // Required for Leaflet
  scrollEnabled: boolean;                // Allow pan
  zoomEnabled: boolean;                  // Allow pinch zoom (iOS)
  scalePageToFit?: boolean;              // Android: auto-scale to fit
  androidLayerType?: "hardware" | "software";  // Hardware for performance
}
```

### New Dependencies
**None.** Use existing `react-native-webview@13+` (already in Expo 54).

### Version Verified
- `react-native-webview`: v13.0+ (compatible with Expo SDK 54 + React Native 0.81.5)
- Expo: SDK 54
- React Native: 0.81.5

### Configuration Keys to Add
```json
{
  "webview": {
    "leaflet": {
      "minHeight": 300,
      "enableOnLoadEnd": true,
      "useHardwareAcceleration": true,
      "allowFullscreen": true
    }
  }
}
```

### What NOT to Change
- Do NOT add `height: 100%` to WebView style directly (causes overflow on small screens)
- Do NOT use `fitContent` or `autoHeight` libraries (not maintained for Expo)
- Do NOT use `SafeAreaView` wrapping (complicates WebView height calculation)
- Keep existing `expo-print` + `expo-sharing` for PDF export from map

---

## 2. Tokens de Convite — Supabase Auth Session + JWT Expiry

### Current Configuration
```typescript
// Existing auth setup
const { data, error } = await supabase.auth.signUp({
  email: userEmail,
  password: userPassword,
  options: {
    data: { role: 'agent', municipio_id: municipio }
  }
});

// Missing: Invitation-specific token handling
```

### Root Cause Hypothesis
1. **JWT expiry limit too short:** Default 1 hour, invitation tokens expire before user clicks link (backend issue)
2. **No refresh on app init:** Token not automatically refreshed when app starts
3. **Single-use tokens:** Supabase `inviteUserByEmail()` uses single-use tokens with 24h expiry (hardcoded limit)
4. **Missing session persistence:** Session not restored after app restart

### Fix Approach

**A. JWT Expiry Configuration (Supabase Dashboard)**
Navigate to: **Auth → Providers → JWT Settings**
```
Current setting check:
- JWT expiry limit: [1 hour by default]
- Refresh token expiry: [604800 seconds = 7 days, ideal]
- Reuse interval: [10 seconds, allows legitimate retries]

VERIFY: Is "Single-use tokens" enabled?
If yes → invitation tokens expire in 24h (hardcoded by Supabase, cannot extend)
```

**B. Auto-Refresh on App Init**
```typescript
// auth/AuthService.ts
import { useEffect } from 'react';
import { useAuth } from '@react-navigation/native';

export function AuthProvider({ children }) {
  useEffect(() => {
    // 1. Restore session from secure storage
    const restoreSession = async () => {
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          // 2. Refresh token if expired
          const { data, error } = await supabase.auth.refreshSession(session.data.session);
          if (error) throw error;
          // Token refreshed → new access_token issued
        }
      } catch (err) {
        // Session invalid, redirect to login
        signOut();
      }
    };

    restoreSession();
  }, []);

  return <>{children}</>;
}
```

**C. Invitation Flow Fix**
```typescript
// For inviting users (admin only, service_role)
const { data, error } = await supabase.auth.admin.inviteUserByEmail(
  newUserEmail,
  {
    data: {
      role: 'agent',
      municipio_id: municipio,
      invited_at: new Date().toISOString()  // Track for auto-resend if needed
    }
  }
);

// Token validity: 24 hours (Supabase hardcoded, cannot change)
// Workaround: If user reports "token expired" after 24h:
// 1. Admin can resend invitation link
// 2. Or use custom token system (out of scope for v1.2.0)
```

**D. Handle Invitation Link in App**
```typescript
// app/(auth)/accept-invite.tsx
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'expo-router';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const { token } = useSearchParams();

  useEffect(() => {
    const handleToken = async () => {
      if (!token) {
        // No token in URL
        return router.replace('/(auth)/login');
      }

      try {
        // Exchange token for session
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'invite'
        });

        if (error) {
          if (error.message.includes('expired')) {
            alert('Token expirou. Peça ao admin para reenviar o convite.');
          }
          return router.replace('/(auth)/login');
        }

        // Token valid → redirect to set password
        router.replace('/(auth)/set-password');
      } catch (err) {
        console.error('Token error:', err);
        router.replace('/(auth)/login');
      }
    };

    handleToken();
  }, [token]);

  return <LoadingScreen />;
}
```

### New Dependencies
**None.** Use existing Supabase client library.

### Version Verified
- `@supabase/supabase-js`: v2.38+ (handles JWT refresh automatically with correct config)

### Configuration Keys to Check
```json
{
  "supabase": {
    "auth": {
      "jwtExpiryLimit": 3600,  // seconds (default 1h)
      "refreshTokenExpiry": 604800,  // 7 days
      "autoRefreshSession": true,
      "invitationTokenExpiry": 86400  // 24h (hardcoded, Supabase limit)
    }
  }
}
```

### What NOT to Change
- Do NOT override Supabase JWT expiry in code (only in dashboard settings)
- Do NOT use `signUp()` for invitations (use `admin.inviteUserByEmail()` instead)
- Do NOT try to extend invitation token beyond 24h (Supabase hardcoded limit; document to users)
- Keep existing `SecureStore` for token persistence

---

## 3. Formulários Offline — expo-sqlite + Sync Outbox Pattern

### Current Configuration
```typescript
// Existing (manual, no migration management)
const db = openDatabaseSync('forms.db');
db.execSync(`
  CREATE TABLE IF NOT EXISTS formularios (
    id TEXT PRIMARY KEY,
    municipio_id TEXT,
    data TEXT,
    ... (no outbox, no sync tracking)
  )
`);
```

### Root Cause Hypothesis
1. **No outbox table:** Form data written directly to DB without sync metadata
2. **No idempotency keys:** Duplicate writes on retry cause conflicts
3. **No migration versioning:** Schema changes break without version tracking
4. **No conflict detection:** Last-write-wins not implemented
5. **No sync status:** No way to track which records need upload

### Fix Approach

**A. Schema with Outbox Pattern**
```typescript
// db/schema.ts (or use Drizzle ORM)
const formSchema = `
  CREATE TABLE IF NOT EXISTS formularios (
    id TEXT PRIMARY KEY,
    municipio_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Form data (R1/R2/R3/R4 fields)
    risco_classificacao TEXT CHECK(risco_classificacao IN ('R1', 'R2', 'R3', 'R4')),
    endereco TEXT,
    estrutura_tipo TEXT,
    data_vistoria DATE,

    -- Sync metadata
    is_synced INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(municipio_id) REFERENCES municipios(id),
    FOREIGN KEY(user_id) REFERENCES auth.users(id)
  );

  -- CRITICAL: Outbox table for pending changes
  CREATE TABLE IF NOT EXISTS formularios_outbox (
    id TEXT PRIMARY KEY,
    formulario_id TEXT NOT NULL,
    operation TEXT CHECK(operation IN ('create', 'update', 'delete')),
    payload JSON,
    idempotency_key TEXT UNIQUE NOT NULL,  -- Prevents duplicate writes on retry
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at DATETIME,
    is_synced INTEGER DEFAULT 0,

    FOREIGN KEY(formulario_id) REFERENCES formularios(id)
  );

  -- Sync metadata
  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;
```

**B. Write Operation with Outbox**
```typescript
// lib/db/formService.ts
import { v4 as uuid } from 'uuid';

export async function saveFormOffline(form: Form) {
  const db = openDatabaseSync('forms.db');
  const formularioId = form.id || uuid();
  const outboxId = uuid();
  const idempotencyKey = `${formularioId}-${Date.now()}`;  // Unique per attempt

  try {
    // 1. Write form data in transaction
    await db.withTransactionAsync(async () => {
      // Upsert form
      db.execSync(`
        INSERT OR REPLACE INTO formularios (
          id, municipio_id, user_id, risco_classificacao, endereco,
          estrutura_tipo, data_vistoria, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        formularioId,
        form.municipio_id,
        form.user_id,
        form.risco_classificacao,
        form.endereco,
        form.estrutura_tipo,
        form.data_vistoria,
        new Date().toISOString(),
        form.created_at || new Date().toISOString()
      ]);

      // 2. Insert outbox event (CRITICAL for sync)
      db.execSync(`
        INSERT INTO formularios_outbox (
          id, formulario_id, operation, payload, idempotency_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        outboxId,
        formularioId,
        form.id ? 'update' : 'create',
        JSON.stringify(form),
        idempotencyKey,
        new Date().toISOString()
      ]);
    });

    return { id: formularioId, synced: false };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      // Idempotent: same operation already queued
      console.log('Outbox event already exists (idempotent), skipping duplicate');
    }
    throw err;
  }
}
```

**C. Sync State Machine**
```typescript
// lib/sync/SyncService.ts
export async function syncFormsToSupabase() {
  const db = openDatabaseSync('forms.db');
  const supabase = createClient(URL, ANON_KEY);

  // Phase 1: Push outbox → Supabase
  console.log('[Sync] Phase 1: Pushing outbox events...');
  const outboxEvents = db.allAsync(`
    SELECT * FROM formularios_outbox
    WHERE is_synced = 0
    ORDER BY created_at ASC
  `);

  for (const event of outboxEvents) {
    try {
      const { error } = await supabase
        .from('formularios')
        [event.operation === 'delete' ? 'delete' : 'upsert'](
          event.payload,
          {
            onConflict: 'id',
            headers: {
              'Idempotency-Key': event.idempotency_key  // Prevent duplicates server-side
            }
          }
        );

      if (error) throw error;

      // Mark as synced
      db.execSync(`
        UPDATE formularios_outbox
        SET is_synced = 1, last_attempt_at = ?
        WHERE id = ?
      `, [new Date().toISOString(), event.id]);
    } catch (err) {
      // Retry logic
      db.execSync(`
        UPDATE formularios_outbox
        SET attempt_count = attempt_count + 1, last_attempt_at = ?
        WHERE id = ?
      `, [new Date().toISOString(), event.id]);

      if (attempt_count > 3) {
        // Max retries reached → log error, user will retry manually
        NotificationService.error(`Sync failed for form ${event.formulario_id}`);
      }
    }
  }

  // Phase 2: Pull changes from Supabase
  console.log('[Sync] Phase 2: Pulling server changes...');
  const lastSyncCursor = db.firstAsync(
    'SELECT value FROM sync_meta WHERE key = ?',
    ['last_pull_cursor']
  )?.value;

  const { data: serverForms, error: pullError } = await supabase
    .from('formularios')
    .select('*')
    .gt('updated_at', lastSyncCursor || '1970-01-01');

  if (pullError) throw pullError;

  // Phase 3: Resolve conflicts (last-write-wins)
  console.log('[Sync] Phase 3: Resolving conflicts...');
  for (const serverForm of serverForms) {
    const localForm = db.firstAsync(
      'SELECT * FROM formularios WHERE id = ?',
      [serverForm.id]
    );

    if (!localForm) {
      // New server form → insert
      db.execSync(`
        INSERT INTO formularios (...) VALUES (...)
      `, [...serverForm]);
    } else if (new Date(serverForm.updated_at) > new Date(localForm.updated_at)) {
      // Server newer → overwrite local
      db.execSync(`
        UPDATE formularios
        SET risco_classificacao = ?, endereco = ?, ...
        WHERE id = ?
      `, [...serverForm]);
    }
    // else: local newer → keep local (will push in Phase 1 on next sync)
  }

  // Update cursor
  db.execSync(`
    INSERT OR REPLACE INTO sync_meta (key, value)
    VALUES (?, ?)
  `, ['last_pull_cursor', new Date().toISOString()]);

  console.log('[Sync] Complete');
}
```

**D. Migration Management (Optional: Drizzle ORM)**
```typescript
// If using Drizzle ORM (recommended for maintainability)
// install: npm install drizzle-orm drizzle-kit

// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  driver: 'expo-sqlite',
  dbName: 'forms.db',
} satisfies Config;

// db/schema.ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const formularios = sqliteTable('formularios', {
  id: text('id').primaryKey(),
  municipio_id: text('municipio_id').notNull(),
  user_id: text('user_id').notNull(),
  risco_classificacao: text('risco_classificacao'),
  endereco: text('endereco'),
  is_synced: integer('is_synced').default(0),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const formularios_outbox = sqliteTable('formularios_outbox', {
  id: text('id').primaryKey(),
  formulario_id: text('formulario_id').notNull(),
  operation: text('operation').notNull(),
  payload: text('payload'),
  idempotency_key: text('idempotency_key').unique(),
  is_synced: integer('is_synced').default(0),
});

// Then run: npx drizzle-kit generate:sqlite
// This creates SQL migrations in ./drizzle folder
```

**E. Migration Execution**
```typescript
// db/migrations.ts
import { openDatabaseSync } from 'expo-sqlite';
import * as fs from 'expo-file-system';

export async function runMigrations() {
  const db = openDatabaseSync('forms.db');

  // Option 1: Manual SQL (current setup)
  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS formularios (
      id TEXT PRIMARY KEY,
      ... schema ...
    );
    CREATE TABLE IF NOT EXISTS formularios_outbox (
      ... outbox schema ...
    );
  `;
  db.execSync(migrationSQL);

  // Option 2: With Drizzle (recommended)
  // const migrations = require('./drizzle/migrations');
  // migrate(db, migrations);

  // Track version
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)
  `);
  const currentVersion = db.firstAsync('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')?.version || 0;
  const targetVersion = 5;  // Your current migration number

  if (currentVersion < targetVersion) {
    console.log(`Migrating from v${currentVersion} to v${targetVersion}`);
    // Run v${currentVersion + 1}.sql, v${currentVersion + 2}.sql, etc.
    for (let v = currentVersion + 1; v <= targetVersion; v++) {
      const migration = require(`./migrations/v${v}.sql`);
      db.execSync(migration);
    }
    db.execSync(`INSERT INTO schema_version VALUES (?)`, [targetVersion]);
  }
}
```

### New Dependencies
```bash
# Option A: Manual SQL (existing setup)
# No new dependencies

# Option B: Drizzle ORM (recommended)
npm install drizzle-orm@latest drizzle-kit@latest
```

### Version Verified
- `expo-sqlite`: v14+ (already in Expo 54)
- `drizzle-orm`: v0.30+ (supports Expo SQLite)
- `drizzle-kit`: v0.20+ (generates migrations)

### Configuration Keys to Add
```json
{
  "sqlite": {
    "dbName": "forms.db",
    "syncBatchSize": 50,
    "maxRetryAttempts": 3,
    "outboxPurgeAfterDays": 30,
    "conflictStrategy": "last-write-wins"
  }
}
```

### What NOT to Change
- Do NOT use `realm` or other ORM (adds unnecessary complexity)
- Do NOT sync directly without outbox pattern (will lose data on failures)
- Do NOT trust client timestamps alone (use server-side `updated_at` for conflict resolution)
- Keep existing `SyncService` structure, just add outbox phase

---

## 4. Sistema de Risco R1/R2/R3/R4 — Data Structure

### Current Configuration
```typescript
// Existing (no structured R1-R4 system)
type Form = {
  endereco: string;
  observacoes: string;
  ... (unstructured risk data)
}
```

### Root Cause Hypothesis
1. **No risk classification enum:** "Risco" field is text, not validated
2. **No risk criteria fields:** No R1/R2/R3/R4-specific form fields
3. **No risk score calculation:** Manual classification, no consistent rules

### Fix Approach

**A. Risk Classification Schema**
```typescript
// db/schema.ts
export enum RiscoClassificacao {
  R1 = 'R1',  // Iminente danger
  R2 = 'R2',  // High risk
  R3 = 'R3',  // Medium risk
  R4 = 'R4',  // Low risk
}

// Risk assessment criteria (per classification)
export type RiscoAvaliacao = {
  // Structural safety
  rachaduras_parede: 'sim' | 'nao' | 'nao_avaliado';
  desconexao_estrutural: 'sim' | 'nao' | 'nao_avaliado';
  deformacao_elementos: 'sim' | 'nao' | 'nao_avaliado';

  // Foundation/stability
  recalque_diferencial: 'sim' | 'nao' | 'nao_avaliado';
  desconexao_fundacao: 'sim' | 'nao' | 'nao_avaliado';

  // Exterior hazards
  queda_elementos: 'sim' | 'nao' | 'nao_avaliado';
  risco_incendio: 'sim' | 'nao' | 'nao_avaliado';
  acesso_obstruido: 'sim' | 'nao' | 'nao_avaliado';

  // Calculated classification
  classificacao_final: RiscoClassificacao;
  justificativa: string;
  recomendacoes: string;
};

export const formularios = sqliteTable('formularios', {
  id: text('id').primaryKey(),
  municipio_id: text('municipio_id').notNull(),
  user_id: text('user_id').notNull(),

  // Structural info
  endereco: text('endereco').notNull(),
  cep: text('cep'),
  lat: text('lat'),
  long: text('long'),
  estrutura_tipo: text('estrutura_tipo'),  // casa, prédio, comércio, etc.

  // Risk assessment (R1-R4)
  risco_classificacao: text('risco_classificacao')
    .notNull()
    .check(sql`risco_classificacao IN ('R1', 'R2', 'R3', 'R4')`),

  // Criteria (JSON for flexibility)
  risco_avaliacao_json: text('risco_avaliacao_json'),  // JSON-encoded RiscoAvaliacao

  // Additional fields
  observacoes: text('observacoes'),
  fotos_urls: text('fotos_urls'),  // JSON array of URLs

  // Sync metadata
  is_synced: integer('is_synced').default(0),
  is_deleted: integer('is_deleted').default(0),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

**B. Risk Classification Algorithm**
```typescript
// lib/utils/riscoUtils.ts
export function classificarRisco(avaliacao: RiscoAvaliacao): RiscoClassificacao {
  const criteriosCriticos = [
    avaliacao.desconexao_estrutural === 'sim',
    avaliacao.queda_elementos === 'sim',
    avaliacao.acesso_obstruido === 'sim',
  ];

  const criteriosAltos = [
    avaliacao.rachaduras_parede === 'sim',
    avaliacao.deformacao_elementos === 'sim',
    avaliacao.recalque_diferencial === 'sim',
  ];

  // R1: Imminent danger
  if (criteriosCriticos.filter(Boolean).length >= 2) {
    return RiscoClassificacao.R1;
  }

  // R2: High risk
  if (criteriosCriticos.some(Boolean) || criteriosAltos.filter(Boolean).length >= 2) {
    return RiscoClassificacao.R2;
  }

  // R3: Medium risk
  if (criteriosAltos.some(Boolean)) {
    return RiscoClassificacao.R3;
  }

  // R4: Low risk
  return RiscoClassificacao.R4;
}
```

### New Dependencies
**None.** Enum + utility functions only.

### Version Verified
- TypeScript: v5+ (Enum support)

### Configuration Keys to Add
```json
{
  "risco": {
    "r1_criteria": ["desconexao_estrutural", "queda_elementos"],
    "r2_criteria": ["rachaduras_parede", "deformacao_elementos"],
    "r3_criteria": ["observacoes_menores"],
    "r4_label": "Seguro"
  }
}
```

### What NOT to Change
- Do NOT hardcode classifications (use algorithm)
- Do NOT skip field validation (each R1-R4 field is required)

---

## 5. Sincronização Offline → Supabase — Outbox + Conflict Resolution

### (See Section 3 — Formulários Offline for full implementation)

**Summary:**
- **Outbox table:** Every offline write queued with idempotency key
- **Sync phases:** Push → Pull → Resolve
- **Conflict rule:** Last-write-wins (server `updated_at` vs local `updated_at`)
- **Idempotency:** Supabase `Idempotency-Key` header prevents duplicates

### Configuration Keys
```json
{
  "sync": {
    "enabled": true,
    "batchSize": 50,
    "retryMaxAttempts": 3,
    "retryDelayMs": 5000,
    "conflictResolution": "last-write-wins"
  }
}
```

---

## 6. Aba de Logs Admin — Existing Logging, Display Issue

### Current Configuration
```typescript
// Existing logging (already implemented)
// app/admin/logs.tsx displays logs from AsyncStorage
```

### Root Cause Hypothesis
- Display rendering issue (FlatList, schema mismatch), not logging issue

### Fix Approach
- No stack changes needed; this is a UI/display fix for Phase 2 (Development)
- Verify: Are logs being written? → Check AsyncStorage data
- If yes: Fix FlatList/display; If no: Add logging calls

### New Dependencies
**None.**

---

## 7. Mensagens de Erro em Português (pt-BR)

### Current Configuration
```typescript
// Existing (English error messages hardcoded)
if (error) {
  alert('Error: Token expired');
}
```

### Fix Approach
- Create string catalog in `.ts` file (no i18n library needed for single language)
- Replace hardcoded strings with catalog keys

```typescript
// locales/pt-br/errors.ts
export const errors = {
  TOKEN_EXPIRED: 'Token expirou. Peça ao administrador para reenviar o convite.',
  NETWORK_ERROR: 'Erro de conexão. Verifique sua internet e tente novamente.',
  FORM_INVALID: 'Formulário inválido. Verifique todos os campos.',
  SYNC_FAILED: 'Falha ao sincronizar dados. Tente novamente.',
};

// Usage
import { errors } from '@/locales/pt-br/errors';

if (error) {
  alert(errors.TOKEN_EXPIRED);
}
```

### New Dependencies
**None.** Use `.ts` file catalog (existing pattern in project).

---

## 8. Cadastro de Municípios — Data Fetch / Validation

### Current Configuration
```typescript
// Existing (optional RPC call, warns if missing)
const { data: municipios, error } = await supabase.rpc('get_municipios_stats');
```

### Fix Approach
- Validate RPC response schema
- Add fallback if RPC unavailable
- No stack changes needed

### New Dependencies
**None.**

---

## Stack Comparison Table

| Component | Current | Recommendation | Why |
|-----------|---------|-----------------|-----|
| **WebView** | react-native-webview v13 | Keep v13+ | Works with Expo 54, just needs layout fix |
| **Supabase Auth** | @supabase/supabase-js v2.38 | Keep v2.38+ | JWT refresh auto-works with config |
| **SQLite** | expo-sqlite v14 | Keep v14 (or add Drizzle) | Stable; Drizzle optional for migrations |
| **Sync Pattern** | Manual | Add outbox pattern | Prevents data loss, handles retries |
| **Conflict Resolution** | None | last-write-wins | Simple, sufficient for this domain |
| **Risk Classification** | Unstructured | Add R1/R2/R3/R4 enum | Type safety, consistency |
| **String Catalog** | English hardcoded | Create pt-br catalog | Maintainability, localization ready |
| **Logging** | Existing | No change | Display fix only |

---

## Installation / Verification

### Current Stack (Verify Versions)
```bash
# Check what's installed
npm list expo react-native react @supabase/supabase-js react-native-webview expo-sqlite

# Expected:
# expo@54.x.x
# react-native@0.81.5
# react@19.x.x
# @supabase/supabase-js@2.38+
# react-native-webview@13+
# expo-sqlite@14+
```

### Optional: Add Drizzle ORM (Recommended for Migrations)
```bash
npm install -D drizzle-orm drizzle-kit

# Generate migrations
npx drizzle-kit generate:sqlite --config drizzle.config.ts

# Create migrations in ./drizzle folder (SQL files)
```

### No Upgrades Needed
The existing stack supports all fixes. Only add Drizzle if you want managed migrations.

---

## Known Limitations & Workarounds

| Issue | Limitation | Workaround |
|-------|-----------|-----------|
| **Invitation tokens** | Supabase hardcodes 24h expiry | Document to admins; use resend link feature |
| **WebView height** | 100vh doesn't work in native context | Use flex layout + explicit minHeight |
| **SQLite migrations** | Manual SQL vs ORM | Use Drizzle for large projects; manual SQL OK for v1.2.0 |
| **Offline sync** | Complex conflict resolution | Start with last-write-wins; upgrade if needed |

---

## Summary of Configuration Changes

**Add to app config / .env:**
```bash
# Supabase (verify existing)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx  # For admin operations only, never expose to client

# JWT Settings (check in Supabase Dashboard)
# Auth → Providers → JWT Settings
# - JWT expiry limit: 3600 (1 hour, default)
# - Refresh token expiry: 604800 (7 days)
# - Reuse interval: 10 (seconds)

# App config
SYNC_ENABLED=true
SYNC_BATCH_SIZE=50
CONFLICT_STRATEGY=last-write-wins
```

---

## Sources

- [react-native-webview Expo Documentation](https://docs.expo.dev/versions/latest/sdk/webview/)
- [react-native-webview GitHub Reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md)
- [Supabase Sessions & JWT](https://supabase.com/docs/guides/auth/sessions)
- [Supabase JWT Configuration](https://supabase.com/docs/guides/auth/jwts)
- [Expo SQLite Local-First Guide](https://docs.expo.dev/guides/local-first/)
- [Outbox Pattern for Offline Sync](https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli)
- [Drizzle ORM with Expo SQLite](https://orm.drizzle.team/docs/get-started/expo-new)
- [Supabase inviteUserByEmail API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
