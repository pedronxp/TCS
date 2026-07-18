## Why

Os relatórios, laudos e termos gerados pelo TCS já reservam espaço para a ciência do morador ou responsável, mas hoje essa confirmação permanece manual, sem vínculo verificável com a versão exata do documento e sem trilha de auditoria no sistema. A ciência eletrônica permite comprovar o que foi apresentado, quem registrou o recebimento e quando isso ocorreu, inclusive durante atendimentos com conectividade instável.

## What Changes

- Adicionar um fluxo de ciência eletrônica para documentos operacionais gerados a partir de uma vistoria, inicialmente relatórios/laudos e termos de interdição.
- Exigir a visualização da versão final do documento e uma declaração explícita antes da coleta da ciência.
- Registrar identificação do destinatário, assinatura manuscrita na tela, data e hora, agente responsável, dispositivo e versão da declaração vinculados ao hash do documento apresentado.
- Permitir registrar ciência, recusa ou impossibilidade de assinatura, com motivo obrigatório nos dois últimos casos e testemunha quando exigida pela política da organização.
- Suportar coleta offline com fila local protegida e sincronização idempotente quando a conexão retornar, deixando claro enquanto o comprovante ainda estiver pendente de confirmação pelo servidor.
- Gerar comprovante auditável e permitir exportá-lo junto ao documento, com protocolo e estado da ciência, sem modificar o arquivo técnico originalmente apresentado.
- Restringir leitura e administração dos registros pela conta individual ou organização da vistoria, usando RLS e auditoria no servidor.
- Tratar a funcionalidade como evidência de recebimento e ciência dentro do TCS, sem apresentá-la como assinatura digital qualificada ou certificação ICP-Brasil.

## Capabilities

### New Capabilities

- `electronic-document-acknowledgement`: versionamento do documento apresentado, coleta presencial de ciência/recusa/impossibilidade, assinatura manuscrita, funcionamento offline, sincronização, comprovante, auditoria e controle de acesso.

### Modified Capabilities

Nenhuma. Não há especificações consolidadas em `openspec/specs/` que precisem ter requisitos alterados nesta mudança.

## Impact

- Fluxos de geração e exibição de documentos em `app/(panel)/inspecoes/`, além do construtor compartilhado em `utils/laudoPdfBuilder.ts`.
- Persistência local em Expo SQLite, fila de sincronização e tratamento de conflitos em `utils/database.ts` e `services/SyncService.ts`.
- Supabase Database, Storage, funções RPC, políticas RLS, trilha de auditoria e uma nova migração para documentos versionados e registros de ciência.
- Armazenamento privado de PDFs e imagens de assinatura, com retenção e exclusão condicionadas às regras da organização e à preservação da auditoria.
- Telas de histórico/detalhe da vistoria e geração de comprovantes; o dashboard interno poderá consultar o estado e a trilha, mas não editar uma ciência concluída.
- Testes unitários e de integração para hash, estados do fluxo, idempotência, isolamento organizacional, modo offline e tentativas de alteração posterior.
