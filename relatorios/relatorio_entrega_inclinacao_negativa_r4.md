# Relatorio de entrega - inclinacao negativa como agravante R4

Data: 26/05/2026
Branch: `codex/fix-inclinacao-negativa-r4`

## Objetivo

Implementar a nova opcao de inclinacao negativa no formulario de Vistoria de Risco de Deslizamento e garantir que essa resposta eleve a vistoria para R4 por agravante critico.

## Onde mudou

- `assets/formularios/vistoria_deslizamento_v3.json`
  - Adicionada a opcao `q2_f` na pergunta `desl2_q2 - Inclinacao da encosta`.
  - A nova opcao entra logo apos `>=90 graus (vertical)`.
  - Texto da opcao: `Inclinação negativa / talude solapado`.
  - Descricao: face verticalizada ou com base erodida/solapada, comida por baixo, em balanco ou com perda de apoio visivel.
  - Peso mantido em `1.0` para preservar a escala 0-10 do formulario.

- `utils/riscoUtils.ts`
  - Criado o conceito de `CalculoRiscoAgravante`.
  - O snapshot de calculo agora pode gravar:
    - `pontuacaoBase`: soma normal antes do agravante.
    - `agravantes`: lista de agravantes aplicados.
  - Criada regra especifica para `vistoria_deslizamento_v3 + desl2_q2 + q2_f`.

- `utils/laudoPdfBuilder.ts`
  - O PDF do laudo passa a exibir o bloco `Agravante critico aplicado` quando houver agravante no snapshot.
  - Isso evita confusao quando a soma base for baixa, mas o resultado final for R4.

- `utils/__tests__/formularios.test.ts`
  - Adicionado teste garantindo que a opcao de inclinacao negativa existe e fica logo apos a opcao vertical.

- `utils/__tests__/risco.test.ts`
  - Adicionados testes para:
    - inclinacao negativa forcar R4;
    - `pontuacaoBase` continuar registrando a soma original;
    - `pontuacaoTotal` subir para no minimo `7.0`;
    - formulario estrutural nao ser afetado indevidamente.

## Tipo de calculo usado

O calculo principal continua sendo `soma_total`.

A diferenca e que agora existe uma regra de agravante critico para uma resposta especifica:

```text
se formularioId == vistoria_deslizamento_v3
e perguntaId == desl2_q2
e respostaId == q2_f:
  pontuacaoBase = soma normal dos pesos
  pontuacaoTotal = max(pontuacaoBase, 7.0)
  nivelRisco = r4
  agravantes = [inclinacao_negativa_talude_solapado]
```

Sem a opcao negativa, a regra antiga permanece:

```text
pontuacaoTotal = soma dos pesos, limitada de 0.0 a 10.0
nivelRisco = R1/R2/R3/R4 conforme limites oficiais
```

## Grau de risco da opcao negativa

A opcao `Inclinação negativa / talude solapado` gera R4 obrigatorio por agravante critico.

Como o sistema trabalha com apenas quatro niveis, nao existe nivel acima de R4. A regra operacional ficou:

- `maior que R4` no contexto tecnico = `R4 obrigatorio no sistema`;
- pontuacao final minima = `7.0`;
- nivel final = `r4`.

## Bugs evitados antes da implementacao

- Evitado usar `pesoRisco` maior que `1.0`, porque os formularios ativos sao validados como escala 0-10 com maximo de 1 ponto por pergunta.
- Evitado aplicar a regra em qualquer formulario ou pergunta parecida. O gatilho ficou condicionado a `formularioId`, `perguntaId` e `respostaId`.
- Evitado gerar R4 sem explicacao no laudo. O snapshot grava o agravante e o PDF exibe o motivo.
- Evitado alterar o formulario estrutural. Ele continua tratando `Talude / Encosta proxima` como efeito na edificacao, nao como leitura geometrica da inclinacao.

## Validacao executada

- `npm test -- --runInBand utils/__tests__/risco.test.ts utils/__tests__/formularios.test.ts`
  - Resultado: passou.
  - Testes: 21 passaram.

- `npx tsc --noEmit`
  - Resultado: passou sem erros.

- `npm test -- --runInBand`
  - Resultado: passou.
  - Suites: 7 passaram.
  - Testes: 61 passaram.
  - Observacao: a suite de sync emite logs esperados de erro/warn simulando falha de rede; os testes passaram.

## Riscos residuais

- Risco operacional: se o vistoriador marcar inclinacao negativa sem haver solapamento/base erodida/face em balanco, o sistema classificara como R4. A mitigacao e treinamento e exigencia de foto/observacao.
- Risco de vistorias antigas: snapshots antigos nao possuem `agravantes`, mas continuam compativeis porque o campo e opcional.
- Risco de comunicacao: equipes precisam entender que `q2_f` nao e apenas um angulo; e um sinal visual critico de instabilidade do talude.

## Status de revisao

Status: approved

Findings: nenhum bloqueador encontrado apos validacao automatizada.

Residual risk: uso incorreto da nova opcao em campo, mitigado por texto descritivo, registro no laudo e treinamento operacional.
