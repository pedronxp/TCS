---
plan: 14-02
phase: 14-bug-fixes-criticos
status: complete
completed: 2026-04-03
executor: manual+agent
---

## One-liner

Banner offline movido para o rodapé (não sobrepõe conteúdo); 26 telas corrigidas com safe area insets dinâmicos.

## What was built

- `components/ConnectivityBanner.tsx`: pill reposicionado de `top` para `bottom` (`insets.bottom + 68`), hiddenOffset invertido — banner aparece acima da bottom nav, não sobre o conteúdo
- 26 telas em `app/(panel)/`: `paddingTop: 60` removido do StyleSheet estático; `useSafeAreaInsets` importado; `paddingTop: insets.top + 12` aplicado inline no header View — funciona corretamente em todos os tamanhos de tela, notch e Dynamic Island

## Self-Check: PASSED
