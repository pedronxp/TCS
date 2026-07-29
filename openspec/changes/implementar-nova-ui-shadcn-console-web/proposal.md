## Why

O console web já possui os fluxos funcionais de clientes, planos, assinaturas, suporte, sessões, equipe, auditoria e operações técnicas, mas a interface é composta majoritariamente por elementos HTML e classes Tailwind repetidas diretamente nas páginas. Essa dispersão dificulta manter consistência visual, acessibilidade, responsividade e evolução do produto.

O design criado no Penpot estabelece uma identidade minimalista para a TCS, porém a implementação atual ainda não possui uma entrada comercial pública antes do login, não utiliza uma biblioteca shadcn completa e não traduz todos os estados e restrições reais do sistema. A nova UI precisa modernizar a experiência sem reescrever hooks, permissões, RPCs ou regras de negócio já validadas.

## What Changes

- Configurar shadcn/ui no dashboard React/Vite existente, com componentes versionados no repositório e tema baseado em variáveis semânticas.
- Migrar a fundação visual para a paleta aprovada de branco quente, preto suave, bege, marrom e azul-claro, preservando cores semânticas de sucesso, alerta, erro e risco R1–R4.
- Criar uma página Comercial pública em `/`, manter autenticação em `/login` e mover o console protegido para `/app/*`, com redirecionamentos temporários das rotas internas antigas.
- Implementar as seções públicas Produto, Soluções, Planos e Segurança com conteúdo alinhado aos planos e capacidades reais do sistema.
- Substituir o shell atual por uma composição shadcn responsiva, recolhível e orientada ao papel interno de owner ou developer.
- Criar componentes de domínio reutilizáveis para cabeçalhos, indicadores, filtros, tabelas, estados assíncronos, risco, auditoria, contexto do cliente e ações de alta criticidade.
- Migrar as páginas por ondas, preservando consultas, mutations, autorização server-side e contratos de dados existentes.
- Padronizar loading, vazio, erro, sucesso, confirmação, feedback, foco, teclado, contraste e comportamento responsivo.
- Introduzir validação visual e testes de regressão por rota crítica antes de remover a UI anterior.
- Tratar o arquivo Penpot `TCS — Web Dashboard` como fonte de verdade visual para fundações, componentes, composição, conteúdo, estados e hierarquia das páginas.
- Cobrir todas as rotas públicas e autenticadas existentes com uma matriz rota → board/template → permissões → estados → breakpoints.
- Criar no Penpot os boards ausentes antes de implementar Detalhe do agente, Dashboard técnico, Formulários, Regras de risco, Sincronização, Armazenamento, Logs, Configurações e Arquivamento.
- Tornar o design system obrigatório para rotas futuras por meio de templates de página, tokens semânticos, componentes compartilhados, manifesto de rotas e quality gates automatizados.
- Considerar uma rota migrada somente após comparação visual lado a lado com o Penpot, validação funcional autenticada e aprovação nos viewports suportados.

## Capabilities

### New Capabilities

- `internal-console-ui-system`: Define a fundação shadcn/ui, tokens visuais, entrada comercial pública, shell autenticado, padrões de composição, responsividade, acessibilidade e estratégia incremental de migração do console web.

### Modified Capabilities

Nenhuma especificação base será modificada. A mudança preserva os requisitos funcionais e de autorização da mudança concluída `reformular-dashboard-interno-donos-programadores`.

## Impact

- Dashboard Vite em `dashboard/`, especialmente `package.json`, configuração Tailwind/Vite, `components.json`, `src/index.css` e `src/components/ui/`.
- Roteamento em `dashboard/src/App.tsx`, com nova fronteira pública e prefixo autenticado `/app`.
- Shell e navegação em `dashboard/src/components/AppLayout.tsx`, `Sidebar.tsx` e `src/config/navigation.ts`.
- Todas as páginas em `dashboard/src/pages/`, migradas em ondas sem alteração deliberada dos contratos de domínio.
- Arquivo Penpot `TCS — Web Dashboard`, ampliado para representar todas as rotas atuais, variantes por papel, estados assíncronos e adaptações responsivas necessárias.
- Manifesto de cobertura visual das rotas, usado por documentação, revisão e regressão visual.
- Testes unitários e de fluxo do dashboard, acrescidos de acessibilidade, responsividade e regressão visual.
- Nenhuma alteração prevista no aplicativo Expo, schema Supabase, RLS, RPCs, Edge Functions, cobrança ou regras de assinatura.

## Non-goals

- Reescrever o backend, autenticação, autorização ou modelo de dados.
- Alterar cálculos de risco, regras de assinatura ou operações administrativas existentes.
- Implementar um portal autenticado para clientes externos.
- Fazer uma substituição integral da interface em uma única entrega.
- Exibir dados simulados em produção para preencher layouts.
- Declarar fidelidade ao Penpot para uma rota que não possua board aprovado ou derivação explicitamente documentada de um template aprovado.
