# Research Summary: v1.2.0 Critical Bug Fixes

**Domain:** React Native / Expo mobile app for structural risk inspection
**Research Date:** 2026-03-31
**Research Mode:** Ecosystem (Stack additions for bug fixes)
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

The existing tech stack (Expo 54, React Native 0.81.5, Supabase, expo-sqlite) is **fundamentally sound** for all 8 critical bugs. No major library replacements needed. All fixes involve:

1. **Configuration changes** (Supabase JWT settings verification)
2. **Pattern implementations** (outbox for offline sync, WebView layout fixes)
3. **Schema additions** (R1/R2/R3/R4 classification system, sync metadata tables)
4. **Optional ORM** (Drizzle for structured migrations, not required)

**Key finding:** The "tela branca" (white screen) on maps is a WebView layout issue, NOT a library issue. The token expiry is a JWT configuration issue in Supabase dashboard, NOT a code bug. These are fixable in v1.2.0 without major refactoring.

---

## Key Findings

### Stack Analysis
- **WebView + Leaflet:** `react-native-webview` v13+ works fine; issue is `height: 100vh` in HTML not resolving in native context. Fix: Use `flex: 1` + explicit `minHeight` on View container.
- **Supabase Tokens:** Default JWT expiry 1 hour is appropriate. Invitation tokens have 24h hardcoded limit (Supabase constraint). Fix: Verify dashboard settings, implement auto-refresh on app init, document 24h limit to admins.
- **SQLite Sync:** No built-in sync in expo-sqlite. Fix: Implement outbox pattern (industry standard) with idempotency keys and last-write-wins conflict resolution.
- **R1/R2/R3/R4:** No structured risk system exists. Fix: Add enum + classification algorithm + assessment fields to schema.

### Dependencies Assessment
- **No major upgrades needed.** Expo 54 + React Native 0.81.5 + existing libraries support all fixes.
- **Optional addition:** Drizzle ORM (v0.30+) for structured schema management and auto-generated migrations. Manual SQL sufficient for v1.2.0.
- **No new client libraries required** beyond what's already installed.

### Critical Patterns Discovered
1. **Outbox Pattern:** Standard for offline-first apps. Every local change → outbox event with idempotency key → sync pushes events → pulls server changes → resolves conflicts via timestamps.
2. **Last-Write-Wins:** Simple conflict resolution using `updated_at` timestamps. Sufficient for structural inspection forms (no complex multi-field merges needed).
3. **WebView Layout:** Must use `flex: 1` on parent View + explicit height constraint. `100vh` CSS doesn't translate to native.

---

## Implications for Roadmap

### Phase Structure Recommendation

**Phase 1: Foundation Fixes (v1.2.0 sprint)**
- ✓ Mapa (tela branca) — Layout fix + Leaflet HTML updates (1-2 days)
- ✓ Tokens (expiry) — Config verification + auto-refresh on app init (1 day)
- ✓ SQLite schema — Add outbox table + sync_meta table (1 day)
- ✓ Sync implementation — State machine: push → pull → resolve (2-3 days)
- ✓ R1/R2/R3/R4 — Enum + classification algorithm + form fields (1-2 days)
- ✓ String catalog — Create pt-br error messages (0.5 days)
- ✓ Logs display — Fix FlatList rendering (0.5 days)
- ✓ Municipios — Validate RPC response (0.5 days)

**Phase 2: Testing & Hardening (post-v1.2.0)**
- Offline sync edge cases (network flaky, app crash during sync)
- Conflict resolution real-world scenarios
- Performance under large datasets (100+ forms)
- Optional: Migrate to Drizzle ORM for maintainability

**Phase 3: Future Enhancements**
- Photo uploads from vistoria
- PDF generation from form data
- Admin dashboard with analytics
- Offline map caching

### Why This Order
1. **Foundation fixes must come first** — app is unusable without working map and sync
2. **Offline sync enables field usage** — agents can now collect forms without constant connectivity
3. **String localization adds polish** — but not blocking for internal v1.2.0 release
4. **Testing validates the foundation** — before scaling to more users

### Phase-Specific Research Needs

| Phase | Topic | Research Needed? | Why |
|-------|-------|------------------|-----|
| **v1.2.0** | WebView layout | LOW | Standard pattern, well-documented |
| **v1.2.0** | Supabase JWT | LOW | Official docs clear, just verify dashboard |
| **v1.2.0** | Outbox pattern | LOW | Industry standard, implementations exist |
| **v1.2.0** | Conflict resolution | LOW | last-write-wins is simple, documented |
| **v1.2.0** | R1/R2/R3/R4 algorithm | MEDIUM | Needs business logic clarification from domain expert |
| **v1.2.0** | Offline sync edge cases | HIGH | Needs testing; complex scenarios possible |
| **v2.0+** | Drizzle ORM migration | MEDIUM | Only if manual SQL becomes unmaintainable |

---

## Confidence Assessment

| Area | Level | Rationale |
|------|-------|-----------|
| **Stack choices** | HIGH | Verified with official Expo docs + react-native-webview Reference |
| **WebView fix** | HIGH | Issue #3132 documented on react-native-webview repo; flex layout pattern standard |
| **Supabase JWT** | HIGH | Official docs clear on JWT expiry, auto-refresh, session flow |
| **SQLite sync** | MEDIUM-HIGH | Outbox pattern researched from multiple sources (dev.to, Expo docs) but needs real-world testing |
| **Drizzle integration** | MEDIUM | Official docs support Expo + drizzle-kit, but complex migrations not yet tested on this project |
| **R1/R2/R3/R4 classification** | MEDIUM | Algorithm structure clear, but business rules need domain validation |
| **Offline edge cases** | MEDIUM | General patterns understood, but app-specific scenarios need testing in v2 |

**Sources of confidence:**
- ✓ Expo official documentation
- ✓ react-native-webview GitHub Reference.md
- ✓ Supabase official docs
- ✓ Multiple dev.to articles on outbox pattern
- ✓ Drizzle ORM official docs
- ⚠ No context7 (libraries not available in that system)
- ⚠ Limited real-world testing on this specific app (will validate in v1.2.0 sprint)

---

## Gaps to Address in Phase Implementation

### Before Starting v1.2.0 Sprint
1. **R1/R2/R3/R4 classification rules:** Clarify with domain expert (Defesa Civil) what criteria determine each risk level
2. **Offline sync conflict scenarios:** Document what should happen if same form edited on phone + laptop offline
3. **Invitation token UX:** Decide: resend link on expiry, or longer validity workaround?
4. **Error handling strategy:** Which sync failures warrant user notification vs silent retry?

### During v1.2.0 Sprint
1. **Leaflet map server:** Test Leaflet initialization in WebView with real coordinates
2. **SQLite transaction safety:** Verify outbox implementation handles concurrent writes (unlikely but possible)
3. **Supabase RLS policies:** Ensure sync pull queries respect Row Level Security
4. **Offline performance:** Test sync with 100+ queued forms on slow network

### Post-v1.2.0 (Phase 2)
1. **Drizzle migration:** Only if manual SQL becomes hard to maintain
2. **Advanced conflict resolution:** Only if last-write-wins causes real issues
3. **Photo uploads:** Separate feature, requires storage URL strategy

---

## Risk Assessment

### Technical Risks (Mitigated)
| Risk | Severity | Mitigation |
|------|----------|-----------|
| WebView still shows white screen | HIGH | Layout fix is well-documented; verify onLoadEnd fires |
| Sync causes data loss | HIGH | Outbox pattern + idempotency keys + tests |
| JWT auto-refresh doesn't work | MEDIUM | Verify Supabase config in dashboard; test on app startup |
| Offline forms don't sync when app reopens | MEDIUM | SyncService called on app init + periodic background jobs |
| Conflict resolution breaks forms | MEDIUM | last-write-wins is simple; test with 2 simultaneous edits |

### Business Risks
| Risk | Severity | Mitigation |
|------|----------|-----------|
| Agents spend 2h on mapa, can't use app | HIGH | Fix in v1.2.0 is critical path; prioritize |
| Admins confused by 24h invitation limit | MEDIUM | Document in release notes; provide resend feature |
| Sync failures cause forms to disappear | MEDIUM | Comprehensive error logging + user notifications |

---

## Recommendation Summary

**For v1.2.0 sprint:**
1. ✅ Use existing stack — no major library changes
2. ✅ Implement all 8 fixes with patterns researched above
3. ✅ Add outbox tables + sync state machine (core of release)
4. ✅ **Skip Drizzle ORM** for v1.2.0 — manual SQL sufficient; migrate later if needed
5. ✅ Focus on testing — especially offline sync edge cases
6. ⚠️ Clarify R1/R2/R3/R4 rules with domain expert before implementation

**For v1.3+:**
- Optional Drizzle ORM migration (if schema becomes complex)
- Advanced conflict detection (if real-world use shows issues)
- Photo upload integration
- Admin analytics dashboard

---

*Research completed 2026-03-31. All findings in `.planning/research/STACK.md` with code examples and configuration keys.*
