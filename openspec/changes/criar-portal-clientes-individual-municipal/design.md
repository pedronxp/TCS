## Context

O repositório contém dois produtos executáveis: o aplicativo Expo/React Native e `dashboard/`, uma aplicação React/Vite. No Web atual, `/` é o site comercial, `/login` autentica exclusivamente a equipe TCS e `/app/*` monta o console interno protegido por `get_internal_staff_profile`. Não há rota, provider, shell ou guarda para clientes.

O Supabase de produção está saudável e já oferece a base de domínio: `organizations`, `organization_members`, `organization_invites`, `plans`, `plan_versions`, `features`, `plan_features`, `plan_limits`, `subscriptions`, `usage_*`, `active_sessions`, suporte, agenda, documentos e vistorias. Também existem RPCs para contexto de assinatura, entitlement, convites e sessões. Todos os 52 objetos públicos auditados possuem RLS.

A auditoria identificou lacunas que impedem publicar os portais sem uma fase de reconciliação:

- `entitlement_enforcement_enabled` e `session_enforcement_enabled` estão `false`;
- há uma única assinatura ativa, nenhuma organização/membership e nenhum convite no modelo novo;
- checkout, vínculo com provedor de pagamento e webhook não existem;
- o catálogo vivo diverge de `docs/planos-comerciais-aprovados.md` em preço, trial, status e módulos;
- `plan_features` contém combinações incompatíveis com o catálogo aprovado, como ARV no Individual Básico;
- os advisors reportam 121 achados de segurança, incluindo funções `SECURITY DEFINER` executáveis por papéis amplos e duas políticas permissivas; estes achados devem ser triados antes de ampliar a superfície de clientes;
- o Penpot “TCS — Web Dashboard” possui 25 páginas aprovadas e define a identidade visual, mas ainda não contém os portais.

O arquivo Penpot é a fonte de verdade visual. A fundação aprovada usa Inter, background `#FAF8F5`, surface `#FFFFFF`, foreground `#1C1917`, secondary `#F3EFE9`, border `#E7E0D8`, primary `#6F513A`, warm accent `#D7C3AA`, info `#EAF4FB`, info strong `#2F6F96`, espaçamento 4/8/12/16/24/32 px e raios 6/10/14/24 px.

## Goals / Non-Goals

**Goals:**

- Projetar dois portais Web completos e responsivos sem conceder acesso ao console interno.
- Definir rotas, autenticação, autorização, navegação, módulos, estados e contratos de dados antes do código.
- Fazer entitlement comercial, papel municipal e escopo do recurso participarem de toda decisão de acesso.
- Cobrir o ciclo de assinatura, checkout, webhook, liberação de módulos e convites.
- Reutilizar a identidade aprovada e criar no Penpot todos os boards necessários à aprovação.
- Manter uma identidade de produto única entre Web, Android e iOS.
- Preparar uma implementação futura em nova branch, com ondas independentes, feature flags e rollback.

**Non-Goals:**

- Implementar frontend, migrations, Edge Functions, checkout ou webhook nesta etapa.
- Escolher definitivamente o provedor de pagamento, adquirente, emissão fiscal ou política jurídica.
- Permitir vistorias completas pelo navegador na primeira onda; o Web gerencia, consulta, agenda, documenta e analisa, enquanto a captura de campo continua prioritariamente nativa.
- Compartilhar componentes React DOM com React Native; serão compartilhados tokens, linguagem e contratos.
- Alterar ou publicar o catálogo comercial antes da reconciliação e aprovação.
- Migrar um usuário entre organizações ou permitir múltiplas organizações na primeira versão.

## Decisions

### 1. Três superfícies Web, três fronteiras de autorização

A aplicação Web terá três árvores canônicas:

| Superfície | Rotas | Identidade | Provider/RPC permitido |
| --- | --- | --- | --- |
| Público | `/`, `/planos`, `/entrar`, `/criar-conta`, `/convite/:token`, `/checkout/retorno` | anônimo ou sessão sem contexto privilegiado | catálogo público sanitizado, Auth e início de checkout |
| Clientes | `/portal/individual/*`, `/portal/municipal/*` | usuário autenticado com contexto individual ou membership municipal ativo | RPCs `portal_*`, tabelas/RLS do próprio sujeito ou organização |
| TCS interno | `/login`, `/app/*` | `internal_staff` ativo com permissão interna | RPCs `internal_*`, MFA e auditoria interna |

O roteador raiz montará providers lazy e isolados. O portal não importará `AuthContext` interno, `OWNER_NAVIGATION`, `DEVELOPER_NAVIGATION`, busca global de clientes nem hooks `internal_*`. `/app/*` continuará exigindo `get_internal_staff_profile`; uma sessão de cliente sem perfil interno receberá acesso negado, nunca redirecionamento permissivo.

Inicialmente as superfícies podem compartilhar o mesmo bundle Vite e hostname. A fronteira lógica deve permitir separar depois `www`, `portal` e `console` em deploys/subdomínios diferentes sem mudar os contratos. Separar hostnames melhora isolamento, mas não substitui RLS/RPCs.

Alternativa rejeitada: reutilizar `/app` e esconder itens por menu. Isso mistura providers e transforma um erro de frontend em escalada para o console.

### 2. Contexto único de acesso para clientes

Após autenticar, o Web chamará uma RPC de leitura `get_portal_access_context` que retorna somente:

- tipo de conta (`individual` ou `organization`);
- identificador do sujeito e, quando municipal, `organization_id`, papel e status do membership;
- plano/versão, assinatura, datas e política de bloqueio;
- features e limites efetivos, incluindo overrides válidos;
- permissões efetivas e capacidades de navegação;
- resumo de consumo e flags de experiência.

O cliente não enviará papel, organização ou plano como autoridade. Toda mutação validará novamente `auth.uid()`, membership, assinatura, feature, limite e escopo no servidor. Claims editáveis de `user_metadata` não participarão da autorização.

### 3. Matriz plano × módulo × função × permissão

Acesso efetivo será a interseção:

`sessão válida ∩ membership/status ∩ papel/permissão ∩ feature do plano ∩ estado da assinatura ∩ escopo do recurso`.

`✓` indica feature incluída; `—` indica bloqueio de plano/papel. A coluna de papel descreve o maior escopo permitido; regras de assinatura podem reduzi-lo para leitura.

| Módulo | Permissão normativa | Ind. Básico | Ind. Prof. | Mun. Básico | Mun. Prof. | Mun. Completo | Coordenador | Supervisor | Agente |
| --- | --- | :---: | :---: | :---: | :---: | :---: | --- | --- | --- |
| Dashboard | `portal.dashboard.read` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | equipe/organização autorizada | próprio |
| Vistoria padrão | `inspection.standard.read/create` | ✓ | ✓ | ✓ | ✓ | ✓ | organização; cria/atribui | escopo; cria/atribui | próprias/atribuídas; cria |
| Vistoria ARV | `inspection.arv.read/create` | — | — | — | — | ✓ | organização | escopo | próprias/atribuídas |
| Mapa | `inspection.map.read` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | escopo | próprio |
| Agenda | `appointment.read/manage` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | escopo | própria |
| Documentos básicos | `document.basic.read/generate` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | escopo | próprios |
| Relatórios básicos | `report.basic.read/export` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | escopo | próprios |
| Relatórios avançados | `report.advanced.read/export` | — | ✓ | — | ✓ | ✓ | organização | escopo | próprios quando permitido |
| Indicadores essenciais | `indicator.essential.read` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | escopo | próprios |
| Indicadores completos | `indicator.complete.read` | — | ✓ | — | ✓ | ✓ | organização | escopo | próprios quando permitido |
| Indicadores customizados | `indicator.custom.manage` | — | — | — | — | ✓ | configura | visualiza | — |
| Relatório institucional | `report.institutional.export` | — | — | — | — | ✓ | gera | gera no escopo | — |
| Modo treinamento | `training.use/manage` | — | — | — | — | ✓ | gerencia | acompanha | participa |
| Equipe | `member.read/manage` | — | — | ✓ | ✓ | ✓ | lê e gerencia | lê; gerencia agentes | próprio perfil |
| Convites | `invite.create/revoke` | — | — | ✓ | ✓ | ✓ | coordenador/supervisor/agente | somente agente | — |
| Consumo | `usage.read` | próprio | próprio | ✓ | ✓ | ✓ | organização | resumo do escopo | próprio |
| Plano e assinatura | `subscription.read` | próprio | próprio | ✓ | ✓ | ✓ | organização | status sem cobrança | status sem cobrança |
| Checkout/cobrança | `billing.manage` | titular | titular | ✓ | ✓ | ✓ | gerencia | — | — |
| Suporte | `support.read/create` | ✓ | ✓ | ✓ | ✓ | ✓ | organização | próprios e do escopo | próprios |
| Configuração municipal | `organization.settings.manage` | — | — | ✓ | ✓ | ✓ | gerencia | — | — |
| Sessões e perfil | `profile.self.manage` | próprio | próprio | próprio | próprio | próprio | próprio | próprio | próprio |

Esta matriz é o alvo a aprovar. A publicação futura deve gerar uma nova versão dos planos e não editar silenciosamente assinaturas históricas. `docs/planos-comerciais-aprovados.md`, Supabase e Penpot precisam convergir antes de habilitar checkout.

### 4. Navegação do Portal Individual

Shell: marca TCS, plano/status, seletor de contexto ausente, central de ajuda, perfil e navegação responsiva.

| Rota | Função |
| --- | --- |
| `/portal/individual` | resumo de atividade, próximos agendamentos, consumo, pendências e atalhos |
| `/portal/individual/vistorias` | busca, filtros, lista e acesso ao detalhe |
| `/portal/individual/vistorias/:inspectionId` | resumo, risco, evidências, ciência e documentos |
| `/portal/individual/mapa` | mapa das próprias vistorias e lista acessível equivalente |
| `/portal/individual/agenda` | compromissos e vínculo com vistoria |
| `/portal/individual/documentos` | laudos, relatórios, termos, status e download assinado |
| `/portal/individual/relatorios` | indicadores e exportações conforme plano |
| `/portal/individual/assinatura` | plano, trial, consumo, cobrança, upgrade, cancelamento e portal de cobrança |
| `/portal/individual/suporte` | chamados, histórico e novo contato |
| `/portal/individual/perfil` | identidade, segurança, sessões e preferências |

### 5. Navegação do Portal Municipal por função

Rotas comuns usam `/portal/municipal`; a navegação é derivada de permissões do servidor.

- **Coordenador:** Visão municipal, Vistorias, Mapa, Agenda, Documentos, Relatórios, Equipe, Convites, Consumo, Plano e cobrança, Suporte, Configurações.
- **Supervisor:** Visão operacional, Vistorias do escopo, Mapa, Agenda, Documentos, Relatórios permitidos, Equipe, Convites de agente, Suporte, Perfil.
- **Agente:** Meu trabalho, Minhas vistorias, Meu mapa, Minha agenda, Meus documentos, Indicadores próprios quando incluídos, Suporte, Perfil.

Rotas canônicas:

`/portal/municipal`, `/vistorias`, `/vistorias/:inspectionId`, `/mapa`, `/agenda`, `/documentos`, `/relatorios`, `/equipe`, `/convites`, `/consumo`, `/assinatura`, `/suporte`, `/configuracoes` e `/perfil`.

Uma rota existente, mas não autorizada, renderiza “Sem permissão” com retorno seguro; uma feature ausente renderiza “Não incluído no plano”. Esses estados não são intercambiáveis.

### 6. Taxonomia transversal de estados

Toda página de dados terá variantes:

| Estado | Regra visual e funcional |
| --- | --- |
| Loading | skeleton preserva a geometria; ação mutável fica indisponível; anúncio `aria-live` |
| Vazio | explica ausência real, oferece ação permitida e não sugere upgrade indevido |
| Erro | mensagem sanitizada, retry e canal de suporte; dados anteriores permanecem quando seguros |
| Bloqueio de plano | mostra módulo, benefício e plano necessário; não simula “sem permissão” |
| Sem permissão | informa escopo/papel e oferece retorno ou solicitação ao coordenador |
| Trial | banner com término, consumo e CTA de cobrança; módulos seguem o plano |
| Ativa | experiência normal e status discreto |
| Inadimplência | banner prioritário, recuperação de pagamento e política de leitura/criação |
| Carência | prazo explícito e operações permitidas pelo contrato |
| Cancelamento agendado | acesso até o período final, data e opção de reativar |
| Cancelada/expirada | histórico/documentos permitidos em leitura; novas operações bloqueadas |

Estados financeiros nunca apagam dados. O servidor decide se criação permanece permitida; a UI apenas representa a decisão.

### 7. Checkout e webhook idempotente

O fluxo será provedor-agnóstico:

1. O usuário escolhe plano e periodicidade a partir de um catálogo público versionado.
2. Após autenticação e confirmação de titular/organização, uma Edge Function cria a sessão de checkout com `plan_id`, `plan_version`, preço, sujeito e chave de idempotência.
3. O navegador é redirecionado ao checkout hospedado; nenhuma chave secreta entra no cliente.
4. A página de retorno exibe processamento e consulta o estado server-side; ela não ativa módulos.
5. O webhook verifica assinatura e timestamp, persiste `provider_event_id` único e processa o evento numa transação.
6. O servidor vincula cliente/assinatura do provedor, atualiza `subscriptions`, registra auditoria e invalida/refaz o contexto de entitlement.
7. Eventos duplicados ou fora de ordem não podem regredir uma assinatura mais nova.
8. Falhas entram em fila de retry e dead-letter operacional; alertas são visíveis apenas no console TCS.

Contratos futuros: `create_checkout_session`, `open_billing_portal`, `billing_webhook`, `billing_webhook_events`, `billing_customers` e vínculo de assinatura ao provedor. Valores de cartão nunca transitam ou são persistidos pela TCS.

### 8. Liberação automática de módulos

Features efetivas vêm da versão do plano congelada na assinatura, com overrides auditados e prazo. Após evento financeiro válido:

- `trial`, `active` e `grace` liberam conforme a política;
- `past_due` aplica a política comercial aprovada, por padrão bloqueando nova operação e preservando leitura;
- cancelamento agendado mantém acesso até `current_period_end`;
- `canceled` ou `expired` preserva histórico permitido e bloqueia criação.

Mudança de plano entra em vigor conforme evento do provedor e regra de prorrata. O frontend não grava `plan_features`; somente apresenta o contexto calculado.

### 9. Convites municipais

Convites serão emitidos por RPC/Edge Function server-side e conterão `organization_id` imutável, e-mail normalizado, papel, hash do token, expiração, emissor e status.

- coordenador convida coordenador, supervisor ou agente;
- supervisor convida apenas agente;
- agente não convida;
- emissão e aceite validam assinatura, feature municipal e assentos;
- aceite exige usuário autenticado cujo e-mail corresponda ao convite;
- token é uso único, revogável e nunca armazenado em claro;
- reenvio revoga/substitui o token anterior;
- aceite cria membership atômico e não permite selecionar organização;
- conflito com membership ativo em outra organização é bloqueado e auditado.

### 10. Identidade única entre Web, Android e iOS

Penpot continuará sendo a origem visual. A implementação futura exportará um contrato versionado de tokens semânticos:

- cor, tipografia, spacing, radius, shadow, risco e estados;
- marca, tom de voz, ícones conceituais e nomenclatura;
- componentes equivalentes: botão, campo, card, badge, feedback, bloqueio, consumo e assinatura;
- taxonomia única de loading/vazio/erro/plano/permissão/assinatura.

Web usa sidebar, tabela, drawer e foco de teclado. Android/iOS usam navegação e controles nativos, áreas de toque mínimas e padrões de acessibilidade próprios. Paridade significa mesma intenção, hierarquia e estado, não pixel idêntico nem compartilhamento forçado de componente.

### 11. Estrutura dos boards Penpot

Serão adicionadas páginas após as 25 existentes:

| Página | Boards obrigatórios |
| --- | --- |
| `26 · Portais — Arquitetura` | mapa de superfícies, jornadas de login, checkout, webhook, convite e matriz de acesso |
| `27 · Portais — Componentes e estados` | shell, navegação, cards, tabelas/listas, filtros, consumo, assinatura, convite e todos os estados transversais |
| `28 · Portal Individual` | dashboard e todas as rotas individuais |
| `29 · Municipal — Coordenador` | dashboard, gestão, cobrança, equipe e configurações |
| `30 · Municipal — Supervisor` | dashboard operacional, escopo, equipe e convite de agente |
| `31 · Municipal — Agente` | meu trabalho, vistorias, agenda, documentos e perfil |
| `32 · Portais — Fluxos comerciais` | planos, checkout, retorno, billing portal, trial, inadimplência e cancelamento |
| `33 · Portais — Autenticação e convites` | entrar, criar conta, aceitar/rejeitar/expirar convite e conflitos |
| `34 · Portais — QA responsivo` | índice de cobertura, anotações de comportamento e checklist por rota/estado |

Cada rota canônica terá boards nomeados `NN · <Rota> · <Papel/Estado> · <Largura>` para 1440, 1024, 768 e 390 px. Componentes devem ser instâncias/referências da biblioteca existente ou novos componentes documentados em `27`, nunca cópias sem vínculo. Os boards permanecerão `pending-approval` até revisão visual do usuário.

### 12. Validação responsiva e acessibilidade

- 1440: sidebar persistente, tabelas densas e painéis paralelos.
- 1024: sidebar recolhível, redução de colunas e ações secundárias em menu.
- 768: navegação off-canvas, grids de uma ou duas colunas e filtros em Sheet.
- 390: navegação móvel, cards/listas equivalentes a tabelas, ações essenciais visíveis e sem overflow horizontal.

Todos os breakpoints exigem foco visível, ordem de teclado, labels, contraste WCAG AA, zoom, texto ampliado, `prefers-reduced-motion`, alternativa textual para mapas/gráficos e alvos de toque adequados. Loading, vazio, erro e bloqueios devem ser testados em pelo menos um board de cada família de layout; estados de assinatura devem existir nos shells individual e municipal.

## Risks / Trade-offs

- [Cliente herda permissões internas por reutilização de provider/RPC] → imports e providers separados, RPC namespace `portal_*`, testes negativos e `get_internal_staff_profile` obrigatório em `/app/*`.
- [Catálogo vivo inconsistente libera módulo ou preço errado] → reconciliação bloqueante, nova versão de plano e comparação automatizada com a matriz aprovada.
- [Webhook duplicado ou fora de ordem altera acesso] → event id único, assinatura verificada, transação, versionamento temporal e idempotência.
- [Inadimplência bloqueia operação de interesse público] → política por plano/contrato, carência explícita, leitura preservada e override interno auditado.
- [RLS atual amplia risco ao adicionar novas rotas] → resolver advisors relevantes, reduzir funções `SECURITY DEFINER` públicas e executar testes BOLA entre dois usuários e duas organizações.
- [Muitos boards se tornam inconsistentes] → componentes vinculados, templates, nomenclatura determinística e página de cobertura responsiva.
- [Paridade Web/native vira cópia pixel a pixel] → compartilhar tokens e semântica, mantendo padrões de cada plataforma.
- [Supervisor vê dados fora do escopo] → escopo derivado no servidor; filtros de UI nunca são autorização.
- [Convite é encaminhado para outra pessoa] → e-mail obrigatório, correspondência com Auth, token hash/uso único e auditoria.
- [Penpot MCP incompatível impede edição automatizada] → não declarar aprovação; reconectar uma versão compatível e executar criação/QA antes de iniciar a branch de implementação.

## Migration Plan

1. Aprovar proposal, design, specs, matriz e inventário de boards.
2. Concluir os boards no Penpot e revisar 1440, 1024, 768 e 390; registrar `pending-approval`/`approved`.
3. Escolher provedor de pagamento e política comercial; reconciliar documentação e Supabase.
4. Criar uma nova branch `codex/criar-portal-clientes-individual-municipal`.
5. Onda 0: segurança, advisors, contrato de contexto e testes negativos.
6. Onda 1: fundação de rotas/providers e autenticação de clientes, sem módulos mutáveis.
7. Onda 2: Portal Individual em leitura, depois ações.
8. Onda 3: Municipal Agente e Supervisor.
9. Onda 4: Municipal Coordenador, equipe e convites.
10. Onda 5: checkout, webhook, billing portal e automação de entitlement.
11. Onda 6: identidade/paridade mobile, acessibilidade, regressão visual e piloto.
12. Ativar por feature flag e coorte; ampliar somente após métricas, auditoria e aprovação.

Rollback: desativar a onda/feature flag, preservar dados de billing, memberships e auditoria, manter leitura do histórico e retornar ao fluxo comercial manual. Eventos financeiros recebidos durante rollback continuam sendo persistidos e reconciliados; não se apagam assinaturas.

## Open Questions

- Qual provedor de pagamento e quais meios (cartão, PIX, boleto) entram na primeira versão?
- Quem é o titular de cobrança municipal e quais documentos fiscais/campos são obrigatórios?
- Inadimplência municipal bloqueia criação imediatamente, após `past_due` ou apenas ao fim de `grace`?
- O supervisor enxerga toda a organização ou uma equipe/território configurável?
- O agente poderá iniciar uma vistoria Web no futuro ou apenas consultar/gerenciar nesta versão?
- Planos Municipal Profissional e Completo serão reativados ou o catálogo comercial será consolidado em um único Municipal?
- O cancelamento será imediato ou somente ao fim do período pago?
- O console interno será movido para hostname/deploy separado na mesma onda ou posteriormente?
