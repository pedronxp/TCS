# Plano de redesign do TCS Web orientado por skills

Data: 2026-08-08

Status: planejamento somente. Nenhuma tela ou componente deve ser implementado antes da aprovação dos gates P0.

## 1. Propósito do produto

O TCS reduz o intervalo entre a vistoria técnica de risco em campo e a decisão do gestor. A cadeia de valor é: captura offline, classificação R1-R4, evidências, sincronização segura, protocolo oficial, laudo/documento rastreável e visão gerencial.

O Web contém três produtos distintos:

1. Superfície pública de aquisição, prova e escolha comercial.
2. Portais de clientes individual e municipal para gestão do trabalho, equipe, documentos, consumo e assinatura.
3. Console interno TCS para operação comercial, suporte, governança e saúde técnica.

O principal momento de valor não é “abrir o dashboard”. É concluir uma vistoria válida, sincronizar e produzir classificação/documento rastreável. Para o município, existe um segundo momento: convidar a equipe e acompanhar a primeira operação real.

## 2. Skills e ordem obrigatória

Cada lote de rotas seguirá esta sequência:

1. **revenue-centric-design**: definir ICP, estágio de consciência, promessa, prova, ação de valor, ativação, retenção/expansão e métrica.
2. **marcolou-review** — checkpoint 1: revisar arquitetura de informação e copy; fixar uma ideia dominante e uma ação principal.
3. **emil-design-eng**: decidir se cada mudança de estado deve animar, por quê, com que frequência, curva, duração e comportamento de redução de movimento.
4. **marcolou-review** — checkpoint 2: revisar hierarquia visual, demonstração do produto, evidência, números, escolha e memorabilidade.
5. **review-animations**: revisar a especificação/protótipo de motion. Qualquer bloqueio impede handoff.
6. Após implementação futura: repetir `marcolou-review` e `review-animations` na interface real e em dispositivos reais.

## 3. Gates P0 antes de desenhar

1. Escolher o contrato comercial vigente:
   - baseline de 2026-07-16: cinco planos, trials de 14/30 dias e anual por dez mensalidades; ou
   - mudança OpenSpec ainda não implementada: retirada do Individual Básico, trial de 2 dias, implantação e nova cobrança.
2. Não apresentar planos `draft` como publicados nem usar CTA de ativação imediata enquanto checkout/gateway não forem operacionais.
3. Derivar home, `/planos` e checkout do mesmo catálogo versionado. Hoje a home combina preços e limites incompatíveis.
4. Remover ou comprovar alegações como “98/100”, “histórico imutável”, “backups verificados”, SSO/MFA e “mais escolhido”.
5. Fixar nomenclatura canônica de produto e oferta.
6. Definir o ICP dominante da home. Hipótese recomendada: Defesa Civil municipal como narrativa principal; individual como caminho secundário explícito.
7. Reconciliar manifesto de rotas, permissões locais e navegação antes de redesenhar telas que aparentem autoridade inexistente.
8. Definir a baseline visual vigente entre implementação, `docs/ui-final` e testes visuais.

## 4. Princípios transversais

- Preservar separação rigorosa entre público, cliente e staff.
- Nunca usar município textual como autoridade; escopo vem de identidade e organização persistidas.
- Nunca esconder falha, permissão, plano, assinatura ou estado financeiro atrás de animação.
- Não inventar números, depoimentos, comparações, escassez ou popularidade.
- Fazer cada dashboard responder “o que devo fazer agora?”, não apenas exibir métricas.
- Substituir dashboards vazios por próximo passo, exemplo seguro ou orientação contextual.
- Mostrar prova antes do pedido: offline, classificação, evidência, laudo, protocolo e rastreabilidade.
- Tratar expansão no momento contextual do limite, sem interromper operação crítica nem apagar histórico.
- Preservar mapas cognitivos de fluxos muito usados; redesenhar em lotes, não como big bang.
- Status críticos devem usar texto, ícone e estrutura, nunca só cor.

## 5. Matriz de rotas

Os números na última coluna referem-se aos princípios da `marcolou-review`. Cada rota recebe no máximo três.

### Público, identidade e transações

| Rota | Mensagem primária | Ação primária | Marcolou | Direção de motion |
| --- | --- | --- | --- | --- |
| `/` | O TCS conecta a vistoria de risco em campo à decisão auditável da Defesa Civil. | Ver planos e limites | 6, 10, 22 | Demonstração explicativa rara; CTAs e navegação apenas com feedback curto. |
| `/planos` | Escolha capacidade, limites e próximo passo transparentes para seu perfil. | Individual: iniciar acesso publicado; Municipal: solicitar proposta | 12, 16, 28 | Seleção de público/plano curta; preço e condições permanecem estáveis. |
| `/login` | Acesso restrito ao console da equipe TCS. | Entrar no console | 6, 22, 28 | Feedback de envio/erro; sem deslocamento decorativo. |
| `/entrar` | Entre no portal correspondente ao vínculo verificado. | Continuar com a conta | 6, 21, 28 | Transições discretas entre resolução de acesso e resultado. |
| `/criar-conta` | Crie a identidade necessária para acessar seu contrato ou convite. | Criar conta | 6, 21, 28 | Validação progressiva; sucesso curto, sem celebração exagerada. |
| `/recuperar-senha` | Recupere o acesso com segurança. | Enviar link de recuperação | 6, 22, 28 | Request para confirmação com presença curta. |
| `/redefinir-senha` | Defina uma nova senha dentro da sessão de recuperação válida. | Salvar nova senha | 6, 22, 28 | Requisitos e sucesso estáveis; sem motion de força de senha que distraia. |
| `/convite/:token` | Confirme organização, papel e validade antes de aceitar o convite. | Aceitar convite | 6, 21, 28 | Loading/expirado/usado/sucesso com troca de estado curta; nada antes da confirmação do servidor. |
| `/checkout/retorno` | O pagamento foi recebido para verificação; ativação depende do servidor. | Acompanhar status da ativação | 3, 6, 28 | Progresso funcional contido e anunciado; nunca simular ativação. |
| `/ciencia/:token` | Leia o documento correto e registre ciência ou recusa de forma rastreável. | Registrar decisão | 6, 21, 28 | Mudança de etapa/resultado apenas; documento e evidência não se movem. |

### Portal individual

| Rota | Mensagem primária | Ação primária | Marcolou | Direção de motion |
| --- | --- | --- | --- | --- |
| `/portal/individual` | Veja a próxima ação que aproxima sua primeira ou próxima vistoria válida. | Abrir a pendência prioritária | 6, 10, 22 | Skeleton sem reflow; no máximo um stagger curto na primeira ativação. |
| `/portal/individual/vistorias` | Encontre rapidamente a vistoria necessária. | Abrir vistoria | 6, 11, 22 | Filtros e resultados preservam posição; refetch sem reentrada da lista. |
| `/portal/individual/vistorias/:inspectionId` | Entenda estado, risco, evidências e documento desta vistoria. | Abrir/baixar documento disponível | 3, 6, 10 | Continuidade contextual curta; feedback inline de download. |
| `/portal/individual/mapa` | Localize vistorias autorizadas no território. | Selecionar ocorrência/ponto | 6, 10, 22 | Movimento espacial somente na seleção; não animar todos os marcadores. |
| `/portal/individual/agenda` | Saiba o que exige ação e quando. | Abrir compromisso prioritário | 6, 22, 28 | Continuidade por data/filtro; evitar carousel. |
| `/portal/individual/documentos` | Encontre o documento certo e seu estado. | Abrir/baixar documento | 6, 11, 28 | Feedback local de carregamento/download; empty state orientado. |
| `/portal/individual/relatorios` | Transforme vistorias em leitura gerencial quando o plano permitir. | Abrir relatório ou entender limite | 6, 24, 28 | Estado bloqueado permanece inequívoco; sem motion que prometa desbloqueio. |
| `/portal/individual/consumo` | Entenda uso atual, limite e consequência operacional. | Ver ação contextual para o limite | 3, 6, 28 | Barras entram uma vez via transform; alertas permanecem estáveis. |
| `/portal/individual/assinatura` | Entenda plano, cobrança, limites e próximo evento financeiro. | Gerenciar/contratar plano | 12, 16, 28 | Seleção mensal/anual curta; submitting explícito. |
| `/portal/individual/suporte` | Resolva o problema sem perder o contexto da operação. | Abrir chamado | 21, 22, 28 | Expansão funcional do formulário com foco gerenciado; sem auto-scroll brusco. |
| `/portal/individual/perfil` | Controle identidade, conexão e sessões da sua conta. | Salvar alteração contextual | 6, 22, 28 | Confirmação e remoção local curta em sessões. |

### Portal municipal

| Rota | Mensagem primária | Ação primária | Marcolou | Direção de motion |
| --- | --- | --- | --- | --- |
| `/portal/municipal` | Veja risco, pendências e a próxima ação da operação municipal segundo seu papel. | Abrir prioridade operacional | 3, 6, 22 | Skeleton estável; microfeedback em cards, sem números monumentais decorativos. |
| `/portal/municipal/vistorias` | Encontre vistorias dentro do escopo organizacional autorizado. | Abrir vistoria | 6, 11, 22 | Mesma regra de lista do portal individual; escopo não pode desaparecer em transições. |
| `/portal/municipal/vistorias/:inspectionId` | Entenda evidências, risco e documento no contexto municipal correto. | Abrir/baixar documento | 3, 6, 10 | Continuidade curta; ações auditáveis inline. |
| `/portal/municipal/mapa` | Leia a distribuição territorial do risco autorizado. | Selecionar ponto/área | 6, 10, 22 | Pan/zoom e painel interrompíveis; alternativa textual obrigatória. |
| `/portal/municipal/agenda` | Coordene compromissos e pendências da equipe. | Abrir item prioritário | 6, 22, 28 | Continuidade por data/filtro, sem motion exuberante. |
| `/portal/municipal/documentos` | Acesse documentos oficiais do escopo correto. | Abrir/baixar documento | 6, 11, 28 | Estados estáveis; feedback local de download. |
| `/portal/municipal/relatorios` | Converta a operação em indicadores e prestação de contas. | Abrir relatório disponível | 3, 10, 24 | Revelação de insight, não animação de evidência; bloqueio explícito. |
| `/portal/municipal/equipe` | Saiba quem pode fazer o quê e em qual estado. | Gerenciar membro contextual | 6, 21, 28 | Alterações de papel/status com confirmação; evitar reorder brusco. |
| `/portal/municipal/convites` | Convide a pessoa certa para o papel certo com validade explícita. | Criar convite | 6, 22, 28 | Novo item entra somente após confirmação; link/sucesso persistentes. |
| `/portal/municipal/consumo` | Entenda capacidade usada e impacto antes do limite. | Planejar capacidade/expansão | 3, 24, 28 | Interpolação única de barra; alertas estáveis e não pulsantes. |
| `/portal/municipal/assinatura` | Entenda contrato, autoridade, cobrança e continuidade do serviço. | Solicitar/gerenciar ação autorizada | 12, 16, 28 | Clareza de autoridade prevalece; submitting explícito. |
| `/portal/municipal/suporte` | Resolva incidentes preservando organização, urgência e contexto. | Abrir chamado | 21, 22, 28 | Expansão funcional e foco; timeline sem reentrada completa. |
| `/portal/municipal/configuracoes` | Altere dados organizacionais com consequência e estado de salvamento claros. | Salvar alterações | 6, 22, 28 | Dirty/saving/saved explícitos; evitar autosave invisível. |
| `/portal/municipal/perfil` | Controle sua identidade e suas próprias sessões. | Salvar alteração contextual | 6, 22, 28 | Remoção local após confirmação; sem confundir conta com organização. |

### Console interno TCS

| Rota | Mensagem primária | Ação primária | Marcolou | Direção de motion |
| --- | --- | --- | --- | --- |
| `/app` | Owner vê prioridades de negócio; developer vê saúde técnica real. | Abrir a prioridade do papel | 3, 6, 22 | Remover entrada repetida de 500 ms; dados críticos aparecem estáveis. |
| `/app/clientes` | Encontre o cliente e sua próxima pendência de implantação/operação. | Abrir cliente | 6, 11, 22 | Filtros/linhas com mudanças discretas; sem animar width de barras. |
| `/app/clientes/:customerId/:section?` | Mantenha todo o contexto do cliente ao navegar entre operação, uso, assinatura e suporte. | Executar a ação da seção | 6, 11, 22 | Tabs preservam barra contextual e URL; ações de risco sem celebração. |
| `/app/clientes/:customerId/usuarios/:userId/:userSection?` | Investigue o agente sem perder cliente, escopo ou evidência. | Abrir a seção necessária | 6, 11, 22 | Tabs/mapa/filtros preservam estado; confirmação de acesso é estável. |
| `/app/planos` | Edite e publique um catálogo versionado e auditável. | Validar/publicar versão | 3, 6, 28 | Dirty/validation/publish explícitos; confirmação curta. |
| `/app/assinaturas` | Entenda estado comercial e próxima ação de cada contrato. | Abrir assinatura/ação pendente | 3, 6, 22 | Mudança de status auditável no conteúdo, nunca apenas toast. |
| `/app/sessoes` | Veja dispositivos e encerre somente a sessão correta. | Encerrar sessão selecionada | 6, 21, 28 | Remoção após confirmação; lista não salta. |
| `/app/suporte` | Priorize e resolva tickets com contexto do cliente. | Abrir ticket prioritário | 6, 21, 22 | Continuidade master-detail e seleção persistente. |
| `/app/staff` | Controle papéis internos e ações de alto risco. | Gerenciar membro selecionado | 6, 21, 28 | Confirmação e feedback persistentes; sem reordenação decorativa. |
| `/app/auditoria` | Encontre evidência confiável de quem fez o quê e quando. | Inspecionar evento | 3, 6, 10 | Continuidade timeline-inspector; logs/evidência nunca animados. |
| `/app/desenvolvimento/versoes` | Saiba o que está em draft, publicado e ativo. | Validar/publicar versão | 3, 6, 28 | Estados explícitos; transição curta somente após confirmação. |
| `/app/desenvolvimento/builds` | Acompanhe o estágio real do pipeline e intervenha com segurança. | Abrir build/ação necessária | 3, 6, 10 | Motion funcional por estágio real; sem loops decorativos. |
| `/app/desenvolvimento/formularios` | Gerencie versões sem confundir rascunho e produção. | Validar/publicar formulário | 6, 11, 28 | Save/publish explícitos; diff estável. |
| `/app/desenvolvimento/regras-risco` | Altere regras críticas com validação e rastreabilidade. | Validar/publicar regra | 6, 21, 28 | Diferenças e erros ficam estáveis; nada é suavizado a ponto de ocultar risco. |
| `/app/desenvolvimento/sincronizacao` | Encontre eventos de sync que exigem ação. | Inspecionar evento | 3, 6, 22 | Refresh controlado; sem reorder animado excessivo. |
| `/app/desenvolvimento/armazenamento` | Encontre eventos de storage que exigem ação. | Inspecionar evento | 3, 6, 22 | Severidade prevalece; chegada de eventos discreta. |
| `/app/desenvolvimento/logs` | Diagnostique erros reais sem métricas simuladas nem PII desnecessária. | Inspecionar erro | 3, 6, 22 | Streaming pausável; nada piscando; reduced motion obrigatório. |
| `/app/governanca/configuracoes` | Veja estado do sistema, integrações e atalhos operacionais. | Abrir configuração/diagnóstico | 6, 11, 22 | Mudanças de status discretas; links claros. |
| `/app/governanca/arquivamento` | Arquive/restaure com lifecycle, justificativa e aprovação inequívocos. | Iniciar ação protegida | 6, 21, 28 | Comunicar lifecycle; item só muda após servidor/two-person approval. |
| `/app/referencia-ui` | Validar componentes, tokens, estados e motion antes do rollout. | Executar checklist de homologação | 6, 11, 22 | Laboratório canônico de curvas, durações e redução de movimento. |

## 6. Contrato de motion proposto por emil-design-eng

### Decisão por frequência

| Frequência | Regra TCS |
| --- | --- |
| 100+ vezes/dia ou teclado | Sem animação. |
| Dezenas de vezes/dia, como navegação, tabs, filtros e hover | Remover movimento ou reduzir a feedback de 100-160 ms. |
| Ocasional, como dialog, drawer, toast e mudança de etapa | 150-250 ms; até 300 ms quando justificado. |
| Rara, como primeira ativação concluída | Delight contido e proporcional ao esforço; nunca em ações de risco. |

### Tokens candidatos para prototipação

- `ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)`.
- `ease-in-out`: `cubic-bezier(0.77, 0, 0.175, 1)`.
- drawer: `cubic-bezier(0.32, 0.72, 0, 1)`.
- Press feedback: 100-160 ms, escala 0.97-0.98.
- Tooltip/popover pequeno: 125-200 ms.
- Select/dropdown: 150-250 ms.
- Dialog/drawer: 200-300 ms no TCS; maior só com justificativa testada.
- Entradas: nunca partir de `scale(0)`; usar 0.95-0.97 com opacidade quando escala for necessária.
- Animar somente `transform` e `opacity`; barras usam transform, não width.
- Popovers nascem do trigger; modais permanecem centrados.
- Toda movimentação tem alternativa em `prefers-reduced-motion`.
- Hover com movimento só sob `(hover: hover) and (pointer: fine)`.

## 7. Follow-up review-animations do baseline atual

### Parte 1 — Findings

| Before | After | Why |
| --- | --- | --- |
| `transition-all` no botão base (`dashboard/src/components/ui/Button.tsx:8`) | Transições explícitas de `transform`, cor, background e border; `transform` 150 ms com curva forte | `all` permite animar propriedades não pretendidas e torna o contrato imprevisível. |
| `transition-all` nas tabs (`dashboard/src/components/ui/Tabs.tsx:7`) | Apenas propriedades visuais necessárias; troca de conteúdo instantânea ou muito curta | Tabs são usadas dezenas de vezes; motion excessivo atrasa navegação. |
| `transition-all` no progresso (`dashboard/src/components/ui/Progress.tsx:5`) | `transform` com duração/curva explícitas | A implementação já move por transform, mas `all` deixa futuras propriedades escaparem. |
| `transition-[width]` da sidebar (`dashboard/src/components/layout/AppSidebar.tsx:42`) | Remover a animação ou prototipar composição por transform/clip sem relayout | Animar width força layout e afeta toda a página; há correção GPU possível. |
| `transition-all` + `hover:scale-105` sem gate (`dashboard/src/components/layout/AppSidebar.tsx:66`) | `transform`/cores explícitos e hover de movimento apenas para pointer fino, ou remover escala | Hover de controle recorrente não precisa de delight e touch pode gerar falso hover. |
| Quatro entradas `duration-500` em cascata (`dashboard/src/pages/DashboardHome.tsx:122,132,154,180`) | Remover no acesso diário; reservar stagger de 30-80 ms para primeira experiência rara | 500 ms excede o orçamento de UI e bloqueia percepção de prontidão em rota frequente. |
| Barra com `transition-all duration-300` e `width` (`dashboard/src/pages/CustomersPage.tsx:319-320`) | Barra por transform, abaixo de 300 ms, somente quando a mudança ajuda leitura | Width dispara layout/paint; 300 ms é o limite, não o padrão. |
| `.action-item` com `transition-all` e `hover:translate-x-1` (`dashboard/src/index.css:271-274`) | `transition-colors` ou movimento removido/gated | Links recorrentes devem parecer rápidos; movimento de hover é dispensável. |
| Drawer com easing built-in (`dashboard/src/components/ui/Sheet.tsx:12`) | Curva drawer `cubic-bezier(0.32, 0.72, 0, 1)` e duração explícita | Curva forte comunica resposta imediata e coesão. |
| Select sem origem/duração explícitas (`dashboard/src/components/ui/Select.tsx:13`) | Origem derivada do trigger, 150-200 ms, `scale(0.97)` + opacidade | Popover deve nascer do trigger e a física precisa ser intencional. |

### Parte 2 — Verdict

**Feel-breaking regressions:** a entrada em cascata de 500 ms no dashboard diário deve ser removida ou drasticamente reduzida.

**Missed simplifications:** tabs, ações rápidas e hover da sidebar recebem mais movimento do que a frequência justifica.

**Performance:** animação de width na sidebar e na barra de implantação; múltiplos `transition-all`.

**Origin, physicality & cohesion:** select/drawer não têm contrato explícito de origem, curva e duração.

**Accessibility:** existe uma base global em `dashboard/src/index.css:292-300`; ela deve virar critério testado por componente e o hover móvel precisa de gate.

**Decisão: Block.** Não adicionar novas animações até corrigir o contrato de propriedades GPU, frequência, durações, origem e hover. Este bloqueio é para o futuro handoff de motion, não uma autorização para editar agora.

## 8. Fases de trabalho depois da aprovação

### Fase 0 — verdade comercial e governança

- Resolver todos os gates P0.
- Produzir um contrato único de planos/limites/CTAs.
- Produzir registro de alegações com fonte, data, escopo e permissão de publicação.
- Corrigir o plano de permissões e navegação em nível de especificação.

### Fase 1 — pesquisa, métricas e baseline

- Definir ICP/awareness por entrada pública.
- Definir ativação: vistoria válida sincronizada + documento; ativação municipal colaborativa.
- Definir TTV, activation rate, D7/D30, conclusão de convite, checkout confirmado pelo servidor, abertura de documento, resolução de suporte e adoção de módulos.
- Registrar baselines visuais e de estado por rota e viewport.
- Rodar cinco entrevistas quando volume não sustentar A/B test.

### Fase 2 — fundações

- IA por produto e papel.
- Tokens visuais e semânticos.
- Contrato de motion e reduced motion.
- Estados loading/empty/error/retry/permission/plan/subscription uniformes.
- Componentes de evidência, ação crítica, contexto do cliente e status auditável.
- Homologar primeiro em `/app/referencia-ui`.

### Fase 3 — aquisição pública

- Redesenhar `/` e `/planos` depois do contrato comercial.
- Testar entendimento em cinco segundos, segmentação Individual/Municipal, CTA e comparação.
- Definir SEO/OG específicos por rota.
- Checkpoints `marcolou-review`, `emil-design-eng` e `review-animations`.

### Fase 4 — identidade e fluxos transacionais

- `/login`, `/entrar`, `/criar-conta`, recuperação, convite, retorno de checkout e ciência documental.
- Priorizar confiança, explicação de estado e continuidade do servidor.
- Testar teclado, leitor de tela, foco, expiração e falhas.

### Fase 5 — portal individual

- Overview e ativação primeiro; depois vistorias/detalhe/mapa/agenda; depois documentos/relatórios/consumo; por fim assinatura/suporte/perfil.
- Não transformar o portal Web em substituto implícito da captura de campo mobile.

### Fase 6 — portal municipal

- Overview por papel; vistorias/mapa/agenda; equipe/convites; documentos/relatórios/consumo; assinatura/suporte/configurações/perfil.
- Homologar isolamento organizacional, autoridade e fluxos de coordenador/supervisor/agente.

### Fase 7 — console owner

- `/app`, clientes e contexto do cliente primeiro.
- Em seguida planos, assinaturas, sessões, suporte, staff e auditoria.
- Ações de alto risco exigem justificativa, MFA/AAL2 quando aplicável e confirmação server-side.

### Fase 8 — console developer e governança

- Versões/builds/formulários/regras de risco.
- Sync/storage/logs com refresh e streaming controlados.
- Configurações/arquivamento com lifecycle e aprovação explícitos.

### Fase 9 — revisão e rollout

- Revisões finais por skill.
- QA visual em viewports do manifesto, teclado, foco, WCAG AA, texto ampliado, mapas e reduced motion.
- Testes de motion em slow motion/frame a frame e dispositivo real.
- Rollout por superfície e papel, com métricas e rollback; nunca big bang.

## 9. Critérios de aceite do plano

- Todas as rotas ativas estão atribuídas a uma fase, mensagem, ação e política de motion.
- Nenhum preço, limite, prova ou controle de segurança aparece sem fonte vigente.
- Cada rota tem um único objetivo dominante e uma métrica de sucesso.
- Toda animação futura registra frequência, propósito, propriedades, curva, duração, interruptibilidade e reduced motion.
- `review-animations` termina em Approve antes do handoff.
- `marcolou-review` não contém P0/P1 sem decisão ou hipótese de validação.
- A segurança e autoridade do servidor continuam verdadeiras mesmo que a UI falhe ou seja manipulada.

## 10. Fora do escopo até decisão explícita

As telas sem rota ativa não entram no redesign: `AgendamentosPage.tsx`, `CommercialMetricsPage.tsx`, `LaudosPage.tsx`, `MapaPage.tsx`, `OcorrenciasPage.tsx`, `OrganizationsPage.tsx`, `PlaceholderPage.tsx`, `RelatoriosPage.tsx` e `UsuariosPage.tsx`.

## 11. Fontes canônicas para a próxima sessão

- Rotas: `dashboard/src/App.tsx`, `dashboard/src/PrivateApp.tsx`, `dashboard/src/PortalApp.tsx`.
- Manifesto: `dashboard/design/route-manifest.mjs`.
- Propósito e restrições: `CONTEXT.md`, `PDR.md`, `README.md`, `README.CLIENT.md`.
- Contrato comercial atual: `docs/planos-comerciais-aprovados.md`.
- Mudança comercial planejada: `openspec/changes/evoluir-comercializacao-autenticacao-e-governanca/`.
- Portais: `openspec/changes/criar-portal-clientes-individual-municipal/`.
- Console: `openspec/changes/reformular-dashboard-interno-donos-programadores/`.
