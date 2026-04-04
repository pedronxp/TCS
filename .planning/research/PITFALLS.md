# Domain Pitfalls: v1.2.0 Critical Fixes

**Project:** Defesa Civil — App de Vistoria Técnica
**Milestone:** v1.2.0 (Correções Críticas + Funcionalidades Core)
**Researched:** 2026-03-31
**Context:** Fixing critical bugs in existing production app (v1.1.0) with offline-first SQLite + Supabase sync

---

## Fix Area 1: React Native WebView + Leaflet Map

**Current state:** Map shows white screen, never functioned since beginning
**Target:** Fix white screen, render Leaflet map in WebView

### Critical Pitfalls

#### 1.1 WebView Layout Dimensions
**What goes wrong:** White screen or 1px height container, map never initializes
**Why it happens:**
- WebView requires explicit `height` and `width` props
- Parent View container needs `flex: 1` or fixed dimensions
- `useWindowDimensions()` may not trigger layout recalculation
- React Native doesn't auto-inherit CSS display properties

**Consequences:**
- Map component renders but invisible
- No error warnings (silent failure)
- Hard to debug without React DevTools inspection

**Prevention:**
- Set `style={{flex: 1}}` on parent container
- Explicitly pass `height` and `width` to `<WebView>` (not inherited)
- Use `onLoadingFinish` callback to verify WebView initialization
- Test on both Android emulator and physical device (layout may differ)

**Detection:**
- Map appears blank after 3+ seconds of load
- `onLoadingFinish` callback fires but no visual content
- Inspect via Android Studio device inspector

#### 1.2 Leaflet HTML Asset Loading in WebView
**What goes wrong:** Leaflet CSS/JS not found, map elements non-interactive or styled incorrectly
**Why it happens:**
- WebView security requires absolute file paths or data URIs for local assets
- Relative URLs (e.g., `../leaflet/leaflet.js`) fail silently in WebView
- Expo asset paths differ from web build paths
- Some react-native-webview-leaflet versions expect `expo-asset-utils` (now unmaintained)

**Consequences:**
- Map renders but no styling (missing leaflet.css)
- Map interactive controls missing
- Tiles don't load or load as blank/error states

**Prevention:**
- Use absolute file paths: `file:///` for bundled assets or `require()` for imports
- Embed Leaflet HTML as inline string if assets path unclear
- Include Leaflet CSS and JS in single HTML file to avoid path issues
- Test asset loading with `onError` callback on WebView
- Avoid `react-native-webview-leaflet` v4.2.x–v4.3.0 (asset-utils dependency issues)

**Detection:**
- Network tab shows 404 for CSS/JS files
- Map appears unstyled (missing colors, borders)
- Zoom/pan controls unresponsive

#### 1.3 PostMessage Communication Latency
**What goes wrong:** JavaScript-to-React Native bridge too slow, commands don't execute in sync
**Why it happens:**
- `WebView.postMessage()` is asynchronous and batched
- Map pan/zoom commands sent before map fully initializes
- No acknowledgment mechanism for command execution
- Multiple commands in rapid succession may race

**Consequences:**
- User taps marker, map doesn't pan to it immediately
- Location updates arrive faster than WebView processes them
- User perception: app feels broken/unresponsive

**Prevention:**
- Add `onMessage` handler in WebView with command queue
- Delay map commands until `onLoadingFinish` + 500ms buffer
- Send location updates in throttled batches (max 1 per 200ms)
- Implement command ACK: WebView responds `{ack: true}` before React Native sends next command
- Test with location enabled + moving marker updates simultaneously

**Detection:**
- Marker not updating on location change
- Pan command issued but map stays centered elsewhere
- Console lag or dropped frames (check with React Profiler)

#### 1.4 Android WebView Permissions (Location, Storage)
**What goes wrong:** Geolocation API blocked, map can't show user location or load tiles
**Why it happens:**
- Android requires `android.permission.ACCESS_FINE_LOCATION` in `app.json`
- WebView geolocation policy different from Expo location permissions
- Some devices require user to enable location in WebView settings
- Supabase storage URLs may be blocked if WebView doesn't allow HTTPS mixed content

**Consequences:**
- Marker appears at 0,0 (default) instead of user location
- Map shows blank tiles (failed HTTPS requests)
- Feature appears broken to users with strict security profiles

**Prevention:**
- Add to `app.json` under `android.permissions`:
  ```json
  {
    "name": "android.permission.ACCESS_FINE_LOCATION",
    "maxSdkVersion": 32
  },
  {
    "name": "android.permission.ACCESS_COARSE_LOCATION",
    "maxSdkVersion": 32
  }
  ```
- Test location explicitly: `navigator.geolocation.getCurrentPosition()` in WebView
- Allow mixed HTTPS/HTTP: Set `WebView` prop `mixedContentMode="always"`
- Request location permission separately with `expo-location` BEFORE opening map screen

**Detection:**
- Location stays at (0, 0) in map
- Console error: "Geolocation API deprecated" or permission denied
- Network requests to tile server blocked (ERR_BLOCKED_BY_CLIENT)

---

## Fix Area 2: Supabase Invite Tokens (Expiry)

**Current state:** Tokens created show "expired" immediately after creation
**Target:** Tokens valid for 7 days without premature expiry

### Critical Pitfalls

#### 2.1 Email Prefetching False Expiry
**What goes wrong:** Token marked "expired" immediately in email, but actually valid in app
**Why it happens:**
- Email clients (Gmail, Outlook) auto-fetch URLs in emails to check for malicious links
- Email security tools (Sandboxes, firewalls) access token URLs to scan them
- Token used up by prefetch, original user gets "token expired" error
- `expires_at` timestamp consumed before user can click

**Consequences:**
- User receives invite, clicks link, sees "Token has expired or is invalid"
- User can't register, blames app/company
- Support requests spike

**Prevention:**
- **Single-use tokens should not be embedded in email URLs**
  - Instead, embed a non-expiring session code (e.g., `invite_code_xyz`)
  - In app, user clicks "Accept Invite", calls API with `invite_code_xyz` to exchange for token
  - API validates and consumes token then
- If tokens must be in URLs:
  - Use POST-only endpoints (not GET) to prevent prefetch consumption
  - Add rate-limiting per IP to detect prefetch patterns
  - Log prefetch attempts (User-Agent contains "bot" or "crawler")
- Add `X-Robots-Tag: noindex` header to token URLs (Email clients ignore but documents intent)

**Detection:**
- Admin panel shows token created 1 minute ago
- User sees "expired" error same minute
- Check Supabase auth logs for auto_confirm events from unknown IPs/locations

#### 2.2 Token TTL vs. JWT Refresh Token Confusion
**What goes wrong:** Invite token expires, but app conflates with JWT refresh token expiry
**Why it happens:**
- Supabase has **two different token types**:
  1. Invite tokens (single-use, custom TTL)
  2. JWT access/refresh tokens (always renewed automatically)
- `supabase.auth.refreshSession()` doesn't extend invite token expiry
- Developer assumes refresh token fixes invite issue (it doesn't)

**Consequences:**
- Even if JWT refresh works, invite still fails
- Fix attempted in wrong layer (auth vs. invite)
- Problem persists despite "fixing" token refresh logic

**Prevention:**
- Treat **invite token workflow separately** from JWT workflow:
  - Invite token: custom table `invite_tokens(code, email, created_at, expires_at, consumed_at)`
  - JWT token: Supabase auth (access + refresh)
- Verify Supabase project auth settings:
  - Go to Project Settings → Auth → Email Confirm Duration (should be ≥7 days)
  - This controls invite token validity, not JWT expiry
- Check `auth.users.email_confirmed_at` — if NULL, invite not yet claimed
- Test: Create invite, wait 24 hours, verify it still works

**Detection:**
- `supabase.auth.refreshSession()` succeeds but invite still fails
- Check Supabase PostgreSQL: `SELECT * FROM auth.users WHERE email = 'test@...';`
  - If `email_confirmed_at` is NULL, confirmation not completed
  - If `created_at` is > 7 days ago, confirmation link may have expired

#### 2.3 Time Synchronization Between Client and Server
**What goes wrong:** Client clock skewed (±hours), token marked expired when actually valid
**Why it happens:**
- Device has incorrect system time (common on old phones, new installs)
- Server timestamp in Supabase doesn't match device time
- Token expiry checked client-side before server validation
- No NTP sync on app startup

**Consequences:**
- User can't register despite token being valid on server
- Works for users with correct system time, fails for others
- Intermittent, hard to reproduce

**Prevention:**
- **Never trust client time for expiry validation**
  - Always validate on server: `created_at + expires_in > NOW()`
- Add NTP sync to app startup:
  ```typescript
  import { NtpClient } from 'ntp-client'; // or similar
  const serverTime = await fetchServerTime(); // GET /api/time
  const skew = Date.now() - serverTime;
  ```
- Log and warn if skew > 5 minutes
- If skew > 1 hour, prompt user to fix device time
- In Supabase, store both `created_at` and `expires_at` with server NOW()

**Detection:**
- User can't register, but Supabase logs show token still valid
- Invite works for admin but fails for regular users
- Check device settings: Settings → Date & Time → automatic enabled?

#### 2.4 Token Rate-Limiting Confusion
**What goes wrong:** User tries to create multiple invites, second one blocked/expired immediately
**Why it happens:**
- Supabase rate-limits `auth.admin.inviteUserByEmail()` to prevent abuse
- User tries to resend invite after first one "expires", gets throttled
- Token from first request may be consumed, second request fails
- No clear error message distinguishing rate-limit from expiry

**Consequences:**
- Admin can't resend invites
- User creates new account instead of using invite
- Audit trail breaks (user_type mismatch)

**Prevention:**
- Check Supabase rate-limit headers after each invite request:
  ```typescript
  const { data, error, headers } = await supabase.auth.admin.inviteUserByEmail(email);
  const remaining = headers['X-RateLimit-Remaining'];
  if (remaining === '0') {
    // Wait before next invite
  }
  ```
- Implement frontend cooldown: disable "Send Invite" button for 60s after submission
- Store invite state in SQLite: `{email, created_at, status: 'pending'}`
  - Don't allow second invite until 24 hours elapsed
  - Show countdown to user
- Test resend flow: create invite → wait min(1 hour, until rate-limit resets) → create second invite

**Detection:**
- Supabase logs show both invites created but second shows early expiry
- Rate-limit headers show `X-RateLimit-Remaining: 0`
- Admin panel shows "Send Invite" button remains disabled >60s

---

## Fix Area 3: SQLite Schema Changes & Migrations

**Current state:** App has v1–v5 migrations, adding new fields without test coverage
**Target:** Add new columns to offline schema, sync with Supabase safely

### Critical Pitfalls

#### 3.1 Asymmetric Schema Between SQLite and Supabase
**What goes wrong:** New column added to Supabase table, but not in SQLite migrations; app crashes on sync
**Why it happens:**
- Schema changes made directly in Supabase console
- SQLite migration not added before deploying app update
- Sync code tries to INSERT/UPDATE with missing columns
- Offline-first: user's device has old schema, sync fails

**Consequences:**
- App crashes on first sync attempt
- User loses offline data if they're forced to clear cache
- Requires new APK build + Play Store release (can't use EAS Update)
- Users stuck offline until they update

**Prevention:**
- **Schema change protocol (MUST be enforced)**:
  1. Write SQLite migration first (v6, v7, etc.)
  2. Update Supabase schema via migration SQL
  3. Update sync code to handle new columns
  4. Test on fresh device (old schema) AND existing device (migrate then sync)
- Create migration before deploying to Supabase:
  ```typescript
  // db.ts migration v6
  const migrations = [
    // ... v1-v5
    {
      version: 6,
      up: async (db) => {
        await db.execAsync(
          `ALTER TABLE vistorias ADD COLUMN novo_campo TEXT;`
        );
      },
      down: async (db) => {
        // Keep for safety, don't actually use
        await db.execAsync(
          `ALTER TABLE vistorias DROP COLUMN novo_campo;`
        );
      },
    },
  ];
  ```
- Test migrations in CI:
  - Run v1-v5 sequentially on fresh DB
  - Verify schema matches expected
  - Don't ship code if migration fails
- Use `PRAGMA schema_version` to track applied migrations

**Detection:**
- Sync throws `SQLITE_ERROR: no such column: novo_campo`
- App works offline, crashes on upload
- Supabase has column, SQLite doesn't

#### 3.2 Missing Column Default Values in Legacy Devices
**What goes wrong:** New column added without DEFAULT, old rows have NULL, app expects non-null value
**Why it happens:**
- Migration adds column but not DEFAULT value
- Existing SQLite rows get NULL for new column
- App code assumes column is always non-null, crashes on read
- Sync may fail if Supabase column is NOT NULL

**Consequences:**
- Reading old records throws: `Cannot read property 'length' of null`
- Sync fails with constraint violation (NOT NULL)
- Feature silently breaks for old data

**Prevention:**
- Always add DEFAULT when adding columns:
  ```sql
  ALTER TABLE vistorias ADD COLUMN novo_campo TEXT DEFAULT '';
  ```
- If adding to existing rows:
  - Use UPDATE to backfill: `UPDATE vistorias SET novo_campo = '' WHERE novo_campo IS NULL;`
- Verify with data query before migration ships:
  ```typescript
  const rows = await db.getAllAsync('SELECT COUNT(*) as cnt FROM vistorias WHERE novo_campo IS NULL;');
  if (rows[0].cnt > 0) throw new Error('Backfill failed');
  ```
- Test migration on device with existing offline data

**Detection:**
- Sync error: `NOT NULL constraint failed: vistorias.novo_campo`
- App crashes reading offline record: `Cannot read... null`
- Null values in Supabase for old records post-sync

#### 3.3 Sync Batching Not Updated for New Columns
**What goes wrong:** New column added to schema, but SyncService doesn't include it in SELECT/INSERT
**Why it happens:**
- SyncService uses hardcoded column list: `SELECT id, nome, ... FROM vistorias`
- Migration adds new column but SyncService not updated
- Offline edits don't sync new column value
- Supabase receives partial data, defaults new column to NULL

**Consequences:**
- User enters data in new field, goes offline, field lost on sync
- Data corruption: new field always NULL after sync
- Feature appears broken offline

**Prevention:**
- Use `SELECT *` in SyncService if possible:
  ```typescript
  const changes = await db.getAllAsync('SELECT * FROM vistorias WHERE sync_status = ?', ['pending']);
  ```
- If hardcoded columns required, update with migration:
  ```typescript
  // When v6 migration runs, update SyncService columns
  const syncColumns = ['id', 'nome', 'municipio_id', 'novo_campo', ...];
  ```
- Test sync with new column:
  - Create record with new field offline
  - Go online, sync
  - Verify field uploaded to Supabase

**Detection:**
- Supabase records have NULL for new column despite offline data
- SyncService logs show old column list

#### 3.4 Concurrent Migration Execution on Multiple Devices
**What goes wrong:** Two devices sync at same time, both run migration v6, schema conflict
**Why it happens:**
- SQLite migration doesn't have locking mechanism
- If app opens on two devices simultaneously, both execute migrations
- Second device's migration fails or corrupts schema
- `PRAGMA schema_version` not incremented atomically

**Consequences:**
- One device's schema invalid
- Sync fails permanently until cache cleared
- Data loss if user forced to wipe app

**Prevention:**
- Wrap migration in transaction with lock:
  ```typescript
  const runMigrations = async (db: SQLiteDatabase) => {
    await db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync('PRAGMA schema_version;');
      for (const migration of migrations) {
        if (migration.version > version.schema_version) {
          await migration.up(db);
          await db.execAsync(`PRAGMA schema_version = ${migration.version};`);
        }
      }
    });
  };
  ```
- Test with: Open app simultaneously on 2 emulators, both at db initialization
- Verify only one migration runs, second blocks until first completes

**Detection:**
- SQLite error: `database is locked`
- One device succeeds, other shows schema mismatch
- Check logs: `PRAGMA schema_version` inconsistent across devices

---

## Fix Area 4: SyncService Extension (New Entity Types)

**Current state:** SyncService handles `vistorias`, `formularios`, `riscos`
**Target:** Add new entity types safely without breaking existing sync

### Critical Pitfalls

#### 4.1 Batch Sync Size Explosion
**What goes wrong:** Adding entities to sync causes batch size to explode, network timeouts or memory overload
**Why it happens:**
- Each entity type adds to sync payload: new entity A + new entity B + new entity C = 3x data
- Network timeout on large batches (default 30s)
- Mobile may not have bandwidth for larger payloads
- Memory spike when loading all entities at once

**Consequences:**
- Sync times out and fails
- App uses too much RAM, crashes on low-end devices
- Users with slow 3G connections sync never completes

**Prevention:**
- Split sync into separate calls per entity type:
  ```typescript
  await syncVistorias();
  await syncFormularios();
  await syncRiscos();
  await syncNewEntityA(); // Add separately
  ```
- Implement per-entity batch limits:
  ```typescript
  const batchSize = 50; // Records per sync call
  const vistorias = await db.getAllAsync(
    'SELECT * FROM vistorias WHERE sync_status = ? LIMIT ?',
    ['pending', batchSize]
  );
  ```
- Add sync progress UI: show which entity is syncing, ETA
- Test on slow network (Chrome DevTools throttle to 3G)
- Monitor sync size: warn if payload > 5MB

**Detection:**
- Sync fails with timeout after adding new entity
- App shows loading >60s on 3G connection
- Memory profiler shows spike during sync

#### 4.2 Idempotency Loss When Adding New Entity Type
**What goes wrong:** New entity syncs, gets uploaded, then sync crashes midway; retry creates duplicates
**Why it happens:**
- No idempotency key (`sync_id`) for new entity type
- If sync fails after new entity uploaded but before sync_status updated, retry creates duplicate
- Supabase INSERT succeeds twice, constraint violation
- Or: updates with duplicate data, corrupting record count

**Consequences:**
- Duplicate records in Supabase
- Admin reports see inflated numbers
- Data auditing breaks

**Prevention:**
- **Every entity must have unique sync ID**:
  ```sql
  ALTER TABLE new_entity ADD COLUMN sync_id TEXT UNIQUE;
  ```
- In SyncService, use upsert (conflict resolution):
  ```typescript
  const upsert = `
    INSERT INTO new_entity_remote (sync_id, data)
    VALUES (?, ?)
    ON CONFLICT(sync_id) DO UPDATE SET data = excluded.data;
  `;
  ```
- Mark entity synced BEFORE sending (pessimistic):
  ```typescript
  await db.runAsync('UPDATE new_entity SET sync_status = ? WHERE id = ?', ['syncing', id]);
  // Then upload
  // Only mark 'synced' if response successful
  ```
- Test: Create record → sync → network error mid-way → retry → verify no duplicates

**Detection:**
- Supabase has duplicate records with same `sync_id`
- Admin log query shows same entity twice on same timestamp

#### 4.3 Foreign Key Constraints with New Entity Types
**What goes wrong:** New entity references existing entity (e.g., foto references vistoria), but deletion order breaks constraint
**Why it happens:**
- SQLite foreign keys disabled by default (`PRAGMA foreign_keys = OFF`)
- New entity type references existing table, but constraint not enforced
- Delete vistoria, orphaned fotos remain in SQLite
- Sync pushes orphaned records to Supabase, constraint violation

**Consequences:**
- Orphaned records in local SQLite, can't sync
- Supabase rejects upload: foreign key violation
- Manual cleanup required

**Prevention:**
- Enable foreign keys in db initialization:
  ```typescript
  await db.execAsync('PRAGMA foreign_keys = ON;');
  ```
- Add foreign key constraint to new entity:
  ```sql
  CREATE TABLE fotos (
    id INTEGER PRIMARY KEY,
    vistoria_id INTEGER NOT NULL,
    FOREIGN KEY(vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE
  );
  ```
- Test deletion: Delete vistoria → verify fotos deleted cascaded
- In SyncService, respect deletion order: delete child before parent

**Detection:**
- Sync fails: `FOREIGN KEY constraint failed`
- SQLite error: `foreign key constraint failed (code 19)`
- Orphaned records in local DB but not in Supabase

#### 4.4 Conflict Resolution Missing for New Entity Type
**What goes wrong:** User edits record offline on Device A, admin edits same record on Supabase from Device B; sync creates conflict
**Why it happens:**
- New entity type added without conflict detection logic
- SyncService merges last-write-wins without checking timestamps
- Offline edit ignored if server edit is newer (data loss)
- Or: offline edit overwrites server, losing admin's changes

**Consequences:**
- Data loss: one user's edits silently discarded
- No audit trail of what happened
- User confused: "I entered data but it's gone"

**Prevention:**
- Add `updated_at` timestamp to new entity:
  ```sql
  ALTER TABLE new_entity ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  ```
- In SyncService, check before overwriting:
  ```typescript
  const remote = await fetchFromSupabase(id);
  const local = await db.getFirstAsync('SELECT * FROM new_entity WHERE id = ?', [id]);

  if (local.updated_at < remote.updated_at) {
    // Server is newer, pull and overwrite
    await db.runAsync('UPDATE new_entity SET ... WHERE id = ?', [remote]);
  } else {
    // Local is newer, push to server
    await pushToSupabase(local);
  }
  ```
- For critical conflicts, don't auto-resolve:
  - Flag as conflict in SQLite: `conflict_status = 'unresolved'`
  - Show UI: "This record was edited elsewhere, review changes"
  - Let user choose: keep local, take remote, or merge manually
- Test: Edit locally on Device A (offline) + edit remotely on Device B → sync both → verify conflict handled

**Detection:**
- User's offline edit missing after sync, no warning
- Supabase has older timestamp than local SQLite
- Admin's change overwritten without notification

---

## Fix Area 5: Error Message Translation (i18n)

**Current state:** Errors in English, need pt-br translation across entire app
**Target:** All error messages in Portuguese, no missing translations

### Critical Pitfalls

#### 5.1 Layout Regressions from Text Length Variance
**What goes wrong:** Portuguese error messages longer than English, buttons overflow or text cuts off
**Why it happens:**
- English is compact (10 chars avg per word)
- Portuguese adds gender/articles: "O formulário é obrigatório" (25 chars) vs. "Form is required" (15 chars)
- Fixed-width buttons designed for English won't fit
- Dialog padding assumes max 30 chars per line, Portuguese needs 40+

**Consequences:**
- Error text clips (e.g., "O formulário é..." without period)
- Buttons expand off-screen
- UI looks broken on production
- Especially bad on small phones

**Prevention:**
- Design buttons/dialogs with flexbox, not fixed width:
  ```typescript
  <Button style={{maxWidth: 'auto'}} label={t('error.required')} />
  ```
- Test each error message on 4.5" phone screen (Google Pixel 2a)
- Enforce max-line test: measure rendered text width
  ```typescript
  const maxWidth = 320; // px on small phone
  const textWidth = measureText(message);
  if (textWidth > maxWidth) console.warn(`Text overflow: ${message}`);
  ```
- Use i18n tool that enforces max length per key (e.g., Crowdin)
- Snapshot test UI with each locale: Portuguese shows no clipping

**Detection:**
- Error dialog shows "Formulário é obrig..." (text cut)
- Button text overflows button bounds
- Snapshot test fails for pt-br locale

#### 5.2 Missing Translation Keys During Push
**What goes wrong:** Error message not translated, app shows key "error.network_timeout" instead of text
**Why it happens:**
- Translation file incomplete at deploy time
- New error added to code, translation not added to `pt.json`
- CI doesn't check for missing keys
- Falls back to key name instead of user-friendly message

**Consequences:**
- User sees: "error.network_timeout" instead of "Erro de conexão"
- Looks unprofessional, confuses users
- Support gets confused messages

**Prevention:**
- Add i18n linting to CI:
  ```bash
  # Check all keys in code exist in translation file
  npx i18n-check \
    --source src/ \
    --translation locales/pt.json \
    --fallback locales/en.json
  ```
- Require translation keys be added **before** error message code ships
- Add fallback UI component that shows warning in dev:
  ```typescript
  const t = (key: string, fallback?: string) => {
    const value = translations[key];
    if (!value) {
      if (__DEV__) console.warn(`Missing translation: ${key}`);
      return fallback || key;
    }
    return value;
  };
  ```
- In production, use English fallback, never show key name
- Set up Crowdin or i18next for automated sync

**Detection:**
- App shows "error.validation.email" instead of translated text
- User message contains dots (sign of untranslated key)
- CI check fails: "error.required not in pt.json"

#### 5.3 Inconsistent Error Message Tone and Terminology
**What goes wrong:** Same error translated differently in different places, or professional/casual tone inconsistent
**Why it happens:**
- Multiple developers translate independently
- No translation glossary (e.g., "Erro" vs. "Problema", "falhou" vs. "não conseguiu")
- Copy-paste errors between files
- Professional vs. casual tone mixed

**Consequences:**
- App feels unprofessional, non-native
- Users confused by inconsistent terminology
- Admin can't build mental model of error types

**Prevention:**
- Create translation glossary (shared document):
  ```
  erro → Erro (always capitalized)
  falhou → Falhou (past tense for user actions)
  não conseguiu → Não conseguiu (permission denied)
  rede → conexão (network, not "rede" in errors)
  formulário → formulário (lowercase when embedded in sentence)
  ```
- Use consistent error message pattern:
  ```
  "Erro: {specific message}" (for admins)
  "Não conseguimos {action}. Tente novamente." (for users)
  ```
- Have native Portuguese speaker review all error strings
- Use translation management tool with context (Crowdin)
  - Include screenshot of where error appears
  - Show previous translations to maintain consistency

**Detection:**
- Search codebase for "Erro de" — multiple variations
- A/B compare error messages across screens
- Native speaker says "This doesn't sound natural"

#### 5.4 Date/Number Format Not Localized with Strings
**What goes wrong:** Error message translated but date/number still in English format
**Why it happens:**
- `toLocaleString()` not called for embedded dates/numbers
- Message: "Erro: arquivo de 2.5MB muito grande" (English decimal point)
- Portuguese uses comma: "2,5MB"
- Date: "Error: deadline 03/15/2026" (US format) but should be "15/03/2026" (Brazil)

**Consequences:**
- Mixed language/format looks broken
- User confused by date interpretation (03/15 could be March 15 OR 3:15)
- Unprofessional appearance

**Prevention:**
- Use i18n for all format strings, not just text:
  ```typescript
  const formatted = new Intl.NumberFormat('pt-BR').format(size);
  const msg = t('error.file_too_large', { size: formatted });
  // error.file_too_large = "Arquivo de {{size}} é muito grande"
  ```
- Test messages with embedded values:
  - Date: "Prazo: {{date}}" → "Prazo: 15 de março de 2026"
  - Number: "Tamanho: {{size}}" → "Tamanho: 2,5 MB"
  - Time: "Tentaremos novamente em {{time}}" → uses HH:MM format

**Detection:**
- Error shows "2.5MB" (dot) instead of "2,5MB" (comma)
- Date appears as "03/15/2026" in error message
- Mixed Portuguese text and English numbers

---

## Fix Area 6: Admin Log Queries (Supabase PostgreSQL)

**Current state:** Admin logs tab shows errors or slow performance
**Target:** Fast, accurate admin activity logs

### Critical Pitfalls

#### 6.1 RLS Policies Blocking Admin Log Queries
**What goes wrong:** Admin can't view logs due to RLS policy, sees empty/error
**Why it happens:**
- RLS policy set to `auth.uid() = user_id` (restricts to own logs only)
- Admin needs to see ALL users' logs, but RLS blocks it
- Admin's user_id ≠ other users' user_id
- No admin-override policy exists

**Consequences:**
- Admin sees empty log list
- Admin sees error: "permission denied"
- Feature unusable for auditing

**Prevention:**
- Create admin-aware RLS policy:
  ```sql
  CREATE POLICY admin_view_logs ON audit_logs
    FOR SELECT
    USING (
      auth.uid() = user_id
      OR
      (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'master_admin')
    );
  ```
- Test as non-admin: can only see own logs
- Test as admin: can see all logs
- Alternative: Create logs table with no RLS, access only via stored procedure
  ```sql
  CREATE FUNCTION get_audit_logs(p_limit INT DEFAULT 100)
  RETURNS TABLE (...) AS $$
  BEGIN
    -- Check caller is admin inside function
    IF (SELECT role FROM users WHERE id = auth.uid()) NOT IN ('admin', 'master_admin') THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
    RETURN QUERY SELECT * FROM audit_logs LIMIT p_limit;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```

**Detection:**
- Admin clicks "Logs" tab, sees empty list
- Browser console shows 403 error
- Supabase logs show `permission denied` for admin user

#### 6.2 Missing Indexes on Log Queries (Performance)
**What goes wrong:** Log query scans entire table, takes 30+ seconds, times out
**Why it happens:**
- `audit_logs` table has 100k+ rows
- Query: `SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '7 days'`
- No index on `created_at`, full table scan
- Mobile app timeout (default 30s)

**Consequences:**
- Admin clicks "Logs", waits 30+ seconds, times out
- Empty result, looks like bug
- Feature unusable

**Prevention:**
- Add indexes for common queries:
  ```sql
  CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
  CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
  CREATE INDEX idx_audit_logs_action ON audit_logs(action);
  -- Composite for common filter
  CREATE INDEX idx_audit_logs_user_action_time
    ON audit_logs(user_id, action, created_at DESC);
  ```
- Test query plan:
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM audit_logs
  WHERE user_id = 'abc-123'
    AND created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC;
  ```
- Verify "Seq Scan" → "Index Scan" after adding index
- Check Supabase Performance Advisor dashboard
- Monitor query time in production: `pg_stat_statements`

**Detection:**
- Query takes >5 seconds
- EXPLAIN shows "Seq Scan" on large table
- Admin experience: timeouts, empty results
- Supabase logs show slow query warnings

#### 6.3 Unbounded Queries (No LIMIT)
**What goes wrong:** Admin clicks "Logs", query loads 10,000 rows, app crashes
**Why it happens:**
- Log query has no LIMIT:
  ```sql
  SELECT * FROM audit_logs WHERE user_id = ?;
  ```
- Result set huge (100k+ rows)
- App tries to parse/display all rows
- Memory overload, crash

**Consequences:**
- Admin app crashes
- Data never displayed
- Feature broken

**Prevention:**
- Always add LIMIT + pagination:
  ```sql
  SELECT * FROM audit_logs
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT 100
  OFFSET ?;
  ```
- In app, implement pagination:
  ```typescript
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchLogs = async (pageNum: number) => {
    const data = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pageNum * limit, (pageNum + 1) * limit - 1);
    setLogs(data);
  };
  ```
- Show UI indicator: "Showing 1–50 of 1,245 logs"
- Default view: last 7 days, not all-time

**Detection:**
- App crashes when opening Logs tab
- Memory usage spikes >100MB
- Network request shows 10MB+ response

#### 6.4 RLS Function Overhead (Slow Evaluation per Row)
**What goes wrong:** Query with RLS function (e.g., checking role for each row) scans 100k rows, evaluates function on each — takes minutes
**Why it happens:**
- RLS policy uses function: `(SELECT role FROM users WHERE id = auth.uid())`
- Function called **for every row evaluated**
- 100k rows × function call = 100k+ queries equivalent
- No function result caching

**Consequences:**
- Admin views logs, waits 2+ minutes (timeout)
- Query cancelled, results lost
- Feature completely unusable

**Prevention:**
- Cache role in session (not in function):
  ```typescript
  // Once at login
  const session = await supabase.auth.getSession();
  const user = await supabase.from('users').select('role').eq('id', session.user.id).single();
  localStorage.setItem('user_role', user.role);

  // Use in RLS
  // Not ideal, but avoids function per-row cost
  ```
- Or: Use SET role in transaction:
  ```sql
  SET LOCAL role = (SELECT role FROM users WHERE id = auth.uid());
  SELECT * FROM audit_logs WHERE ...;
  ```
- Rewrite RLS to use indexed column:
  ```sql
  -- Instead of function check per row
  CREATE POLICY admin_logs ON audit_logs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND role IN ('admin', 'master_admin')
      )
    );
  ```
- Test with real data (1M rows) in staging

**Detection:**
- Query takes >60 seconds
- CPU usage very high
- Database slow log shows same function called millions of times
- Supabase query advisor: "Function evaluated per-row"

#### 6.5 Incorrect Timestamp Comparison (Timezone Issues)
**What goes wrong:** Logs filter by date, but timezone mismatch causes wrong results
**Why it happens:**
- Device in São Paulo (UTC-3), server in UTC
- Query: `created_at > '2026-03-31 00:00:00'` (UTC)
- User expects São Paulo midnight (2026-03-31 03:00:00 UTC)
- Results off by hours/day

**Consequences:**
- Admin filters "Today's logs", sees logs from yesterday
- Missing logs from today
- Audit trail inaccurate

**Prevention:**
- Always store timestamps in UTC:
  ```sql
  ALTER TABLE audit_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
  ```
- Convert to user's timezone in app (not in query):
  ```typescript
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g., 'America/Sao_Paulo'
  const logsInUserTZ = logs.map(log => ({
    ...log,
    created_at_local: new Date(log.created_at).toLocaleString('pt-BR', { timeZone: userTZ })
  }));
  ```
- Query using ISO format:
  ```sql
  WHERE created_at > '2026-03-31T00:00:00Z'::TIMESTAMP AT TIME ZONE 'UTC';
  ```
- Test: Set device to São Paulo TZ, filter logs by date, verify correct results

**Detection:**
- Admin in São Paulo sees logs from 03:00 to 03:00 (wrong date range)
- Filter "Today" shows yesterday's logs
- Timestamp display inconsistent with query results

---

## Regression Risk Summary

### High-Risk Fixes (Breaking Changes Possible)

| Fix | Regression Risk | Key Mitigation |
|-----|-----------------|-----------------|
| **Map WebView Layout** | HIGH | Explicit height/width props, `onLoadingFinish` callback validation |
| **SQLite Schema Changes** | HIGH | Write migration → test on old schema → sync test. Enforce in PR |
| **SyncService New Entities** | HIGH | Idempotency keys required, batch limits, conflict detection |
| **Token Expiry** | HIGH | Time sync, server-side validation, email prefetch prevention |

### Medium-Risk Fixes (Data Correctness)

| Fix | Regression Risk | Key Mitigation |
|-----|-----------------|-----------------|
| **Admin Logs RLS** | MEDIUM | Test as admin/non-admin, performance profiling |
| **Error Translation** | MEDIUM | i18n CI linting, native speaker review, snapshot tests |

---

## Phase-Specific Warnings

| Phase/Fix | Likely Pitfall | Mitigation | Responsible |
|-----------|--------------|-----------|------------|
| **Phase 1: Map Fix** | White screen, asset loading fails | Explicit WebView dimensions, onLoadingFinish test | QA on device |
| **Phase 2: Token Fix** | Time skew, email prefetch, server validation | NTP sync, server-side TTL enforcement | Backend verify |
| **Phase 3: SQLite Migrations** | Schema async conflict, missing default | Transaction lock, migration CI test | Code review |
| **Phase 4: SyncService** | Duplicate records, conflict loss, orphans | Idempotency test, FK constraints | Integration test |
| **Phase 5: Error Translation** | Missing keys, layout overflow, date format | i18n linting CI, snapshot test pt-br | Translation QA |
| **Phase 6: Admin Logs** | Query timeout, RLS permission denied, TZ issues | Index creation, RLS test role-based, TZ conversion | Admin QA |

---

## Prevention Checklist (Apply to All Fixes)

Before shipping each fix:

- [ ] **Fresh Device Test**: Install on emulator/device with no prior app data
- [ ] **Upgrade Device Test**: Upgrade existing device from v1.1.0 to test version
- [ ] **Offline Test**: Disable network, complete action offline, enable network, sync
- [ ] **Rollback Test**: If EAS Update, verify can rollback to v1.1.0 without data loss
- [ ] **Error Path Test**: Trigger error conditions (network down, invalid input, permissions denied)
- [ ] **Log Audit**: Check Supabase logs for unexpected errors, 403s, warnings
- [ ] **Performance**: Check device memory, CPU during action (no spikes >20% above baseline)
- [ ] **Regression Test**: Re-run existing critical flows (login → create vistoria → sync)

---

## Sources

- [react-native-webview-leaflet - npm](https://www.npmjs.com/package/react-native-webview-leaflet/v/4.2.13)
- [GitHub - reggie3/react-native-webview-leaflet](https://github.com/reggie3/react-native-webview-leaflet)
- [Supabase User Sessions Documentation](https://supabase.com/docs/guides/auth/sessions)
- [Supabase OTP Token Expiration Troubleshooting](https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0)
- [Supabase Refresh Token Best Practices](https://prosperasoft.com/blog/database/supabase/supabase-token-refresh/)
- [Expo SQLite Guide](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Offline-First SQLite Sync Patterns - DEV Community](https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli)
- [Drizzle ORM - Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite)
- [Supabase Database Replication Documentation](https://supabase.com/docs/guides/database/replication)
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture)
- [ObjectBox Sync - Offline-First Conflict Resolution](https://objectbox.io/customizable-conflict-resolution-for-offline-first-apps/)
- [React Native i18n Mistakes - Translated Right](https://www.translatedright.com/blog/20-i18n-mistakes-developers-make-in-react-apps-and-how-to-fix-them/)
- [React Native i18n Best Practices - DEV Community](https://dev.to/retyui/99-of-react-native-apps-make-this-localization-i18n-mistake-is-yours-one-of-them-2o6g)
- [Lingui React Native Localization](https://lingui.dev/tutorials/react-native)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [PostgreSQL Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Performance Debugging](https://supabase.com/docs/guides/database/debugging-performance)
- [RLS Best Practices - MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Expo EAS Update Rollbacks](https://docs.expo.dev/eas-update/rollbacks/)
- [Expo EAS Update Best Practices](https://expo.dev/blog/eas-update-best-practices)
- [React Native OTA Updates Guide - DEV Community](https://dev.to/nour_abdou/react-native-ota-updates-with-expo-eas-step-by-step-guide-best-practices-1idk)
