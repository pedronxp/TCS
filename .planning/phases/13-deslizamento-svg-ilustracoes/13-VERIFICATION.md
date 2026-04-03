---
phase: 13-deslizamento-svg-ilustracoes
verified: 2026-04-03T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Abrir o formulário 'Vistoria de Risco de Deslizamento' no dispositivo e navegar até Q5 (Trincas)"
    expected: "Cada opção exibe um SVG inline temático em vez das imagens genéricas opcao_nao/opcao_sim"
    why_human: "Renderização visual de SvgXml não é verificável programaticamente — depende de react-native-svg em runtime"
  - test: "Preencher o formulário com pontuação 2 (ex: Q5=Sim, Q6=Não, demais Q1–Q4 mínimo) e verificar classificação"
    expected: "Resultado exibe R2 — MÉDIO (pontuação 2 deve ser ≤3 e >1)"
    why_human: "Lógica de cálculo envolve runtime do app e UI de resultado — não testável com grep"
  - test: "Preencher um formulário de risco estrutural v2 e confirmar que imagens PNG ainda aparecem normalmente"
    expected: "Cards do formulário estrutural exibem imagens PNG inalteradas (fallback PNG intacto)"
    why_human: "Retrocompatibilidade com PNG depende de runtime — formulários sem svgKey devem usar o branch else"
---

# Phase 13: Deslizamento SVG Ilustrações — Verification Report

**Phase Goal:** Formulário "Vistoria de Risco de Deslizamento" exibe ilustrações SVG inline nas questões Q5–Q10 e limites de classificação correspondem à planilha técnica original (R1≤1, R2≤3, R3≤5, R4>5)
**Verified:** 2026-04-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                          | Status     | Evidence                                                                                                          |
|----|--------------------------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------------------|
| 1  | Questões Q5–Q10 do formulário de deslizamento exibem ilustrações SVG específicas ao tema (não ícones genéricos sim/não)       | VERIFIED   | `vistoria_deslizamento_v1.json` — 14 opções das perguntas `desl_trincas` a `desl_processos_instabilizacao` têm `svgKey` preenchido; `deslizamentoSvgs.ts` tem 14 entradas SVG temáticas distintas |
| 2  | Limites de classificação em vistoria_deslizamento_v1.json correspondem exatamente à planilha: R1≤1, R2≤3, R3≤5, R4>5         | VERIFIED   | `classificacao.limites`: `max:1`, `max:3`, `max:5`, `max:9999` — exatamente como especificado na planilha técnica |
| 3  | Wizard carrega SvgXml somente quando svgKey está presente — PNG fallback mantido para todos os outros formulários              | VERIFIED   | `wizard.tsx` linha 533: `op.svgKey && DESL_SVGS[op.svgKey] ? <SvgXml ...> : op.imagemLocal && (...)` — branch PNG intacto |
| 4  | Formulário funciona 100% offline — SVGs são strings inline, sem dependência de rede                                           | VERIFIED   | `deslizamentoSvgs.ts` contém SVG strings literais em `Record<string,string>` — nenhuma URL ou fetch externo        |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact                                             | Expected                                              | Status     | Details                                                                                     |
|------------------------------------------------------|-------------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| `assets/formularios/vistoria_deslizamento_v1.json`  | JSON com thresholds corrigidos e svgKey em Q5–Q10     | VERIFIED   | `max:1/3/5/9999` corretos; `svgKey` presente em todas as 14 opções de Q5–Q10               |
| `utils/deslizamentoSvgs.ts`                          | Catálogo de 14 SVG strings para Q5–Q10               | VERIFIED   | Exporta `DESL_SVGS: Record<string,string>` com exatamente 14 chaves (`desl_trincas_nao` … `desl_instab_ocorrido`) |
| `utils/formulariosAssets.ts`                         | Interface OpcaoModel com campo svgKey opcional        | VERIFIED   | `svgKey?: string \| null` na interface; `svgKey: o.svgKey \|\| null` em `flattenPerguntas` |
| `app/(panel)/inspecoes/wizard.tsx`                   | Renderização SvgXml quando svgKey presente, PNG fallback intacto | VERIFIED | `import { SvgXml }` + `import { DESL_SVGS }` nas linhas 21–22; renderização condicional na linha 533; estilo `optionSvg` na linha 670 |

---

### Key Link Verification

| From                              | To                                  | Via                                           | Status   | Details                                                                     |
|-----------------------------------|-------------------------------------|-----------------------------------------------|----------|-----------------------------------------------------------------------------|
| `vistoria_deslizamento_v1.json`   | `deslizamentoSvgs.ts`               | `svgKey` string como chave de lookup          | WIRED    | JSON `svgKey` corresponde 1:1 às chaves em `DESL_SVGS`                     |
| `deslizamentoSvgs.ts`             | `wizard.tsx`                        | `import { DESL_SVGS }` + `DESL_SVGS[op.svgKey]` | WIRED | Import na linha 22; uso na linha 534                                        |
| `formulariosAssets.ts`            | `wizard.tsx`                        | `flattenPerguntas` mapeia `svgKey` em `OpcaoModel` | WIRED | `flattenPerguntas` já importado; `op.svgKey` acessível no wizard via `OpcaoModel` |
| `wizard.tsx` SvgXml branch        | PNG fallback branch                 | Ternário `op.svgKey && DESL_SVGS[op.svgKey] ? ... : op.imagemLocal && (...)` | WIRED | Outros formulários sem `svgKey` caem no branch `else` sem alteração |

---

### Data-Flow Trace (Level 4)

| Artifact       | Data Variable          | Source                                      | Produces Real Data | Status   |
|----------------|------------------------|---------------------------------------------|--------------------|----------|
| `wizard.tsx`   | `op.svgKey`            | `flattenPerguntas` ← `vistoria_deslizamento_v1.json` | Sim — SVG string literal inline | FLOWING |
| `wizard.tsx`   | `classificacao.limites`| `vistoria_deslizamento_v1.json`             | Sim — valores `1, 3, 5, 9999` corretos | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                | Command                                                                                     | Result                         | Status  |
|-----------------------------------------|---------------------------------------------------------------------------------------------|--------------------------------|---------|
| DESL_SVGS exporta 14 chaves             | `grep -c "desl_" utils/deslizamentoSvgs.ts`                                                | 14                             | PASS    |
| Thresholds R1 max=1                     | JSON linha 11: `"max": 1`                                                                  | Confirmado                     | PASS    |
| Thresholds R2 max=3                     | JSON linha 17: `"max": 3`                                                                  | Confirmado                     | PASS    |
| Thresholds R3 max=5                     | JSON linha 23: `"max": 5`                                                                  | Confirmado                     | PASS    |
| Thresholds R4 max=9999                  | JSON linha 29: `"max": 9999`                                                               | Confirmado                     | PASS    |
| svgKey em desl_trincas/nao              | JSON linha 190: `"svgKey": "desl_trincas_nao"`                                             | Confirmado                     | PASS    |
| SvgXml importado em wizard.tsx          | Linha 21: `import { SvgXml } from 'react-native-svg'`                                      | Confirmado                     | PASS    |
| DESL_SVGS importado em wizard.tsx       | Linha 22: `import { DESL_SVGS } from '../../../utils/deslizamentoSvgs'`                    | Confirmado                     | PASS    |
| Renderização condicional por svgKey     | Linha 533: `op.svgKey && DESL_SVGS[op.svgKey]`                                             | Confirmado                     | PASS    |
| PNG fallback preservado                 | Linhas 535–541: `op.imagemLocal && (FORM_IMAGES[op.imagemLocal] ? ...)`                    | Branch PNG intacto             | PASS    |
| estilo optionSvg adicionado             | Linha 670: `optionSvg: { width: '100%', height: 80, ... overflow: 'hidden' }`             | Confirmado                     | PASS    |
| 4 commits da fase existem no git        | `git log 86b02b1 a35e93a dc8744b 34af560`                                                  | Todos os 4 commits confirmados | PASS    |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                                         | Status    | Evidence                                                                           |
|-------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------|-----------|------------------------------------------------------------------------------------|
| FORM-08     | 13-01-PLAN  | Questões Q5–Q10 do formulário de deslizamento exibem ilustrações SVG específicas e limites de classificação conforme planilha técnica | SATISFIED | SVGs temáticos em 14 opções; thresholds `max:1,3,5,9999` confirmados no JSON      |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Nenhum encontrado | — | — |

SVGs são strings literais completas (não placeholders). Nenhum `TODO`, `FIXME`, `return null`, ou dados hardcoded vazios detectados nos arquivos da fase.

---

### Human Verification Required

#### 1. Renderização SVG em dispositivo real

**Test:** Abrir o formulário "Vistoria de Risco de Deslizamento" no app e navegar até a questão Q5 (Trincas no solo).
**Expected:** Cada opção exibe um SVG inline temático — "Sem trincas" com checkmark verde sobre solo verde, "Trincas" com linha em ziguezague vermelho sobre solo — em vez das imagens genéricas `opcao_nao`/`opcao_sim`.
**Why human:** Renderização visual de `SvgXml` do react-native-svg requer execução do app em dispositivo ou simulador — não verificável com ferramentas estáticas.

#### 2. Cálculo de classificação com thresholds corrigidos

**Test:** Preencher o formulário marcando apenas Q5=Sim (pesoRisco=2) e Q1–Q4 com opções de peso 0. Verificar a tela de resultado.
**Expected:** Classificação R2 — MÉDIO (pontuação 2 está no intervalo >1 e ≤3).
**Why human:** A lógica de `calcularNivelRisco` e a exibição em `resultado.tsx` precisam ser observadas em runtime para confirmar que os novos limites são aplicados corretamente.

#### 3. Retrocompatibilidade PNG com formulário estrutural v2

**Test:** Iniciar uma vistoria de risco estrutural v2, navegar até qualquer pergunta de elemento e verificar as opções.
**Expected:** Imagens PNG (est_, grav_, ext_ etc.) continuam aparecendo normalmente, sem regressão visual.
**Why human:** O branch `else` do ternário em wizard.tsx só é exercido em runtime quando `op.svgKey` é null/undefined — não há como confirmar visualmente sem abrir o formulário.

---

### Gaps Summary

Nenhuma lacuna encontrada. Todos os 4 artefatos existem, são substantivos (não stubs), estão conectados corretamente e o fluxo de dados é verificável de ponta a ponta.

Os 4 commits da fase (34af560, dc8744b, a35e93a, 86b02b1) estão presentes no histórico git. O REQUIREMENTS.md já registra FORM-08 como `[x]` Complete com mapeamento para Phase 13.

---

*Verified: 2026-04-03*
*Verifier: Claude (gsd-verifier)*
