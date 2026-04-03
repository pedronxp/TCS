---
phase: 09-ux-correcoes-finais
plan: "01"
subsystem: ux/i18n
tags: [auth, errors, i18n, pt-br, supabase]
status: complete

dependency_graph:
  provides:
    - traduzirErroAuth — utilitário de tradução de erros Supabase Auth para pt-br
  affects:
    - app/(auth)/login.tsx
    - app/(auth)/register.tsx
    - app/(panel)/admin/usuarios.tsx
    - app/(panel)/admin/editor-perguntas.tsx
    - app/(panel)/admin/form-editor.tsx
    - app/(panel)/inspecoes/wizard.tsx

tech_stack:
  patterns:
    - includes-based string matching (case-insensitive) para lidar com variações de wording do Supabase
    - fallback preserva strings pt-br já corretas sem alteração

key_files:
  created:
    - utils/authErrors.ts
  modified:
    - app/(auth)/login.tsx
    - app/(auth)/register.tsx
    - app/(panel)/admin/usuarios.tsx
    - app/(panel)/admin/editor-perguntas.tsx
    - app/(panel)/admin/form-editor.tsx
    - app/(panel)/inspecoes/wizard.tsx

decisions:
  - Opção por includes-based matching (não switch/case com strings exatas) pois o Supabase pode variar o wording entre versões
  - Nas telas de painel, e.message foi removido completamente dos Alert.alert (sem wrapping) — o fallback pt-br fixo é suficiente e mais seguro
  - Nas telas de auth, e.message é wrappado via traduzirErroAuth() pois a mensagem pt-br throwada internamente ('Conta aguardando aprovação...') também deve ser preservada
  - logger.error/warn mantidos intactos em todos os catch blocks — logs internos podem receber e.message normalmente

metrics:
  completed: "2026-04-03T10:58:23Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 6
---

# Phase 09 Plan 01: UX-01 — Tradução de mensagens de erro Supabase Auth Summary

Utilitário `traduzirErroAuth` com 8 mapeamentos includes-based criado e aplicado em 6 arquivos: telas de auth usam wrapping, telas de painel usam strings pt-br fixas.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Criar utils/authErrors.ts com mapa de tradução | 68a2196 | utils/authErrors.ts |
| 2 | Aplicar tradução em telas de auth e painel | c182160 | 6 arquivos modificados |

## Decisions Made

1. **includes-based matching** — O Supabase pode variar o wording entre versões. Usar `m.includes(...)` em vez de match exato é mais resiliente.

2. **Fallback preserva pt-br** — A função retorna a mensagem original se nenhum mapeamento bate. Isso preserva mensagens como `'Conta aguardando aprovação do administrador.'` que são throwadas em pt-br pelo próprio código.

3. **Painel: string fixa vs. wrapping** — Em `Alert.alert` das telas de painel, `e.message` foi removido completamente. O fallback pt-br fixo (ex: `'Houve uma falha ao tentar mudar a senha.'`) é adequado e elimina qualquer risco de vazar erro técnico ao usuário.

4. **Auth: wrapping com traduzirErroAuth** — Em `login.tsx` e `register.tsx`, usa `traduzirErroAuth(e.message)` para traduzir erros do Supabase Auth mantendo compatibilidade com erros pt-br já corretos.

## Deviations from Plan

None — plano executado exatamente como especificado.

## Known Stubs

None — todas as mensagens de erro exibidas ao usuário são strings pt-br fixas ou passam pelo utilitário de tradução.

## Self-Check: PASSED

- [x] `utils/authErrors.ts` existe e exporta `traduzirErroAuth`
- [x] `login.tsx` importa e usa `traduzirErroAuth`
- [x] `register.tsx` importa e usa `traduzirErroAuth`; placeholder "Maria Silva" aplicado
- [x] `usuarios.tsx`: `Alert.alert` de senha usa string pt-br fixa (sem `e.message`)
- [x] `editor-perguntas.tsx`: `Alert.alert` usa string pt-br fixa
- [x] `form-editor.tsx`: dois `Alert.alert` usam strings pt-br fixas
- [x] `wizard.tsx`: dois `Alert.alert` usam strings pt-br fixas
- [x] Todos os `logger.error`/`logger.warn` preservados nos catch blocks
- [x] Commits: 68a2196, c182160
