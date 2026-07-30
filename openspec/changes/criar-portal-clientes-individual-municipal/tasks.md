## 1. Aprovação de design e escopo

- [ ] 1.1 Restabelecer uma conexão Penpot MCP compatível com o arquivo “TCS — Web Dashboard” e registrar a versão usada
- [x] 1.2 Criar `26 · Portais — Arquitetura` com superfícies, jornadas, matriz de acesso, checkout/webhook e convite municipal
- [x] 1.3 Criar `27 · Portais — Componentes e estados` reutilizando Foundations, tipografia, paleta e componentes aprovados
- [x] 1.4 Criar todos os boards e estados do Portal Individual em `28 · Portal Individual`
- [x] 1.5 Criar todos os boards e estados do coordenador em `29 · Municipal — Coordenador`
- [x] 1.6 Criar todos os boards e estados do supervisor em `30 · Municipal — Supervisor`
- [x] 1.7 Criar todos os boards e estados do agente em `31 · Municipal — Agente`
- [x] 1.8 Criar checkout, billing, autenticação e convites nas páginas 32 e 33
- [x] 1.9 Validar e anotar cada rota em 1440, 1024, 768 e 390 px na página 34
- [x] 1.10 Executar revisão visual, acessibilidade e consistência Web/Android/iOS e obter aprovação explícita

## 2. Preparação da implementação

- [x] 2.1 Criar e trocar para a nova branch `codex/criar-portal-clientes-individual-municipal` somente após a aprovação visual
- [x] 2.2 Congelar o inventário de rotas, boards, permissões, features, limites e estados aprovados
- [x] 2.3 Registrar feature flags independentes para fundação, portal individual, cada papel municipal e billing
- [x] 2.4 Adicionar manifesto executável rota → audiência → permissão → board → estados → breakpoints
- [x] 2.5 Definir métricas de piloto, critérios de avanço, rollback e responsáveis por onda

## 3. Segurança e reconciliação Supabase

- [x] 3.1 Triar os advisors de segurança relevantes e remover execução pública desnecessária de funções `SECURITY DEFINER`
- [ ] 3.2 Corrigir as políticas permissivas e validar RLS de usuários, convites, organizações, assinaturas e operações
- [x] 3.3 Criar testes negativos entre dois indivíduos, duas organizações e um usuário interno
- [x] 3.4 Reconciliar preços, trial, carência, status, features e limites entre documentação, Supabase e matriz aprovada
- [ ] 3.5 Publicar novas versões imutáveis dos planos aprovados sem reescrever histórico
- [x] 3.6 Implementar `get_portal_access_context` com identidade, membership, assinatura, features, limites, consumo e permissões efetivas
- [x] 3.7 Implementar helpers/RPCs `portal_*` que derivem sujeito e organização exclusivamente do servidor
- [ ] 3.8 Regenerar tipos Supabase e adicionar testes de contrato para todos os retornos do portal

## 4. Fronteiras Web e autenticação

- [x] 4.1 Separar no roteador os layouts e providers público, cliente e interno
- [x] 4.2 Implementar `/entrar`, `/criar-conta`, retorno autenticado e redirecionamento seguro por audiência
- [x] 4.3 Implementar guardas de `/portal/individual/*` e `/portal/municipal/*` a partir do contexto server-side
- [x] 4.4 Impedir imports de hooks, navegação e RPCs internos no bundle do portal de clientes
- [x] 4.5 Manter `/login` e `/app/*` exigindo `internal_staff` ativo e permissões internas
- [x] 4.6 Testar que clientes autenticados não acessam console, dados internos ou aliases legados
- [x] 4.7 Implementar shell responsivo, foco, skip link, navegação móvel e estados transversais compartilhados

## 5. Onda Portal Individual

- [x] 5.1 Implementar dashboard individual com atividade, agenda, documentos, consumo e assinatura reais
- [x] 5.2 Implementar lista, filtros e detalhe de vistorias próprias
- [x] 5.3 Implementar mapa próprio com alternativa textual acessível
- [x] 5.4 Implementar agenda individual e vínculo com vistoria
- [x] 5.5 Implementar central de documentos com links assinados sob demanda
- [x] 5.6 Implementar relatórios e indicadores condicionados ao plano
- [x] 5.7 Implementar plano, consumo, status de assinatura e ações de cobrança permitidas
- [x] 5.8 Implementar suporte, perfil, segurança e sessões próprias
- [x] 5.9 Cobrir loading, vazio, erro, plano, permissão e todos os estados financeiros em testes

## 6. Onda Portal Municipal — agente e supervisor

- [x] 6.1 Implementar dashboard e navegação do agente com escopo próprio/atribuído
- [x] 6.2 Implementar vistorias, mapa, agenda, documentos, indicadores, suporte e perfil do agente
- [x] 6.3 Implementar dashboard operacional e navegação do supervisor
- [x] 6.4 Implementar consultas server-side para o escopo configurado do supervisor
- [x] 6.5 Implementar gestão de operações, relatórios e equipe permitidos ao supervisor
- [x] 6.6 Implementar convite de agente pelo supervisor sem permitir outros papéis
- [x] 6.7 Testar tentativa de acesso cruzado, troca de filtros e chamadas diretas fora do escopo

## 7. Onda Portal Municipal — coordenador

- [x] 7.1 Implementar dashboard municipal com operação, risco, equipe, consumo e assinatura
- [x] 7.2 Implementar gestão de vistorias, agenda, documentos, relatórios e indicadores organizacionais
- [x] 7.3 Implementar equipe, papéis, status e ações administrativas permitidas
- [x] 7.4 Implementar consumo, plano, billing e política de excedentes da organização
- [x] 7.5 Implementar configurações municipais e suporte organizacional
- [x] 7.6 Exigir confirmação, justificativa e auditoria para ações municipais de alto impacto
- [x] 7.7 Testar que coordenador municipal não recebe nenhuma permissão `internal_*` ou acesso `/app/*`

## 8. Convites municipais

- [x] 8.1 Endurecer o modelo de convite com e-mail normalizado obrigatório, hash, expiração, status e auditoria
- [x] 8.2 Implementar criação de convite por coordenador e supervisor com regras de papel
- [x] 8.3 Implementar verificação atômica de assinatura, feature municipal e assentos
- [x] 8.4 Implementar aceite por usuário autenticado com e-mail verificado correspondente
- [x] 8.5 Implementar reenvio, revogação, expiração e mensagens não sensíveis
- [x] 8.6 Bloquear conflito de membership e tentativa de transferir organização pelo cliente
- [x] 8.7 Testar corrida pelo último assento, reuso de token e convite encaminhado

## 9. Checkout, webhook e entitlement automático

- [ ] 9.1 Escolher e documentar o provedor, meios de pagamento, periodicidades, prorrata e política de cancelamento
- [x] 9.2 Criar tabelas/vínculos de cliente do provedor, checkout, assinatura e eventos de webhook
- [x] 9.3 Implementar criação server-side de checkout com versão de plano, preço e idempotência
- [x] 9.4 Implementar retorno de checkout que consulta estado sem ativar módulos
- [x] 9.5 Implementar webhook com verificação de assinatura, evento único, transação, retry e dead-letter
- [x] 9.6 Implementar proteção contra eventos duplicados e fora de ordem
- [ ] 9.7 Implementar billing portal, atualização de pagamento, upgrade/downgrade e cancelamento
- [x] 9.8 Implementar transições trial, active, grace, past_due, cancel-at-period-end, canceled e expired
- [x] 9.9 Atualizar automaticamente o contexto de entitlement após eventos autoritativos
- [ ] 9.10 Testar falha de pagamento, recuperação, renovação, cancelamento, reativação e rollback operacional

## 10. Identidade multiplataforma

- [x] 10.1 Versionar o contrato de tokens semânticos derivado do Penpot
- [x] 10.2 Mapear tokens e estados para CSS/Web, tema React Native, Android e iOS
- [x] 10.3 Unificar glossário, mensagens e ações de assinatura, plano e permissão
- [x] 10.4 Atualizar componentes móveis equivalentes sem forçar composição Web
- [x] 10.5 Registrar a versão do contrato visual adotada em cada plataforma
- [ ] 10.6 Executar revisão de contraste, leitor de tela, texto ampliado, movimento reduzido e alvos de toque — automação concluída; passagem auditiva humana pendente em `docs/portal-accessibility-review.md`

## 11. Qualidade, rollout e encerramento

- [x] 11.1 Criar regressão visual de todas as rotas e estados em 1440, 1024, 768 e 390 px
- [ ] 11.2 Executar testes unitários, integração, RLS/BOLA, concorrência, acessibilidade, lint e build
- [x] 11.3 Comparar cada rota com o board aprovado e registrar exceções aprovadas
- [ ] 11.4 Publicar a primeira coorte de piloto com enforcement controlado por feature flag
- [ ] 11.5 Monitorar login, acesso negado, webhook, convite, conversão, erro e suporte por papel/plano
- [ ] 11.6 Exercitar rollback de cada onda sem apagar assinaturas, memberships ou auditoria
- [ ] 11.7 Obter aceite final e somente então ampliar o rollout e remover caminhos temporários
