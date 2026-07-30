# Boards finais no Penpot

Projeto: `TCS — Web Dashboard`.

- Team ID: `64054412-1123-81ed-8008-5ce7021c500a`
- File ID: `a1a9e568-e174-80fb-8008-5ce7be9647bc`
- Editor: `https://design.penpot.app/#/workspace?team-id=64054412-1123-81ed-8008-5ce7021c500a&file-id=a1a9e568-e174-80fb-8008-5ce7be9647bc`
- Estado: 25 páginas verificadas e salvas.

## 23 · Templates operacionais

Nove boards de referência foram materializados, nomeados e organizados:

1. Página pública.
2. Autenticação.
3. Dashboard.
4. Listagem.
5. Detalhe contextual.
6. Timeline.
7. Editor versionado.
8. Configurações.
9. Operação técnica.

Os contratos continuam exigindo estados assíncronos, permissões, tokens semânticos e validação em 1440, 1024, 768 e 390 px.

## 24 · Dashboard técnico

O board contém as referências aprovadas de 1440, 1024, 768 e 390 px. Ele preserva cabeçalho e ações, linha de versões, leitura operacional, métricas técnicas, fila de atenção e atalhos. Público: `developer`; permissão: `dashboard.technical.read`.

## 25 · Detalhe do agente

O board contém as referências aprovadas de 1440, 1024, 768 e 390 px. Ele preserva contexto do cliente/agente, filtros compartilhados, resumo, risco, vistorias, mapa, agenda, documentos, acesso, sessões, atividade técnica e operações administrativas protegidas por MFA.

## Aprovação

Os três conjuntos foram revisados visualmente no arquivo do Penpot e estão registrados como `approved` em `dashboard/design/penpot-handoff.mjs` e no manifesto de rotas.

## Portais de clientes

As páginas `26 · Portais — Arquitetura` a `34 · Portais — Validação responsiva` adicionam 21 boards
aprovados para a arquitetura, componentes/estados, Portal Individual, três papéis municipais, conta,
checkout, convites e validação nos breakpoints 1440, 1024, 768 e 390 px. O comando
`/opsx:apply criar-portal-clientes-individual-municipal` foi tratado como aprovação explícita do gate
visual e iniciou a branch de implementação correspondente.
