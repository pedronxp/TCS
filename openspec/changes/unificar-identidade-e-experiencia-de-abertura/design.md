## Context

O aplicativo Expo/React Native possui uma abertura fragmentada. O ícone instalado ainda representa a marca antiga "TCS Cursos e Serviços", a splash usa um ativo provisório de grade, o estado de boot em `app/_layout.tsx` apresenta apenas um spinner e a tela pública usa TCS Relatório e Risco junto de um brasão genérico da Defesa Civil Municipal. Na primeira instalação, o roteamento envia o usuário ao onboarding; sessões autenticadas e de treinamento ignoram a tela pública. A solução precisa, portanto, abranger todos os caminhos de cold start sem alterar suas regras.

A arquitetura de marca aprovada é: TCS como marca-mãe, Relatório e Risco como produto e Defesa Civil como público especializado. Prefeitura, município, órgão e brasão são contexto da organização autenticada, não a marca global do produto. A implementação deve funcionar em iOS e Android, temas claro e escuro, aparelhos pequenos e condições offline.

## Goals / Non-Goals

**Goals:**

- Criar uma sequência visual contínua entre ícone, splash, boot React Native e primeiro destino navegável.
- Comunicar a hierarquia TCS → Relatório e Risco → Defesa Civil antes da autenticação.
- Preservar o roteamento atual para onboarding, autenticação, painel, recuperação de senha e treinamento.
- Padronizar a experiência pública e as entradas de autenticação com tokens e componentes compartilhados.
- Melhorar contraste, responsividade, áreas de toque e comportamento com movimento reduzido.
- Reservar a identidade de prefeitura ou órgão para o contexto autenticado.

**Non-Goals:**

- Alterar autenticação, autorização, assinatura, cobrança, limites ou regras de sessão.
- Criar white-label completo ou editor de marca por organização.
- Reformular dashboards e fluxos operacionais internos.
- Alterar o modelo de dados de organizações.
- Introduzir novas bibliotecas de UI ou animação sem necessidade comprovada.

## Decisions

### 1. Usar uma arquitetura de marca em três níveis

A abertura usará TCS como elemento dominante, "Relatório e Risco" como nome do produto e "Plataforma de vistoria técnica para Defesa Civil" como descrição. O indicador R1–R4 será uma assinatura visual do produto. Identidade municipal não aparecerá antes de a sessão resolver a organização.

Alternativa considerada: manter o brasão genérico da Defesa Civil como protagonista. Rejeitada porque confunde marca do produto com identidade do cliente e prejudica a oferta a diferentes órgãos e contas individuais.

### 2. Tratar a abertura como uma sequência de estados, não como uma única tela

A experiência será modelada como `splash nativa → boot React Native → destino resolvido`. Splash e boot compartilharão fundo, símbolo, escala e posicionamento aproximados. A splash será estática, conforme as limitações nativas; animações discretas ocorrerão somente após o React Native estar disponível.

Alternativa considerada: redesenhar somente `app/(auth)/index.tsx`. Rejeitada porque primeira instalação, sessão autenticada e treinamento podem nunca renderizar essa tela.

### 3. Preservar o resolvedor de rotas como fonte de verdade

`resolveRootRedirect` continuará determinando onboarding, autenticação, painel e treinamento. A mudança visual não adicionará atrasos artificiais nem novas decisões de autenticação. O boot visual será encerrado assim que os contextos atuais estiverem prontos e o destino puder ser resolvido.

Alternativa considerada: criar uma nova rota intermediária para toda abertura. Rejeitada por aumentar risco de loops, flashes e regressões em deep links e recuperação de senha.

### 4. Criar primitivas compartilhadas de identidade da abertura

Símbolo, wordmark, barra R1–R4, descrição do produto e fundo decorativo serão centralizados em componentes reutilizáveis e alimentados pelos tokens existentes de cor, tipografia e espaçamento. Telas poderão escolher variantes compacta, hero ou boot sem duplicar valores de marca.

Alternativa considerada: manter estilos locais em cada tela. Rejeitada porque foi a causa direta das divergências atuais.

### 5. Separar ativos-fonte de derivados de plataforma

Será aprovado um ativo mestre com transparência e área segura. A partir dele serão gerados ícone, adaptive icon, splash, favicon e, quando adequado, ícone monocromático e de notificação. Ativos antigos ou provisórios deixarão de ser referenciados pela configuração do Expo.

Alternativa considerada: reaproveitar `assets/logo.png`. Rejeitada porque o arquivo possui fundo branco incorporado, muitos detalhes e não funciona bem em tamanhos pequenos.

### 6. Manter uma ação primária inequívoca na tela pública

"Acessar sistema" será a única ação primária. "Ativar acesso" e "Conhecer o TCS" serão secundárias. "Modo treinamento" permanecerá separado como entrada especializada. A mudança de rótulo não alterará o destino atual de cada ação.

### 7. Representar conectividade sem prometer disponibilidade do backend

O rodapé não exibirá "Sistema online" como constante. Quando houver sinal confiável, apresentará um estado como "Conectado" ou "Modo offline"; ausência de conectividade não bloqueará o login visual nem os caminhos que já possuem comportamento offline. Não será inferida saúde completa do serviço apenas a partir da rede do aparelho.

### 8. Respeitar tema e acessibilidade desde o primeiro frame React Native

O boot usará o tema resolvido sem flash incompatível. Textos e controles deverão manter contraste adequado, alvos de toque de pelo menos 44 pontos, suporte a fonte ampliada e fallback com rolagem em telas compactas. Animações contínuas serão removidas ou desativadas quando a preferência de redução de movimento estiver ativa.

## Risks / Trade-offs

- [A splash nativa não conhece imediatamente o tema salvo pelo usuário] → usar uma cor institucional escura estável na splash e garantir transição aceitável para o tema resolvido.
- [Ativos detalhados perdem legibilidade em ícones pequenos] → aprovar um símbolo simplificado e validar em tamanhos reais de launcher e notificação.
- [Mudanças na abertura podem causar loops de navegação] → preservar `resolveRootRedirect` e ampliar seus testes antes de alterar componentes visuais.
- [Fontes ampliadas podem empurrar ações para fora da tela] → usar contêiner rolável com prioridade para ação principal e safe areas.
- [Estado de rede pode oscilar durante o boot] → usar linguagem de conectividade, evitar afirmar saúde total do backend e não bloquear navegação por transições momentâneas.
- [A personalização municipal pode reintroduzir inconsistência] → limitar esta entrega ao ponto de integração autenticado e deixar white-label completo fora do escopo.

## Migration Plan

1. Aprovar símbolo, wordmark, composição e cópias da nova identidade antes de substituir ativos publicados.
2. Adicionar primitivas compartilhadas e testes sem alterar o roteamento.
3. Substituir ativos de ícone e splash e alinhar o estado de boot React Native.
4. Migrar tela pública, onboarding, login, ativação e treinamento para as primitivas compartilhadas.
5. Adicionar o contexto institucional somente em áreas autenticadas que já conhecem a organização.
6. Validar cold start e warm start em iOS e Android para primeira instalação, usuário desconectado, sessão autenticada, treinamento e recuperação de senha.
7. Publicar em build de teste antes da distribuição; rollback consiste em restaurar as referências aos ativos anteriores e os componentes visuais, sem migração de dados.

## Open Questions

Nenhuma questão funcional bloqueante. A arte final do símbolo TCS e suas variantes precisa de aprovação visual antes da implementação dos ativos definitivos.
