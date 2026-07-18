## Context

O TCS gera relatórios/laudos e termos de interdição no dispositivo com `expo-print`, permite compartilhá-los e grava apenas marcadores de geração na vistoria. O relatório já contém uma declaração de ciência com linha para assinatura manual, mas não existe registro eletrônico do destinatário, da assinatura, da versão apresentada nem de um resultado como recusa. O aplicativo trabalha offline, persiste vistorias em Expo SQLite, sincroniza com Supabase e já utiliza buckets privados para fotos e laudos.

A mudança cruza geração de documentos, armazenamento local, sincronização, banco, Storage, RLS e experiência móvel. Assinaturas e identificadores pessoais são dados sensíveis; a solução deve minimizar sua coleta, impedir exposição por URL pública ou telemetria e preservar registros concluídos. A ciência será uma evidência operacional de apresentação e recebimento, sujeita à validação jurídica e às regras de retenção de cada contratante, e não será rotulada como assinatura digital qualificada.

## Goals / Non-Goals

**Goals:**

- Vincular cada ciência à versão imutável e verificável do conteúdo apresentado.
- Coletar presencialmente ciência, recusa ou impossibilidade de assinatura com dados mínimos e declaração versionada.
- Funcionar offline sem representar um evento local como confirmado pelo servidor.
- Produzir comprovante auditável, manter histórico e isolar os dados por usuário individual ou organização.
- Reaproveitar a geração de documentos, o armazenamento e a sincronização existentes sem alterar a metodologia técnica da vistoria.

**Non-Goals:**

- Implementar assinatura qualificada, certificado ICP-Brasil, biometria ou validação automática da identidade civil.
- Criar nesta entrega um portal público, fluxo remoto por e-mail/SMS/WhatsApp ou assinatura por pessoa sem acesso ao aparelho do agente.
- Converter documentos históricos sem ciência em documentos eletronicamente reconhecidos.
- Permitir edição ou exclusão direta de um evento concluído.
- Definir unilateralmente prazos legais de retenção ou tornar CPF obrigatório antes de validação jurídica e de privacidade.

## Decisions

### 1. Snapshot canônico e PDF serão preservados como uma versão de documento

Criar `generated_documents` com identificador gerado no cliente, vistoria, escopo individual/organizacional, tipo, número da versão, versão do template, snapshot JSON canônico, hash SHA-256 do conteúdo, hash SHA-256 do PDF, caminho privado, tamanho, autor, datas, estado e referência à versão substituída. O app renderizará a prévia a partir do mesmo snapshot imutável usado pelo construtor do PDF. A ciência apontará para essa versão, nunca apenas para a vistoria ou para um arquivo local mutável.

O hash do conteúdo protege a equivalência semântica entre prévia e documento; o hash dos bytes protege o arquivo exportado. Regenerar conteúdo técnico cria nova versão e exige uma nova ciência, enquanto a versão e os eventos anteriores permanecem consultáveis.

Alternativa considerada: gravar assinatura e data diretamente em `vistorias`. Foi rejeitada porque não identifica qual tipo ou versão de documento foi apresentado e permite que uma regeneração posterior pareça ter sido assinada.

### 2. O comprovante será um artefato separado do documento apresentado

O PDF técnico original permanecerá imutável. Após a confirmação do servidor, o sistema gerará um comprovante/anexo com protocolo, tipo e versão do documento, hash abreviado e completo disponível nos metadados, resultado da ciência, declaração utilizada, destinatário, agente e horários do dispositivo e do servidor. A assinatura será incluída somente quando o resultado for `acknowledged`.

Alternativa considerada: inserir a assinatura no PDF original após a coleta. Foi rejeitada porque essa modificação mudaria o hash do próprio arquivo que o destinatário visualizou. Uma exportação combinada poderá concatenar documento e comprovante sem substituir os arquivos-fonte.

### 3. Eventos de ciência serão append-only e finalizados de forma idempotente

Criar `document_acknowledgement_events` com `client_event_id` único, documento, resultado (`acknowledged`, `refused` ou `unable_to_sign`), versão/hash da declaração, nome e relação do destinatário, referência/hash da assinatura quando aplicável, motivo, testemunha quando aplicável, instante informado pelo dispositivo, instante recebido pelo servidor, identificador pseudonimizado do dispositivo e autor. Inserts, atualizações e exclusões diretas pelo cliente serão bloqueados; a conclusão ocorrerá por função de servidor.

Correções não sobrescreverão dados. Um supervisor autorizado poderá anexar um evento de invalidação/correção referenciando o original, com motivo obrigatório. O mesmo `client_event_id` retornará o resultado já criado, evitando duplicação em retries da fila offline.

Alternativa considerada: permitir atualização do registro até o agente encerrar a vistoria. Foi rejeitada porque enfraquece a trilha de auditoria e dificulta distinguir correção de alteração indevida.

### 4. A sincronização terá estados locais explícitos

O app manterá uma fila local de pacotes com os arquivos, hashes e metadados necessários. Os estados de interface serão `não coletada`, `pendente de sincronização`, `confirmada`, `recusada`, `impossibilidade registrada` e `falha de sincronização`. Arquivos temporários ficarão apenas no diretório privado do aplicativo e serão removidos depois da confirmação e da disponibilidade da cópia remota; dados pessoais não serão escritos em logs ou analytics.

Ao recuperar conexão, a fila enviará o snapshot/PDF e a evidência para caminhos privados determinísticos, e chamará a finalização com o `client_event_id`. A operação do servidor verificará autenticação, vínculo com a vistoria, tipo/estado do documento, hashes e regras do resultado antes de inserir o evento. Uma coleta offline não emitirá protocolo definitivo nem será mostrada como confirmada até essa operação terminar.

Alternativa considerada: desabilitar a coleta sem internet. Foi rejeitada porque vistorias de campo precisam funcionar em locais sem conectividade.

### 5. A assinatura será uma evidência de gesto, não um mecanismo de identidade

A tela capturará traços normalizados com componente baseado em `react-native-svg`, dependência já presente, e validará que há conteúdo mínimo antes da confirmação. O servidor aceitará somente estrutura numérica limitada e produzirá a representação usada no comprovante, evitando SVG arbitrário fornecido pelo cliente. Nome será obrigatório para ciência; identificador civil será opcional e somente será adicionado após definição de finalidade, base de tratamento, proteção e retenção. Recusa e impossibilidade não exigirão assinatura, mas exigirão motivo; a política organizacional poderá exigir testemunha.

Alternativa considerada: incorporar uma biblioteca nativa de assinatura. Foi adiada para reduzir dependências e porque a captura manuscrita não oferece, por si só, autenticação biométrica.

### 6. Acesso seguirá o escopo persistido da vistoria

As tabelas carregarão `organization_id` ou `owner_user_id` derivados no servidor, nunca escolhidos livremente pelo cliente. RLS permitirá leitura a membros ativos da organização com função autorizada ou ao titular individual; criação dependerá de acesso à vistoria. Objetos ficarão em bucket privado com caminhos vinculados ao escopo e URLs assinadas de curta duração. Apenas funções administrativas auditadas poderão registrar correção/invalidação, sem apagar o evento original.

O dashboard interno poderá consultar estado e histórico conforme as permissões existentes, mas a primeira entrega priorizará o fluxo móvel e não oferecerá edição de evidências.

### 7. Modo treinamento não produzirá evidência operacional

O fluxo poderá ser demonstrado em uma vistoria de treinamento, porém documento, tela e comprovante serão marcados como treinamento e os eventos ficarão separados ou explicitamente sinalizados como sem validade operacional. Eles não contarão como ciência de um documento real nem aparecerão como pendência institucional.

## Risks / Trade-offs

- [Assinatura manuscrita não comprova sozinha a identidade] → apresentar a finalidade como ciência operacional, registrar contexto e declaração e submeter os campos obrigatórios à revisão jurídica.
- [Horário do dispositivo pode estar incorreto] → preservar horário do dispositivo e horário confiável de recebimento do servidor, sem substituir um pelo outro.
- [Falha entre upload e finalização pode deixar objetos órfãos] → usar caminhos por IDs idempotentes e rotina de limpeza apenas para objetos antigos sem registro concluído.
- [Dados sensíveis podem permanecer no aparelho perdido] → usar diretório privado, minimizar campos offline, excluir temporários após sincronização e não persistir assinatura na galeria.
- [Mudanças futuras no template podem alterar o documento] → salvar versão do template, snapshot canônico e os dois hashes; nunca reconstruir uma versão histórica somente com o template atual.
- [Regeneração depois da ciência pode confundir o usuário] → marcar a versão anterior como substituída, preservar seu comprovante e exigir nova ciência para a nova versão.
- [RLS ou políticas de Storage incorretas podem expor evidências] → criar testes negativos entre organizações/contas e impedir buckets ou URLs públicos.
- [Exigir testemunha em todas as recusas pode bloquear o campo] → tornar a exigência configurável e apresentar claramente quando a política a impõe.

## Migration Plan

1. Criar tabelas, enums/checks, índices, funções de finalização/correção, bucket privado e políticas RLS sem ativar a interface.
2. Adicionar utilitários de canonicalização/hash e testes com vetores determinísticos antes de integrar a geração atual.
3. Adicionar persistência local e fila idempotente com migração aditiva do SQLite.
4. Integrar uma primeira categoria de relatório/laudo atrás de feature flag e validar em ambiente de teste, inclusive offline e entre duas organizações.
5. Habilitar termos de interdição após validar o fluxo, o texto da declaração e a política de testemunha.
6. Liberar histórico e comprovante; monitorar falhas de sincronização e objetos órfãos antes da expansão.

Rollback: desabilitar a feature flag e impedir novas coletas, mantendo tabelas, arquivos e eventos existentes somente para leitura. Não remover ou reescrever evidências já confirmadas durante rollback.

## Open Questions

- Quais tipos de documento entram no piloto: relatório de vistoria, laudo, termo de interdição ou todos?
- Qual é o texto institucional aprovado da declaração para cada tipo de documento?
- Nome e relação com o imóvel são suficientes ou algum identificador civil será obrigatório?
- Em quais resultados e perfis a organização exigirá testemunha?
- Qual política de retenção, exportação e atendimento a solicitações de titulares será adotada?
- O comprovante precisa de identidade visual municipal e de um verificador autenticado no futuro?
