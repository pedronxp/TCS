## 1. Aprovação da identidade e inventário

- [x] 1.1 Inventariar todas as referências atuais a ícone, splash, logo, favicon, adaptive icon, notification icon e marca TCS Cursos e Serviços
- [x] 1.2 Aprovar o símbolo simplificado TCS, wordmark, barra R1–R4, composição "Relatório e Risco" e descrição "Plataforma de vistoria técnica para Defesa Civil"
- [x] 1.3 Definir variantes de marca para fundo claro, fundo escuro, composição compacta, hero e boot
- [x] 1.4 Registrar as áreas seguras e os tamanhos mínimos necessários para launcher, splash, favicon e notificação

## 2. Ativos de plataforma

- [x] 2.1 Produzir o ativo mestre transparente e os derivados aprovados para ícone do aplicativo, adaptive icon, splash, favicon e ícone monocromático/notificação quando aplicável
- [x] 2.2 Substituir em `app.json` as referências aos ativos antigos ou provisórios sem alterar identificadores, permissões ou configurações não relacionadas
- [x] 2.3 Validar recorte, transparência, área segura e legibilidade dos ativos em tamanhos reais de iOS e Android
- [x] 2.4 Confirmar que nenhum ativo publicado exibe TCS Cursos e Serviços, grade de gabarito ou retângulo branco não intencional

## 3. Primitivas visuais compartilhadas

- [x] 3.1 Criar componentes reutilizáveis para símbolo/wordmark TCS, barra R1–R4, identificação do produto e fundo da abertura
- [x] 3.2 Criar variantes compacta, hero e boot usando os tokens existentes de cor, tipografia, espaçamento e raios
- [x] 3.3 Implementar comportamento compatível com temas claro e escuro sem duplicar paletas locais nas telas consumidoras
- [x] 3.4 Implementar suporte à preferência de redução de movimento e remover animações decorativas contínuas quando ela estiver ativa
- [x] 3.5 Adicionar testes de renderização das variantes e dos estados de tema e movimento reduzido

## 4. Sequência de inicialização e roteamento

- [x] 4.1 Substituir o spinner isolado de `app/_layout.tsx` por um estado de boot alinhado visualmente à splash nativa
- [x] 4.2 Garantir que o estado de boot termine assim que autenticação, treinamento, tema e onboarding permitirem resolver o destino, sem atraso artificial
- [x] 4.3 Preservar `resolveRootRedirect` como fonte de verdade e cobrir primeira instalação, usuário desconectado, usuário autenticado, treinamento ativo/expirado e recuperação de senha
- [x] 4.4 Validar que deep links e fluxos de recuperação não apresentam flash da tela pública nem são redirecionados incorretamente
- [x] 4.5 Adicionar testes automatizados para os estados de cold start e decisões de destino afetadas

## 5. Tela pública, onboarding e autenticação

- [x] 5.1 Reformular `app/(auth)/index.tsx` com TCS como marca dominante, Relatório e Risco como produto e Defesa Civil como público
- [x] 5.2 Manter "Acessar sistema" como única ação primária e mapear "Ativar acesso", "Conhecer o TCS" e "Modo treinamento" para os fluxos existentes
- [x] 5.3 Substituir o status estático por mensagem derivada da conectividade, sem afirmar saúde completa do backend nem bloquear recursos offline
- [x] 5.4 Adaptar a tela pública para safe areas, telas compactas, rolagem de fallback, fontes ampliadas e alvos de toque de no mínimo 44 pontos
- [x] 5.5 Aplicar as primitivas compartilhadas ao onboarding, login, ativação/registro e entrada de treinamento sem mudar as regras funcionais desses fluxos
- [x] 5.6 Remover da experiência pública créditos pessoais e identidade municipal genérica, mantendo apenas marca responsável e versão aprovadas
- [x] 5.7 Adicionar testes das ações, rótulos, conectividade, responsividade e acessibilidade das telas públicas alteradas

## 6. Contexto institucional autenticado

- [x] 6.1 Identificar os pontos autenticados que já recebem organização confiável e podem apresentar nome, município ou identidade institucional
- [x] 6.2 Exibir identidade da organização como contexto subordinado ao TCS somente quando o vínculo autenticado estiver resolvido
- [x] 6.3 Garantir que contas individuais permaneçam completas e coerentes sem organização ou brasão municipal
- [x] 6.4 Adicionar testes para conta municipal resolvida, conta individual e contexto organizacional indisponível

## 7. Validação e entrega

- [x] 7.1 Executar lint, TypeScript e testes automatizados relevantes, corrigindo regressões introduzidas pela mudança
- [ ] 7.2 Validar visualmente splash, boot e primeiro destino em iOS e Android nos temas claro e escuro
- [x] 7.3 Validar primeira instalação, retorno desconectado, sessão autenticada, treinamento, recuperação de senha, offline e reconexão
- [ ] 7.4 Validar aparelhos pequenos, fontes ampliadas, safe areas, contraste, leitor de tela, alvos de toque e movimento reduzido
- [ ] 7.5 Gerar build de teste e confirmar ícone, nome, splash e adaptive icon fora do Expo Go antes da publicação
- [x] 7.6 Documentar evidências de validação e aprovar a experiência final antes de distribuir a versão
