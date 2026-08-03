# Homologação TCS Mobile V5

## Estado técnico

- [x] TypeScript sem erros
- [x] Expo Doctor: 18/18 verificações
- [x] Testes automatizados: 32 suítes e 227 testes
- [x] Bundle Android/Hermes gerado
- [x] Bundle iOS/Hermes gerado
- [x] Android: `com.tcs.relatorioderisco`, versionCode 28
- [x] iOS: `com.tcs.relatorioderisco`, buildNumber 28
- [x] Produção Android configurada para AAB
- [x] Ícones V5 em 1024 × 1024 e ícone de notificação em 96 × 96
- [x] Permissões sensíveis solicitadas no contexto de uso
- [ ] Homologação manual Android concluída
- [ ] Homologação manual iOS concluída

## Fluxos públicos e de conta

- [ ] Abertura, splash e onboarding
- [ ] Login, logout e recuperação de senha
- [ ] Cadastro, termos, permissões e confirmação
- [ ] Perfil e atualização dos dados da conta
- [ ] Assinatura, catálogo de planos e limites
- [ ] Suporte e estados vazios/erro/carregamento
- [ ] Links profundos de recuperação de senha

## Perfil individual e agente

- [ ] Dashboard, módulos e navegação inferior
- [ ] Lista, detalhe e filtros de vistorias
- [ ] Dados iniciais e localização
- [ ] Seleção do formulário e preenchimento do wizard
- [ ] Captura e seleção de fotos
- [ ] Resultado, nível de risco e conduta
- [ ] Laudo, relatório, impressão e compartilhamento
- [ ] Ciência eletrônica e assinatura manual
- [ ] Modo treinamento
- [ ] Funcionamento offline, fila e sincronização
- [ ] Mapas, marcadores, agrupamentos e heatmap

## Perfil municipal e supervisor

- [ ] Dashboard municipal/supervisor
- [ ] Coordenação, equipe e agentes
- [ ] Grupos e detalhes dos grupos
- [ ] Agendamentos e detalhes
- [ ] Indicadores, riscos e relatórios
- [ ] Permissões e bloqueios por função

## Perfil administrador

- [ ] Dashboard administrativo
- [ ] Usuários e exclusão com confirmação
- [ ] Tokens e geração de token
- [ ] Editor de formulários e perguntas
- [ ] Configuração de risco
- [ ] Estatísticas, relatórios e protocolos
- [ ] Logs e estados de conectividade

## Perfil master/desenvolvedor

- [ ] Dashboard global
- [ ] Municípios
- [ ] Contratações
- [ ] Treinamentos
- [ ] Logs globais
- [ ] Restrições de acesso aos módulos internos

## Matriz de aparelhos

- [ ] Android API 24 ou equivalente mínimo
- [ ] Android atual com navegação por gestos
- [ ] Android com fonte/tela ampliada
- [ ] iPhone compacto
- [ ] iPhone padrão atual
- [ ] iPhone com Dynamic Island
- [ ] Tema claro do sistema
- [ ] Tema escuro do sistema
- [ ] Alternância manual entre sistema, claro e escuro
- [ ] Preferência de tema preservada após reiniciar o app
- [ ] Orientação retrato

## Critérios visuais

- [ ] Logo sem bolha ou fundo branco indevido
- [ ] Paleta TCS consistente, sem azul, roxo ou marrom como cor de marca
- [ ] Cores de risco usadas apenas como informação semântica
- [ ] Safe areas respeitadas no Android e iOS
- [ ] Teclado não cobre campos ou ações
- [ ] Textos não cortam com acessibilidade ativada
- [ ] Alvos de toque, contraste e leitores de tela revisados
- [ ] Estados obrigatórios, validação e mensagens estão claros
- [ ] Mapa legível no tema escuro sem introduzir azul ou marrom na identidade
- [ ] Splash, barra de status, modais e navegação não exibem flashes claros

## Resultado da homologação

Para cada problema registrar: perfil, rota, aparelho, versão do sistema, passos, resultado esperado, resultado observado e captura de tela.

## Tema escuro implementado

A versão mobile agora oferece os modos **Sistema**, **Claro** e **Escuro** em Perfil. A escolha é persistida no aparelho, a barra de status acompanha o tema e Android/iOS usam configuração automática de aparência. O splash, o mapa e os componentes compartilhados receberam variantes escuras próprias, mantendo a identidade verde-neutra da TCS.

A aprovação final ainda depende da execução completa desta matriz em aparelhos Android e iOS reais, especialmente contraste, teclado, safe areas, mapa nativo e transições durante a abertura do aplicativo.
