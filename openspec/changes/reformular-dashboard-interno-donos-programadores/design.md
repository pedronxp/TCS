## Context

O repositório possui um dashboard React/Vite compartilhando Supabase Auth, Postgres, Storage e Edge Functions com o aplicativo móvel. O dashboard nasceu como painel operacional para administradores municipais e passou a receber telas comerciais de planos, organizações, assinaturas, sessões e suporte. A mudança ativa `criar-planos-assinatura-e-gestao-municipal` já estabelece organizações, memberships, entitlements, sessões e suporte, além de restringir o console aos proprietários.

O estado atual apresenta três problemas: a navegação mistura negócio, operação municipal e desenvolvimento; os únicos papéis conhecidos pelo frontend são os papéis do aplicativo; e várias telas novas exibem dados, mas não completam o fluxo administrativo. O novo console deve atender exclusivamente a equipe interna, com visão executiva para donos e visão técnica para programadores. Um portal do cliente poderá ser criado depois, mas não compartilhará autorização nem navegação com o console interno.

## Goals / Non-Goals

**Goals:**

- Criar um shell interno responsivo com navegação e dashboard orientados ao papel do colaborador.
- Tornar Clientes o ponto central para informações comerciais, operacionais e técnicas.
- Implementar fluxos completos de gestão, com autorização server-side, auditoria e feedback de interface.
- Separar permissões de dono e programador sem reutilizar papéis municipais como identidade interna.
- Reutilizar o modelo de organizações, planos, assinaturas, consumo, sessões e suporte já definido.
- Organizar operações técnicas de versões, builds, formulários, sincronização, armazenamento, logs e erros.
- Criar componentes, consultas e contratos que possam ser reutilizados no futuro portal do cliente sem expor funções internas.

**Non-Goals:**

- Criar o portal web do cliente nesta mudança.
- Permitir que agentes realizem vistorias pelo navegador.
- Alterar os formulários e cálculos de risco do aplicativo móvel além do necessário para administrá-los.
- Escolher ou configurar o provedor de hospedagem do dashboard.
- Implementar cobrança automática ou integração com um provedor de pagamento.
- Substituir o Supabase como backend compartilhado.

## Decisions

### 1. Um console interno com experiências por papel

O dashboard continuará sendo uma única aplicação, mas o shell resolverá o papel interno e montará navegação, indicadores e ações compatíveis. Donos verão a visão executiva e programadores verão a visão técnica. Páginas compartilhadas, como Clientes e Suporte, ajustarão ações e profundidade conforme permissão.

Alternativa considerada: duas aplicações internas separadas. Foi rejeitada porque duplicaria autenticação, componentes, deploy e consultas sem trazer isolamento adicional, que deve ser garantido no servidor.

### 2. Identidade interna explícita e independente dos papéis municipais

Será criada uma fonte de autorização interna com `user_id`, `role`, `active` e metadados de auditoria. Os papéis iniciais serão `owner` e `developer`; o modelo poderá aceitar `support` e `auditor` posteriormente. A compatibilidade com `owner_admins` será preservada durante a migração, e `master_admin` deixará de ser suficiente para liberar o console.

As políticas e RPCs validarão o papel interno no banco. Esconder itens no frontend será apenas uma medida de experiência, nunca a fronteira de autorização.

Alternativa considerada: continuar usando `master_admin`. Foi rejeitada porque mistura autoridade do aplicativo com funções internas e não permite separar negócio de desenvolvimento.

### 3. Cliente como agregado central do console

Uma camada de consulta apresentará organizações e contas individuais sob o conceito de Cliente. A rota `/clientes/:id` terá abas de resumo, assinatura, consumo, usuários, sessões, vistorias, chamados, implantação e auditoria. Dados operacionais atualmente globais serão acessados dentro desse contexto para reduzir mistura acidental entre municípios.

O identificador da rota será um identificador de cliente resolvido server-side para `organization_id` ou `user_id`. Consultas nunca aceitarão município textual como autorização.

Alternativa considerada: manter Organizações e Usuários individuais em módulos isolados. Foi rejeitada porque fragmenta a jornada comercial e impede uma visão única da saúde do cliente.

### 4. Navegação agrupada e orientada a tarefas

O shell terá os grupos Principal, Negócio, Desenvolvimento e Governança. O cabeçalho mostrará página, ambiente, busca de cliente, alertas e ação principal. A sidebar não exibirá módulos operacionais municipais como destinos globais; ocorrências, mapa, agenda, usuários e laudos serão ferramentas de diagnóstico dentro do cliente.

Em telas pequenas, a navegação será recolhível e o conteúdo será empilhado sem tabelas ou ações inacessíveis. O dashboard será otimizado primeiro para desktop e tablet, pois o aplicativo móvel continua sendo a ferramenta de campo.

### 5. Camada de dados tipada e mutations centralizadas

Tipos reais do Supabase serão gerados e usados pelo dashboard. Consultas ficarão em hooks de domínio com TanStack Query. Ações sensíveis usarão RPCs ou Edge Functions que validem papel, estado anterior, justificativa e idempotência. Páginas não executarão mutations administrativas diretas sem tratamento de erro.

Cada ação apresentará loading, sucesso ou erro e invalidará somente as queries relacionadas. Alterações destrutivas exigirão confirmação; alterações de plano, limite, sessão, build ou configuração terão evento de auditoria.

Alternativa considerada: manter chamadas Supabase diretamente em cada página. Foi rejeitada pela duplicação, ausência de tipos e falhas silenciosas observadas no código atual.

### 6. Operações técnicas como domínio próprio

O grupo Desenvolvimento reunirá versões e builds, formulários e regras de risco, sincronização, armazenamento, logs e erros. Indicadores técnicos serão obtidos de fontes persistidas e auditáveis; a interface não exibirá métricas simuladas em produção.

Quando uma fonte ainda não existir, será criado um contrato mínimo de evento técnico com cliente, versão, plataforma, categoria, severidade, timestamp e metadados sanitizados. Segredos, tokens, conteúdo sensível de formulários e dados pessoais desnecessários não serão registrados.

### 7. Componentes compartilhados sem compartilhar autorização

Tabelas, filtros, estados, cards, badges e detalhes de ocorrências poderão ser reutilizados no futuro portal do cliente. Rotas, providers de autenticação, políticas e permissões do console interno permanecerão separados. Nenhum componente compartilhado poderá presumir que a visibilidade da interface autoriza a consulta.

## Risks / Trade-offs

- [Duas mudanças OpenSpec ativas alteram o mesmo dashboard] → implementar primeiro a fundação de assinaturas ou revisar conflitos antes de aplicar esta mudança; reutilizar tabelas e RPCs em vez de duplicá-las.
- [Migração de `owner_admins` pode bloquear proprietários atuais] → criar registros internos equivalentes antes de ativar o novo gate e manter rollback compatível.
- [Programador recebe dados comerciais ou pessoais além do necessário] → aplicar matriz de permissões por coluna/ação, consultas sanitizadas e testes negativos.
- [Contexto de cliente incorreto mistura dados de organizações] → resolver escopo no servidor, exigir `organization_id` persistido e testar com duas prefeituras.
- [Dashboard tenta virar ferramenta de observabilidade completa] → limitar a primeira versão a eventos acionáveis de sincronização, build, versão, armazenamento e erro.
- [Navegação por papel esconde uma função necessária] → manter rotas compartilhadas para diagnóstico, mas controlar ações individualmente e registrar tentativas negadas.
- [Tabelas grandes degradam a experiência] → usar paginação e filtros server-side, selecionar apenas colunas necessárias e carregar abas sob demanda.
- [Ações administrativas falham silenciosamente] → centralizar mutations, exigir retorno tipado e manter o estado anterior quando houver erro.

## Migration Plan

1. Criar a fonte de identidade interna e migrar proprietários ativos de `owner_admins` como `owner`.
2. Adicionar helpers de autorização e testes negativos sem remover o gate atual.
3. Criar o novo shell, rotas e componentes mantendo as páginas existentes acessíveis por rotas de compatibilidade.
4. Implementar Clientes e o detalhe por abas sobre o modelo de dados existente.
5. Migrar planos, assinaturas, suporte, sessões e auditoria para hooks tipados e mutations protegidas.
6. Mover páginas operacionais para o contexto do cliente e remover seus atalhos globais somente após validação.
7. Implementar a visão técnica e as fontes mínimas de eventos técnicos.
8. Ativar o gate por papel interno, validar dono e programador e remover a autorização baseada apenas em papel municipal.
9. Atualizar documentação e executar testes funcionais, de RLS e responsividade.

Rollback: reativar temporariamente o shell e o gate anteriores por feature flag, preservando identidades internas e eventos já gravados. Não remover dados de auditoria, clientes ou configurações durante rollback.

## Extensão de design: detalhe do agente

### Estado encontrado

A aba `Usuários` de `CustomerDetailPage` apenas lista nome, papel, status e último acesso. A linha não abre um usuário. As vistorias do detalhe do cliente vêm de `get_internal_customer_detail` com `LIMIT 50`, enquanto `get_internal_customer_operations` retorna até 250 pontos no mapa para todo o cliente. Portanto, selecionar um agente não produz uma visão individual e os limites atuais não atendem ao requisito de consultar todo o histórico.

### Rota e navegação

A rota canônica será `/clientes/:customerId/usuarios/:userId/:userSection?`. A aba Usuários do cliente transformará a linha inteira e uma ação explícita “Ver agente” em links acessíveis para essa rota. `userSection` aceitará `resumo`, `vistorias`, `mapa`, `agendamentos`, `documentos` e `acesso`; valores inválidos voltarão para `resumo`.

O cabeçalho mostrará nome, papel, status do vínculo, organização, plano herdado, último acesso e última atividade conhecida. O retorno levará à aba Usuários do cliente sem perder filtros e paginação quando o estado de navegação estiver disponível.

### Contrato de dados

Uma consulta server-side receberá `customer_id`, `user_id`, período, riscos, status, formulário, texto, cursor e tamanho da página. O servidor validará que o usuário pertence ao cliente — ou que é o próprio sujeito de um cliente individual — antes de consultar vistorias. A resposta separará:

- identidade e vínculo do agente;
- totais do período e do período anterior;
- distribuição R1–R4, dias ativos, última vistoria, percentual geolocalizado e completude documental;
- página de vistorias ordenada por `dataVistoria` decrescente, com total e próximo cursor;
- contagens de agendamentos e documentos;
- última sessão, heartbeat e último evento técnico permitido.

A lista usará páginas de 25 itens e permitirá 25, 50 ou 100. Não haverá `LIMIT` global que esconda registros antigos. O mapa usará consulta própria por usuário e filtros, retornando clusters ou pontos do viewport com contagem total; assim, todos os registros geolocalizados permanecem representados sem enviar um conjunto ilimitado ao navegador.

### Módulos

1. **Visão geral:** KPIs do período, comparação com o período anterior, distribuição de risco, atividade por dia e alertas acionáveis.
2. **Vistorias:** busca por protocolo/endereço autorizado, filtros por período, risco, status e formulário, paginação, ordenação e abertura do detalhe existente.
3. **Mapa:** clusters, legenda R1–R4, ajuste aos resultados, sincronização com os mesmos filtros e acesso ao resumo da vistoria.
4. **Agendamentos:** futuros, atrasados e concluídos vinculados por `agente_uid`, com navegação para a vistoria resultante quando existir.
5. **Documentos:** laudo, relatório e termo por vistoria, estado de geração e link assinado sob demanda; URLs privadas não serão expostas diretamente.
6. **Acesso e atividade:** aprovação/vínculo, sessões, dispositivos, heartbeat, versão conhecida, falhas técnicas permitidas e ações protegidas de bloquear/liberar, encerrar sessão e redefinir senha.

Assinatura, cobrança, suporte geral e consumo da organização continuarão no nível do cliente. O detalhe do agente apenas exibirá o plano herdado e o acesso efetivo, evitando duplicar módulos comerciais que não pertencem ao usuário municipal.

### Compatibilidade e dados legados

Antes da ativação, uma auditoria identificará vistorias com `agenteUid` ausente/inválido e vistorias municipais sem `organization_id`. Registros corrigíveis serão vinculados por identificadores persistidos em migração controlada. O runtime não usará nome do agente ou município textual como autorização. Dados não reconciliados aparecerão em um relatório administrativo, não serão atribuídos por aproximação.

## Open Questions

- O papel `developer` poderá disparar build diretamente em produção ou precisará de aprovação do dono?
- Quais fontes serão usadas para erros do aplicativo e falhas de sincronização na primeira entrega: tabelas próprias, serviço externo ou ambos?
- Dados pessoais de vistorias poderão ser vistos integralmente por programadores ou somente mediante abertura explícita de um modo de suporte auditado?
- Perfis `support` e `auditor` entram nesta implementação ou ficam apenas preparados no modelo?
