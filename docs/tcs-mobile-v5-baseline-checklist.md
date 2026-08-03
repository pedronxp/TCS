# TCS Mobile V5 — Checklist de baseline

Data: 2026-08-01  
Resultado: **APROVADO PARA INICIAR A IMPLEMENTAÇÃO APÓS REVISÃO DO CHECKLIST**.

Este documento encerra a Fase 0. Nenhuma implementação do redesign foi iniciada.

## 1. Identificação do projeto

- Aplicativo: `app_defesa_civil_expo`.
- Versão atual: `1.3.20`.
- Branch observada: `main`.
- Node.js: `24.16.0`.
- npm: `11.13.0`.
- Expo CLI: `54.0.26`.
- Telas de rota: 54.
- Layouts Expo Router: 4.
- Total de arquivos TSX em `app`: 58.

## 2. Checklist concluído

- [x] Design V5 finalizado no Penpot.
- [x] Todas as 54 rotas atuais mapeadas.
- [x] Seis perfis representados no design.
- [x] Android e iOS documentados no painel N01.
- [x] Plano técnico de implementação registrado.
- [x] Branch atual identificada.
- [x] Alterações locais existentes identificadas e preservadas.
- [x] TypeScript executado sem erros.
- [x] Suíte Jest executada com cache limpo.
- [x] 29 suítes Jest aprovadas.
- [x] 210 testes Jest aprovados.
- [x] Migrações de assinatura validadas em banco local temporário.
- [x] Detalhe operacional do agente validado em banco local temporário.
- [x] Arquivamento e restauração validados em banco local temporário.
- [x] Guards e redirects de rota aprovados pela suíte existente.
- [x] Fluxos de sincronização aprovados pela suíte existente.
- [x] Geração de laudo e integridade documental aprovadas pela suíte existente.
- [x] Nenhum arquivo de código do app foi modificado pela Fase 0.

## 3. Resultados das validações

### TypeScript

Comando:

```bash
npx.cmd tsc --noEmit
```

Resultado: **aprovado, zero erros**.

### Jest

Comando final:

```bash
npm.cmd test -- --runInBand --no-cache
```

Resultado:

- 29 suítes aprovadas;
- 210 testes aprovados;
- 0 testes com falha;
- 0 snapshots com falha.

Uma primeira execução reutilizou um cache antigo do Jest e apontou uma expectativa que já havia sido removida do arquivo de teste. A execução isolada e a suíte completa com `--no-cache` passaram. Isso foi classificado como cache local, não como defeito do código atual.

### Testes locais de banco e segurança

```bash
npm.cmd run test:subscription-migration
npm.cmd run test:agent-detail
npm.cmd run test:archive-restore
```

Resultados:

- catálogo, contratação e ativação de assinatura aprovados;
- escopo, paginação, mapa sensível e mutações do detalhe do agente aprovados;
- MFA, permissão, idempotência, dupla aprovação, transação e auditoria de restauração aprovados.

Os três scripts usam bancos PGlite temporários e não modificaram o ambiente remoto.

## 4. Teste conscientemente não executado

- [ ] `test:subscription-concurrency`.

Motivo: exige duas contas remotas de teste e consome a última unidade de uma assinatura fixture. Não é seguro executá-lo sem preparar novamente os dados remotos.

Impacto: **não bloqueia a Fase 1 do redesign**, que altera tokens e componentes sem modificar assinatura, banco ou concorrência. Esse teste deve ser executado antes de uma entrega que altere consumo de assinatura.

## 5. Alterações locais protegidas

O worktree já estava modificado antes da implementação V5. Há trabalho em andamento nas seguintes áreas:

- fluxo de vistoria;
- risco, resultado, relatório e laudo;
- contexto e serviço de relatórios;
- sincronização;
- geração de PDF e recibo de ciência;
- função de backend para geração do laudo;
- documentação e utilitários compartilhados.

Proteções definidas:

- não executar reset, checkout destrutivo ou limpeza do worktree;
- não incluir essas alterações em commits do redesign sem revisão explícita;
- iniciar o redesign por tokens, componentes e shell;
- só migrar resultado/relatório/laudo após estabilização do trabalho atual;
- revisar qualquer conflito arquivo a arquivo.

## 6. Particularidade do ambiente Windows

O PowerShell local bloqueia os atalhos `npm.ps1` e `npx.ps1` pela política de execução. Os executáveis `npm.cmd` e `npx.cmd` funcionam normalmente e devem ser usados nos comandos automatizados neste ambiente.

Isso é uma restrição do shell, não uma falha do projeto.

## 7. Pendências antes do primeiro commit de implementação

- [ ] Revisar este checklist com o responsável pelo produto.
- [ ] Confirmar que o Penpot H01 representa a direção final.
- [ ] Definir se o logo atual será mantido na primeira implementação.
- [ ] Criar a branch `codex/tcs-mobile-v5-foundations`.
- [ ] Registrar novamente o `git status` imediatamente antes da primeira alteração.
- [ ] Garantir que alterações locais do fluxo de laudo estejam preservadas.

## 8. Decisão de prontidão

### GO

A implementação pode começar pela **Fase 1 — tokens e componentes fundamentais** depois da revisão deste checklist.

### Restrições

- não começar pelo fluxo de laudo;
- não alterar schema, RLS ou RPCs para executar o redesign;
- não inventar dark mode;
- não substituir cores globalmente sem migrar por componente;
- não remover ou renomear rotas atuais;
- não misturar mudanças visuais com mudanças de regra de negócio.

## 9. Primeiro pacote após aprovação

O primeiro pacote de implementação deverá conter somente:

1. tokens de cor V5;
2. tipografia e espaçamento;
3. atualização do `ThemeContext` para o tema claro aprovado;
4. primitives `Button`, `Card`, `Badge`, estados e campos;
5. testes das variantes dos componentes;
6. nenhuma migração de tela crítica ainda.

