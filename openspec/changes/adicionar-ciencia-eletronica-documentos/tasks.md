## 1. Contratos e integridade do documento

- [x] 1.1 Definir tipos TypeScript para categoria/versão de documento, resultados e estados locais de ciência, declaração versionada, testemunha e eventos de correção.
- [x] 1.2 Implementar canonicalização determinística do snapshot e hashes SHA-256 de conteúdo, PDF e evidência, com vetores de teste estáveis.
- [x] 1.3 Extrair dos geradores atuais um snapshot imutável por tipo de documento e versionar os templates sem alterar o resultado técnico das vistorias existentes.
- [x] 1.4 Criar testes que comprovem que conteúdo igual gera o mesmo hash e que qualquer alteração de conteúdo ou arquivo cria versão/hash diferente.

## 2. Persistência e segurança no Supabase

- [x] 2.1 Criar migração aditiva para `generated_documents` e `document_acknowledgement_events`, incluindo checks de resultado, referências de versão/correção, unicidade de `client_event_id`, índices e proibição de mutação direta.
- [x] 2.2 Criar bucket privado e políticas de Storage para PDFs, assinaturas/evidências e comprovantes em caminhos derivados do escopo persistido.
- [x] 2.3 Implementar RLS para conta individual e organização, derivando `organization_id`/titular da vistoria no servidor e negando acesso cruzado.
- [x] 2.4 Implementar a função de finalização idempotente que valida documento, hashes, declaração, resultado, assinatura/motivo/testemunha e retorna evento e protocolo definitivos.
- [x] 2.5 Implementar função auditada para supervisor anexar correção ou invalidação sem atualizar ou excluir o evento original.
- [ ] 2.6 Adicionar testes SQL/integrados para autorização, validações de resultado, retries idempotentes, DML direto bloqueado e correção append-only.

## 3. Persistência local e sincronização offline

- [x] 3.1 Adicionar migração do Expo SQLite para versões locais de documento, eventos pendentes e etapas da outbox sem afetar vistorias existentes.
- [x] 3.2 Implementar repositório local que persiste pacote, arquivos privados, hashes, tentativas e estados `pending`, `syncing`, `confirmed` e `failed` sem registrar dados pessoais em logs.
- [x] 3.3 Estender o `SyncService` para enviar documento e evidência, retomar upload parcial, chamar a finalização com o mesmo `client_event_id` e reconciliar o protocolo retornado.
- [x] 3.4 Remover arquivos temporários somente após confirmação e disponibilidade remota, mantendo falhas permanentes visíveis para tratamento controlado.
- [x] 3.5 Cobrir fila, retry após timeout, recuperação de upload parcial, perda de autorização e limpeza segura com testes unitários.

## 4. Coleta móvel de ciência

- [x] 4.1 Criar componente acessível de assinatura com `react-native-svg`, traços numéricos normalizados, limpar/refazer e validação de conteúdo mínimo.
- [x] 4.2 Criar fluxo de prévia e declaração versionada que exige confirmação explícita antes do resultado `acknowledged`.
- [x] 4.3 Implementar formulários condicionais para ciência, recusa e impossibilidade, exigindo nome/relação/assinatura ou motivo/testemunha conforme a política.
- [x] 4.4 Integrar criação de versão e abertura da ciência aos fluxos elegíveis de relatório/laudo e termo, usando feature flag por tipo de documento.
- [x] 4.5 Exibir claramente coleta offline pendente, falha de sincronização e ausência de protocolo definitivo, com ação segura de retry.
- [x] 4.6 Marcar toda coleta de treinamento na tela e nos dados como sem validade operacional e separá-la das pendências reais.

## 5. Histórico, comprovante e exportação

- [x] 5.1 Exibir no detalhe/histórico da vistoria o estado por tipo e versão, sem herdar a ciência de uma versão substituída.
- [x] 5.2 Implementar comprovante para ciência, recusa e impossibilidade com protocolo, hashes, declaração, destinatário, agente e horários de dispositivo/servidor.
- [x] 5.3 Implementar exportação do documento com o comprovante como anexo/cópia combinada, preservando os arquivos-fonte e seus hashes.
- [x] 5.4 Verificar hashes ao abrir artefatos remotos e bloquear a apresentação como original quando houver divergência.
- [x] 5.5 Adicionar histórico de correção/invalidação legível sem oferecer edição do evento confirmado.

## 6. Verificação e implantação

- [x] 6.1 Adicionar testes de componentes e fluxos para declaração não aceita, assinatura vazia, três resultados, testemunha obrigatória, nova versão e modo treinamento.
- [ ] 6.2 Executar testes negativos de RLS e Storage com duas organizações e duas contas individuais, incluindo tentativa por identificador conhecido e URL expirada.
- [ ] 6.3 Validar em dispositivo Android e iOS a prévia, captura, rotação/acessibilidade, coleta offline, reconexão, comprovante e exportação.
- [x] 6.4 Documentar texto inicial da declaração, campos mínimos, política de testemunha/retensão, limitações jurídicas e procedimento de suporte para pendências.
- [ ] 6.5 Liberar por feature flag primeiro para organização piloto, monitorar falhas/objetos órfãos e registrar critérios de expansão ou rollback somente leitura.
