# Multi-portal access design

## Objective

Make each authenticated person land in the correct TCS environment with a clear identity, least-privilege navigation, and a safe recovery path when a deep link belongs to another environment.

## Preserve current route roots

Extend existing routes rather than replacing them:

- Public marketing stays at \`/\`.
- Internal Console stays at \`/login\` and \`/app/*\`.
- Customer entry stays at \`/entrar\`, \`/criar-conta\`, and \`/convite/:token\`.
- Individual Portal stays at \`/portal/individual/*\`.
- Municipal Portal stays at \`/portal/municipal/*\`.

## Entry behavior

After session hydration, the server returns active contexts for the current \`auth.uid()\` only: Console, Individual Portal, and Municipal Portal. Each contains only a server-owned id, label, subtitle, kind, and destination.

1. No context: keep the existing onboarding or pending-access explanation.
2. One context: route automatically, preserving \`returnTo\` only inside that context root.
3. Multiple contexts: render \`/selecionar-ambiente\` with only server-issued choices.
4. A cross-context protected URL: render \`/acesso-restrito\` with a button to the active environment or selector. Do not silently switch environments.

The browser never authorizes from \`user_metadata\`, client storage, query parameters, or menu visibility. Existing RLS and resource RPCs remain the authority.

## Internal roles and menus

| Role | Landing | Menu purpose |
|---|---|---|
| owner | \`/app\` | Executive operation and governance |
| developer | \`/app\` | Technical health and delivery |
| support | \`/app/suporte\` | Tickets and customer resolution |
| commercial | \`/app/negocio/indicadores\` | Indicators, plans, subscriptions, customers |
| auditor | \`/app/auditoria\` | Read-only audit work |

Support no longer inherits owner navigation. Commercial becomes an internal role. Every route retains its permission guard.

## Customer recognition

The shell continuously identifies the environment:

- Individual: \`Meu Portal TCS\` plus account name.
- Municipal: \`Portal Municipal\`, organization/municipality name, and municipal role.
- Internal: \`TCS Console\` and internal role.

When a second active context exists, the identity menu exposes \`Trocar ambiente\`. Municipal self-provisioning remains disabled: municipal users enter via \`/convite/:token\`, and signup explains that path.

## Security and acceptance criteria

The entry RPC requires a non-null \`auth.uid()\`, uses a fixed \`search_path\`, is unavailable to \`PUBLIC\`/`anon`, and is executable only by `authenticated`. Support and commercial never see owner menus. Valid deep links resume, while external/cross-context returns are rejected. Existing public, Console, individual, municipal, invitation, and recovery paths remain compatible.
