# TCS Mobile V5 — Plano técnico de implementação

Data: 2026-08-01  
Status: design e Fase 0 concluídos; aguardando revisão do checklist antes da implementação.

Design de referência: [TCS — Mobile Product V3 · New Grids](https://design.penpot.app/#/workspace?team-id=64054412-1123-81ed-8008-5ce7021c500a&file-id=8694f143-a620-8054-8008-6742e05220c9)

## 1. Objetivo

Implementar o redesign TCS V5 no aplicativo Expo/React Native sem remover rotas, alterar regras de negócio ou quebrar autenticação, permissões por perfil, operação offline, geração de laudos e sincronização existentes.

O trabalho será incremental. Cada fase deve produzir uma versão executável e verificável antes da próxima fase.

## 2. Base técnica encontrada

- Expo 54, React Native 0.81, React 19 e Expo Router 6.
- Supabase para autenticação, dados, RPCs, Storage e funções de backend.
- SQLite, AsyncStorage e serviços próprios para operação offline e sincronização.
- 58 arquivos de tela, aproximadamente 24.223 linhas de interface.
- 68 arquivos com `StyleSheet.create`.
- 65 arquivos consumidores de `useTheme`.
- 687 linhas com cores hexadecimais diretas em `app`, `components`, `constants` e `context`.
- Componentes de UI existentes: `Button`, `Card`, `Badge`, `SectionHeader`, estados vazio, erro e carregamento.
- Quatro papéis de autenticação: `agent`, `supervisor`, `admin`, `master_admin`.
- Quatro papéis de organização: `owner`, `coordinator`, `supervisor`, `agent`.
- Dois públicos comerciais: `individual` e `organization`.
- Modo desenvolvedor/teste é transversal e não deve ser transformado em um papel comum.

## 3. Decisões de arquitetura

### 3.1 Shadcn adaptado ao React Native

Não será instalada uma implementação web do shadcn. Os princípios serão aplicados aos componentes nativos existentes:

- tokens semânticos;
- variantes explícitas;
- composição de componentes;
- estados `default`, `pressed`, `focused`, `disabled`, `loading` e `error`;
- acessibilidade e alvos mínimos nativos;
- componentes desacoplados das regras de negócio.

### 3.2 Identidade visual

Tokens aprovados no Penpot:

| Token | Valor |
|---|---|
| background | `#F7F8F7` |
| foreground | `#171A18` |
| primary | `#2F6B5B` |
| secondary | `#EDF3F0` |
| accent | `#B9D8CD` |
| border | `#DCE4E0` |
| success | `#2E7D5A` |
| warning | `#A66B22` |
| danger | `#B24A4A` |

Azul não será usado como cor de marca. Cores de risco continuam semânticas e só aparecem em risco, alerta ou bloqueio.

O Penpot V5 está desenhado em tema claro. A implementação inicial deve permanecer em tema claro; não será inventado um tema escuro sem aprovação visual específica.

### 3.3 Autorização e perfis

A navegação não pode depender somente de `profile.role`. Deve existir uma matriz central de capacidades combinando:

- público da conta: individual ou organização;
- papel de autenticação;
- papel de associação à organização;
- modo desenvolvedor/teste;
- estado da assinatura.

Essa matriz deverá alimentar:

- módulos visíveis;
- abas inferiores;
- dashboard inicial;
- guards de rota;
- ações permitidas dentro das telas.

As políticas RLS, RPCs e contratos do Supabase não serão alterados nas fases visuais. Qualquer necessidade de backend será tratada separadamente, com revisão de segurança e migração própria.

### 3.4 Estratégia de migração

- Não reescrever todas as telas de uma vez.
- Migrar primeiro fundações e componentes.
- Depois migrar um fluxo vertical completo.
- Preservar hooks, queries, serviços, contextos e parâmetros de rota existentes.
- Evitar alterações simultâneas de UI e regra de negócio no mesmo PR.
- Não tocar inicialmente nos arquivos de resultado, relatório e laudo que já possuem alterações locais não consolidadas.

## 4. Fases de implementação

### Fase 0 — Baseline e proteção

Escopo:

- registrar screenshots atuais das rotas críticas;
- executar testes e TypeScript antes de alterações;
- confirmar comportamento de login, guards, offline, sincronização e laudo;
- separar alterações locais existentes do trabalho de redesign;
- criar branch de implementação somente após autorização.

Critério de aceite:

- baseline reproduzível;
- nenhuma alteração do usuário sobrescrita;
- lista de falhas preexistentes registrada.

### Fase 1 — Tokens e componentes fundamentais

Arquivos principais:

- `constants/Colors.ts`;
- `constants/Typography.ts`;
- `constants/Spacing.ts`;
- `context/ThemeContext.tsx`;
- `components/ui/*`.

Entregas:

- aplicar os tokens V5;
- remover dependências azuis dos componentes fundamentais;
- definir elevação, radius, bordas e escala tipográfica;
- atualizar `Button`, `Card`, `Badge`, estados vazio/erro/loading;
- criar `Screen`, `AppHeader`, `FormField`, `ListRow`, `MetricCard`, `ModuleCard`, `StateBanner` e `ConfirmSheet`;
- centralizar o mapa de ícones de módulos usando o pacote de ícones já instalado.

Critério de aceite:

- componentes isolados cobrem todos os estados do Penpot;
- Android com alvo mínimo de 48 dp;
- iOS com alvo mínimo de 44 pt;
- contraste AA em textos e controles;
- nenhuma regra de negócio alterada.

### Fase 2 — Marca, abertura e shell nativo

Arquivos principais:

- `app.json`;
- `components/brand/*`;
- `app/onboarding.tsx`;
- `app/showcase.tsx`;
- `app/(auth)/*`;
- `app/_layout.tsx`;
- `app/(panel)/_layout.tsx`;
- `components/BottomNavBar.tsx`.

Entregas:

- splash e apresentação TCS;
- login e recuperação de acesso;
- status bar e safe areas;
- bottom navigation por capacidade/perfil;
- headers e transições de navegação;
- identidade de ícone, splash, adaptive icon e notificação;
- permissão contextual: câmera, galeria e localização somente quando a função for utilizada.

Decisões nativas:

- manter `edgeToEdgeEnabled` e validar insets em Android;
- avaliar predictive back somente após auditar modais e formulários;
- biometria exige decisão e dependência nativa específica antes da implementação;
- tema do sistema permanece bloqueado em claro até existir dark mode aprovado.

Critério de aceite:

- abertura até dashboard idêntica ao fluxo P01–P04;
- nenhuma permissão solicitada sem explicação contextual;
- navegação de retorno não perde dados;
- tabs mudam conforme capacidades do perfil.

### Fase 3 — Fluxo vertical da vistoria

Rotas:

- dados iniciais;
- seleção de formulário;
- wizard/checklist;
- evidências/foto;
- análise de risco;
- resultado;
- ciência;
- relatório;
- laudo.

Entregas:

- implementar os grids V5 preservando funções e estado atuais;
- validação inline de obrigatórios;
- confirmação ao sair ou descartar;
- rascunho preservado ao voltar;
- evidência ausente com foto ou justificativa;
- cálculo incompleto com retorno à pergunta;
- recuperação de PDF sem perder vistoria;
- feedback de sincronização local e remota.

Critério de aceite:

- uma vistoria completa funciona online e offline;
- fechar, voltar ou perder rede não apaga respostas nem fotos;
- relatório e laudo mantêm o conteúdo e contratos atuais;
- fluxo validado em Android e iOS.

Observação: esta fase só começa depois que as alterações locais atuais em resultado/relatório/laudo estiverem estabilizadas.

### Fase 4 — Painéis Individual e Agente

Rotas principais:

- dashboard;
- módulos;
- vistorias;
- agenda e detalhe da visita;
- mapa;
- assinatura/planos;
- perfil;
- suporte;
- treinamento.

Critério de aceite:

- conta individual mostra operação própria e plano individual;
- agente mostra agenda, coleta e prioridades de campo;
- módulos e abas refletem as capacidades reais da conta.

### Fase 5 — Painéis municipais

Perfis:

- owner/coordenador;
- supervisor;
- administrador municipal.

Rotas principais:

- coordenação;
- equipe;
- grupos e detalhe;
- supervisor;
- agentes;
- usuários;
- tokens e geração de token;
- estatísticas;
- relatórios;
- editor de formulário e perguntas;
- configuração de risco;
- logs e protocolo documental.

Critério de aceite:

- cada perfil vê somente módulos e ações permitidos;
- guards visuais e guards de rota usam a mesma matriz de capacidades;
- ações administrativas continuam protegidas no backend.

### Fase 6 — Master, desenvolvedor e operação global

Rotas:

- painel master;
- municípios;
- treinamentos;
- logs globais;
- contratações.

Critério de aceite:

- modo desenvolvedor continua transversal;
- master mantém acesso global sem contaminar a experiência de outros perfis;
- telas globais distinguem claramente município, organização e plataforma.

### Fase 7 — Estados nativos, QA e entrega

Entregas:

- câmera e galeria;
- localização;
- compartilhamento nativo;
- bloqueio de sessão;
- eventual biometria;
- fila offline e recuperação;
- acessibilidade;
- testes de regressão;
- builds internos Android e iOS.

Matriz mínima:

- Android API 24 e API 35;
- iOS 15.1 e versão atual suportada;
- aparelho pequeno, médio e grande;
- teclado aberto/fechado;
- online, offline e reconexão;
- permissões concedidas, negadas e bloqueadas;
- todos os seis perfis.

## 5. Sequência sugerida de PRs

1. `mobile-v5-foundations` — tokens, tema e primitives.
2. `mobile-v5-shell` — marca, onboarding, auth, headers e navegação.
3. `mobile-v5-inspection-flow` — vistoria completa e estados críticos.
4. `mobile-v5-individual-agent` — painéis operacionais.
5. `mobile-v5-municipal` — coordenação, supervisor e admin.
6. `mobile-v5-master` — operação global e dev mode.
7. `mobile-v5-native-qa` — permissões, offline, acessibilidade e builds.

## 6. Verificação obrigatória por PR

Comandos existentes:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Verificações adicionais:

- teste unitário da matriz de capacidades;
- teste dos redirects e guards de rota;
- testes de variantes dos componentes;
- teste de preservação de rascunho;
- teste de reconexão e sincronização;
- revisão visual contra o Penpot;
- teste manual em build nativo, não apenas Expo Web.

## 7. Riscos conhecidos

| Risco | Tratamento |
|---|---|
| telas muito grandes, algumas acima de mil linhas | extrair UI por seção sem mover regra de negócio no mesmo PR |
| centenas de cores diretas | migrar por componente e rota; não fazer substituição global cega |
| dois sistemas de papel/perfil | matriz central de capacidades com testes |
| alterações locais em laudo/resultado | preservar e estabilizar antes da Fase 3 |
| dark mode não desenhado | entregar V5 claro; desenhar dark separadamente |
| permissões solicitadas no boot | migrar para primers contextuais por função |
| predictive back desativado | testar todos os formulários antes de ativar |
| poucas provas automatizadas de UI | ampliar testes de primitives, guards e fluxos críticos |
| configuração sensível no repositório | tratar endurecimento de configuração em tarefa separada, sem misturar com redesign |

## 8. Definição de pronto do redesign

- 54 rotas continuam acessíveis quando autorizadas.
- Seis perfis recebem dashboard, módulos e navegação coerentes.
- Nenhum azul ou marrom é usado como identidade de marca.
- Ícones representam a entrega real de cada módulo.
- Estados obrigatório, offline, falha e recuperação funcionam sem perda de dados.
- Android e iOS respeitam seus padrões nativos.
- Nenhuma mudança de schema ou política Supabase é necessária apenas para o redesign.
- Testes, TypeScript e builds internos passam.
- Revisão visual final corresponde às páginas H01, N01 e J03–J06 do Penpot.
