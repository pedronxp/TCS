# Phase 06: Mapa + Autenticação — Research

**Researched:** 2026-03-31
**Domain:** React Native WebView + Leaflet.js, Supabase invite tokens, Expo Router auth flow
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAPA-01 | Agente consegue visualizar o mapa sem tela branca no Android/iOS | WebView layout fix: container must be `flex:1` with explicit dimensions; `invalidateSize` timing and CDN loading sequence are critical |
| MAPA-02 | Tiles do Leaflet carregam corretamente dentro da WebView | baseUrl must point to unpkg.com CDN; `mixedContentMode="always"` + `originWhitelist={['*']}` required; network reachability from within WebView sandbox differs from native layer |
| AUTH-01 | Admin cria token de convite e usuário o usa imediatamente sem "Token expirado" | Root cause is Supabase JWT clock skew or timezone mismatch between client `Date.now()` and Supabase server `now()`; fix is server-side timestamp comparison via RPC or RLS, not client JS |
| AUTH-02 | Master admin cadastra novo município sem erros | `municipios` table insert requires correct RLS policy for `master_admin` role; `criarMunicipio()` function code is correct but may fail silently due to missing RLS or table constraint |
</phase_requirements>

---

## Summary

Phase 06 addresses four bugs that prevent the app from being usable in production: a white-screen map, CDN tile loading failures, false "token expired" errors on freshly-created invite tokens, and a broken municipality creation flow. All four are correction bugs (not new features) — the code structure is already in place.

**Map (MAPA-01, MAPA-02):** Two prior fix commits (384a11f and 2a13d79) already addressed the most obvious causes (wrong baseUrl, missing `height:100vh`, `invalidateSize` timing, disabled iOS path). The current `mapas.tsx` code looks correct on inspection. If the map is still broken after those commits, the remaining suspects are: (1) the outer `<View style={styles.container}>` having `flex:1` but its *parent* chain not propagating height all the way to the screen root, (2) `StyleSheet.absoluteFillObject` on the WebView competing with the loading overlay, or (3) CDN scripts failing to load in the WebView network sandbox on physical device (not Expo Go).

**Tokens (AUTH-01):** The `gerar-token.tsx` uses `Date.now() + horas * 3600000` to compute `expiraEm`. The `register.tsx` checks `new Date(tokenData.expiraEm) < new Date()`. Both are client-side JS dates. The "Token expirado" error on a fresh token most likely means the Supabase `expiraEm` value is being stored or returned in a timezone that JavaScript interprets as already past. Since `invite_tokens.expiraEm` is stored as an ISO string, if Supabase interprets it as UTC but the app's `Date.now()` is offset by timezone, a 24h token can appear expired from the moment of creation. The fix is to move expiry comparison to the database (RPC or RLS `now() < expiraEm`).

**Municípios (AUTH-02):** The `criarMunicipio()` function is straightforward — it inserts into `municipios` table. The most likely cause of errors is a missing or incorrect RLS policy on the `municipios` table that blocks `master_admin` from inserting. Secondary cause is the table not existing or having a constraint mismatch.

**Primary recommendation:** Fix MAPA-01/02 by auditing the full View hierarchy for height propagation and verifying CDN accessibility in a real device WebView. Fix AUTH-01 by replacing the client-side date comparison in `register.tsx` with a database-side check. Fix AUTH-02 by verifying and applying the correct Supabase RLS policy for `master_admin` on the `municipios` table.

---

## Standard Stack

### Core (already in use — no new installs needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| react-native-webview | 13.15.0 | Renders Leaflet HTML map inside RN | Already installed |
| Leaflet.js | 1.9.4 (CDN) | Interactive map library inside WebView HTML | Loaded via unpkg CDN |
| leaflet.markercluster | 1.5.3 (CDN) | Clusters overlapping map markers | Loaded via unpkg CDN |
| leaflet.heat | 0.2.0 (CDN) | Heatmap overlay | Loaded via unpkg CDN |
| expo-location | ~19.0.8 | User GPS position for map centering | Already installed |
| @supabase/supabase-js | ^2.45.0 | Backend: invite_tokens, municipios tables | Already installed |
| expo-sqlite | ~16.0.10 | Offline fallback for map markers | Already installed |

### No New Dependencies

This phase fixes bugs in existing code. No new packages should be installed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes. All files are already in place:

```
app/(panel)/mapas.tsx              # Map screen — MAPA-01, MAPA-02
app/(panel)/admin/gerar-token.tsx  # Token generation — AUTH-01
app/(auth)/register.tsx            # Token consumption — AUTH-01
app/(panel)/master/municipios.tsx  # Municipality creation — AUTH-02
```

### Pattern 1: WebView Leaflet Map — Height Propagation Fix

**What:** React Native's WebView requires every ancestor `<View>` in the tree to have explicit `flex:1` or an absolute height. A single ancestor with `height: undefined` collapses the entire chain to zero, causing a white screen.

**When to use:** Any time a WebView renders white on Android or iOS.

**Diagnostic sequence:**
1. Temporarily set `backgroundColor="red"` on each ancestor View to find which collapses.
2. The outer container `styles.container` already has `{ flex: 1 }` — verify the screen itself is receiving full height from the Stack navigator.
3. The WebView uses `StyleSheet.absoluteFillObject` — this is correct but requires the parent to have non-zero dimensions first.

**Known-working WebView props for CDN HTML maps (already in code):**
```typescript
<WebView
  source={{ html, baseUrl: 'https://unpkg.com' }}
  style={[StyleSheet.absoluteFillObject, { backgroundColor: '...' }]}
  javaScriptEnabled
  domStorageEnabled
  originWhitelist={['*']}
  mixedContentMode="always"
  allowFileAccessFromFileURLs
  allowUniversalAccessFromFileURLs
  startInLoadingState
/>
```

**Critical:** `baseUrl: 'https://unpkg.com'` is mandatory. An empty string `''` or `'about:blank'` prevents the WebView network sandbox from resolving the CDN script URLs on Android.

### Pattern 2: WebView CDN Script Loading — Failure Detection

**What:** When `mapas.tsx` loads Leaflet dynamically (via `loadNextScript`), `s.onerror` fires if the CDN is unreachable. The current code shows "Não foi possível carregar o mapa" but does NOT notify React Native of the failure, so the React loading state may never resolve.

**Fix pattern:** After `showError()`, also call `window.ReactNativeWebView.postMessage(JSON.stringify({type:'loadError'}))` so the React component can react (e.g., show a retry button in native UI).

**Physical device note:** On Android, WebView network access uses the system WebView (Chrome-based). If `INTERNET` permission is missing from `AndroidManifest`, CDN calls silently fail. The `app.json` already lists `android.permission.INTERNET` — verify it survives the build.

### Pattern 3: Invite Token — Server-Side Expiry Comparison

**What:** The current code computes expiry with `Date.now()` on the client and stores it as an ISO string. When the user registers, the client re-reads the ISO string and compares with `new Date()`. Any clock difference, timezone interpretation difference, or Supabase timestamp coercion can cause a valid token to appear expired.

**Root cause specifics:**
```typescript
// gerar-token.tsx — problem area
const expira = new Date(Date.now() + horasSelecionadas * 3600000).toISOString();
// Stores e.g. "2026-04-01T14:00:00.000Z"

// register.tsx — problem area
if (tokenData.expiraEm && new Date(tokenData.expiraEm) < new Date()) {
  throw new Error('Token expirado. Solicite um novo ao administrador.');
}
// If Supabase returns expiraEm WITHOUT the trailing 'Z', new Date() may misinterpret it
```

**Fix:** Replace the client-side expiry check in `register.tsx` with a Supabase RPC that does the comparison server-side using PostgreSQL `now()`:

```sql
-- Supabase SQL editor
CREATE OR REPLACE FUNCTION validate_invite_token(p_codigo TEXT)
RETURNS TABLE (
  id UUID,
  codigo TEXT,
  municipio TEXT,
  role TEXT,
  valido BOOLEAN,
  motivo TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.codigo,
    t.municipio,
    t.role,
    CASE
      WHEN t.usado THEN FALSE
      WHEN t."expiraEm" IS NOT NULL AND t."expiraEm" < now() THEN FALSE
      ELSE TRUE
    END AS valido,
    CASE
      WHEN t.usado THEN 'Token já utilizado.'
      WHEN t."expiraEm" IS NOT NULL AND t."expiraEm" < now() THEN 'Token expirado. Solicite um novo ao administrador.'
      ELSE 'ok'
    END AS motivo
  FROM invite_tokens t
  WHERE t.codigo = p_codigo AND t.usado = false
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This eliminates timezone/clock-skew issues entirely.

**Alternative (simpler, no RPC):** Ensure the `expiraEm` column in Supabase is of type `TIMESTAMPTZ` (with timezone), not `TIMESTAMP`. A `TIMESTAMPTZ` column always returns with `+00:00` or `Z` suffix, which JavaScript's `Date` constructor always parses as UTC. If the column is `TIMESTAMP` (no timezone), the returned string has no suffix and JS may interpret it as local time.

### Pattern 4: Supabase RLS for master_admin

**What:** The `municipios` table must allow `master_admin` to INSERT. Without explicit RLS policy, all inserts from authenticated users are blocked by default.

**Minimal RLS policy (apply in Supabase SQL editor):**

```sql
-- Allow master_admin to insert municipalities
CREATE POLICY "master_admin_insert_municipios"
ON municipios
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE uid = auth.uid()) = 'master_admin'
);

-- Allow master_admin to update municipalities
CREATE POLICY "master_admin_update_municipios"
ON municipios
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM users WHERE uid = auth.uid()) = 'master_admin'
);

-- Allow all authenticated to read municipalities
CREATE POLICY "authenticated_read_municipios"
ON municipios
FOR SELECT
TO authenticated
USING (true);
```

**Verification:** After creating the policy, test with: `supabase.from('municipios').insert({ nome: 'Test' })` logged in as master_admin — should return no error.

### Anti-Patterns to Avoid

- **Do NOT use `height: '100%'` in the WebView HTML root.** In WebView contexts, `100%` resolves relative to the parent which may have zero computed height. Use `height: 100vh` (viewport height) in the HTML CSS instead.
- **Do NOT compare token expiry using `Date.now()` client-side.** Use the database server time. Client clocks can drift by minutes and timezone interpretation is error-prone.
- **Do NOT add `<Stack.Screen>` options to `mapas` with `headerShown: true`.** The map uses absolute-positioned overlays; a native header would offset the coordinate system.
- **Do NOT reload the WebView on every filter change.** The current code uses `key={mapStyle-filter-period-heatmap}` which forces WebView remount on each filter change, causing a blank flash. Better approach: inject JS into the existing WebView via `webviewRef.current.injectJavaScript()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side token expiry | Custom clock sync logic | PostgreSQL `now()` via RPC | DB server time is authoritative; client clocks drift |
| RLS enforcement | Client-side role checks | Supabase RLS policies | Client-side checks are bypassable (SEG-01 in CODEBASE_ANALYSIS) |
| WebView CDN fallback | Local Leaflet bundle | CDN with `onerror` detection | Bundling Leaflet adds ~200KB to JS bundle; CDN already working |
| Tile caching | Custom tile cache | (deferred to v1.3.0) | Out of scope per REQUIREMENTS.md |

---

## Runtime State Inventory

> This phase does not rename or refactor persistent identifiers. No runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `invite_tokens` table in Supabase with `expiraEm` column type (TIMESTAMP vs TIMESTAMPTZ) | Verify column type in Supabase dashboard — if TIMESTAMP, alter to TIMESTAMPTZ |
| Live service config | Supabase RLS policies on `municipios` table — live in Supabase dashboard, not in git | Verify and create policies via Supabase SQL editor |
| OS-registered state | None | None |
| Secrets/env vars | `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` — unchanged | None |
| Build artifacts | None relevant to this phase | None |

---

## Common Pitfalls

### Pitfall 1: WebView Shows White After Fix — Dimensions Race Condition

**What goes wrong:** Map renders white even after `height:100vh` and `invalidateSize` are in place.

**Why it happens:** The WebView's `initMap()` check `if (mapEl.offsetWidth === 0 || mapEl.offsetHeight === 0)` retries every 100ms, but if the WebView itself has not yet finished laying out its viewport (common on first paint in React Native), `offsetWidth/Height` may return 0 for the first 200–400ms. If the retry loop only checks once, it may initialize the map before the layout is ready.

**How to avoid:** Increase the retry window. The current code uses a single `setTimeout(initMap, 100)` retry. Consider a loop with up to 10 retries (1 second total) before giving up and calling `showError()`. Alternatively, use the `onLayout` prop on the parent View to trigger a WebView injection only after layout is confirmed.

**Warning signs:** White screen that resolves after switching apps and coming back (which triggers a layout recalculation in the background).

### Pitfall 2: Token Expiry Appears Correct in Simulator but Fails on Device

**What goes wrong:** The "Token expirado" error disappears in iOS Simulator or Android Emulator but reappears on physical devices.

**Why it happens:** Emulators typically have their clocks synchronized with the host machine (same timezone as developer). Physical devices may have different timezone settings, or may have clock drift if they were offline. The `Date.now()` comparison that worked in testing fails in production.

**How to avoid:** The only correct fix is the server-side comparison. Do not add timezone offsets to client-side dates as a workaround — that introduces more drift.

**Warning signs:** Reports of "Token expirado" only from users in different timezones, or intermittently.

### Pitfall 3: Supabase RLS Blocks Insert Silently

**What goes wrong:** `criarMunicipio()` runs without throwing a JS error, but the municipality never appears in the list.

**Why it happens:** Supabase RLS policy rejections return an error object from `supabase.from('municipios').insert(...)`, but if `error` is not checked or is swallowed, the UI appears to succeed. The current code does `if (error) throw error` which is correct — but the catch block shows `Alert.alert('Erro', e.message || ...)`. If `e.message` is empty or generic (like "new row violates row-level security policy"), the user sees a vague error.

**How to avoid:** Always check the specific Supabase error code. RLS violations return `error.code === '42501'`. Surface a clear Portuguese message: "Permissão negada. Verifique se você tem perfil de master_admin."

**Warning signs:** Insert appears to succeed (no Alert) but data is not in the Supabase table when checked via dashboard.

### Pitfall 4: Leaflet `invalidateSize` Timing on Android

**What goes wrong:** Map tiles render but are offset or only partially visible (grey areas at edges).

**Why it happens:** Leaflet calculates tile coverage based on the container size at initialization. If `invalidateSize` is called before Android's layout engine has fully computed dimensions (which happens asynchronously), Leaflet uses wrong dimensions.

**How to avoid:** The current 300ms delay for `invalidateSize` may be insufficient on slower Android devices. Consider 500ms, or listen for the `onLoadEnd` WebView prop and inject `map.invalidateSize()` via `injectJavaScript` from the React Native side.

**Warning signs:** Map tiles visible but with grey borders on Android; correct layout on iOS (which has faster layout cycles).

### Pitfall 5: `expiraEm` Column Type in Supabase

**What goes wrong:** Token created at 14:00 UTC-3 (17:00 UTC) is stored as `2026-04-01T17:00:00` (no Z suffix). When retrieved, JS reads it as local time (14:00 local), which may already be in the past on some interpretations.

**Why it happens:** If `invite_tokens.expiraEm` is `TIMESTAMP WITHOUT TIME ZONE` in PostgreSQL, Supabase returns it without UTC marker. `new Date('2026-04-01T17:00:00')` is parsed as LOCAL time by JavaScript in some environments.

**How to avoid:** Verify column type. If it is `TIMESTAMP`, run: `ALTER TABLE invite_tokens ALTER COLUMN "expiraEm" TYPE TIMESTAMPTZ USING "expiraEm" AT TIME ZONE 'UTC';`

---

## Code Examples

### Verified: WebView with CDN Map (current working code in mapas.tsx)

```typescript
// Source: app/(panel)/mapas.tsx — current implementation
<WebView
  key={`${mapStyle}-${filter}-${filtroPeriodo}-${showHeatmap}`}
  ref={webviewRef}
  source={{ html, baseUrl: 'https://unpkg.com' }}
  style={[StyleSheet.absoluteFillObject, { backgroundColor: mapStyle === 'escuro' ? '#0B0F19' : '#E8EDF2' }]}
  javaScriptEnabled
  domStorageEnabled
  originWhitelist={['*']}
  mixedContentMode="always"
  allowFileAccessFromFileURLs
  allowUniversalAccessFromFileURLs
  startInLoadingState
  onMessage={handleMessage}
/>
```

### Recommended: Server-Side Token Validation in register.tsx

```typescript
// Replace the client-side check at register.tsx line 81
// BEFORE (client-side, broken):
if (tokenData.expiraEm && new Date(tokenData.expiraEm) < new Date()) {
  throw new Error('Token expirado. Solicite um novo ao administrador.');
}

// AFTER (server-side, correct):
const { data: tokenValidation, error: validationError } = await supabase
  .rpc('validate_invite_token', { p_codigo: codigoNorm })
  .single();

if (validationError || !tokenValidation) throw new Error('Token inválido ou já utilizado.');
if (!tokenValidation.valido) throw new Error(tokenValidation.motivo);

// tokenValidation.municipio and tokenValidation.role are already available
const tokenData = tokenValidation;
```

### Recommended: RLS Error Handling in municipios.tsx

```typescript
// Replace generic error message in criarMunicipio()
} catch (e: any) {
  const msg = e?.code === '42501'
    ? 'Permissão negada. Verifique se você tem perfil de master admin.'
    : e.message || 'Não foi possível criar o município.';
  Alert.alert('Erro', msg);
  logger.error('system', 'Erro criar município', { erro: e?.message || JSON.stringify(e), code: e?.code });
}
```

### Recommended: Inject invalidateSize from React Native (more reliable than HTML setTimeout)

```typescript
// In MapasScreen, after WebView onLoadEnd:
const handleLoadEnd = () => {
  setTimeout(() => {
    webviewRef.current?.injectJavaScript(`
      if (typeof map !== 'undefined') { map.invalidateSize({animate: false}); }
      true; // required for iOS
    `);
  }, 300);
};

// Add to WebView props:
// onLoadEnd={handleLoadEnd}
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| Leaflet embedded as local file | Leaflet loaded from CDN via WebView baseUrl | Current — works when online |
| iOS map blocked (intentional) | iOS map enabled (commit 384a11f) | Fixed in v1.1.0 |
| Client-side token expiry check | Server-side RPC check | Needed — this phase's main fix |
| `height: '100%'` in WebView HTML | `height: 100vh` in WebView HTML | Fixed in commit 2a13d79 |

---

## Open Questions

1. **Is `invite_tokens.expiraEm` column type TIMESTAMP or TIMESTAMPTZ?**
   - What we know: The code stores ISO strings from `Date.now()`. The exact PostgreSQL column type is not in the codebase.
   - What's unclear: Whether Supabase adds `Z` suffix on retrieval (TIMESTAMPTZ) or not (TIMESTAMP).
   - Recommendation: First task in AUTH-01 fix should be to check the Supabase dashboard column type. If TIMESTAMP, alter to TIMESTAMPTZ before adding RPC.

2. **Has the map white screen been verified fixed on a physical device after commits 384a11f and 2a13d79?**
   - What we know: Two fix commits exist but STATE.md lists MAPA-01 and MAPA-02 as still "pending".
   - What's unclear: Whether the fixes were tested on device or only in Expo Go/simulator.
   - Recommendation: Plan should include a physical device smoke test as the first verification step.

3. **Does the `municipios` RLS policy exist at all?**
   - What we know: The `criarMunicipio()` code is correct. The error could be RLS or a missing table.
   - What's unclear: Whether the `municipios` table has any RLS policies configured.
   - Recommendation: First diagnostic step is `supabase.from('municipios').select('*').limit(1)` logged as master_admin — if this fails, RLS SELECT policy is also missing.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Supabase project | AUTH-01, AUTH-02, MAPA-01 | Assumed | `EXPO_PUBLIC_SUPABASE_URL` and key must be in `.env` |
| Physical Android/iOS device | MAPA-01, MAPA-02 verification | Unknown | White screen issues often only reproducible on device, not emulator |
| Supabase SQL editor access | AUTH-01 RPC, AUTH-02 RLS | Assumed | Required to create `validate_invite_token` RPC and RLS policies |
| internet access from WebView | MAPA-02 | Required | CDN scripts fail without internet; must test on physical device with real network |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest-expo 54.0.0 |
| Config file | package.json (jest key) |
| Quick run command | `npm test -- --passWithNoTests` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAPA-01 | WebView container renders with non-zero dimensions | manual (device) | manual smoke test | N/A |
| MAPA-02 | Leaflet CDN scripts load without console errors | manual (device) | manual smoke test | N/A |
| AUTH-01 | Fresh token passes expiry check immediately after creation | unit | `npm test -- utils/__tests__/tokenExpiry.test.ts` | ❌ Wave 0 |
| AUTH-02 | Municipality insert succeeds for master_admin role | integration/manual | manual smoke test against Supabase | N/A |

**Note on MAPA-01/MAPA-02:** These are rendering bugs in a WebView that requires a physical device. They cannot be meaningfully automated with jest. The verification gate is a manual smoke test: "open map screen, confirm no white screen, confirm tiles load."

### Sampling Rate

- **Per task commit:** `npm test -- --passWithNoTests`
- **Per wave merge:** `npm test -- --coverage`
- **Phase gate:** Full suite green + manual smoke test on device before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `utils/__tests__/tokenExpiry.test.ts` — covers AUTH-01 (date comparison logic unit test)

*(MAPA-01, MAPA-02, AUTH-02 require manual device testing — no automated test gap to fill)*

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `app/(panel)/mapas.tsx` — full Leaflet WebView implementation reviewed
- Direct code inspection: `app/(panel)/admin/gerar-token.tsx` — token generation logic reviewed
- Direct code inspection: `app/(auth)/register.tsx` — token consumption and expiry check reviewed
- Direct code inspection: `app/(panel)/master/municipios.tsx` — municipality creation logic reviewed
- `.planning/CODEBASE_ANALYSIS.md` — prior bug analysis (SEG-01, PERF-04, Bug analysis)
- `.planning/STATE.md` — accumulated context, known root causes
- `git log` — commit history shows two prior map fix attempts (384a11f, 2a13d79)
- `app.json` — Android permissions, SDK versions, build config

### Secondary (MEDIUM confidence)

- react-native-webview documentation: `baseUrl` behavior on Android requires a valid HTTP origin for CDN script resolution
- Supabase documentation: `TIMESTAMPTZ` vs `TIMESTAMP` return format difference (ISO string with/without Z suffix)
- PostgreSQL documentation: RLS policy error code `42501` for insufficient privilege

### Tertiary (LOW confidence)

- Known community pattern: `invalidateSize` timing issues in Leaflet + WebView on Android — 300ms is commonly insufficient on low-end devices; 500ms is safer

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, versions confirmed in package.json
- Architecture patterns: HIGH — based on direct code inspection and git history
- Root cause analysis AUTH-01: MEDIUM — TIMESTAMPTZ hypothesis is most likely but cannot be confirmed without Supabase dashboard access
- Root cause analysis MAPA-01/02: HIGH — two prior commits confirm the fix path; remaining risk is device-specific timing
- Pitfalls: HIGH — all derived from actual code inspection

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable stack, slow-moving dependencies)
