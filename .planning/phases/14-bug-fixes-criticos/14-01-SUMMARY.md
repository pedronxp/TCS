---
plan: 14-01
phase: 14-bug-fixes-criticos
status: complete
completed: 2026-04-03
executor: manual
---

## One-liner

Corrigidos bugs de município errado e foto ausente nos relatórios PDF.

## What was built

- `app/(panel)/inspecoes/wizard.tsx`: municipio agora usa `params.municipio || profile?.municipio` (prioridade correta); params de navegação para resultado agora incluem `municipio`
- `app/(panel)/inspecoes/resultado.tsx`: adicionado `municipioParam` em useLocalSearchParams; fallbacks usam `municipioParam || profile?.municipio`; `foto_url` adicionado ao SELECT Supabase, `normalizar()` e `buildDados()`; `foto_url` passado para `initReport()`
- `context/ReportContext.tsx`: adicionado campo `foto_url?: string | null` em `ReportDraft`
- `app/(panel)/inspecoes/relatorio.tsx`: `exportarPDF()` passa `foto_url: draft.foto_url ?? null` para `buildLaudoHtml()`

## Self-Check: PASSED
