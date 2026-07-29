# Contribuindo com o console web

## Fonte de verdade

Antes de alterar uma rota, localize seu board no projeto Penpot `TCS — Web Dashboard`. Estrutura, copy, tokens, densidade e breakpoints devem seguir o board aprovado. Diferenças necessárias por dados reais, segurança ou acessibilidade precisam ser documentadas.

## Composição

- Use primitivas de `src/components/ui` e componentes de domínio/layout existentes.
- Use tokens semânticos de `src/index.css`; não adicione cores Tailwind literais em páginas.
- `CardTitle` representa uma seção de página (`h2`). Preserve a sequência semântica de títulos.
- Consultas devem ter loading, vazio, erro e retry por meio de `AsyncBoundary`.
- Operações críticas usam `HighAssuranceDialog`, justificativa, MFA e autorização server-side.
- Não coloque segredos, service role, URLs privadas de arquivo ou metadados sensíveis no bundle.

## Dados e Supabase

Uma migração visual não altera contratos. Quando um contrato novo for necessário:

1. crie migration aditiva e RPC com autorização explícita;
2. ative RLS e defina grants mínimos;
3. use `SECURITY DEFINER` apenas com `search_path = ''`, checagem de `auth.uid()`/permissão e revogação de `PUBLIC`;
4. teste cenários permitidos e negados;
5. documente publicação e rollback.

## Gate de uma rota

Antes do merge:

```bash
cd dashboard
npm run design:validate
npm run lint
npm run test
npm run test:visual
npm run build
```

O manifesto executável está em `design/route-manifest.mjs`. Toda rota nova deve ser adicionada nele antes da implementação. Templates, campos obrigatórios, exceções e checklist completo estão em `../docs/ui-route-governance.md`.

Valide 1440, 1024, 768 e 390 px, sem overflow ou ação inacessível. Execute axe, navegação por teclado, foco visível, zoom/fontes ampliadas e movimento reduzido. Para arquivamento/restauração, execute também na raiz:

```bash
npm run test:archive-restore
```

As referências de todas as rotas ficam em `tests/visual/__screenshots__`. Rotas internas usam somente a sessão e as respostas isoladas de `tests/visual/authenticated-fixture.ts`. Atualize as imagens com `npm run test:visual:update` apenas após comparação com o Penpot e registre a aprovação na revisão. Não adicione bypass de autenticação, credenciais ou dados privilegiados ao código da aplicação.

Aliases e componentes antigos só podem ser removidos depois que todas as rotas consumidoras forem aprovadas e o período de rollback terminar.
