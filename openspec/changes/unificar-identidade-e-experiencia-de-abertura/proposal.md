## Why

O aplicativo apresenta identidades diferentes entre o ícone instalado, a splash nativa, o carregamento e a tela pública, além de usar a Defesa Civil Municipal como marca principal antes de conhecer o tipo de conta ou a organização do usuário. A abertura precisa refletir o posicionamento aprovado: TCS como marca-mãe, Relatório e Risco como produto e Defesa Civil como público especializado, com continuidade visual em todos os estados de inicialização.

## What Changes

- Substituir os ativos antigos ou provisórios de ícone, splash e logotipo por uma identidade única do TCS Relatório e Risco.
- Unificar visualmente splash nativa, carregamento da aplicação, onboarding, tela pública e entradas de autenticação e treinamento.
- Tornar TCS a marca predominante, Relatório e Risco o nome do produto e Defesa Civil o contexto operacional comunicado na abertura.
- Exibir nome, brasão ou logotipo de prefeitura/órgão somente depois que a organização do usuário for conhecida.
- Reorganizar a tela pública com uma ação principal de acesso, ações secundárias de ativação e apresentação do produto e uma entrada especial para treinamento.
- Substituir o indicador estático de disponibilidade por um estado coerente com a conectividade conhecida, sem bloquear o acesso às funções offline.
- Aplicar tokens e componentes do Design System, requisitos de contraste, responsividade, áreas de toque e preferência por movimento reduzido.
- Preservar as regras e rotas atuais de onboarding, autenticação, ativação por convite/token, sessão autenticada e treinamento.

## Capabilities

### New Capabilities

- `app-opening-experience`: Define a identidade, a continuidade visual, a hierarquia de ações, os estados de abertura e os requisitos de acessibilidade desde o ícone e a splash até o primeiro destino navegável.

### Modified Capabilities

Nenhuma. O repositório ainda não possui especificações base em `openspec/specs/` para modificar.

## Impact

- Configuração Expo e ativos em `app.json` e `assets/`, incluindo ícones de iOS/Android, splash, favicon e notificações quando aplicável.
- Inicialização, roteamento e estado intermediário em `app/_layout.tsx` e `utils/rootRouting.ts`.
- Experiência pública e de entrada em `app/onboarding.tsx`, `app/showcase.tsx` e `app/(auth)/`.
- Design System em `constants/`, `components/ui/` e contexto de tema/conectividade.
- Testes de roteamento, renderização, acessibilidade e validação visual em iOS e Android.
- Nenhuma alteração prevista em autenticação, autorização, planos, cobrança, regras de assinatura ou dados operacionais.
