# Visibilidade do portal Profissional e acesso interno

## Objetivo

Corrigir o acesso do plano Individual Profissional aos registros já sincronizados e aos relatórios, direcionar contas internas ao Console TCS, permitir a leitura dos termos no onboarding e disponibilizar filtros de formulário nos mapas web e móvel.

## Problema confirmado

As três vistorias de Cataguases já existem no banco, estão sincronizadas e possuem coordenadas. O portal individual as oculta porque a função `portal_get_workspace` foi reduzida a uma resposta exclusiva para suporte. Além disso, a tela de relatórios procura a chave `reports`, enquanto o plano Profissional libera `reports_basic` e `reports_advanced`.

As contas internas também mantêm um perfil legado de cliente. O fluxo web prioriza esse perfil e encaminha a pessoa para o onboarding, em vez de respeitar o vínculo interno ativo.

## Decisões

1. A consulta de workspace voltará a atender `vistorias`, `mapa`, `documentos` e `relatorios`, além de preservar a consulta detalhada de `suporte` existente. Ela continuará a aplicar o escopo da pessoa autenticada, sem expor registros de outra organização.
2. O portal Profissional considerará relatórios liberados quando possuir `reports`, `reports_basic` ou `reports_advanced`.
3. Perfis internos ativos de `owner`, `developer`, `support` e `auditor` terão prioridade sobre um eventual perfil legado de cliente e seguirão para o Console TCS. Eles não entrarão no onboarding individual.
4. Os Termos de Uso e a Política de Privacidade serão links separados no texto de aceite. Cada link abrirá o conteúdo integral em diálogo acessível antes da confirmação.
5. Os mapas web e móvel terão um filtro de formulário, iniciado em “Todos os formulários”. O filtro será combinado com a busca e o filtro de status já existentes.
6. A identificação visual seguirá o padrão já aprovado no app: bueiro/drenagem, incêndio em vegetação, alagamento/inundação e árvore recebem seus ícones próprios; edifício, deslizamento, ponte e passarela mantêm o ícone atual.

## Fluxo de dados

O banco devolverá, para cada item de mapa e vistoria, o identificador do formulário além dos campos existentes. O cliente web e o aplicativo agrupam os registros disponíveis para montar o seletor, e aplicam o filtro localmente. Não haverá nova criação ou reenvio das três vistorias existentes: corrigir a leitura do workspace basta para exibi-las.

## Tratamento de erros e segurança

O acesso ao workspace continua dependente do usuário autenticado e do escopo individual ou municipal já aplicado no banco. Um perfil interno não usará o portal de cliente como alternativa ao Console. Quando não houver registros para o filtro selecionado, o mapa exibirá um estado vazio explícito em vez de ocultar a falha.

## Testes de aceitação

- Uma conta Individual Profissional com vistorias sincronizadas vê as mesmas vistorias em Vistorias, Mapa, Documentos e Relatórios do portal web.
- A aba Relatórios deixa de bloquear o plano Profissional que possui relatórios básicos ou avançados.
- Contas internas ativas de desenvolvimento e suporte abrem o Console TCS, não a etapa de onboarding.
- O aceite permite abrir e ler cada documento de termos antes de aceitar.
- A seleção de um formulário limita os pontos e a lista no mapa web e móvel, preservando os ícones corretos.
- Os testes existentes de sincronização e os novos testes de regressão permanecem verdes.
