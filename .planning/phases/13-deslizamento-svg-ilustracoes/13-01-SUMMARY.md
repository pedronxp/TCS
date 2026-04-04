---
phase: 13-deslizamento-svg-ilustracoes
plan: 01
subsystem: ui
tags: [react-native-svg, SvgXml, formularios, deslizamento, wizard, json-form]

# Dependency graph
requires:
  - phase: 07-formularios-classificacao-risco
    provides: wizard.tsx com renderização de opções via FORM_IMAGES PNG
  - phase: 12-formulario-completo
    provides: formulariosAssets.ts com OpcaoModel e flattenPerguntas

provides:
  - vistoria_deslizamento_v1.json com thresholds corrigidos (R1≤1, R2≤3, R3≤5, R4>5)
  - vistoria_deslizamento_v1.json com svgKey em 14 opções das perguntas Q5–Q10
  - utils/deslizamentoSvgs.ts com catálogo de 14 SVGs inline temáticos
  - OpcaoModel com campo svgKey opcional retrocompatível
  - wizard.tsx renderizando SvgXml quando svgKey presente, PNG fallback intacto

affects:
  - wizard
  - formularios
  - laudo
  - deslizamento

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "svgKey opcional em OpcaoModel — outros formulários sem svgKey usam fallback PNG automaticamente"
    - "DESL_SVGS Record<string,string> — catálogo de SVGs inline por chave, sem dependência de rede"
    - "SvgXml prioridade sobre PNG — renderização condicional op.svgKey && DESL_SVGS[op.svgKey]"

key-files:
  created:
    - utils/deslizamentoSvgs.ts
  modified:
    - assets/formularios/vistoria_deslizamento_v1.json
    - utils/formulariosAssets.ts
    - app/(panel)/inspecoes/wizard.tsx

key-decisions:
  - "svgKey coexiste com imagemLocal — PNG mantido como fallback para garantir retrocompatibilidade e compatibilidade com laudos/relatórios"
  - "DESL_SVGS como Record<string, string> em arquivo separado — isolamento do catálogo SVG específico do deslizamento, sem poluir o wizard"
  - "Thresholds corrigidos: R1≤1, R2≤3, R3≤5, R4>5 conforme planilha técnica original (anteriores: 2, 4, 9 estavam incorretos)"

patterns-established:
  - "Padrão svgKey: campos JSON de formulário podem ter svgKey opcional para substituir imagens genéricas opcao_sim/opcao_nao por ilustrações temáticas"
  - "Catálogo SVG isolado: SVGs de um formulário ficam em utils/{formulario}Svgs.ts, não inline no wizard"

requirements-completed:
  - FORM-08

# Metrics
duration: 25min
completed: 2026-04-03
---

# Phase 13 Plan 01: Deslizamento SVG Ilustrações Summary

**Formulário deslizamento melhorado: thresholds corrigidos (R1≤1/R2≤3/R3≤5/R4>5) e 14 SVGs inline temáticos substituindo imagens genéricas nas questões Q5–Q10**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-03T00:00:00Z
- **Completed:** 2026-04-03T00:25:00Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Corrige thresholds de classificação de risco: R1≤1, R2≤3, R3≤5, R4>5 (anteriores eram 2, 4, 9 — incorretos segundo planilha técnica)
- Cria 14 SVGs inline temáticos para as 6 perguntas Q5–Q10 (trincas, degraus, inclinação de estruturas, muros embarrigados, escorregamento próximo, processos de instabilização)
- Estende `OpcaoModel` com `svgKey` opcional — zero impacto nos 3 formulários existentes sem svgKey
- Wizard renderiza `SvgXml` quando `svgKey` está presente, fallback PNG intacto para todos os outros formulários

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Corrigir thresholds e adicionar svgKey no JSON** - `34af560` (feat)
2. **Tarefa 2: Criar utils/deslizamentoSvgs.ts** - `dc8744b` (feat)
3. **Tarefa 3: Extender OpcaoModel em formulariosAssets.ts** - `a35e93a` (feat)
4. **Tarefa 4: Adicionar SvgXml no wizard com fallback PNG** - `86b02b1` (feat)

## Files Created/Modified

- `assets/formularios/vistoria_deslizamento_v1.json` - Thresholds corrigidos + svgKey em 14 opções de Q5–Q10
- `utils/deslizamentoSvgs.ts` - Catálogo de 14 SVG strings inline (Record<string, string>)
- `utils/formulariosAssets.ts` - OpcaoModel com svgKey opcional + flattenPerguntas mapeando svgKey
- `app/(panel)/inspecoes/wizard.tsx` - Import SvgXml/DESL_SVGS + renderização condicional + estilo optionSvg

## Decisions Made

- `svgKey` coexiste com `imagemLocal` — PNG mantido como fallback, garantindo retrocompatibilidade com laudos/relatórios que possam usar imagemLocal
- `DESL_SVGS` em arquivo separado `utils/deslizamentoSvgs.ts` — isolamento do catálogo SVG específico do formulário deslizamento, mantendo wizard limpo
- Thresholds corrigidos para R1≤1, R2≤3, R3≤5, R4>5 conforme planilha técnica original

## Deviations from Plan

**1. [Desvio pré-execução] Worktree desatualizado**
- **Encontrado em:** Início da execução
- **Problema:** Branch `worktree-agent-a2ebf9f2` estava 91 commits atrás de main — não tinha `vistoria_deslizamento_v1.json`, `formulariosAssets.ts` ou `wizard.tsx`
- **Correção:** `git merge main --no-edit --no-verify` (fast-forward sem conflitos)
- **Impacto:** Nenhum — merge limpo, plano executado normalmente após sincronização

---

**Total desvios:** 1 pré-execução (worktree desatualizado), 0 durante execução
**Impacto no plano:** Nenhum — plano executado exatamente como especificado após sincronização

## Issues Encountered

Worktree branch estava 91 commits atrás de main. Resolvido com `git merge main` (fast-forward limpo sem conflitos).

## User Setup Required

Nenhum — sem dependências externas, sem configuração de serviço necessária.

## Next Phase Readiness

- Formulário deslizamento com ilustrações SVG temáticas funcionais
- Padrão svgKey estabelecido — pode ser aplicado a novos formulários (inundação, etc.)
- Todos os outros formulários (risco_estrutural_v1/v2/completo_v1) mantêm comportamento PNG inalterado

---
*Phase: 13-deslizamento-svg-ilustracoes*
*Completed: 2026-04-03*
