# Entrega local — proprietário, fotos e documentos

Implementação na branch `codex/owner-mobile-workflow`, preservando as alterações que já existiam no checkout. Sem commit, merge, push ou publicação nesta entrega.

## Comportamento implementado

- Proprietário escolhe Acompanhar ou Administrar e operar no primeiro acesso. Preferência por conta, guardada no servidor, com cache para leitura offline; troca disponível no perfil.
- Administração nativa cobre clientes, contas, equipe e permissões, suspensão/aprovação, assinaturas, fila de qualidade, planos/formulários, suporte e auditoria. Arquivamento de vistorias é reversível e preserva documentos e evidências.
- Ferramentas avançadas do painel ficam acessíveis pelo console integrado no aplicativo: planos, assinaturas/contratações, financeiro, editores de formulários e risco, sessões, dispositivos, tokens, comunicações, WhatsApp, IA, campanhas e desenvolvimento. O console usa login/MFA próprios em sessão isolada; não recebe tokens nativos. Requer rede e novo login ao reabrir. A interface principal de campo permanece nativa.
- Galeria compartilhada permite até três fotos por vistoria, com visualizar, zoom, fechar, adicionar, remover e substituir. Cancelamento preserva a imagem anterior. As capturas conservam o georreferenciamento existente.
- Dados e anexos têm estados separados. Upload tardio funciona mesmo após emissão do protocolo. Pendências remotas são preservadas ao editar outra foto, contam no limite e nunca viram completude silenciosamente. Rascunho antigo entra em conflito e exige recarga explícita. Há fila de retentativa para fotos capturadas em outro telefone sem uma vistoria SQLite local.
- Revisão de qualidade tem caminho acessível e erro recuperável. Ciência fica junto do documento e refere-se a uma versão preservada. Outro operador autorizado pode coletar sem assumir a autoria técnica.
- Relatório preliminar permite seguir com os dados disponíveis. Final exige autor técnico, assinatura renderizável e evidências completas ou dispensa motivada auditada vinculada à revisão atual. O aplicativo aguarda o registro autorizado no servidor antes de liberar PDF final; offline prepara preliminar.
- Versões/documentos, hashes e autoria não mudam em uma retentativa. Novas evidências exigem nova versão; a ciência anterior continua ligada ao conteúdo anterior. PDFs preservados por outro dispositivo abrem como original, sem reconstruir seu conteúdo a partir da prévia.

## Publicação pendente

1. Conferir o histórico e os pré-requisitos do banco de destino; aplicar em ordem as migrations desta entrega:
   - `supabase/migrations/20261112011732_owner_mobile_experience_and_quality_access.sql`.
   - `supabase/migrations/20261112011951_owner_inspection_media_workflow.sql`.
2. Publicar `supabase/functions/generate-inspection-laudo` com seus módulos compartilhados atualizados.
3. Publicar o painel atualizado e entregar o novo bundle/build do app. O console integrado usa `EXPO_PUBLIC_ADMIN_CONSOLE_URL`, uma origem HTTPS sem caminho ou parâmetros; o padrão acompanha o endereço do projeto, `https://tcsvistoria.pages.dev`.

As duas migrations ainda não foram executadas no banco remoto. Não executar uma publicação indiscriminada de outras migrations pendentes deste checkout: existem alterações de outras tarefas. Depois de publicar, confirmar o estado real do backend e o papel owner ativo para a conta de teste.

## Roteiro de validação no aparelho e na web

1. Entrar como proprietário, escolher os dois modos em momentos diferentes e conferir a persistência após sair/entrar. Em operar, abrir Administração TCS; acessar um cliente de outra organização, a fila de qualidade e uma vistoria de Pedro. Suspender/reativar uma conta de teste com motivo. Arquivar/restaurar uma vistoria de teste sem apagar suas versões.
2. Capturar três fotos no formulário: ampliar, dar zoom, voltar, cancelar substituição, substituir, remover e adicionar. Conferir limite após reiniciar e antes/depois de salvar. Entrar no console integrado, fazer login do proprietário e verificar um editor avançado e uma operação administrativa com MFA.
3. Simular falha de duas fotos após envio dos dados: web e app devem mostrar uma de três disponível. Em outro celular, substituir a foto disponível sem apagar as duas pendências. Retomar o celular original; completar uploads sem duplicar protocolo ou fotos. Testar rascunho antigo contra remoção feita em outro aparelho: deve mostrar conflito.
4. Gerar preliminar da vistoria de Pedro como proprietário sem assinar por Pedro; coletar ciência daquela versão. Confirmar nome do coletor e autor separadamente. Depois de completar fotos, emitir nova versão com o autor técnico e assinatura; a ciência anterior não deve ser transferida automaticamente.
5. Negar dispensa sem motivo. Registrar dispensa válida como revisor/proprietário autorizado; confirmar motivo no documento final e invalidade da dispensa para uma nova revisão de mídia. Tentar abrir dados de outra conta como agente comum e como proprietário suspenso; o servidor deve recusar.

## Evidências e limites

Testes Jest do app, testes funcionais de SQL em PGlite, TypeScript, testes de fluxo do painel e build do painel são executados localmente. O registro final de comandos/contagens está em `.superpowers/sdd/owner-mobile-workflow/progress.md`.

O teste de integração do gerador usa o código real `buildPdf`, armazenamento em memória e um mecanismo PDF de gravação para verificar que a foto principal e adicionais chegam à incorporação sem duplicação; não é uma inspeção visual de PDF produzido pelo Deno.

Deno não está instalado neste ambiente. A execução real da Edge Function hospedada, PDF/assinatura no aparelho e console integrado em iOS/Android ainda precisam da validação acima após publicação. A foto que existe apenas num celular desconectado não pode ser recuperada pelo servidor. Assumir formalmente responsabilidade técnica de outro profissional depende de um fluxo real de habilitação/atribuição; o papel de proprietário sozinho não o inventa.
