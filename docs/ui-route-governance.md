# Governança de rotas e design da TCS Console

O manifesto executável está em `dashboard/design/route-manifest.mjs`. Ele é a fronteira entre roteamento, autorização, templates visuais e aprovação no Penpot. Toda rota pública, autenticada ou alias precisa possuir uma entrada antes do merge.

## Templates operacionais

Os templates abaixo são contratos de composição derivados dos boards existentes. Um novo board pode especializar o template, mas não remover seus estados, acessibilidade ou breakpoints obrigatórios.

| Template | Estrutura obrigatória | Uso |
| --- | --- | --- |
| `public-page` | layout público, hero, prova de valor, CTA e rodapé | Comercial e páginas públicas futuras |
| `authentication` | composição editorial, formulário, erro, carregamento e retorno autenticado | Login e recuperação futura |
| `dashboard` | cabeçalho, releases/contexto, métricas, atenção e atalhos | Visões owner e developer |
| `listing` | cabeçalho, métricas, toolbar, tabela/lista e paginação | Clientes, assinaturas, sessões e equipe |
| `context-detail` | contexto persistente, filtros compartilhados, módulos/abas e ações auditáveis | Cliente, agente e suporte |
| `timeline` | filtros, sequência cronológica, detalhe sanitizado e estados vazios | Auditoria |
| `editor` | versão atual, edição, pré-visualização, validação e publicação/rollback | Planos, versões, formulários e risco |
| `settings` | grupos de configuração, origem do valor, alteração pendente e publicação segura | Configurações |
| `technical-operation` | resumo de saúde, filtros específicos, eventos/fila e ações operacionais | Builds, eventos e arquivamento |
| `design-reference` | tokens, variantes, estados e componentes compartilhados | `/app/referencia-ui` |

Os nove templates foram materializados na página `23 · Templates operacionais`. O Dashboard técnico e o Detalhe do agente possuem referências responsivas aprovadas nas páginas 24 e 25.

O pacote `dashboard/design/penpot-handoff.mjs` registra a especificação validada e o estado aprovado desses boards; consulte `docs/penpot-handoff.md`.

## Campos obrigatórios do manifesto

- `id`: identificador estável e único.
- `path`: caminho absoluto usado pelo React Router.
- `audience`: papéis ou audiência autorizada.
- `permission`: permissão mínima; `null` apenas para superfícies públicas.
- `template`: um dos templates operacionais documentados.
- `penpot`: página/board de origem ou herança explícita.
- `states`: estados assíncronos, sucesso e permissão aplicáveis.
- `breakpoints`: sempre `1440`, `1024`, `768` e `390`.
- `approvalStatus`: `approved`, `pending-penpot` ou `inherited`.
- `visualBaselines`: capturas versionadas quando disponíveis.

## Gates automáticos

`npm run design:validate` executa dois controles:

1. `validate-route-manifest.mjs` compara as rotas declaradas em `App.tsx` e `PrivateApp.tsx` com o manifesto. Uma rota sem entrada, uma entrada órfã ou a ausência de `/app/referencia-ui` falha.
2. `validate-design-governance.mjs` bloqueia novas cores Tailwind literais e o crescimento de primitivas HTML paralelas nas páginas migradas.

Após a aprovação prevista no item 9.8 do OpenSpec, o editor versionado de Planos foi migrado para tokens semânticos e o `HighRiskDialog` passou a usar apenas componentes compartilhados. O gate não mantém mais exceções de cores literais ou primitivas paralelas nesses dois pontos.

Os gates são executados automaticamente antes de `npm test` e `npm run build`.

## Checklist de criação ou alteração de rota

Antes de implementar:

- escolher um template;
- criar board no Penpot ou registrar uma derivação aprovada;
- adicionar a rota ao manifesto com permissão, estados e breakpoints;
- confirmar quais dados reais sustentam cada indicador e ação;
- definir comportamento de loading, vazio, erro, retry, sucesso e permissão negada.

Durante a implementação:

- usar tokens semânticos e componentes compartilhados;
- preservar autorização server-side, filtros de URL e contratos de dados;
- manter ações críticas com justificativa, MFA e auditoria quando aplicável;
- oferecer alternativa textual para informação exclusivamente visual;
- não adicionar cores literais ou primitivas paralelas sem exceção documentada.

Antes do merge:

- comparar 1440 px lado a lado com o board;
- validar 1024, 768 e 390 px sem overflow ou ações inacessíveis;
- executar teclado, acessibilidade automatizada e contraste;
- executar `npm run design:validate`, `npm run lint`, `npm test` e `npm run build`;
- registrar capturas de regressão visual e atualizar `visualBaselines`;
- atualizar `approvalStatus` somente depois da aprovação visual.

## Regressão visual automatizada

O Playwright compara Comercial, Login e as 21 composições internas em 1440, 1024, 768 e 390 px por meio de 92 referências versionadas em `dashboard/tests/visual/__screenshots__`. O ensaio também falha em caso de erro de console, erro de página ou overflow horizontal. A fonte Inter é empacotada localmente para tornar as capturas reproduzíveis.

```bash
cd dashboard
npm run test:visual
```

O job `dashboard-visual-regression` executa essas comparações no pipeline e publica relatório, diferenças e traces quando houver falha. As referências podem ser regeneradas com `npm run test:visual:update` somente após comparação com o board correspondente e aprovação visual.

As rotas internas usam uma sessão owner/developer e respostas Supabase determinísticas instaladas exclusivamente pelo Playwright em `dashboard/tests/visual/authenticated-fixture.ts`. A fixture usa domínio inválido, não contém credenciais e não altera `AuthProvider`, `ProtectedRoute` ou o bundle de produção. O manifesto exige uma referência automatizada para cada rota canônica e falha se qualquer arquivo de breakpoint estiver ausente.
