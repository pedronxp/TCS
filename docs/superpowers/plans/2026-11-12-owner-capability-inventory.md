# Owner capability inventory

Task 1 implementation record. No deployment or production mutation performed. The full approved project is not complete merely because the capabilities below exist.

Parent integration update: advanced capabilities listed below as remaining native parity are now reachable inside the app through `internal/console.tsx`, using the existing console in an isolated WebView with its own login/MFA. They were not duplicated as native editors. Native core remains available without that extra console login. Final verification and publication steps: `2026-11-12-owner-workflow-delivery.md`.

## Implemented core

| Capability | Mobile implementation | Server authority / evidence |
| --- | --- | --- |
| First-use follow/operate choice; later change | OwnerExperienceContext, OwnerExperienceChoice, internal/modo; first-use modal in panel layout; profile link | get_owner_mobile_experience/set_owner_mobile_experience, active internal owner only, per-user cache; 6 initial Jest cases |
| Simpler follow navigation vs full operation | BottomNavBar ownerMode, internal dashboard quick actions and modules | Preference changes no server authorization |
| Global customers with search and pagination | internal/administracao customers section | list_internal_customers with existing server permission checks |
| Customer detail, team, subscription, inspection and audit history | Native labeled sections, not JSON dumps | get_internal_customer_detail |
| Suspend/reactivate organization | Customer action with reason, confirmation, stable operation id | mutate_internal_organization; existing AAL2/permissions preserved |
| Suspend/reactivate subscription | Customer subscription action | mutate_internal_subscription; existing AAL2 preserved |
| Approve customer account; block/unblock access | Native team member actions | set_user_approval, set_account_lock_state; reason/idempotency/AAL2 |
| Internal team status and role | Native staff section | manage_internal_staff; no self suspension control |
| Internal permission override | Reads current overrides and merges the selected change | list_internal_staff_permission_overrides + manage_internal_staff_permissions with p_grants/p_revokes; preserves other overrides |
| View plan catalog, feature grants and resource limits | Native plans section | Existing RLS-protected plans/plan_features/plan_limits read |
| View and activate/deactivate forms | Native forms section | list_internal_forms + mutate_internal_form set_status |
| View support queue | Native support section | list_internal_support_queue |
| View global audit | Native labeled audit cards | list_internal_audit_timeline |
| AAL2 step-up for an already-enrolled authenticator | security section, numeric code, challengeAndVerify | Supabase Auth MFA; no bypass, no secret key |
| Logical archive/restore of inspections | Customer inspection actions + archived section | New set_owner_inspection_archived, AAL2, active internal owner, audit, stable operation id; separate owner_archived_at from cold-storage archived_at |
| Archived inspections not visible to ordinary users; stale sync blocked | Restrictive SELECT policy + BEFORE UPDATE trigger | SQL functional test covers broad legacy permissive policy, agent attempts to mutate/remove archive flag, idempotency and restoration |
| Global owner QE, including an owner without a legacy users row | Owner layout/modules permit QE; existing queue/detail screens | qe_fila/qe_revisar derive owner from active internal_staff, preserve actual revisor identity and notifications; lock review row and reject closed/invalid/null decision |
| Global operational directory / appointments / team/map screens | Owner gates added to equipe, agenda list/detail, initial inspection municipality and map fallback; admin statistics global filter | list_operational_users/get_operational_user and upsert/transition/delete_operational_appointment include active internal owner; read policies on agenda/atribuicoes; SQL test creates and transitions appointment under owner without users row |

## Remaining parity work (not claimed complete)

| Capability still missing in native admin | Existing console source and APIs to reuse |
| --- | --- |
| Create/edit customers, provision individual clients, organization membership assignment | dashboard/src/hooks/useOrganizationMutation.ts, useIndividualCustomerMutation.ts, useIndividualClientProvisioning.ts; CustomerDetailPage internal_assign_customer_to_organization, mutate_internal_individual |
| Full plan editor / pricing / SLA / publish-retire lifecycle | dashboard/src/pages/PlansPage.tsx, hooks/usePlanMutation.ts; mutate_internal_plan and plan lifecycle APIs |
| Subscription plan changes, renew dates, create and upgrade/downgrade/cancel | dashboard/src/pages/SubscriptionsPage.tsx, hooks/useSubscriptionMutation.ts; mutate_internal_subscription, manage_subscription_lifecycle |
| Full form content/version editing and risk-rule editor/simulation | dashboard/src/pages/FormsPage.tsx and RiskRulesPage.tsx; mutate_internal_form save_draft/publish/rollback, list_internal_risk_configs/mutate_internal_risk_config/simulate_internal_risk_config |
| Create internal staff accounts and semantic permission picker | StaffPage.tsx plus manage_internal_staff; current native selection handles existing staff only and permission codes |
| Support replies, internal notes, ticket assignment/status | dashboard/src/pages/SupportPage.tsx; mutate_internal_support_ticket |
| Session/device workspace and terminate/revoke controls | dashboard/src/pages/SessionsPage.tsx and DevicesPage.tsx; get_internal_session_workspace and session mutation APIs |
| Token creation/revocation and analytics | dashboard/src/pages/TokensConsolePage.tsx, hooks/useTokens.ts/useTokenAnalytics.ts; create_console_invite_token/list_console_invite_tokens/revoke_console_invite_token |
| Communications, WhatsApp sessions/channels/contacts and dispatch | dashboard/src/lib/comunicados.ts, ConsoleWhatsApp* and ConsoleComunicados* pages; internal_list_orgs_comunicados/internal_comunicados_org/internal_*_sessao_bot/internal_operar_sessao_bot/internal_upsert_comunicado/internal_set_comunicado_status and contact/channel/dispatch RPCs |
| Notification campaigns | dashboard/src/pages/NotificationCampaignsPage.tsx; existing campaign RPCs |
| AI provider/configuration/rollout/grants/logs | dashboard/src/lib/ia.ts (central callDb RPC helper and exported typed functions); pages/ia/* |
| App releases, builds and technical events | dashboard/src/pages/VersionsPage.tsx, BuildsPage.tsx, TechnicalEventsPage.tsx; mutate_internal_release/request_internal_build/decide_internal_build/list_internal_technical_events |
| Commercial metrics, invoices, reporting analytics | CommercialMetricsPage.tsx, FaturasPage.tsx, AnalyticsPage.tsx; get_owner_analytics and commercial query APIs |
| MFA enrollment when account has no existing TOTP factor | Supabase auth.mfa.enroll + QR/secret display, challengeAndVerify, explicit cancellation; current native screen only step-up verifies an existing factor |

## Verification

- `npx jest services/__tests__/OwnerExperienceService.test.ts services/__tests__/OwnerAdministrationService.test.ts --runInBand --silent`: 9 tests passed.
- `node scripts/test-owner-mobile-workflow.mjs`: passed actual Postgres-compatible execution, global active owner, first-use preference, bad mode rejection, anonymous/agent/suspended owner denial, global QE approval and closed review rejection, archive/restore idempotency and operation conflict, stale update protection, restrictive RLS, AAL2, global directory and appointment creation/transition.
- One tsc run before later changes exited clean. Most recent shared tsc run exited with one concurrent test error outside Task1 (`RemoteInspectionPhotoDraftService.test.ts` argument count). Parent will run a final integrated typecheck sequentially to avoid machine resource contention.

No physical deletion, deployment, service-key access or privilege granted from a preference was introduced. Existing unrelated dirty files were preserved.
