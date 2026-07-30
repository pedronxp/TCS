# Portais de clientes — contrato de implementação

Versão visual e semântica: `1.0.0`
Fonte de verdade visual: arquivo Penpot `TCS — Web Dashboard`, páginas 26–34.
Branch de implementação: `codex/criar-portal-clientes-individual-municipal`.

## Fronteiras

- Público: `/`, `/planos`, `/entrar`, `/criar-conta`, `/convite/:token` e `/checkout/retorno`.
- Cliente individual: `/portal/individual/*`.
- Cliente municipal: `/portal/municipal/*`.
- Console interno: `/login` e `/app/*`.

O portal do cliente possui `PortalAuthProvider`, query client, navegação e RPCs próprios. O gate
`dashboard/scripts/validate-portal-boundary.mjs` impede imports do contexto, navegação e RPCs do
console interno.

## Autorização

`get_portal_access_context()` é o único contrato canônico do cliente. A função deriva `auth.uid()`,
membership, organização, papel, assinatura, versão imutável do plano, features, limites, consumo e
permissões. Nenhuma RPC `portal_*` aceita organização, papel, plano ou usuário como autoridade
enviada pelo cliente.

O acesso efetivo é a interseção de identidade, status do vínculo, papel, feature, estado financeiro,
escopo server-side e flags de rollout. Consultas existentes permanecem disponíveis durante
`past_due`; criação é bloqueada. Supervisores usam `organization_members.scope.agent_ids`; vazio é
seguro por padrão e permite somente o próprio usuário.

## Convites

Convites armazenam apenas hash do token, e-mail normalizado, organização, papel, emissor, validade e
status. A aceitação exige sessão autenticada, e-mail confirmado correspondente, token pendente e
assentos disponíveis sob lock transacional. Coordenadores podem convidar os três papéis; supervisores
somente agentes. O link em texto puro existe apenas na resposta de criação para entrega manual ou por
um adaptador de e-mail.

## Administração municipal

- Supervisores consultam equipe, relatórios e operação somente dentro do escopo persistido no membership.
- Coordenadores podem alterar papel/status de outros membros e as configurações da organização.
- Alterações administrativas exigem a palavra `CONFIRMAR`, justificativa mínima, bloqueio transacional e evento em `subscription_audit_events`.
- Suspender ou remover um membro revoga as sessões Web ativas; o próprio coordenador e o último coordenador ativo são protegidos contra alteração.

## Billing

A migration cria checkout idempotente, versão e preço congelados, ledger de eventos únicos e proteção
contra eventos fora de ordem. O navegador apenas consulta `/checkout/retorno`; somente
`portal_process_payment_event`, executada com `service_role` depois de assinatura HMAC válida, altera
assinaturas e entitlements.

O adaptador de pagamento permanece propositalmente sem provedor. Até `PAYMENT_PROVIDER`,
`PAYMENT_WEBHOOK_SECRET` e a criação de sessão hospedada serem configurados, a Edge Function retorna
`payment_provider_not_configured` e não inventa URL nem ativa recursos.

## Rollout e rollback

`portal_rollout_settings` mantém flags independentes para fundação, individual, coordenador,
supervisor, agente e billing. Todas começam desligadas. A ordem recomendada é:

1. ativar fundação para contas de teste;
2. ativar individual e medir login, acesso negado, criação e suporte;
3. ativar agente e supervisor municipal;
4. ativar coordenador e convites;
5. configurar o provedor e ativar billing.

Rollback consiste em desligar a flag da onda. Assinaturas, memberships, convites, checkouts e auditoria
não são apagados. Critérios mínimos de avanço: zero acesso cruzado, zero ativação pelo retorno do
navegador, webhooks duplicados idempotentes e taxa de erro de login/portal dentro do baseline do
piloto. Responsável de produto aprova cada onda; responsável técnico executa e monitora.

## Validação local

```text
cd dashboard
npm run design:validate
npm run lint
npm test
npm run build
npm run test:supabase
npm run types:supabase
npx playwright test portal-routes.spec.ts
npx playwright test portal-states.spec.ts
npx playwright test portal-keyboard.spec.ts
```

A regressão visual do portal mantém 508 baselines: 120 para as 30 rotas públicas/autenticadas e 388
para 97 estados pertinentes, todos em 1440, 1024, 768 e 390 px. A matriz aplica loading, vazio e erro
a cada rota orientada a dados em que esses estados existem. Estados compartilhados de acesso,
permissão, plano, vínculo, convite, checkout e ciclo de assinatura são cobertos uma vez por público,
evitando combinações artificiais que a interface nunca apresenta. As páginas de mapa, agenda,
convites, suporte, perfil e configurações possuem feedback visual explícito para seus estados
assíncronos.

A suíte também bloqueia overflow horizontal, erros de execução, violações WCAG detectáveis pelo Axe
— incluindo contraste no navegador — e alvos de toque menores que 44 px no viewport móvel. Em 390 px,
todas as rotas também são verificadas com texto a 200%. Cinco testes dedicados confirmam a ordem de
foco no login, o funcionamento dos skip links públicos e de autenticação, a saída do vínculo
municipal inativo e a abertura/fechamento do menu móvel por teclado, incluindo `Escape` e retorno do
foco ao acionador.

Uma passagem assistida pela árvore de acessibilidade do navegador validou planos, entrada e criação
de conta. Essas telas mantêm um único conteúdo principal e um único título de nível 1, controles com
nomes acessíveis, referências ARIA válidas e nenhum identificador duplicado. A autenticação ganhou
marco principal, atalho de salto e mensagens de erro anunciadas como alerta.

O Playwright força movimento reduzido; nos mapas, aguarda os dois marcadores e neutraliza somente o
canvas de tiles externos para evitar diferenças causadas pela rede, mantendo shell, controles,
marcadores e alternativa textual sob validação.

A revisão automatizada e assistida está registrada em `docs/portal-accessibility-review.md`. Continua
manual antes da aprovação final de acessibilidade a passagem auditiva de ponta a ponta com Narrador,
NVDA, TalkBack ou VoiceOver por uma pessoa usuária.

O projeto local do Supabase está configurado em `supabase/config.toml`, e os scripts usam a CLI
2.110.0 de forma reproduzível. A validação estática exige RLS nas cinco tabelas novas, `search_path`
fixo nas 19 funções `SECURITY DEFINER` e paridade entre o plano e as 32 asserções pgTAP. A política
de escopo também exige que qualquer agente-alvo seja membro ativo da mesma organização, inclusive
para operações iniciadas por coordenadores.

Os tipos TypeScript foram reconciliados com as tabelas, colunas e relacionamentos introduzidos pela
migration. Um teste de contrato compilável cobre os 18 RPCs públicos do portal e as estruturas de
membership, assinatura, entitlements versionados, rollout, checkout e eventos de pagamento.

No aplicativo Expo, os componentes nativos de estado e status de assinatura usam diretamente o
contrato `PortalSemanticTokens`, mantendo composição própria de Android/iOS. A tela de assinatura
adota carregamento com estado `busy`, erro com recuperação, vazio orientativo, status financeiro
nomeado para tecnologia assistiva e alvos de ação com altura mínima de 46 px. Os componentes têm
testes dedicados para assinatura ativa, cancelamento agendado, loading e retry.

A execução real de `npm run test:supabase` e a geração canônica de `npm run types:supabase` exigem
um runtime Docker compatível. O uso desse runtime não está autorizado nesta máquina e a restrição de
custo zero também impede criar uma Preview Branch paga apenas para testes. Por isso, as tarefas 3.2,
3.8 e 11.2 permanecem abertas até migrations e pgTAP passarem em um ambiente gratuito já aprovado.
Nenhuma migration foi aplicada ao projeto remoto. Aplicar migrations e ativar flags são ações
separadas.
