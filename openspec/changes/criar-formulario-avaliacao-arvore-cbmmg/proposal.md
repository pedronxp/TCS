## Why

O app já comercializa o recurso `inspection_arv`, mas ainda não possui um formulário operacional de vistoria de árvores. A implementação deve transformar o Quadro de Avaliação de Árvore de Risco do CBMMG em um fluxo offline, auditável e fiel à metodologia da ITO nº 06, incluindo o limiar de risco iminente e o relatório técnico correspondente.

## What Changes

- Criar o formulário built-in `avaliacao_arvore_cbmmg_v1`, disponível offline no catálogo de vistorias e protegido pelo entitlement `inspection_arv`.
- Implementar os quatro itens do Quadro 2: avaliação dos alvos, maior severidade da árvore/tronco/galhos, diâmetro da parte defeituosa e outros fatores opcionais.
- Calcular a soma dos itens com teto de 10 pontos e classificar o resultado como `não iminente` de 0 a 8 pontos ou `risco iminente` de 9 a 10 pontos.
- Exigir evidência técnica para o defeito determinante do Item 2 e justificativa quando houver acréscimo no Item 4.
- Registrar medidas mitigadoras, fotos, conduta operacional e, quando houver risco iminente sem intervenção, justificativa técnica e número do REDS.
- Adaptar wizard, resultado, histórico, compartilhamento, relatório e laudo/PDF para exibir a classificação específica da metodologia sem converter o resultado para a régua genérica R1-R4.
- Preservar rascunho automático, retomada, funcionamento offline, sincronização posterior e compatibilidade com vistorias existentes.
- Adicionar testes da estrutura do formulário, cálculo, teto, limiar, campos condicionais, persistência e apresentação do relatório.

## Capabilities

### New Capabilities

- `tree-risk-assessment`: formulário de campo CBMMG, regras condicionais, cálculo 0-10, resultado binário, funcionamento offline e conduta operacional.
- `tree-risk-reporting`: rastreabilidade da avaliação de árvore em detalhes, compartilhamento, relatório e PDF, incluindo pontuação por item, evidências, conduta, REDS e identificação da versão metodológica.

### Modified Capabilities

## Impact

- Catálogo e formulário built-in: `assets/formularios/`, `utils/formulariosAssets.ts`, `app/(panel)/inspecoes/selecao-formulario.tsx` e `app/(panel)/inspecoes/wizard.tsx`.
- Cálculo e snapshot: `utils/riscoUtils.ts` e tipos compartilhados de vistoria.
- Apresentação: telas de resultado, detalhe, relatório, laudo, listas e compartilhamento que hoje usam rótulos genéricos de risco.
- PDF: `utils/laudoPdfBuilder.ts`, com referência visual em `output/pdf/prototipo_formulario_arvore_cbmmg.pdf`.
- Assinatura: reutilização do entitlement `inspection_arv`, já existente; não há mudança de plano comercial prevista.
- Persistência: reutilização de `formularioId`, `formularioVersao`, `respostasJson`, `calculoRisco`, fotos e sincronização existentes; não há migração remota obrigatória prevista.
- Testes: suites de formulários, risco, relatório/PDF e sincronização offline aplicáveis.
