## ADDED Requirements

### Requirement: Disponibilidade do formulário de árvore
O sistema SHALL disponibilizar o formulário built-in `avaliacao_arvore_cbmmg_v1` no catálogo offline com título, descrição, versão, fonte metodológica e entitlement explícito `inspection_arv`.

#### Scenario: Plano com vistoria de árvores
- **WHEN** um usuário operacional com `inspection_arv` habilitado abre a seleção de formulários
- **THEN** o sistema exibe o formulário de Avaliação de Árvore de Risco - CBMMG entre os modelos padrão offline

#### Scenario: Plano sem vistoria de árvores
- **WHEN** um usuário sem `inspection_arv` tenta iniciar o formulário
- **THEN** o sistema bloqueia o início e apresenta a orientação de assinatura já utilizada pelos demais recursos protegidos

#### Scenario: Dispositivo sem internet
- **WHEN** o usuário autorizado abre o catálogo sem conectividade
- **THEN** o formulário built-in continua disponível e pode ser preenchido até a conclusão local

### Requirement: Identificação técnica da avaliação
O sistema SHALL coletar a identificação necessária à aplicação e à rastreabilidade da metodologia, reutilizando endereço, coordenadas, responsável e agente do fluxo de vistoria e acrescentando altura estimada, espécie aparente opcional, parte defeituosa e evidências fotográficas.

#### Scenario: Zona de avaliação do alvo
- **WHEN** o agente informa a altura estimada da árvore
- **THEN** o sistema calcula e exibe o raio de referência de `1,5 x altura da árvore` usado para avaliar os alvos

#### Scenario: Altura inválida
- **WHEN** o agente informa altura vazia, zero, negativa ou não numérica
- **THEN** o sistema impede o avanço e solicita uma altura válida

#### Scenario: Espécie não identificada
- **WHEN** o agente não consegue identificar a espécie aparente
- **THEN** o sistema permite continuar com o campo em branco ou marcado como não identificado sem alterar a pontuação

### Requirement: Item 1 - Avaliação dos alvos
O sistema SHALL apresentar uma seleção única e obrigatória para o alvo de maior exposição dentro do raio de referência, com pontuação de 0 a 3 conforme o Quadro 2.

#### Scenario: Ocupação frequente por pessoas
- **WHEN** o agente seleciona risco a pessoas com ocupação frequente
- **THEN** o Item 1 registra 3 pontos

#### Scenario: Ocupação ocasional por pessoas
- **WHEN** o agente seleciona risco eventual a pessoas com ocupação ocasional
- **THEN** o Item 1 registra 2 pontos

#### Scenario: Somente bens ou propriedades
- **WHEN** não há risco a pessoas e o agente identifica risco a bens ou propriedades
- **THEN** o Item 1 registra 1 ponto

#### Scenario: Nenhum alvo exposto
- **WHEN** não há risco a pessoas, bens ou propriedades
- **THEN** o Item 1 registra 0 ponto

### Requirement: Medida mitigadora do alvo
O sistema SHALL solicitar o registro da medida mitigadora aplicada ao alvo ou da justificativa técnica para sua não aplicação.

#### Scenario: Medida aplicada
- **WHEN** o agente registra isolamento, remoção de bem ou restrição de acesso
- **THEN** o sistema preserva a descrição como evidência não pontuável da avaliação

#### Scenario: Medida não aplicada
- **WHEN** o agente informa que nenhuma medida foi aplicada
- **THEN** o sistema exige a justificativa antes de avançar

### Requirement: Item 2 - Maior severidade da árvore e seus segmentos
O sistema SHALL apresentar as quatro faixas de severidade do Quadro 2, com seus critérios técnicos, e exigir que o agente selecione a faixa correspondente ao defeito mais severo observado em toda a árvore ou na parte específica avaliada.

#### Scenario: Situação extremamente alta
- **WHEN** o defeito determinante pertence à faixa de risco extremamente alto
- **THEN** o Item 2 registra 4 pontos

#### Scenario: Situação alta
- **WHEN** o defeito determinante pertence à faixa de risco alto
- **THEN** o Item 2 registra 3 pontos

#### Scenario: Situação moderada
- **WHEN** o defeito determinante pertence à faixa de risco moderado
- **THEN** o Item 2 registra 2 pontos

#### Scenario: Situação baixa
- **WHEN** o defeito determinante pertence à faixa de risco baixo
- **THEN** o Item 2 registra 1 ponto

#### Scenario: Vários defeitos observados
- **WHEN** o agente observa dois ou mais defeitos com pontuações diferentes
- **THEN** o sistema orienta e registra a pontuação do defeito de maior severidade, sem somar os defeitos de menor pontuação

### Requirement: Evidência do defeito determinante
O sistema SHALL exigir descrição técnica da parte avaliada e do defeito que determinou a pontuação do Item 2 e SHALL permitir anexar fotos vinculadas à avaliação.

#### Scenario: Descrição ausente
- **WHEN** o agente seleciona uma severidade no Item 2 sem descrever o defeito determinante
- **THEN** o sistema impede o avanço e solicita a evidência técnica

#### Scenario: Evidência preenchida
- **WHEN** o agente descreve localização, natureza e extensão aparente do defeito
- **THEN** o sistema persiste o texto junto à resposta e o inclui no snapshot da avaliação

### Requirement: Item 3 - Diâmetro da parte defeituosa
O sistema SHALL pontuar o maior diâmetro da parte específica associada ao defeito determinante do Item 2, sem assumir automaticamente o maior diâmetro da árvore.

#### Scenario: Diâmetro maior que 51 cm
- **WHEN** o agente seleciona diâmetro maior que 51 cm
- **THEN** o Item 3 registra 3 pontos

#### Scenario: Diâmetro entre 10 e 51 cm
- **WHEN** o agente seleciona diâmetro de 10 a 51 cm, inclusive
- **THEN** o Item 3 registra 2 pontos

#### Scenario: Diâmetro menor que 10 cm
- **WHEN** o agente seleciona diâmetro menor que 10 cm
- **THEN** o Item 3 registra 1 ponto

#### Scenario: Medição exata disponível
- **WHEN** o agente informa opcionalmente o diâmetro medido em centímetros
- **THEN** o sistema valida que o valor é positivo e compatível com a faixa selecionada antes de concluir

### Requirement: Item 4 - Outros fatores de risco
O sistema SHALL registrar explicitamente 0, 1 ou 2 pontos para fatores de risco não contemplados nos itens anteriores e SHALL tratar esse acréscimo como opcional na metodologia.

#### Scenario: Sem fator adicional
- **WHEN** o agente seleciona 0 ponto
- **THEN** o sistema não exige descrição adicional e mantém o total dos Itens 1 a 3

#### Scenario: Acréscimo de 1 ou 2 pontos
- **WHEN** o agente seleciona 1 ou 2 pontos
- **THEN** o sistema exige a descrição do fator adicional antes de permitir a conclusão

### Requirement: Cálculo e classificação CBMMG
O sistema SHALL somar os pontos dos Itens 1 a 4, limitar o resultado final ao máximo de 10 pontos e classificar a avaliação como `não iminente` para totais de 0 a 8 ou `risco iminente` para totais de 9 a 10.

#### Scenario: Resultado abaixo do limiar
- **WHEN** a soma calculada é menor que 9
- **THEN** o sistema apresenta `NÃO IMINENTE` e a pontuação final

#### Scenario: Resultado no limiar
- **WHEN** a soma calculada é exatamente 9
- **THEN** o sistema apresenta `RISCO IMINENTE` e recomenda intervenção para eliminar o risco da parte perigosa

#### Scenario: Soma bruta superior a 10
- **WHEN** a soma dos quatro itens resulta em 11 ou 12 pontos
- **THEN** o sistema armazena e apresenta 10 como pontuação final e preserva a soma bruta no snapshot para auditoria

#### Scenario: Resultado metodológico específico
- **WHEN** qualquer tela apresenta o resultado dessa avaliação
- **THEN** o sistema usa os rótulos CBMMG e não exibe R1, R2, R3, R4, baixo, médio, alto ou crítico como classificação do formulário

### Requirement: Conduta em risco iminente
O sistema SHALL solicitar a decisão operacional após resultado iminente e SHALL exigir justificativa técnica e número do REDS quando a decisão for não intervir.

#### Scenario: Intervenção escolhida
- **WHEN** o agente registra a decisão de intervir
- **THEN** o sistema exige ou registra a conduta recomendada e permite concluir

#### Scenario: Não intervenção sem justificativa
- **WHEN** o total é maior ou igual a 9 e o agente seleciona não intervir sem justificativa ou sem número do REDS
- **THEN** o sistema impede a conclusão e destaca os campos obrigatórios

#### Scenario: Não intervenção justificada
- **WHEN** o agente informa decisão de não intervir, justificativa técnica e número do REDS
- **THEN** o sistema permite concluir e preserva esses registros no snapshot e no relatório

### Requirement: Rascunho, retomada e sincronização
O sistema SHALL reutilizar o comportamento existente de rascunho automático, retomada, persistência local e sincronização posterior para o formulário de árvore.

#### Scenario: Interrupção do preenchimento
- **WHEN** o app é fechado após uma ou mais respostas
- **THEN** o sistema mantém o rascunho local por identificador e versão do formulário

#### Scenario: Retomada do formulário
- **WHEN** o agente reabre o mesmo formulário e existe rascunho
- **THEN** o sistema oferece continuar do ponto salvo ou descartar o rascunho

#### Scenario: Conclusão offline
- **WHEN** a vistoria é concluída sem internet
- **THEN** o sistema salva respostas, cálculo, fotos e status local sem perder dados e sincroniza quando a conectividade retornar
