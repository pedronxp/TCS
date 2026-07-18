## ADDED Requirements

### Requirement: Versão elegível e imutável do documento
O sistema SHALL criar uma versão identificada do documento antes da coleta, contendo tipo, vistoria, versão do template, snapshot canônico, hash SHA-256 do conteúdo e hash SHA-256 do PDF final, e SHALL vincular todo evento de ciência a essa versão.

#### Scenario: Documento preparado para ciência
- **WHEN** o agente conclui a geração de um relatório, laudo ou termo elegível
- **THEN** o sistema preserva o snapshot e o arquivo final como uma versão identificada antes de habilitar a coleta

#### Scenario: Documento regenerado após coleta
- **WHEN** o conteúdo técnico de um documento com ciência registrada é regenerado ou alterado
- **THEN** o sistema cria uma nova versão, preserva a versão e o evento anteriores e indica que a nova versão ainda não possui ciência

#### Scenario: Arquivo divergente
- **WHEN** o hash calculado de um arquivo recuperado difere do hash registrado para a versão
- **THEN** o sistema bloqueia o uso desse arquivo como original e exibe falha de integridade auditável

### Requirement: Apresentação e declaração explícita
O sistema SHALL apresentar o conteúdo final derivado do snapshot imutável, a identificação do documento e o texto versionado da declaração antes de permitir um resultado de ciência.

#### Scenario: Destinatário confirma a declaração
- **WHEN** o documento foi aberto e o destinatário confirma explicitamente a declaração exibida
- **THEN** o sistema habilita a coleta dos dados correspondentes ao resultado escolhido

#### Scenario: Declaração não confirmada
- **WHEN** o destinatário não confirma a declaração
- **THEN** o sistema não registra o resultado `acknowledged` nem uma assinatura

#### Scenario: Texto da declaração atualizado
- **WHEN** uma nova versão do texto institucional entra em vigor
- **THEN** eventos novos registram a nova versão e eventos anteriores continuam associados ao texto que foi exibido na coleta

### Requirement: Registro de ciência
Para o resultado `acknowledged`, o sistema SHALL exigir nome do destinatário, relação declarada com o imóvel ou atendimento, assinatura manuscrita não vazia, agente responsável, versão da declaração e instantes do dispositivo e do servidor.

#### Scenario: Ciência preenchida corretamente
- **WHEN** o destinatário confirma a declaração, informa os campos obrigatórios e fornece assinatura válida
- **THEN** o sistema registra a ciência vinculada à versão exata do documento e disponibiliza seu protocolo após confirmação do servidor

#### Scenario: Assinatura vazia ou insuficiente
- **WHEN** o traço capturado não atende ao mínimo de conteúdo validado
- **THEN** o sistema impede a confirmação e solicita nova assinatura

#### Scenario: Identificador civil não configurado
- **WHEN** a política aplicável não exige identificador civil
- **THEN** o sistema permite concluir a ciência sem CPF ou outro identificador e não induz sua coleta desnecessária

### Requirement: Recusa e impossibilidade de assinatura
O sistema SHALL permitir registrar `refused` ou `unable_to_sign` sem forçar assinatura do destinatário, SHALL exigir motivo e SHALL aplicar a exigência configurada de testemunha.

#### Scenario: Destinatário recusa a ciência
- **WHEN** o destinatário se recusa a declarar ciência
- **THEN** o agente seleciona recusa, registra um motivo e o sistema preserva o resultado sem criar uma assinatura atribuída ao destinatário

#### Scenario: Destinatário impossibilitado de assinar
- **WHEN** o destinatário recebe as orientações mas está impossibilitado de assinar
- **THEN** o agente registra a impossibilidade e seu motivo sem classificar o evento como assinatura manuscrita do destinatário

#### Scenario: Política exige testemunha
- **WHEN** o resultado escolhido exige testemunha na política da organização
- **THEN** o sistema impede a conclusão até registrar a identificação da testemunha e a forma de confirmação definida

### Requirement: Operação offline e estado de confirmação
O sistema SHALL permitir coletar o pacote de ciência sem conexão, SHALL mantê-lo em armazenamento privado do aplicativo e SHALL distinguir um evento local pendente de um evento confirmado pelo servidor.

#### Scenario: Coleta sem conectividade
- **WHEN** o dispositivo está offline e os dados obrigatórios são preenchidos
- **THEN** o sistema salva o pacote como `pendente de sincronização`, informa que ainda não há protocolo definitivo e mantém o fluxo operacional disponível

#### Scenario: Conexão restabelecida
- **WHEN** a conexão retorna e o usuário ainda possui autorização sobre a vistoria
- **THEN** o sistema envia arquivos e metadados, finaliza o evento idempotentemente e substitui o estado pendente pelo resultado confirmado

#### Scenario: Falha permanente de autorização
- **WHEN** a sincronização é rejeitada porque o usuário perdeu acesso ou o documento não pertence ao seu escopo
- **THEN** o sistema preserva o pacote local para tratamento controlado, exibe uma falha acionável e não o apresenta como confirmado

### Requirement: Sincronização idempotente
O sistema SHALL atribuir um `client_event_id` único a cada tentativa lógica de coleta e SHALL produzir no máximo um evento confirmado para esse identificador.

#### Scenario: Retry após timeout
- **WHEN** o servidor conclui a operação mas a resposta não chega ao dispositivo e a fila repete a requisição
- **THEN** o servidor devolve o mesmo evento e protocolo sem duplicar ciência, assinatura ou comprovante

#### Scenario: Upload parcial
- **WHEN** o PDF é enviado mas a evidência ou a finalização falha
- **THEN** a fila retoma somente as etapas pendentes usando os mesmos identificadores e hashes

### Requirement: Comprovante auditável sem mutação do original
Após confirmação, o sistema SHALL gerar um comprovante separado que referencie a versão do documento, seus hashes, protocolo, resultado, declaração, destinatário, agente e horários aplicáveis, sem substituir o PDF apresentado.

#### Scenario: Comprovante de ciência
- **WHEN** um evento `acknowledged` é confirmado
- **THEN** o comprovante inclui a assinatura validada e os dados auditáveis, e o documento técnico original mantém seus hashes

#### Scenario: Comprovante de recusa ou impossibilidade
- **WHEN** um evento `refused` ou `unable_to_sign` é confirmado
- **THEN** o comprovante identifica claramente o resultado e o motivo e não exibe uma assinatura inexistente como se fosse do destinatário

#### Scenario: Exportação combinada
- **WHEN** o usuário autorizado exporta documento e comprovante em conjunto
- **THEN** o sistema combina cópias dos dois artefatos sem alterar os arquivos-fonte preservados

### Requirement: Histórico append-only e correção auditada
O sistema MUST impedir atualização ou exclusão direta de eventos confirmados e SHALL representar correções ou invalidações por novo evento referenciado, com autor, motivo e horário do servidor.

#### Scenario: Tentativa de editar evento concluído
- **WHEN** um cliente tenta atualizar identificação, resultado, assinatura ou horário de um evento confirmado
- **THEN** o servidor rejeita a alteração e mantém o evento original inalterado

#### Scenario: Correção autorizada
- **WHEN** um supervisor autorizado identifica erro material em um evento
- **THEN** o sistema anexa uma correção ou invalidação com motivo e referência ao original, preservando ambos no histórico

### Requirement: Isolamento e proteção das evidências
O sistema SHALL derivar no servidor o escopo individual ou organizacional da vistoria, SHALL proteger registros e objetos por RLS e Storage privado e MUST NOT expor assinaturas ou dados do destinatário em URL pública, logs ou telemetria.

#### Scenario: Acesso entre organizações
- **WHEN** um usuário de outra organização tenta consultar o documento, assinatura, evento ou comprovante
- **THEN** o servidor nega o acesso mesmo que o usuário conheça os identificadores dos objetos

#### Scenario: Conta individual
- **WHEN** um documento pertence a uma vistoria individual sem organização
- **THEN** somente o titular e administradores internos autorizados conseguem acessar suas evidências

#### Scenario: Exibição de arquivo protegido
- **WHEN** um usuário autorizado abre uma assinatura ou comprovante armazenado
- **THEN** o sistema usa acesso autenticado ou URL assinada de curta duração sem tornar o bucket público

### Requirement: Estado da ciência no histórico da vistoria
O sistema SHALL exibir, por tipo e versão de documento, se a ciência não foi coletada, está pendente, foi confirmada, foi recusada, registra impossibilidade ou falhou na sincronização.

#### Scenario: Vistoria com múltiplos documentos
- **WHEN** uma vistoria possui relatório e termo em versões diferentes
- **THEN** a tela mostra o estado de cada documento separadamente e abre seu histórico e comprovante corretos

#### Scenario: Nova versão sem ciência
- **WHEN** uma versão anterior tem ciência e uma versão nova foi gerada
- **THEN** a interface não herda o estado da versão antiga e destaca que a nova versão está pendente

### Requirement: Separação do modo treinamento
O sistema SHALL marcar documentos e eventos do modo treinamento como sem validade operacional e MUST NOT apresentá-los como ciência de uma vistoria real.

#### Scenario: Demonstração em treinamento
- **WHEN** o fluxo é executado em uma vistoria de treinamento
- **THEN** a tela, o documento e o comprovante exibem a marca de treinamento e o evento não aparece como pendência ou evidência operacional
