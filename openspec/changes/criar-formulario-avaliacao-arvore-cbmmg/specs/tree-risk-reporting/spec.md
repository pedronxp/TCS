## ADDED Requirements

### Requirement: Snapshot metodológico auditável
O sistema SHALL persistir um snapshot versionado do cálculo de árvore contendo identificação da metodologia, versão do formulário e da regra, pontos por item, soma bruta, teto aplicado, total final, resultado metodológico e evidências condicionais.

#### Scenario: Vistoria concluída
- **WHEN** o agente conclui a avaliação de árvore
- **THEN** o snapshot registra valores suficientes para reproduzir o resultado sem recalcular a partir de uma versão futura do formulário

#### Scenario: Teto aplicado
- **WHEN** a soma bruta ultrapassa 10 pontos
- **THEN** o snapshot diferencia a soma bruta do total final limitado a 10

#### Scenario: Leitura histórica sem asset atual
- **WHEN** uma vistoria antiga é aberta após atualização do formulário built-in
- **THEN** o sistema prioriza o snapshot salvo para apresentar pontuação, resultado, respostas determinantes e versão metodológica

### Requirement: Rótulos de resultado consistentes
O sistema SHALL resolver o rótulo, a cor e a conduta da avaliação de árvore pelo resultado metodológico salvo em todas as superfícies que exibem a vistoria.

#### Scenario: Resultado não iminente em telas operacionais
- **WHEN** uma vistoria de árvore com total de 0 a 8 aparece no wizard, resultado, detalhe, histórico ou compartilhamento
- **THEN** o sistema exibe `NÃO IMINENTE` com tratamento visual não crítico

#### Scenario: Resultado iminente em telas operacionais
- **WHEN** uma vistoria de árvore com total de 9 ou 10 aparece no wizard, resultado, detalhe, histórico ou compartilhamento
- **THEN** o sistema exibe `RISCO IMINENTE` com tratamento visual de alerta

#### Scenario: Outras metodologias
- **WHEN** a vistoria pertence a um formulário estrutural ou de deslizamento existente
- **THEN** o sistema mantém os rótulos e as cores atuais dessa metodologia sem regressão

### Requirement: Relatório técnico da avaliação de árvore
O sistema SHALL gerar relatório e PDF identificados como Avaliação de Árvore de Risco - CBMMG, com fonte metodológica legível e sem rótulos genéricos R1-R4.

#### Scenario: Conteúdo mínimo do relatório
- **WHEN** o agente gera o relatório de uma vistoria de árvore
- **THEN** o documento inclui protocolo, data, município, agente, endereço, coordenadas, responsável, identificação da árvore, raio de avaliação do alvo, pontuação por item, total, resultado e fonte metodológica

#### Scenario: Defeito determinante
- **WHEN** o relatório é gerado
- **THEN** o documento inclui a faixa selecionada no Item 2, a descrição do defeito determinante, a parte avaliada e o diâmetro ou faixa do Item 3

#### Scenario: Evidências e conduta
- **WHEN** existem fotos, medida mitigadora, fatores adicionais ou conduta registrados
- **THEN** o documento inclui esses elementos em seções próprias, preservando legenda e associação com a vistoria

#### Scenario: Não intervenção em risco iminente
- **WHEN** o resultado é iminente e a decisão registrada é não intervir
- **THEN** o relatório destaca a decisão, a justificativa técnica e o número do REDS

### Requirement: Relatório legível e estável
O sistema SHALL produzir PDF em formato A4 com hierarquia visual, tabelas legíveis, quebra de página segura, fotos proporcionais e rodapé de identificação.

#### Scenario: Texto técnico extenso
- **WHEN** a descrição do defeito, fator adicional ou justificativa ocupa múltiplas linhas
- **THEN** o PDF quebra o conteúdo sem sobreposição, corte ou saída das margens

#### Scenario: Múltiplas fotos
- **WHEN** a vistoria possui mais fotos do que cabem na página atual
- **THEN** o PDF continua o registro fotográfico em página subsequente sem distorcer as imagens

#### Scenario: Ausência de foto
- **WHEN** nenhuma evidência fotográfica foi registrada
- **THEN** o relatório omite a galeria ou indica ausência de fotos sem reservar um bloco vazio excessivo

### Requirement: Compartilhamento e exportação
O sistema SHALL usar o resultado metodológico e a pontuação final ao compartilhar ou exportar uma vistoria de árvore.

#### Scenario: Mensagem compartilhada
- **WHEN** o usuário compartilha o resumo da vistoria
- **THEN** a mensagem identifica o formulário, a pontuação, `NÃO IMINENTE` ou `RISCO IMINENTE`, o endereço e o protocolo sem converter para R1-R4

#### Scenario: Exportação após sincronização
- **WHEN** uma vistoria concluída offline é sincronizada e o usuário gera o PDF
- **THEN** o relatório usa os mesmos dados e resultado que foram salvos localmente na conclusão

### Requirement: Compatibilidade com persistência existente
O sistema SHALL reutilizar os campos existentes de vistoria e SHALL manter compatibilidade de leitura com registros que não possuem os novos metadados de árvore.

#### Scenario: Novo registro de árvore
- **WHEN** a avaliação de árvore é salva
- **THEN** o sistema utiliza `formularioId`, `formularioVersao`, `respostasJson`, `calculoRisco`, `pontuacaoTotal`, fotos e status existentes sem exigir nova tabela remota

#### Scenario: Registro legado sem resultado metodológico
- **WHEN** uma vistoria antiga não contém os novos campos do snapshot
- **THEN** o sistema aplica o fallback atual de nível de risco e continua abrindo o detalhe e o relatório sem falha
