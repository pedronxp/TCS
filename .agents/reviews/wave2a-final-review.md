# Wave 2A Final Review - task_7ac64975ede0

Branch: codex/dashboard-redesign-all-routes | Scope: 80 files, +6815/-2625 (read-only review, uncommitted working tree)

## Verdict: BLOCK (conditional) - security & design pass; 1 ESLint error + 1 warning must be fixed before merge

## 1. Security-critical acceptance criteria - ALL PASS

### 1a. resetPasswordForEmail {error} - no false success, no enumeration (PASS)
dashboard/src/pages/portal/PortalPasswordRecoveryPage.tsx:54-72
- const { error } = await supabase.auth.resetPasswordForEmail(...) - error is captured.
- On error: generic delay message; setSent(true) NOT reached. No false success.
- On success: RecoverySent with "Se existir uma conta elegivel" - account existence not disclosed. No enumeration.
- Reset gated on validRecovery (session + marker with expiry) before updateUser.

### 1b. Native radios + keyboard (PASS)
dashboard/src/pages/portal/PortalAuthPage.tsx (AccountKindOption)
- Real <input type="radio" name="account-kind"> with sr-only; label focus-within:ring for visible focus.
- Test asserts keyboard ArrowRight -> municipal toBeChecked + toHaveFocus.

### 1c. axe sem regra desativada in Wave 2A scope (PASS)
All Wave 2A test files run expect((await axe(container)).violations).toEqual([]) with NO disabled rules. color-contrast:enabled:false persists ONLY in legacy internal pages NOT touched by Wave 2A.

### 1d. Checkbox removed without dead effect (PASS)
dashboard/src/pages/LoginPage.tsx
- "Manter sessao" checkbox removed; rememberDevice state + Checkbox import fully removed.
- AuthContext.signIn(email,password) never took rememberDevice; zero runtime effect.

### 1e. Contracts / redirects intact (PASS)
- App.tsx, PortalApp.tsx, PrivateApp.tsx NOT modified. Route/redirect contracts unchanged.
- safeConsoleDestination (open-redirect guard) unchanged.
- portalNavigation.ts paths unchanged (adds group + shortLabel only).
- RPC rename admin_reset_password -> internal_reset_password coordinated with migration 20260809015200_fix_admin_operations.sql.

## 2. Contrast >= 4.5 - PASS light, DEBT dark (pre-existing)

Light (all >=4.5): fg/bg 17.18, muted-fg/bg 5.50, primary/bg 5.34, primary on warning-soft 5.14, destructive on destr-soft 5.74.
- Fixed: text-warning on bg-warning-soft was 3.08:1 (FAIL); Wave 2A changed PortalAuthPage suspended alert to text-foreground = 16.53:1.

Dark: fg/bg 17.18, muted-fg/bg 7.36, primary/bg 7.10, fg on warning-soft 12.85 - all PASS.
- DEBT: destructive error alerts text-destructive on bg-destructive-soft = 3.23:1 (FAIL) in dark. Pre-existing pattern (at HEAD), carried forward and expanded. Light = 5.74:1 PASS. Not caught by Wave 2A axe tests (light-only). Flagged as cross-cutting token follow-up, not a hard block.

## 3. Skill-based review

### 3a. review-animations / emil (APPROVE - motion layer)
- Primitives: GPU-only transitions, explicit property lists (no transition:all), custom easing tokens --motion-ease-out/-in-out/-drawer, sub-300ms, asymmetric enter/exit (Sheet 200/150ms), trigger-anchored origins.
- Button press active:scale-[0.98] ease-out 150ms.
- Page-level motion: only animate-spin + animate-pulse, ALL gated motion-reduce:animate-none; decorative loaders aria-hidden. Tests assert reduce-motion class.
- HighRiskDialog migrated hand-rolled div+keydown -> Radix Dialog.
- No ease-in, no scale(0), no layout-property animation, no ungated hover motion.

### 3b. marcolou / revenue (APPROVE)
- CommercialPage consolidated (~760->~220 lines) preserving CTAs; pricing from same catalog as plans page (single source of truth, no fabricated numbers).
- Removed fabricated LoginPage trust metrics ("148 clientes / 96,8% SLA") - honesty/proof win.
- Onboarding humanized; invite-acceptance visibly gates server confirmation.

### 3c. Supabase skill (PASS)
- resetPasswordForEmail error handled; updateUser only in verified recovery session; signOut scopes correct; session marker with expiry; audit RPC before sign-out. PortalAuthContext.signOut now throws on error. validate-portal-boundary: 5 RLS, 19 functions, 32 pgTAP passed.

## 4. Gates

- Tests (npm test): 54 files / 272 tests PASS
- design:validate: PASS (route manifest, visual governance, Penpot handoff, portal boundary)
- tsc -b: clean PASS
- Build (npm run build): PASS (1860 modules, 29s)
- ESLint (npm run lint): FAIL - 1 error + 1 warning
- diff-check secrets/keys: clean (no .env/.key/.pem; package-lock + .claude/settings.local.json only)

### Blocking ESLint issues
1. ERROR dashboard/src/hooks/useUsuarios.ts:75 - no-explicit-any: supabase.rpc('internal_reset_password' as any,...). Root cause: generated src/types/supabase.ts:2640 still has admin_reset_password; new internal_reset_password RPC from migration not regenerated. Fix: npm run types:supabase then drop as any.
2. WARNING dashboard/src/components/customers/OrganizationFormDialog.tsx:101 - react-hooks/exhaustive-deps: useMemo missing coordinator.coordinatorPassword and coordinator.sendEmailInvite.

## 5. What's left
- Fix ESLint error #1 (regenerate Supabase types, drop as any) - required for CI green.
- Address ESLint warning #2 (exhaustive-deps) - recommended.
- (Follow-up, not blocking) dark-theme text-destructive/bg-destructive-soft contrast (3.23:1) - cross-cutting token debt.
