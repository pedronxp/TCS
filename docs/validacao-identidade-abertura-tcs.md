# Evidências de validação — identidade e abertura TCS

Data: 16/07/2026

## Verificações automatizadas

- `npx tsc --noEmit`: aprovado sem erros.
- `npm test -- --runInBand`: 20 suítes e 168 testes aprovados após a atualização compatível do Expo SDK 54.
- Testes específicos cobrem identidade, boot com marca, hierarquia de ações, ausência de crédito pessoal, offline/reconexão, primeira instalação, sessão autenticada, treinamento e recuperação de senha.
- `expo config --type public --json`: configuração pública resolvida com os novos ativos.
- `expo export --platform all --clear`: bundles Hermes de iOS e Android gerados com sucesso, incluindo `assets/brand/tcs-mark.png`.
- `expo-doctor`: 18 de 18 verificações aprovadas após alinhar oito dependências às versões de patch esperadas pelo SDK 54.
- Validação OpenSpec estrita deverá ser executada novamente após o fechamento das tarefas.

## Ativos verificados

| Ativo | Dimensão | Fundo | Uso |
| --- | ---: | --- | --- |
| `tcs-icon.png` | 1024 × 1024 | opaco institucional | launcher iOS/Android |
| `tcs-mark.png` | 1024 × 1024 | transparente | telas e relatórios |
| `tcs-splash.png` | 1024 × 1024 | transparente | splash nativa |
| `tcs-adaptive-foreground.png` | 1024 × 1024 | transparente | adaptive icon Android |
| `tcs-monochrome.png` | 1024 × 1024 | transparente/monocromático | Android themed icon |
| `tcs-notification.png` | 96 × 96 | transparente/monocromático | notificações Android |
| `tcs-favicon.png` | 48 × 48 | opaco institucional | web |

Os ativos foram inspecionados em resolução original. Não apresentam TCS Cursos e Serviços, grade provisória, brasão municipal como marca global ou retângulo branco não intencional.

## Estados cobertos

- Primeira instalação direcionada ao onboarding.
- Usuário recorrente desconectado direcionado à entrada pública.
- Sessão autenticada direcionada ao painel.
- Treinamento ativo e expirado preservados pelo resolvedor.
- Recuperação de senha não interceptada pela entrada pública.
- Entrada pública em conexão disponível, limitada e offline.
- Organização municipal exibida somente a partir do contexto autenticado confiável.
- Conta individual funcional sem identidade municipal.

## Acessibilidade e responsividade

- Conteúdo público usa `ScrollView` com `flexGrow`, safe areas e fallback vertical.
- Ações possuem altura mínima entre 50 e 56 pontos.
- Marca possui rótulo acessível e barra R1–R4 possui descrição semântica.
- Não há animação decorativa contínua; redução de movimento não remove informações ou ações.
- Textos funcionais aceitam escala de fonte; o wordmark usa escala fixa para preservar a marca.
- Contraste usa tokens semânticos dos temas claro e escuro.

## Validação ainda dependente de ambiente externo

- Instalação de APK/IPA em aparelho físico e inspeção de máscaras de launcher específicas de fabricante.
- Leitor de tela real (TalkBack/VoiceOver) e fontes máximas do sistema.
- Build EAS de distribuição: a máquina informou `Not logged in`; depende de autenticação do proprietário.

Esses itens não alteram o contrato funcional e devem ser confirmados no build de homologação antes da publicação em loja.
