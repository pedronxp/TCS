# Design: agendamento completo, compartilhado e integrado à agenda

**Data:** 2026-08-11  
**Status:** aprovado para planejamento  
**Objetivo:** tornar o cadastro de agendamentos mais completo, claro e confiável no console web, mantendo o TCS como fonte de verdade e refletindo o trabalho no app mobile.

## Contexto e decisões

O formulário atual cria uma atividade com título, data/hora, endereço, agente opcional e observações. A tabela `agendamentos` já pertence à organização e possui um único agente responsável (`agente_uid`). As regras atuais de organização, supervisor e agente já delimitam quem pode visualizar atividades.

As decisões de produto são:

- Um agendamento tem **um responsável principal**. Ele executa a atividade e controla o status no mobile.
- Pode ter **participantes**. Eles veem o agendamento e recebem avisos, mas não passam a ser responsáveis pela execução.
- Há duas visibilidades: **individual** e **compartilhado com a equipe**.
- O TCS é a fonte de verdade. A agenda externa é uma cópia pessoal de conveniência, nunca o registro operacional.
- A primeira versão reutiliza a equipe da organização e seus escopos atuais. Não cria grupos personalizados ainda.
- Notificações de criação, alteração e cancelamento são entregues no app para responsável e participantes.
- A agenda externa só é liberada depois que a equipe registra a confirmação do cliente.

## Abordagens avaliadas

1. **Formulário único e expandido:** menor alteração visual, mas concentra muitos campos em uma única tela e aumenta os erros de preenchimento.
2. **Formulário em duas etapas:** separa detalhes do trabalho e distribuição para a equipe. Mantém contexto e reduz a carga de leitura. **Escolhido.**
3. **Agenda completa antes do cadastro:** favorece planejamento por arrastar e soltar, mas amplia muito a primeira entrega e não resolve a qualidade do registro por si só.

## Experiência no console web

O modal passa a usar o título **Novo agendamento** e um indicador discreto de etapas.

### Etapa 1 — Detalhes

- Título da atividade (obrigatório).
- Data e hora de início (obrigatório, futuro).
- Duração estimada (obrigatória; opções rápidas e valor personalizado). O término é calculado para exibição e exportação ao calendário.
- Endereço (obrigatório para atividades de campo) com ação para abrir a rota em aplicativo de mapas quando disponível.
- Observações e orientações de campo.

O cabeçalho informa qual cliente receberá a atividade. Ajuda contextual explica que os dados aparecerão no app mobile e que alterações posteriores serão notificadas.

### Etapa 2 — Equipe e avisos

- Visibilidade em controle segmentado: `Individual` ou `Compartilhado com a equipe`.
- Responsável principal, obrigatório. A lista só contém agentes ativos e autorizados para a organização.
- Participantes, opcional, com seleção múltipla de integrantes ativos. O responsável não pode ser duplicado como participante.
- Resumo de envio: responsável, participantes e quem poderá consultar a atividade conforme a visibilidade e o escopo atual.

Para `Individual`, apenas o responsável e participantes informados recebem o item. Para `Compartilhado`, membros que já têm acesso à equipe/ao escopo do responsável podem consultar o item; responsável e participantes continuam sendo os destinatários diretos das notificações.

### Confirmação e agenda externa

Depois de salvar, a confirmação informa que o agendamento está disponível no app e fica em **Aguardando confirmação do cliente**. A equipe pode copiar uma mensagem pronta e registrar uma das respostas: `Confirmado pelo cliente` ou `Recusado / remarcar`, sempre com data, canal e autor do registro.

Enquanto estiver pendente ou recusado, as ações de agenda externa permanecem indisponíveis. Depois de confirmado, a tela libera a ação **Adicionar à agenda**, com:

- Arquivo `.ics`, baseado no padrão aberto iCalendar, como alternativa universal.
- Link preenchido para Google Agenda.
- Link preenchido para Outlook.

A exportação usa título, início, término, endereço, observações, identificador estável do agendamento e URL de retorno para o TCS. Não usa OAuth nem grava credenciais de provedores externos nesta fase. Editar ou cancelar no TCS não promete alterar automaticamente uma cópia já importada; a tela deixa isso explícito.

## Experiência no app mobile

A agenda apresenta os filtros **Minha agenda** e **Compartilhados**. Cada cartão mostra data/hora, duração, cliente, endereço, responsável, participantes, visibilidade e situação.

- O responsável principal pode concluir, iniciar ou cancelar conforme as regras operacionais existentes.
- Participantes consultam os detalhes e recebem notificações, mas não podem concluir em nome do responsável.
- Na criação, alteração relevante (data, hora, responsável, participantes, endereço) ou cancelamento, o app cria um aviso para responsável e participantes. Cada aviso abre o agendamento correspondente.

## Modelo e autorização

O modelo precisa evoluir a partir de `agendamentos` sem quebrar dados existentes:

- `scheduled_end_at` ou `duracao_minutos` para a duração/término.
- `visibility` com valores controlados `individual` e `team`.
- `client_confirmation_status` com valores controlados `pending`, `confirmed` e `declined`, além de data, canal e autor da resposta.
- Relação de participantes em tabela própria, com uma linha por agendamento e usuário, para consulta e RLS segura.
- Registros de notificação associados ao evento de agendamento e ao destinatário.

O responsável atual continua sendo a referência principal (`agente_uid`). As políticas devem garantir que participantes só sejam adicionados se forem membros ativos da mesma organização, impedir a duplicação do responsável e preservar o acesso já concedido por organização/supervisão. A API deve retornar somente participantes que o solicitante pode conhecer.

## Fora de escopo da primeira entrega

- Sincronização bidirecional via OAuth com Google ou Microsoft.
- Importar ou modificar compromissos externos.
- Grupos personalizados (ex.: Equipe Norte) e recorrência.
- Convites por e-mail, SMS ou WhatsApp.
- Alterar as regras de escopo organizacional já vigentes.

## Critérios de aceite

- Não é possível criar um agendamento sem título, início futuro, duração e responsável.
- Todo novo agendamento começa como pendente de confirmação do cliente; a exportação para agenda externa só é possível depois de confirmado.
- Um participante pertence à organização, está ativo, não se repete e não substitui o responsável.
- O console exibe a modalidade individual ou compartilhada sem esconder quem é responsável.
- O app mostra corretamente itens próprios e compartilhados, sem ampliar acesso fora do escopo atual.
- Criação, alterações relevantes e cancelamento geram uma notificação in-app para os destinatários diretos.
- O usuário consegue exportar o mesmo evento para agenda externa sem autenticar o TCS em Google ou Microsoft.
- Eventos antigos permanecem válidos: duração/visibilidade/participantes ausentes recebem comportamento compatível durante a transição.

## Riscos e mitigação

- **Duplicidade em agenda externa:** deixar claro que o TCS é a fonte oficial e que a exportação é uma cópia.
- **Exposição indevida de equipe:** validar participantes e aplicar RLS por organização e escopo, tanto na leitura quanto na escrita.
- **Formulário longo em telas menores:** duas etapas, resumo persistente e campos com ajuda curta.
- **Notificações em excesso:** enviar somente para criação, mudanças relevantes e cancelamento; consolidar alterações rápidas do mesmo evento quando possível.
