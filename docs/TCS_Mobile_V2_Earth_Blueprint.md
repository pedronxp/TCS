# TCS Mobile V2 Earth — Blueprint de produto e interface

## Objetivo

Redesenhar o aplicativo TCS como uma experiência mobile-first para operação de Defesa Civil, preservando o contrato atual do back-end, o comportamento offline-first e o controle de acesso por papel.

O conceito visual usa preto, branco, bege e marrom-claro como base. As cores verdes, amarelas, laranjas e vermelhas aparecem somente em estados operacionais e níveis de risco R1–R4.

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `ink` | `#171411` | cabeçalhos, navegação e alto contraste |
| `ink-2` | `#2B241F` | superfícies escuras secundárias |
| `paper` | `#FFFCF7` | fundo principal |
| `sand` | `#F4EBDD` | superfícies suaves e estados selecionados |
| `sand-2` | `#E9DCC9` | divisores e fundos auxiliares |
| `camel` | `#CBB38E` | destaque de marca |
| `brown` | `#9A7950` | ações secundárias e informação contextual |
| `brown-deep` | `#5A402E` | ação primária |
| `line` | `#DED1BE` | bordas e separadores |
| `muted` | `#766B60` | textos auxiliares |

Semântica de risco: R1 `#3E6B56`, R2 `#8D7A32`, R3 `#C26A2E`, R4 `#A13C34`. O estado offline usa `#B5792C`.

## Navegação por papel

### Agente

- Início: KPIs pessoais, nova vistoria, agenda e fila offline.
- Vistorias: histórico, filtros, busca, detalhes, fotos, laudo e compartilhamento.
- Mapa: ocorrências e vistorias georreferenciadas, filtros R1–R4 e rota externa.
- Módulos: assinatura, agendamentos, treinamento, suporte e perfil.
- Fluxo de vistoria: dados iniciais, GPS/CEP, seleção de formulário, wizard, foto, cálculo de risco, resultado, relatório editável e laudo PDF.

### Supervisor

- Início: visão da operação municipal, risco alto, vistorias do dia e agentes ativos.
- Vistorias e mapa tático.
- Equipe: agentes, desempenho, detalhe individual e grupos.
- Agendamentos: distribuição e acompanhamento de tarefas.
- Módulos: assinatura, grupos, perfil, treinamento e suporte.

### Administrador municipal

- Início: KPIs municipais, distribuição R1–R4, ranking e atividade recente.
- Mapa e relatórios.
- Usuários: aprovação, suspensão e papéis.
- Equipe e grupos.
- Tokens: lista, geração e expiração.
- Estatísticas, inspeções, formulários, editor de perguntas, regras de risco, protocolo documental e logs municipais.
- Assinatura, planos, coordenação, treinamento, suporte e perfil.

### Master admin

- Início: KPIs globais, municípios críticos, contratos e uso da rede.
- Contratações, municípios, equipe global, inspeções, relatórios, usuários, tokens, mapa global, estatísticas e logs de sistema.
- Treinamentos, assinatura, planos, coordenação, suporte e perfil.

### Console interno em modo companion

Os papéis `owner` e `developer` continuam com o console web como superfície principal. A versão mobile pode oferecer um modo companion somente para consulta e resposta rápida:

- Owner: visão executiva, clientes, suporte, planos, assinaturas, sessões, equipe interna, auditoria, builds, configurações e arquivamento.
- Developer: saúde técnica, clientes, suporte, versões, builds, formulários, regras de risco, sincronização, armazenamento, logs e auditoria.
- Ações destrutivas, publicação de configuração e mudanças de acesso exigem confirmação reforçada.

## Padrão de dashboard

1. Cabeçalho com data, saudação, município/organização, papel e avatar.
2. Banner de conectividade apenas quando necessário; nunca bloqueia o uso.
3. Três ou quatro KPIs clicáveis, adequados ao papel.
4. Uma ação principal destacada.
5. Alertas priorizados por severidade e prazo.
6. Lista curta de atividade recente com acesso ao detalhe.
7. Navegação inferior com quatro destinos estáveis.

## Responsividade

- Compacto, 360–430 px: navegação inferior, cards em uma ou duas colunas e detalhes em telas dedicadas.
- Médio, 600–839 px: navigation rail e layouts mestre-detalhe quando houver espaço.
- Expandido, 840 px ou mais: rail persistente, conteúdo central e painel contextual lateral.
- Toques têm no mínimo 44 × 44 pt; componentes críticos não dependem apenas de cor.

## Estados obrigatórios

- carregando, vazio, erro, sem permissão, offline, sincronizando, sincronizado e conflito;
- risco R1–R4 com rótulo textual;
- agendamento pendente, confirmado, em andamento, concluído e cancelado;
- usuário pendente de aprovação, ativo e suspenso;
- token ativo, usado e expirado;
- assinatura ativa, em carência, suspensa e expirada.

## Contratos de produto preservados

- Município sempre vem do perfil autenticado.
- Perfis: `agent`, `supervisor`, `admin`, `master_admin`.
- Acesso administrativo e master permanece protegido pela guarda de rota.
- Vistorias continuam offline-first e sincronizam quando a conexão retorna.
- Mapas usam OpenStreetMap/Leaflet.
- Fotos permanecem comprimidas antes do armazenamento.
- Logs municipais e logs de sistema mantêm escopos separados.
- Nenhuma tela solicita CPF.
