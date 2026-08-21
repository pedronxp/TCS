# Portal TCS: acesso, papéis e experiência de conta

**Data:** 2026-08-13
**Status:** aguardando revisão do usuário

## Objetivo

Consolidar os portais individual, municipal e interno do TCS. A solução deve permitir que uma pessoa se cadastre sem prefeitura como agente individual ou entre com um token municipal, estabelecer quatro papéis municipais seguros, e corrigir a experiência de perfil, assinatura, consumo, agenda e entrada.

## Rotas e painéis existentes

Não será criada uma URL por papel. As rotas já são protegidas por sessão e permissão, e o menu já é montado a partir das permissões devolvidas pelo servidor.

| Área | Entrada | Área autenticada |
| --- | --- | --- |
| Equipe interna TCS | `/login` | `/app/*` |
| Portal municipal | `/entrar` | `/portal/municipal/*` |
| Portal individual | `/entrar` | `/portal/individual/*` |

As URLs municipais e individuais permanecem as mesmas. Os itens existentes (`Equipe`, `Convites`, `Configurações`, `Assinatura`, etc.) aparecem somente quando a permissão correspondente estiver no contexto de acesso. O trabalho é expandir as permissões e telas já existentes, não bifurcar o portal por papel.

## Papéis e responsabilidades

### Equipe interna TCS

| Papel | Responsabilidade |
| --- | --- |
| `owner` | Governança total, equipe TCS, auditoria e transferências sensíveis de master municipal. |
| `developer` | Operação técnica: versões, builds, formulários e logs; não recebe acesso municipal ou a dados de clientes por padrão. |
| `support` | Atendimento de clientes, vínculo manual de usuários a municípios mediante demanda registrada e auditoria. |
| `auditor` | Leitura de auditoria e evidências, sem escrever ou conceder acessos. |

O papel interno `master_admin` legado não é um papel de login válido no Console atual. Se houver registros antigos, eles deverão ser revisados e mapeados para um dos papéis internos acima antes de receberem acesso.

### Prefeitura

| Papel | Responsabilidade | Emite token para |
| --- | --- | --- |
| `master` | Dono da prefeitura: plano, configuração, equipe, tokens, admins e transferência de responsabilidade. | `admin`, `supervisor`, `agent` |
| `admin` | Gerência operacional e da equipe; não altera o master nem o plano. | `supervisor`, `agent` |
| `supervisor` | Acompanha o escopo autorizado, vistorias e agenda; não administra papéis. | ninguém |
| `agent` | Executa o próprio trabalho de campo e acessa apenas seu escopo. | ninguém |

O modelo atual será migrado sem perda de acesso: `owner` municipal passa a `master`, `coordinator` passa a `admin`, e `supervisor` e `agent` permanecem. Não existe promoção automática: cada operação verifica quem a solicitou e qual papel ele pode conceder. Um `master` só pode ser transferido por um `owner` da TCS ou por `support` mediante fluxo de suporte com justificativa; a transferência gera evento de auditoria antes e depois da mudança.

## Cadastro, afiliação e autenticação

### Estado inicial

Depois de confirmar o cadastro por e-mail/senha ou concluir Google OAuth, a pessoa vê uma etapa de uso:

1. **Tenho token de uma prefeitura.** Ela informa um token válido, que consome o convite e cria a associação municipal com o papel determinado pelo token.
2. **Não tenho vínculo municipal.** Ela confirma que seguirá como `agent` individual, com acesso ao Portal Individual e aos planos individuais.

Quando a pessoa indica que tem vínculo mas fecha a etapa antes de validar o token, a conta fica com estado `pending_affiliation`. A tela oferece inserir o token ou escolher explicitamente seguir como agente individual. Enquanto esse estado persistir, a pessoa não vê nem modifica dados de prefeitura.

Não haverá busca pública de agentes por e-mail no portal municipal. Um vínculo posterior acontece somente por token/convite válido ou pela equipe `support` através de um fluxo interno que exige e-mail já verificado, município-alvo, papel, justificativa e registro de auditoria. O plano individual e seu histórico permanecem na conta; uma afiliação municipal ativa muda a experiência principal para o Portal Municipal, sem criar uma segunda identidade.

### Google e senha

Uma conta com Google pode vincular Google após ter sido criada com e-mail, como já é possível no Perfil. Uma conta que nasceu com Google pode solicitar **Definir senha TCS** pelo e-mail verificado. A senha criada é exclusiva do TCS; a senha do Gmail nunca é solicitada, recebida ou reutilizada. Depois disso, o usuário pode entrar por Google ou por e-mail e senha TCS.

O aceite de cadastro terá links acessíveis de `Termos de Uso` e `Política de Privacidade`, abertos sem perder os dados já digitados. A versão aceita continua registrada no servidor.

## Perfil e privacidade de dispositivos

`/portal/individual/perfil` e a variante municipal serão apenas informativos quanto a registros de dispositivo. O botão e a RPC de **Encerrar registro** saem desse fluxo; a única revogação disponível para o usuário é `Sair de todos os dispositivos`.

Cada registro mostra nome/plataforma, último acesso, IP mascarado e, quando o dispositivo o fornecer legitimamente, MAC mascarado. Exemplos: `177.42.***.***` e `AA:BB:CC:**:**:**`. Navegadores não expõem MAC real; nesses casos a tela mostra um identificador de dispositivo mascarado ou informa que o MAC não foi disponibilizado. Nenhum dado será inventado nem exposto por completo no cliente.

O logo TCS no shell do portal aponta para a página pública (`/`) sem chamar `signOut`; somente o comando explícito de sair encerra a sessão.

## Assinatura e consumo

O contrato de acesso do portal passa a fornecer, de uma fonte única e autorizada: plano ativo, versão contratada, estado de assinatura, uso e limite de vistorias, início/fim do ciclo, próxima renovação e `cancel_at_period_end`.

Em `/portal/individual/assinatura`:

- o cartão identifica o plano ativo e todos os dados do ciclo;
- o plano atual não apresenta botão de contratação repetida;
- somente planos acima do ativo apresentam `Fazer upgrade`;
- cancelamento no fim do ciclo aparece como estado explícito.

Em `/portal/individual/consumo`, a pessoa vê `usadas`, `disponíveis`, `limite` e data/hora de renovação. Sem assinatura ativa, a interface explica a restrição e oferece o caminho de assinatura, sem apresentar contadores enganosos.

## Agenda e entrada

`/portal/*/agenda` mantém a criação de compromissos com vistoria opcional. A submissão valida título, data e hora, converte a data local corretamente e chama uma RPC que recebe exatamente os mesmos parâmetros. Em sucesso, fecha o formulário, atualiza a agenda e confirma a criação. Em erro, preserva os dados e traduz o motivo concreto (permissão, plano, horário ou validação), em vez da mensagem genérica atual.

Em `/entrar`, o link `É da equipe interna TCS? Entrar no Console` aponta para `/login`. Apenas destinos internos válidos são preservados para o Console; um `returnTo` pertencente ao portal do cliente não é repassado como URL interna.

## Dados, autorização e auditoria

- A migração de papéis atualiza dados existentes, constraints, funções de contexto de acesso, políticas e testes de autorização na mesma entrega.
- A emissão, leitura e consumo de tokens ocorre no servidor. Tokens têm papel permitido, organização, expiração, uso único, emissor e auditoria; o cliente nunca decide o papel resultante.
- Funções privilegiadas validam `auth.uid()`, papel e escopo antes de alterar uma associação. Não usam metadados editáveis pelo usuário para autorização.
- Ações sensíveis registram ator, alvo, organização, operação, justificativa, data e resultado. A mesma regra vale para associação manual, revogação, emissão/uso de token e transferência de master.
- Campos de endereço, IP e identificador de dispositivo seguem as regras de acesso existentes e são mascarados antes da apresentação ao dono da conta.

## Tratamento de erro

- Token inválido, vencido, usado ou de papel não permitido retorna mensagem específica e não cria associação parcial.
- Falha ao carregar plano, consumo ou registros de dispositivo preserva a tela e oferece nova tentativa.
- Operações sem permissão retornam ao início do portal aplicável sem revelar dados de outra organização.
- Afiliação pendente não permite acessar rotas municipais até haver associação ativa ou a escolha expressa por agente individual.

## Testes e validação

1. Migração de `owner`/`coordinator` e preservação de membros existentes.
2. Matriz completa de permissões de master, admin, supervisor e agente, incluindo tentativa de promoção e emissão de token proibida.
3. Uso único, expiração e auditoria de token; associação manual autorizada e recusada.
4. Cadastro e retorno por e-mail, Google, senha TCS posterior e recuperação de senha.
5. Estados de agente individual, afiliação pendente e associação municipal ativa.
6. IP/identificador mascarados e ausência da ação de encerrar registro.
7. Plano atual, upgrade, cancelamento de ciclo, consumo e renovação.
8. Criação de agenda com e sem vistoria, erros de RPC e atualização da lista.
9. Link para Console, retorno seguro e marca TCS sem logout.

## Fora de escopo

- Associação municipal automática por pesquisa de e-mail.
- Uso ou validação de senha do Gmail pelo TCS.
- Exposição de MAC real em navegadores ou em dispositivos que não o forneçam.
- Uma rota separada por papel: a segmentação continua sendo por permissões e contexto de acesso.
