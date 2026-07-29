# Arquivamento e restauração segura
## Resultado

O lifecycle mantém o Google Drive como camada de retenção e o Supabase Storage como camada operacional. A restauração deixou de ser uma alteração manual de `storage_location` e passou a ser uma operação persistente, verificável e auditável.

Fluxo:

1. `archive-lifecycle` copia cada arquivo para o Drive, cria quarentena no Storage e registra manifesto com bucket, caminho, tipo, tamanho, ID no Drive e SHA-256.
2. Um owner solicita a restauração com sessão `aal2`, justificativa e `operation_id`.
3. Uma unidade é aprovada na própria solicitação. Um lote fica pendente e exige outro owner.
4. `restore-archive` reivindica a solicitação, baixa os arquivos do Drive, valida tamanho e SHA-256 e os envia ao bucket/caminho original.
5. Uma função transacional troca a origem para `supabase`, conclui a fila e registra auditoria somente depois de todos os uploads.
6. Falhas removem uploads parciais, preservam a origem no Drive e permitem retry limitado e idempotente.

Arquivos legados sem manifesto continuam restauráveis pelos IDs existentes ou pela descoberta da pasta. Eles são marcados na UI como legados; o checksum passa a existir depois da recuperação.

## Segurança e permissões

- Leitura e mutação são expostas por RPC, não por acesso direto à tabela da fila.
- RLS permanece ativa e `anon`/`authenticated` não recebem privilégios diretos na tabela.
- Solicitar, aprovar, reivindicar e repetir exige `configuration.publish` e MFA `aal2`.
- O solicitante não pode aprovar o próprio lote.
- A Edge Function usa contexto do usuário para autorização e service role apenas para Storage e finalização transacional.
- Segredos do Google e a service role nunca são retornados ao navegador.
- Toda etapa relevante escreve em `internal_access_events` com metadados sanitizados.

## Publicação

Ordem recomendada em homologação:

1. Aplicar `supabase/migrations/20260726143000_secure_archive_restore_queue.sql`.
2. Configurar `GOOGLE_SERVICE_ACCOUNT_KEY` e `DRIVE_FOLDER_ROOT_ID`.
3. Publicar `archive-lifecycle` e `restore-archive` com verificação JWT habilitada.
4. Executar `npm run test:archive-restore`.
5. Arquivar e restaurar uma vistoria sintética.
6. Validar Storage, Drive, fila e auditoria.
7. Publicar o dashboard e observar erros técnicos e duração das operações.

Depois da publicação, revisar os advisors de segurança e performance do Supabase. A migration foi criada localmente e não deve ser aplicada diretamente em produção sem a passagem anterior por homologação.

## Rollback

O rollback visual usa `VITE_NEW_CONSOLE_UI=false`. Não apagar a fila nem reverter a migration se houver solicitações criadas.

Para interromper operações:

1. desativar o modo automático na política de retenção;
2. retirar temporariamente a rota da Edge Function ou sua permissão de invocação;
3. deixar solicitações `pending`, `approved` ou `failed` persistidas para diagnóstico;
4. preservar manifestos, checksums e eventos de auditoria;
5. restaurar a função somente após corrigir e validar o retry em homologação.

## Ganhos e custos

Principais ganhos: recuperação operacional, evidência de integridade, separação de função em lotes, retry seguro e auditoria completa.

Custos: mais estado no banco, dependência da disponibilidade do Drive, uso adicional de banda/Storage durante a restauração e operação de MFA para owners. O saldo é favorável porque o sistema já removia os originais do Storage; sem a fila, qualquer recuperação dependia de ação manual sem garantia transacional.
