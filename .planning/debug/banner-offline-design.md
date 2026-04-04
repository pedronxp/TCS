---
status: diagnosed
trigger: "Banner offline integrado visualmente ao design do app"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Focus

hypothesis: ConnectivityBanner usa cor laranja genérica (#F59E0B) e tipografia plain que não integra ao design system do app
test: leitura completa do componente e comparação com Colors.ts
expecting: identificar exatamente quais tokens de design estão faltando ou divergentes
next_action: DIAGNOSED — aguardando implementação de fix

## Symptoms

expected: Quando o dispositivo fica offline, o app exibe indicador de modo offline visualmente integrado ao design — sem barra laranja genérica que destoa do resto do app.
actual: Apareceu barra laranja com mensagem 'modo offline - Dados sincronizados ao reconectar' — usuário relatou que o design precisa melhorar e que não está integrado visualmente.
errors: Nenhum erro técnico — problema puramente visual/design
reproduction: Desativar WiFi/dados do dispositivo e abrir o app (Test 3 do UAT fase 06)
started: Descoberto durante UAT da fase 06

## Eliminated

- hypothesis: problema está no NotificationContext ou NotificationService
  evidence: nenhum desses arquivos renderiza UI de banner — são apenas lógica de push notifications
  timestamp: 2026-04-02T00:00:00Z

- hypothesis: banner é renderizado no _layout.tsx do panel
  evidence: panel/_layout.tsx não monta ConnectivityBanner — apenas o root app/_layout.tsx (linha 101) monta o componente
  timestamp: 2026-04-02T00:00:00Z

## Evidence

- timestamp: 2026-04-02T00:00:00Z
  checked: components/ConnectivityBanner.tsx
  found: |
    Cor offline hardcoded: backgroundColor: '#F59E0B' (âmbar genérico Tailwind)
    Cor online hardcoded: backgroundColor: '#10B981' (verde genérico Tailwind)
    Texto: fontSize 12, fontWeight '600', cor branca fixa
    Posição: position absolute, top 0, left 0, right 0, height BANNER_HEIGHT(40) + insets.top
    Ícone: Feather wifi-off / wifi, size 13, cor #fff
    Animação: slide-down desde -(BANNER_HEIGHT + insets.top) até 0 — barra desliza para dentro do topo da tela
    Texto offline: 'Modo Offline — dados sincronizados ao reconectar'
    Texto online: 'Conexão restaurada'
  implication: |
    A cor #F59E0B não usa nenhum token do design system (Colors.ts).
    O design system tem Colors.light.warning = '#D97706' e Colors.light.warningLight = '#FFFBEB' com
    Colors.light.warningText = '#78350F'. A barra ignora completamente esses tokens.
    Além disso, a barra sobrepõe o conteúdo por ser absolute top-0 sem reservar espaço no layout —
    ela tampa o header das telas ao aparecer.

- timestamp: 2026-04-02T00:00:00Z
  checked: constants/Colors.ts
  found: |
    Design system usa: primary #3B82F6, warning #D97706, warningLight #FFFBEB, warningText #78350F
    Para sucesso/restauração: success #16A34A, successLight #F0FDF4, successText #14532D
    Tema dark tem equivalentes: warning #FCD34D sobre warningLight rgba(252,211,77,0.12)
    Nenhum desses tokens é usado em ConnectivityBanner — cores todas hardcoded
  implication: |
    O fix deve substituir as cores hardcoded pelos tokens do Colors design system e usar
    useColorScheme() para suportar dark mode consistentemente com o resto do app.

- timestamp: 2026-04-02T00:00:00Z
  checked: app/_layout.tsx linha 101
  found: ConnectivityBanner montado no root layout, fora do SafeAreaView — renderiza sobre tudo
  implication: |
    A posição absolute top-0 com paddingTop: insets.top cobre a safe area mas sobrepõe o header
    nativo das telas. Uma abordagem alternativa seria usar uma pill/chip flutuante centralizada
    (semelhante a um toast) que não tampa o conteúdo e é visualmente mais elegante.

## Resolution

root_cause: |
  O componente components/ConnectivityBanner.tsx usa cores hardcoded (#F59E0B laranja âmbar genérico
  para offline, #10B981 verde genérico para restaurado) que não pertencem ao design system do app.
  O componente também ignora dark mode e usa uma tipografia básica sem integração com os tokens de
  fonte do app. A forma de exibição como barra full-width que aparece no topo (estilo "browser warning
  bar") cria um visual genérico e não-nativo que destoa da linguagem visual do restante do app.

fix: pendente — diagnóstico concluído
verification: pendente
files_changed: []
