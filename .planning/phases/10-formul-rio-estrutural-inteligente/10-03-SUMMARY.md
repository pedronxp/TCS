---
phase: 10-formul-rio-estrutural-inteligente
plan: 03
type: summary
status: complete
---

# 10-03 Summary — risco_estrutural_v2.json + Integração

## O que foi feito

### Tarefa 1 — risco_estrutural_v2.json
- Criado `assets/formularios/risco_estrutural_v2.json` com 7 fases e 35 perguntas
- 28 entradas skipSe (7 elementos × 4 perguntas condicionais)
- Mínimo de 7 perguntas (quando todos os elementos estão em Bom estado)
- Pesos: Fundação 1.5, Estrutura 1.5, Muro Arrimo 1.4, Talude 1.4, Drenagem 1.1, Alvenaria 1.0, Cobertura 0.9
- Imagens: est_*/grav_*/ext_* para Estado/Gravidade/Extensão; opcao_nao/sim para Ativa

### Tarefa 2 — Integração no wizard e seleção
- `wizard.tsx`: adicionado `'risco_estrutural_v2'` ao mapa ASSETS
- `selecao-formulario.tsx`: v2 adicionado ao topo de FORMULARIOS_BUILTIN com `isNew: true`
- Badge "Novo" exibido condicionalmente quando `f.isNew === true`
- Corrigido uso de prop `label` no Badge (`<Badge label="..." variant="..." />`)

## Verificações
- `node -e` validation: fases:7 perguntas:35 skipSe:28 OK
- TypeScript: 0 erros novos introduzidos (24 pré-existentes em outros arquivos)
- Commit: 8f90b94

## Resultado
Formulário v2 disponível na seleção de formulário com badge "Novo", integrado ao wizard com lógica skipSe funcionando. O agente verá no máximo 7 perguntas em vistorias com todos elementos em bom estado.
