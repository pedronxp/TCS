# Proprietário no celular, sincronização e conclusão de vistorias

Data: 2026-11-11. Aprovado pelo usuário e implementado localmente em 2026-11-12; publicação e validação em aparelho pendentes. Decisões de implementação e verificação estão no plano e no registro de entrega.

## Objetivo e requisitos do usuário

O proprietário deve escolher no primeiro acesso entre acompanhar pelo celular e administrar pela web, ou executar a operação e a administração completas no aplicativo. Ele precisa visualizar todas as organizações, usuários, equipes, vistorias, documentos e pendências, revisar vistorias, administrar contas e excluir vistorias. A operação não pode depender de chamar o agente original para tarefas que outro profissional autorizado pode executar.

Fotos precisam de visualização, zoom, remoção, substituição e múltiplas capturas com limites. A vistoria que chegou ao servidor sem imagens precisa continuar acessível e permitir trabalho administrativo, com sua incompletude claramente identificada.

## Evidência do código atual

- `app/(panel)/_layout.tsx`: owner ausente das rotas QE/admin/master; algumas rotas são explicitamente web-only.
- `app/(panel)/modulos.tsx`: owner entra no ramo interno de acompanhamento, sem os módulos administrativos ou QE.
- `app/(panel)/qe/index.tsx` e `[id].tsx`: fila via qe_fila e decisões via qe_revisar já existem.
- `app/(panel)/inspecoes/resultado.tsx`: revisão é retroativa; ciência é aberta em Registro, depois da criação da versão do laudo. Não exige aprovação de QE para gerar documento. Falhas de consulta QE não têm erro visível próprio.
- `app/(panel)/inspecoes/wizard.tsx`: resposta de foto é uma URI; tocar na imagem substitui por nova captura.
- `app/(panel)/inspecoes/foto.tsx`: galeria separada com limite de 3 imagens; não oferece a experiência completa de zoom do pedido.
- `services/SyncService.ts`: já envia dados mesmo quando mídia falha e mantém pendência local; é necessário verificar contrato remoto e apresentação da pendência, antes de substituir essa lógica.
- Há alterações locais extensas de outras tarefas. Preservá-las; não resetar, substituir ou incluir em commits desta entrega.

## 1. Um proprietário, dois modos de uso

Decisão proposta pelo implementador: manter role=owner. Modos são preferências de experiência, não novos cargos nem permissões concedidas pelo cliente.

Primeiro login de owner sem preferência: oferecer “Acompanhar” e “Administrar e operar”. Persistir por usuário no servidor; cache local para uso offline. Permitir trocar em Perfil a qualquer momento. Falha de carregamento não deve gravar uma escolha padrão nem apagar preferência remota. Escolher acompanhar simplifica navegação, sem remover poderes do dono na web. Administrar e operar apresenta toda a operação disponível.

Owner tem escopo global autorizado pelo servidor; outros cargos continuam com seus escopos atuais. Não usar chave administrativa no aplicativo. Revisar as regras reais de autorização antes de mudar endpoints. Ações administrativas exigem rede e devem mostrar falha de forma recuperável.

Painel completo: busca e filtros por organização/profissional, vistorias, fila de qualidade, documentos e ciências, equipes/usuários/permissões, contas/assinaturas/suspensões, módulos/configurações e auditoria. Paridade de capacidades administrativas existentes na web; antes de planejar cada tela, inventariar as capacidades reais do console e seus endpoints. “Ver tudo” inclui pendências e registros arquivados. Dados de autenticação secretos não são conteúdo de painel.

Decisão proposta: exclusão pelo owner usa arquivamento reversível auditado, com motivo e confirmação; remove da operação normal e conserva versões de documentos e histórico. Não implementar apagamento físico nesta entrega. Suspensão de conta é reversível e auditada, com distinção explícita entre usuário e organização/assinatura.

## 2. Estados independentes e ações acessíveis

Separar quatro dimensões: coleta da vistoria, sincronização de dados/mídia, revisão de qualidade, documentos/ciência. Não apresentar o conjunto como três passos obrigatoriamente sequenciais.

Resultado deve dizer “Coleta concluída” e mostrar dados enviados/pendentes, fotos enviadas/esperadas e falhas. Protocolo ou hash não é prova de sincronização completa. Mostrar atalho real para fila ou detalhe QE ao autorizado. Status QE indisponível deve ter erro e tentar novamente, sem espera infinita ou fila presumida.

Revisão permanece posterior e não bloqueia a produção de documento. Owner pode revisar de qualquer organização. Outras funções preservam autorização atual. Aprovar/devolver registra revisor, data, parecer e ciclo; autorização de auto-revisão deve seguir a política existente, sem afrouxá-la silenciosamente.

## 3. Fotos e sincronização parcial

Adotar galeria compartilhada pelo formulário e detalhe da vistoria: até 3 fotos por vistoria nesta entrega, preservando o limite existente. Exibir contador, adicionar, abrir em tela cheia, zoom por gesto, voltar, remover com confirmação e substituir. Impedir capturas concorrentes e duplicação por toque repetido. Cancelar câmera não altera galeria. Preservar GPS/carimbo e comportamento offline existentes.

Persistir manifesto remoto de mídias esperadas com identificador estável, ordem, estado e erro recuperável; caminho local fica apenas no aparelho. Estados mínimos: pendente, enviando, disponível, falha, removida. URLs temporárias não são identidade da imagem. O envio e as tentativas devem ser idempotentes, sem duplicar vistoria, protocolo ou anexos. Remoção não pode ser revertida por upload atrasado. O limite deve valer também no servidor, não só na tela. Inventariar controle de frequência existente e reutilizá-lo; nunca bloquear leitura de evidências por limite de upload.

Dados já enviados continuam acessíveis na web e no app. Mostrar “dados recebidos; 1 de 3 fotos disponíveis”, origem da pendência e tentativa mais recente. Permitir nova tentativa no aparelho com arquivos e anexar substituto autorizado pela web/app, preservando autoria e origem. Um servidor não recupera uma imagem que existe somente no telefone desconectado; botão remoto não deve prometer isso. Ao reconectar, enviar só o que falta e atualizar contagens.

Registros legados sem manifesto: tratar contagem esperada como desconhecida, jamais inventar completude. Migrar manifesto dos dados disponíveis sem presumir existência de fotos ausentes.

## 4. Documentos, responsável técnico e ciência

Gerar relatório/versão preliminar com dados disponíveis sem depender do agente original nem da ciência. Destacar no documento e na interface evidências pendentes e imagens indisponíveis; não omitir falhas silenciosamente nem apresentar documento incompleto como completo. Hash identifica uma versão preservada, não garante a existência de todos os anexos.

Responsável técnico e coletor da ciência são pessoas distintas. Proprietário/administrador autorizado pode abrir a vistoria, mostrar a versão do documento ao morador e registrar sua assinatura, recusa ou impossibilidade, no app ou na web. Identificar o coletor real e preservar autor e assinatura técnica originais; nunca assinar em nome de Pedro ou do morador. Não exigir contato com Pedro apenas por ele ser o autor da vistoria. Geração não deve depender da ciência que será coletada sobre o documento gerado.

Decisão proposta: permitir versão preliminar enquanto houver fotos esperadas pendentes; emissão final somente após todas as evidências obrigatórias disponíveis ou dispensa expressa pelo owner/revisor autorizado, com motivo registrado e indicação no documento. A classificação preliminar/final é estado do produto; não inventar efeitos legais. A chegada posterior de fotos não altera PDF ou ciência antigos: requer nova versão, com indicação de que a ciência anterior pertence à versão anterior e nova coleta quando a nova versão for apresentada. Não marcar assinatura antiga automaticamente como ciência de conteúdo novo.

Ciência fica em ação destacada junto do documento, não escondida no fim da tela. Mostrar quem deve agir e o que falta. A web deve permitir os mesmos registros de ciência com vínculo à versão, auditoria e idempotência.

Esclarecimentos após revisão do desenho (decisões propostas pelo implementador): sem assinatura técnica válida, outro operador pode preparar relatório preliminar, mas não emitir laudo final em nome do autor ausente. Um responsável técnico habilitado e autorizado pode assumir formalmente a emissão com sua própria assinatura e registro de responsabilidade, mantendo o histórico do coletor original. Ser owner, isoladamente, não comprova habilitação técnica. A ciência pode ser registrada sobre versão preliminar explicitamente identificada, para não perder o contato com o morador; o registro informa que o conteúdo era preliminar e não confirma ciência de uma futura versão final. Atualização de conteúdo ou anexos exige nova versão e nova ciência para essa versão.

## Ordem proposta

1. Inventariar capacidades do console, autorização, documentos e pendências; fixar testes de regressão para owner/QE, fotos e sincronização parcial.
2. Preferência dos dois modos e acesso global consistente do owner; navegação e QE, sem alterar cargos alheios.
3. Galeria compartilhada e manifesto de sincronização, com leitura de pendências na web/app.
4. Documentos versionados, emissão preliminar/final e coleta de ciência por outro operador autorizado, também na web.
5. Completar paridade administrativa móvel por grupos de capacidades do console, incluindo suspensão, arquivamento e auditoria.

## Critérios de aceitação

- Owner escolhe modo uma vez, troca posteriormente, e preferência acompanha novo login; usuário comum não obtém poderes alterando preferência.
- Modo completo acessa todas as organizações e funções administrativas do inventário, com autorização de servidor; acompanhar mantém interface enxuta.
- Vistoria de Pedro aparece para owner; revisão e ciência não ficam inacessíveis por navegação ou dependência do autor original.
- Simular upload de dados com 1 de 3 imagens: ambos os clientes mostram pendência; retentativa não duplica e completa as imagens; teste inclui reinício do app e arquivo perdido.
- Fotos suportam visualizar/zoom/fechar/remover/substituir/adicionar; quarta imagem é recusada inclusive por chamadas diretas e concorrentes.
- Falha ao carregar QE permite tentar novamente; fila pode aprovar e devolver conforme autorização real.
- Gerar preliminar com imagem faltante informa a lacuna; versão final respeita regra acima. Fotos novas não mudam versão assinada.
- Outro operador autorizado coleta ciência com sua própria identidade; autoria técnica não é transferida; recusa e impossibilidade são preservadas.
- Suspensão e arquivamento exigem confirmação e deixam auditoria; ações e registros resistem a toque duplicado e falha de rede.

## Limites desta proposta

Ainda não foram auditadas as regras do banco remoto nem reproduzido o caso de Pedro. Não assumir causa do upload perdido antes dessa investigação. Não implementar captura remota de assinatura, aprovação automática de risco ou apagamento físico. Decisões propostas acima precisam ser apresentadas ao usuário antes da implementação.
