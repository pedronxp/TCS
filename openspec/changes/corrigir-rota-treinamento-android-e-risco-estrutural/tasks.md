## 1. Route And Map Stability

- [x] 1.1 Audit route and map entry points in `app/(panel)/mapas.tsx`, `app/(panel)/inspecoes/[id].tsx`, scheduling screens, and any "Como Chegar" helpers.
- [x] 1.2 Centralize coordinate validation for finite in-range latitude/longitude pairs and reject missing, invalid, out-of-range, or `0,0` coordinates.
- [x] 1.3 Apply coordinate validation before markers, heatmap points, bounds fitting, map animations, and external route launch.
- [x] 1.4 Add recoverable user feedback when "Como Chegar" cannot open because coordinates are invalid or the platform URL fails.
- [x] 1.5 Harden Android `MapView` lifecycle by hiding/unmounting or ignoring map updates on blur/unmount and clearing pending timers.

## 2. Android Training New Inspection Entry

- [x] 2.1 Reproduce or trace the Modo Treinamento `Nova Vistoria` navigation path from `app/(panel)/treinamento/index.tsx` to `dados-iniciais`.
- [x] 2.2 Prevent duplicate navigation or guard redirects while an active training session enters allowed inspection routes.
- [x] 2.3 Make `app/(panel)/inspecoes/dados-iniciais.tsx` render its form shell immediately before GPS permission, current location, last-known location, or reverse geocode completes.
- [x] 2.4 Keep GPS/reverse geocode errors local and non-blocking, allowing manual address entry in training mode and production mode.
- [x] 2.5 Verify training inspections remain local-only and do not trigger production sync, storage upload, audit log, or operational dashboard writes.

## 3. Structural Risk Form Update

- [x] 3.1 Update `assets/formularios/risco_estrutural_novo_v2.json` so `est_q2` is `Estrutura (pilares e vigas)` and no longer mentions lajes.
- [x] 3.2 Add the required `Laje` question immediately after `est_q2` with options `Bom`, `Ruim`, and `Pessimo`.
- [x] 3.3 Remove `Inexistente` from all structural questions except `Fundacao` and `Estrutura (pilares e vigas)`.
- [x] 3.4 Mark `Inexistente` for `Fundacao` and `Estrutura (pilares e vigas)` as requiring technical justification.
- [x] 3.5 Redistribute structural weights or apply conservative rules so the form remains max score 10 and `Inexistente` in the two critical elements is not zero-risk.

## 4. Wizard, Reports, And Risk Calculation

- [x] 4.1 Extend form models/helpers to support option-level required justification without breaking existing optional risk observations.
- [x] 4.2 Prevent advancing in the wizard when required justification for `Inexistente` is empty.
- [x] 4.3 Persist the required justification with the responses and include it in resolved responses, report, laudo/PDF, and risk snapshot where applicable.
- [x] 4.4 Update `utils/riscoUtils.ts` so conservative `Inexistente` behavior is reflected in score, minimum risk rule, or saved calculation details.
- [x] 4.5 Preserve compatibility with older saved inspections that do not contain the new laje answer or required justification metadata.

## 5. Tests And Validation

- [x] 5.1 Update form asset tests to assert `Inexistente` appears only on fundacao and pillars/beams, laje exists after structure, and max score remains 10.
- [x] 5.2 Add or update risk calculation tests for `Fundacao = Inexistente` and `Estrutura (pilares e vigas) = Inexistente`.
- [x] 5.3 Add or update tests for required justification filtering/persistence if existing test harness supports wizard/helper coverage.
- [x] 5.4 Add route/map validation tests for invalid coordinates if helper-level testing is practical.
- [x] 5.5 Run `npm test -- --runInBand`.
- [x] 5.6 Run `npx tsc --noEmit`.
- [x] 5.7 Run `npx --cache "$env:TEMP\\openspec-npx-cache" @fission-ai/openspec@latest validate --all --json`.

## 6. Reviewer Handoff

- [x] 6.1 Return summary of changed behavior, changed files, validation commands, results, risks, and Android verification notes.
- [x] 6.2 Ask Reviewer to inspect map lifecycle, training route guard, structural form weights, required justification behavior, and report/laudo output.
