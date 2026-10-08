# Code Review — TCS

O fluxo padrão continua em [CONTRIBUTING.md](../CONTRIBUTING.md) (issue → branch → PR → validações → merge).
Este guia define o que **autor** e **revisor** verificam. O objetivo: **PR pequeno, diff mínimo, mudança rastreável**.

## Regras de ouro

1. **Um PR = um assunto.** Bug, feature ou chore — nunca os três juntos. Passou de ~400 linhas de diff relevante? Fatie em PRs menores.
2. **Proibido "drive-by".** Não misturar refactors cosméticos, renomeações ou formatação com correção funcional.
3. **O diff mostra só o que mudou de verdade.** Nenhuma linha é reescrita sem motivo ligado à issue.
4. **Migration nova nunca edita migration antiga.** Sempre adiciona; correção de função usa `CREATE OR REPLACE` completo no arquivo novo.
5. **PR sem contexto não é revisado.** Título + descrição dizem o problema e a solução em 3 linhas.

## Checklist do autor (antes de abrir o PR)

- [ ] Cada linha alterada tem motivo direto ligado à issue (nada de "já que estava aqui…")
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm test -- --runInBand` verde (app); `cd dashboard && npm test` quando afetado
- [ ] Correção de bug inclui **teste de regressão** — ou justifica por que não se aplica
- [ ] Mudança de banco: migration idempotente + RLS revisada + dados existentes preservados
- [ ] Mudança visual ou de fluxo: evidência (captura/vídeo) **sem dados sensíveis**
- [ ] Comportamento visível ao usuário documentado no PR (changelog na release)

## Checklist do revisor (antes do approve)

- [ ] O PR faz o que o título diz — **e só isso**
- [ ] Casos de erro e **offline** tratados (o app é usado em campo, sem sinal)
- [ ] Sem segredos, tokens, dados pessoais ou logs de produção no diff
- [ ] RPC `SECURITY DEFINER` revisada: permissão checada, `REVOKE` de `anon/authenticated`, `search_path` travado
- [ ] Strings de UI em pt-BR coerentes com o produto; nenhuma palavra nova sem necessidade
- [ ] Auditoria/justificativa preservada em ações sensíveis (mudar papel, bloquear, publicar)
- [ ] Rollback é um `revert` simples? Se não, o PR explica como voltar

## Risco define o revisor

| Risco | Exemplos | Revisores |
|---|---|---|
| Alto | migrations, RLS, auth, RPC `SECURITY DEFINER`, cobrança | owner + 1 dev sênior |
| Médio | telas do console, sync, PDFs, permissões | 1 dev |
| Baixo | textos, estilos, docs, testes | qualquer revisor |

## Sinais de alerta (peça mudanças)

- Approve "pelo CI verde" sem ler o diff
- PR que toca 10+ arquivos "só pra organizar"
- `TODO`/`FIXME` novo sem issue vinculada
- Teste que mocka tudo e valida nada
- Migration que depende de estado anterior do banco sem guard
