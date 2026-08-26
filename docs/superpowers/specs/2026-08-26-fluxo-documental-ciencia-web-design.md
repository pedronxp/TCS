# Fluxo documental e ciência pela web

## Objetivo

Corrigir a ordem operacional dos documentos da vistoria e permitir que a ciência seja concluída no aplicativo ou na versão web, sempre sobre a mesma versão imutável do documento e a mesma trilha de auditoria.

## Escopo desta entrega

- impedir que relatório, laudo ou termo elegível seja compartilhado antes da preparação da versão usada na ciência;
- encaminhar o fluxo móvel para a prévia e coleta antes da liberação do documento/comprovante;
- integrar o relatório editável ao contrato de documentos versionados já usado pelo laudo;
- habilitar no Portal TCS a criação, abertura, cópia e revogação de links de ciência;
- permitir coleta presencial pela web usando a rota pública segura `/ciencia/:token`;
- impedir nova ciência sobre uma versão que já recebeu resultado final;
- manter recusa e impossibilidade como resultados finais, sem convertê-las em “ciente” por ação administrativa;
- reforçar autorização, expiração e auditoria das operações web.

O editor de modelos, brasão, logotipo e preview organizacional será implementado em um pacote posterior. Ele consumirá o mesmo contrato de versão criado aqui, mas não faz parte desta branch.

## Fluxo aprovado

1. O agente revisa e assina tecnicamente o conteúdo.
2. O sistema gera o PDF final e registra uma versão imutável com snapshot e hashes.
3. O destinatário visualiza essa versão no app ou na web.
4. O destinatário registra ciência, ou o agente registra recusa/impossibilidade com justificativa.
5. O servidor confirma o evento e emite protocolo.
6. O sistema libera o documento original, o comprovante separado ou uma cópia combinada.

Quando a ciência estiver desabilitada para o tipo ou organização, o compartilhamento continua disponível sem simular uma coleta. Quando a ciência estiver habilitada, mas a preparação da versão falhar, a liberação fica bloqueada e o usuário recebe uma ação de tentativa novamente.

A publicação da versão preparada no armazenamento privado é interna e autenticada: ela permite que o portal autorizado liste e visualize o documento, mas não equivale à liberação para o destinatário. O app sincroniza versões preparadas mesmo antes de existir um evento de ciência; o compartilhamento externo do documento ou do comprovante continua bloqueado até a confirmação do servidor e a emissão do protocolo.

## Ciência web

O painel lista os documentos disponíveis no escopo do usuário. Para uma versão sem resultado final, o usuário autorizado pode:

- iniciar “Coletar pela web”, abrindo uma nova rota segura para o destinatário;
- gerar um link remoto com validade de 1 a 168 horas;
- copiar o link recém-gerado;
- revogar um link ainda aberto.

O token puro existe apenas na resposta de criação e no navegador que o recebeu. O banco persiste somente seu SHA-256. Depois de recarregar a página, o sistema informa que existe um link aberto, mas exige a geração de outro para recuperar um token compartilhável; a geração revoga o anterior.

O agente não pode marcar “ciente” em nome do destinatário. A ação “ciente” exige declaração explícita e assinatura do destinatário na tela pública. Recusa e impossibilidade exigem motivo. Um resultado final encerra aquela versão; qualquer nova apresentação depende de uma nova versão documental.

## Autorização

As operações web validam no servidor:

- sessão autenticada;
- permissão documental no contexto do portal;
- assinatura e vínculo ativos para novas emissões;
- escopo individual ou organização da versão;
- documento disponível e fora do modo treinamento;
- ausência de resultado final antes de criar um link;
- existência de link aberto antes de revogá-lo.

As funções são `SECURITY DEFINER`, ficam com `search_path` vazio, fazem validação explícita de `auth.uid()` e têm execução revogada de `PUBLIC` e `anon`.

## Estados e invariantes

- `pending`: versão disponível sem link aberto e sem resultado.
- `link_sent`: existe solicitação aberta e não expirada.
- `acknowledged`: ciência confirmada pelo destinatário.
- `refused`: recusa final registrada.
- `unable_to_sign`: impossibilidade final registrada.

Somente `pending` e `link_sent` aceitam gerenciamento de link. `acknowledged`, `refused` e `unable_to_sign` são finais para a versão. O PDF original e seus hashes nunca são alterados pelo comprovante.

## Falhas e recuperação

- Falha ao preparar a versão no app: bloquear compartilhamento e oferecer nova tentativa.
- Falha ao criar link: manter o documento pendente e mostrar mensagem acionável.
- Link expirado ou revogado: negar prévia e conclusão.
- Duas conclusões simultâneas: o bloqueio transacional do banco aceita no máximo uma.
- Criação de link concorrente com uma conclusão: ambas usam o mesmo bloqueio por documento, e o índice único de resultado final impede resultados duplicados.
- Perda de autorização: negar a operação sem alterar o documento ou o evento.

## Verificação

- testes unitários do estado de liberação móvel;
- testes de componente para criar, abrir, copiar e revogar ciência web;
- testes SQL positivos e negativos para autorização, assinatura bloqueada, escopo cruzado, versão finalizada e idempotência;
- TypeScript, testes do app, testes do dashboard, build e advisors do Supabase;
- validação manual das rotas móvel e `/portal/municipal/ciencias` em preview.
