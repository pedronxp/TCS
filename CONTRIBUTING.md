# Contribuindo com o TCS

O fluxo padrão é **issue → branch → pull request → validações → merge**. Mudanças diretas na `main` devem ser evitadas.

## 1. Planejar

Abra uma issue para bugs, melhorias e tarefas. Defina problema, escopo e critérios de aceite. Nunca publique credenciais, tokens, documentos pessoais ou dados operacionais sensíveis.

## 2. Implementar

Crie uma branch curta a partir da `main` atualizada:

```text
feat/nome-da-entrega
fix/nome-do-problema
chore/nome-da-manutencao
```

Mantenha commits pequenos e relacionados à issue. Correções devem incluir teste de regressão sempre que possível.

## 3. Validar

Antes do pull request, execute as verificações relevantes:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Para mudanças no dashboard:

```bash
cd dashboard
npm test
npm run build
npm run test:visual
```

Mudanças no banco devem incluir migration, validação RLS e testes pgTAP aplicáveis.

## 4. Revisar e entregar

Abra um pull request usando o template, relacione a issue com `Closes #número` e aguarde as verificações obrigatórias. Resolva todas as conversas antes do merge. A `main` não permite force-push ou exclusão.

Vulnerabilidades devem ser relatadas de forma privada em **Security → Advisories**, nunca em uma issue pública.
