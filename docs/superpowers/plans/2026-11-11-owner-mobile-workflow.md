# Owner mobile workflow implementation plan

Goal: implement the approved owner modes, global mobile administration, photos, partial sync and versioned document workflow.
Spec: ../specs/2026-11-11-owner-mobile-workflow-design.md (approved 2026-11-11).
Architecture: reuse existing Supabase RPCs and UI primitives; authenticated role remains server authority. Add persisted owner experience preference, shared gallery, explicit media state and version-bound science.
Stack: Expo/React Native, React/Vite console, Supabase/Postgres, Jest and existing SQL contract tests.

Constraints: preserve pre-existing dirty changes; no deployment or production data mutation implied; owner preference is not authorization; no service secrets in clients; three photos; no physical deletion; no forged technical signatures. Existing design tokens/components govern visual changes.

## Task 1: Owner modes and mobile administration
Files: new OwnerExperience service/context/screen; panel layout, modules, internal dashboard, profile; isolated preference migration; tests.
Interface: mode 'follow' | 'operate', per authenticated owner; server RPC preference plus per-user cache; loading/error distinguish from no choice. Owner-only full administration screen reuses existing authorized console RPCs. Inventory console capabilities, implement discoverable actions and native mobile routes; do not promise unsupported actions.
- [ ] Tests RED: preference cache isolation, failed fetch not onboarding, non-owner cannot choose/authorize; route owner QE/admin and ordinary role restrictions.
- [ ] Implement first-use selection, change mode in profile, full navigation, owner administrative actions using server capabilities. Preserve all unrelated permissions.
- [ ] Tests GREEN plus typecheck; document SQL required and RPC authorization.

## Task 2: Shared photo gallery
Files: shared evidence gallery/viewer and photo utilities; wizard.tsx; foto.tsx; photo tests.
Interface: string[] image URIs; max=3 per inspection; preserve legacy scalar answers and save paths; full-screen pinch/double tap zoom, close, add/remove/replace. Gallery state must survive drafts and save to primary/extra media.
- [ ] Tests RED: scalar compatibility, flatten/dedupe max, fourth photo blocked; cancel does not delete; prevent parallel captures.
- [ ] Implement reusable gallery and visualizer, wire both entry points, preserve georeference capture and offline persistence.
- [ ] Tests GREEN and typecheck; no dependency additions without need.

## Task 3: Partial media sync and document workflow
Files: SyncService.ts; shared media manifest/service/schema; web inspection workspace; DocumentAcknowledgement service/authorization migration; generation backend; tests.
Interface: server-visible expected/available/failed media; idempotent stable identities, no remote local paths; legacy unknown distinct from zero. Preserve retry logic. Document state preliminary/final tied to frozen media version. Owner can administer any inspection and another authorized actor can collect science with own identity.
- [ ] Inspect existing RPC/RLS definitions and document workspace before modification.
- [ ] Tests RED: one upload fails but remote record carries missing count; retry fills without duplicate; legacy unknown; removed attachment not resurrected; preliminary with missing photos; no final without required evidence or recorded waiver; science remains version-specific.
- [ ] Implement schema/services and web UI for pending photos, retry guidance, authorized replacements and document/science access; preserve technical identity and server authorization.
- [ ] Tests GREEN plus existing sync/acknowledgement/SQL tests; record remote deployment not applied.

## Task 4: Result navigation and integration
Files: resultado.tsx, mobile inspection detail, integration tests.
- [ ] Tests RED: QE fetch error retry; independent cards collection/sync/review/science; owner can open review; science action clearly visible beside generated document; no false completion on missing photos.
- [ ] Integrate task interfaces without replacing current photo-stamp/document changes.
- [ ] Run focused tests, project typechecks and broad tests. Review combined delta against baseline; fix important findings with regression tests.

## Review focus
- Cross-user cached preference or role spoofing.
- Duplicate clicks, stale upload completion after removal, legacy inspection with unknown photo count.
- Offline launch and remote request failure must not invent defaults or completion.
- Signed version unchanged after evidence additions; no delegated signature in original author's name.
- Existing dirty changes and production migrations must not be silently overwritten or deployed.
