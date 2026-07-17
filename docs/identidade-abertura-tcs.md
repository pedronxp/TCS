# Identidade de abertura do TCS

## Inventário atual

| Superfície | Referência atual | Diagnóstico |
| --- | --- | --- |
| Ícone principal | `assets/icon.png` | Marca legada "TCS Cursos e Serviços" |
| Splash nativa | `assets/splash-icon.png` | Grade/gabarito provisório |
| Adaptive icon Android | `assets/icon.png` | Reutiliza a marca legada e não respeita a área segura adaptativa |
| Ícone monocromático Android | `assets/android-icon-monochrome.png` | Ativo genérico sem relação com a identidade aprovada |
| Notificação Android | `assets/notification-icon.png` | Ativo genérico sem relação com a identidade aprovada |
| Favicon | `assets/favicon.png` | Ativo genérico/provisório |
| Logo nas telas | `assets/logo.png` | Brasão genérico da Defesa Civil Municipal, 24 bpp e sem transparência |
| Boot React Native | `app/_layout.tsx` | Spinner azul isolado sobre fundo escuro |
| Entrada pública | `app/(auth)/index.tsx` | Mistura TCS, brasão municipal genérico, status online estático e crédito pessoal |
| Onboarding/showcase | `app/onboarding.tsx`, `app/showcase.tsx` | Repetem o brasão municipal genérico e estilos locais |
| Autenticação/treinamento | `app/(auth)/`, `app/(panel)/treinamento/` | Repetem o ativo municipal e composições divergentes |

## Arquitetura aprovada

1. **Marca-mãe:** TCS.
2. **Produto:** Relatório e Risco.
3. **Público:** Plataforma de vistoria técnica para Defesa Civil.
4. **Contexto autenticado:** prefeitura, órgão, município e identidade institucional.
5. **Assinatura visual:** quatro segmentos R1–R4 em verde, âmbar, laranja e vermelho.

## Variantes planejadas

- **Mark:** símbolo isolado para launcher, favicon e avatar de boot.
- **Compact:** mark + TCS + barra R1–R4 para cabeçalhos e autenticação.
- **Hero:** mark + TCS + Relatório e Risco + descrição do público.
- **Boot:** mark centralizado sobre `#0B0F19`, sem textos pequenos.
- **Monocromática:** geometria sólida branca para notificação e superfícies de uma cor.

## Área segura e tamanhos mínimos

- O conteúdo essencial do launcher deve ficar dentro dos 66% centrais do canvas de 1024 px.
- O adaptive foreground deve manter o conteúdo essencial dentro dos 432 px centrais de um canvas de 1024 px para tolerar máscaras de fabricante.
- A splash deve usar mark transparente com pelo menos 20% de respiro em todos os lados.
- O favicon deve continuar reconhecível em 16, 32 e 48 px; textos secundários não podem fazer parte dele.
- A notificação Android deve ser branca, monocromática, transparente e sem áreas semitransparentes decorativas.
- A composição compacta não deve ser usada abaixo de 96 px de largura; abaixo disso deve ser usado somente o mark.

## Critérios de aprovação do conceito

- Reconhecível como TCS em tamanhos pequenos.
- Compatível com fundo claro e escuro.
- Não utiliza brasão municipal como marca global.
- Não contém elementos da marca antiga "Cursos e Serviços".
- A barra R1–R4 permanece secundária e legível.
- Geometria simples o suficiente para variantes monocromáticas e adaptativas.
