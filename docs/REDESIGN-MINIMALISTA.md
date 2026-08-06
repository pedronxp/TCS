# Proposta de Redesign Minimalista - TCS Dashboard

**Data:** 05/08/2026  
**Versão:** 1.0  
**Design Engineer:** Kiro AI  
**Filosofia:** Less is More — Clareza, Funcionalidade, Respiração

---

## Contexto do Projeto

**App:** Defesa Civil — Vistoria Técnica de Risco Estrutural  
**Stack:** React Native 0.81.5 + Expo Router 6.0 + TypeScript  
**Usuários:** Agentes de campo, Supervisores, Administradores municipais  
**Contexto de uso:** Ambientes externos, sol forte, uso rápido, dados críticos

---

## 1. Princípios do Design Minimalista

### 1.1 Hierarquia Visual Clara
- **Uma ação primária por tela** — destaque absoluto
- **Tipografia com contraste marcante** — Display vs Body (ratio mínimo 2:1)
- **Espaçamento generoso** — 32px entre seções, 16px entre elementos relacionados
- **Cores reduzidas** — máximo 3 cores por tela (primária, neutra, semântica)

### 1.2 Redução de Ruído Visual
- **Eliminar bordas desnecessárias** — usar espaçamento e cor de fundo
- **Ícones essenciais apenas** — remover decorativos
- **Remover sombras excessivas** — usar elevação sutil (2-4dp)
- **Cards sem outline** — background contraste suficiente

### 1.3 Foco no Conteúdo
- **Dados primeiro** — números grandes, labels pequenos
- **Ações secundárias discretas** — ghost buttons, menor contraste
- **Navegação minimalista** — bottom bar com 4 itens max
- **Estados vazios informativos** — ilustração simples + texto direto

---

## 2. Sistema de Cores Minimalista

### 2.1 Paleta Light (Revisada)
```typescript
export const TCSMinimalLight = {
  // Fundação
  background: '#FAFAFA',      // Cinza quase branco (mais neutro)
  surface: '#FFFFFF',         // Branco puro
  foreground: '#0A0A0A',      // Preto quase puro (melhor contraste)
  
  // Primária (verde institucional mantido, saturação reduzida)
  primary: '#1F5B4E',         // Verde escuro minimalista
  primaryLight: '#F0F6F4',    // Verde muito claro (fundos sutis)
  
  // Neutros
  muted: '#737373',           // Cinza médio (textos secundários)
  border: '#E5E5E5',          // Cinza claro (divisores quando necessário)
  
  // Semânticos (apenas quando necessário)
  success: '#16A34A',         // Verde puro
  warning: '#CA8A04',         // Amarelo escuro
  danger: '#DC2626',          // Vermelho puro
  
  // Riscos (simplificados)
  r1: '#16A34A',
  r2: '#CA8A04', 
  r3: '#EA580C',
  r4: '#DC2626',
};
```

### 2.2 Paleta Dark (Revisada)
```typescript
export const TCSMinimalDark = {
  background: '#0A0A0A',      // Preto profundo
  surface: '#171717',         // Cinza escuro
  foreground: '#FAFAFA',      // Branco suave
  
  primary: '#5FB09E',         // Verde claro (contraste 4.5:1)
  primaryLight: '#1C2B27',    // Verde escuro (fundos)
  
  muted: '#A3A3A3',           // Cinza claro
  border: '#262626',          // Cinza escuro
  
  success: '#4ADE80',
  warning: '#FACC15',
  danger: '#F87171',
  
  r1: '#4ADE80',
  r2: '#FACC15',
  r3: '#FB923C',
  r4: '#F87171',
};
```

### 2.3 Uso de Cores
- **Background:** 1 cor apenas por tela (background ou surface)
- **Primária:** apenas em CTAs principais (1-2 por tela)
- **Semânticas:** apenas em badges de risco e alertas
- **Bordas:** evitar sempre que possível, usar espaçamento

---

## 3. Tipografia Minimalista

### 3.1 Scale Reduzida (6 níveis ao invés de 7)
```typescript
export const MinimalTypography = {
  // Display — Números grandes, títulos hero
  display: { 
    fontSize: 48, 
    lineHeight: 56, 
    fontWeight: '700',
    letterSpacing: -1.2 
  },
  
  // Heading — Títulos de seção
  h1: { 
    fontSize: 28, 
    lineHeight: 34, 
    fontWeight: '700',
    letterSpacing: -0.6 
  },
  
  // Subheading — Subtítulos
  h2: { 
    fontSize: 18, 
    lineHeight: 24, 
    fontWeight: '600' 
  },
  
  // Body — Texto padrão
  body: { 
    fontSize: 16, 
    lineHeight: 24, 
    fontWeight: '400' 
  },
  
  // Small — Labels, metadados
  small: { 
    fontSize: 14, 
    lineHeight: 20, 
    fontWeight: '500' 
  },
  
  // Micro — Timestamps, auxiliares
  micro: { 
    fontSize: 12, 
    lineHeight: 16, 
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
};
```

### 3.2 Hierarquia de Uso
1. **Display:** KPIs principais (ex: "42" vistorias)
2. **H1:** Títulos de tela (ex: "Dashboard")
3. **H2:** Títulos de seção (ex: "Seu turno")
4. **Body:** Descrições, conteúdo
5. **Small:** Labels de campo, metadados
6. **Micro:** Timestamps, eyebrows (ex: "AÇÃO PRINCIPAL")

---

## 4. Espaçamento Minimalista

### 4.1 Scale de 8px (simplificada)
```typescript
export const MinimalSpacing = {
  0: 0,
  1: 4,    // Micro (ícone + texto)
  2: 8,    // Pequeno (elementos relacionados)
  3: 16,   // Base (padrão entre elementos)
  4: 24,   // Médio (entre grupos)
  5: 32,   // Grande (entre seções)
  6: 48,   // Extra (separação forte)
  7: 64,   // Hero (espaços dramáticos)
};
```

### 4.2 Aplicação
- **Padding de tela:** 20px horizontal (mobile), 32px (tablet)
- **Gap entre seções:** 48px (móvel), 64px (tablet)
- **Gap entre cards:** 16px
- **Padding interno de card:** 24px
- **Altura mínima touch:** 48px (mobile), 44px (iOS)

---

## 5. Componentes Redesenhados

### 5.1 Button Minimalista

**Variantes reduzidas: 3 apenas**
```typescript
type ButtonVariant = 'primary' | 'ghost' | 'danger';

// ANTES (4 variantes, bordas em todos)
// primary: background + border
// secondary: background + border + accent
// ghost: transparent + border
// danger: background danger

// DEPOIS (3 variantes, sem bordas desnecessárias)
// primary: background sólido, sem borda
// ghost: transparente, sem borda, texto muted
// danger: background danger, sem borda
```

**Tamanhos: 2 apenas**
```typescript
type ButtonSize = 'md' | 'lg';
// Remover 'sm' — causa problemas de touch target
```

**Visual:**
- Remover border em primary e danger
- Border radius: 12px (mais moderno)
- Pressed state: opacity 0.9 apenas (sem scale)
- Padding: 16px horizontal, 14px vertical (md)

### 5.2 Card Minimalista

**Variantes reduzidas: 2 apenas**
```typescript
type CardVariant = 'default' | 'flat';
// Remover 'variant' e 'outlined' — confusão visual
```

**Visual:**
- Remover sombra (elevation: 0)
- Border: apenas 1px em #E5E5E5 (light) ou #262626 (dark)
- Border radius: 16px (mais generoso)
- Padding: 24px (uniforme)
- Background: sempre surface (contraste com background)

### 5.3 MetricCard Minimalista

**Estrutura:**
```
┌─────────────────────────────┐
│                             │
│  42          [ícone sutil]  │  ← Display (número grande)
│  Vistorias hoje             │  ← Small (label)
│  ↑ 12% vs ontem             │  ← Micro (detalhe opcional)
│                             │
└─────────────────────────────┘
```

**Mudanças:**
- Número: fontSize 48 (ao invés de dinâmico)
- Label: fontSize 14, color muted
- Ícone: 20px, color muted, posição top-right
- Remover background colorido — usar borda colorida left (4px)

### 5.4 ModuleCard Minimalista

**Estrutura:**
```
┌──────────────────┐
│                  │
│  [ícone 32px]    │
│                  │
│  Vistorias       │  ← h2
│  Histórico       │  ← small, muted
│                  │
└──────────────────┘
```

**Mudanças:**
- Ícone: 32px (maior, mais clareza)
- Sem background no ícone — apenas o ícone puro
- Título: fontWeight 600 (ao invés de bold)
- Descrição: 1 linha apenas, truncar com ellipsis
- Padding: 20px (ao invés de variável)

---

## 6. Layouts Minimalistas

### 6.1 Dashboard (Agente) — Redesign

**Estrutura hierárquica:**

```
┌─────────────────────────────────────┐
│ [header fixo, sem sombra]           │
│                                     │
│ Olá, Pedro                          │ ← h1
│ Segunda-feira, 5 de agosto          │ ← small, muted
│                         [avatar]    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ [scroll infinito]                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Seu turno                       │ │ ← h2
│ │                                 │ │
│ │ ┌─────┐  ┌─────┐  ┌─────┐      │ │
│ │ │  8  │  │  3  │  │ 42  │      │ │ ← MetricCards
│ │ │Hoje │  │Risk │  │Tot  │      │ │
│ │ └─────┘  └─────┘  └─────┘      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │ Nova vistoria                   │ │ ← CTA Hero
│ │ Inicie uma coleta técnica       │ │
│ │                                 │ │
│ │ [Iniciar] ──────────────────→   │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Acesso rápido              [ver+]  │ ← h2 + link
│                                     │
│ ┌─────────┐  ┌─────────┐           │
│ │[ícone]  │  │[ícone]  │           │ ← ModuleCards
│ │Vistorias│  │Mapa     │           │    (grid 2 col)
│ └─────────┘  └─────────┘           │
│                                     │
└─────────────────────────────────────┘
```

**Mudanças principais:**
1. **Remover date no topo** — mover para subtitle do nome
2. **Remover chips de contexto** — desnecessário (óbvio que é agente)
3. **Remover botão calendário** — mover para módulos
4. **Simplificar métricas** — 3 cards compactos, números grandes
5. **CTA hero menor** — menos pomposo, mais direto
6. **Módulos: 2 apenas** — os 2 mais usados, link "ver todos"

### 6.2 Header Minimalista (todas as telas)

**Antes:**
- Data em linha separada
- Nome + chips de contexto
- 3 botões à direita

**Depois:**
```
Olá, Pedro                    [avatar]
Segunda-feira, 5 de agosto
```
- 2 linhas apenas
- Avatar único à direita
- Sem bordas, sem sombras
- Background: transparent

### 6.3 Bottom Navigation Minimalista

**Itens: 4 apenas (ao invés de 5+)**
```
[Início]  [Vistorias]  [Mapa]  [Mais]
```

**Visual:**
- Ícones: 24px (maiores)
- Labels: sempre visíveis (não apenas no ativo)
- Indicador ativo: ponto 4px abaixo do ícone (não background)
- Height: 64px (mais generoso)
- Sem bordas superiores

---

## 7. Animações Minimalistas

### 7.1 Princípios
- **Duração:** 200ms padrão (ao invés de 300ms)
- **Easing:** ease-out apenas (resposta imediata)
- **Propriedades:** opacity e transform apenas (nunca width/height)
- **Press feedback:** opacity 0.9 (sem scale)

### 7.2 Remover Animações
- ❌ Entrada de tela (janky, lento)
- ❌ Skeleton screens animados (distrativo)
- ❌ Progress bars animados (quando estático serve)
- ❌ Hover effects (mobile não tem hover)

### 7.3 Manter Animações
- ✅ Pressable feedback (opacity)
- ✅ Modal slide up (200ms)
- ✅ Pull to refresh (nativo)
- ✅ Loading spinner (quando necessário)

---

## 8. Estados Minimalistas

### 8.1 Loading State
**Antes:** Skeleton screens complexos, matching layout

**Depois:** 
```
[Spinner 32px]
Carregando...
```
- Centralizado
- Texto opcional (se demora > 2s)
- Sem skeleton (menos elementos, menos confusão)

### 8.2 Empty State
**Antes:** Ilustração + título + subtítulo + botão

**Depois:**
```
[Ícone 48px, muted]

Nenhuma vistoria ainda

[Botão ghost] Iniciar primeira vistoria
```
- Ícone simples (Feather)
- Título direto
- 1 ação opcional
- Sem ilustrações complexas

### 8.3 Error State
**Antes:** Banner vermelho + ícone + título + descrição + botão

**Depois:**
```
[Ícone alert-circle 32px, danger]
Erro ao carregar dados
[Link] Tentar novamente
```
- Texto direto
- Link ao invés de botão
- Sem background colorido (apenas ícone)

---

## 9. Implementação — Cronograma

### Fase 1: Fundação (3 dias)
**Dia 1-2:**
- [ ] Criar `constants/MinimalColors.ts`
- [ ] Criar `constants/MinimalTypography.ts`
- [ ] Criar `constants/MinimalSpacing.ts`
- [ ] Atualizar `ThemeContext` para usar paletas minimalistas

**Dia 3:**
- [ ] Atualizar `Button.tsx` (3 variantes, 2 tamanhos)
- [ ] Atualizar `Card.tsx` (2 variantes, sem sombra)
- [ ] Criar testes visuais (Storybook ou manual)

### Fase 2: Componentes (4 dias)
**Dia 4-5:**
- [ ] Redesenhar `MetricCard.tsx` (número display, borda colorida)
- [ ] Redesenhar `ModuleCard.tsx` (ícone 32px, padding uniforme)
- [ ] Redesenhar `SectionHeader.tsx` (h2 + optional link)

**Dia 6-7:**
- [ ] Criar `MinimalHeader.tsx` (2 linhas, avatar)
- [ ] Atualizar `BottomNavBar.tsx` (4 itens, indicador minimalista)
- [ ] Criar componentes de estado (Loading, Empty, Error)

### Fase 3: Telas Principais (5 dias)
**Dia 8-10:**
- [ ] Redesenhar `dashboard.tsx` (layout simplificado)
- [ ] Redesenhar `inspecoes/index.tsx` (lista limpa)
- [ ] Redesenhar `mapas.tsx` (controles minimalistas)

**Dia 11-12:**
- [ ] Redesenhar `perfil.tsx`
- [ ] Redesenhar `admin/index.tsx`
- [ ] Polimento final e ajustes

### Fase 4: Validação (2 dias)
**Dia 13:**
- [ ] Testes em dispositivos reais (iPhone SE, Pixel 6, tablet)
- [ ] Validação WCAG AA (contraste, touch targets)
- [ ] Performance check (60fps em listas)

**Dia 14:**
- [ ] Ajustes finais
- [ ] Documentação de padrões
- [ ] Handoff para dev

---

## 10. Checklist de Qualidade Minimalista

### Design
- [ ] Máximo 3 cores por tela (primária, neutra, semântica)
- [ ] Hierarquia tipográfica clara (ratio 2:1 entre níveis)
- [ ] Espaçamento generoso (32px+ entre seções)
- [ ] Sem bordas desnecessárias (usar espaçamento)
- [ ] Sem sombras excessivas (max 4dp)
- [ ] Ícones essenciais apenas (remover decorativos)
- [ ] 1 ação primária destacada por tela

### Acessibilidade
- [ ] Contraste WCAG AA (4.5:1 texto, 3:1 UI)
- [ ] Touch targets ≥ 48px
- [ ] Labels descritivos em todos os ícones
- [ ] Funciona com tamanhos de fonte do sistema
- [ ] Testado com screen reader

### Performance
- [ ] 60fps em scrolling
- [ ] Animações ≤ 200ms
- [ ] Loading < 2s (ou feedback claro)
- [ ] Imagens otimizadas (WebP, lazy load)

### Minimalismo
- [ ] Tela pode ser explicada em 5 segundos
- [ ] Sem elementos que não agregam valor
- [ ] Foco claro na tarefa principal
- [ ] Espaço em branco ≥ 30% da tela

---

## 11. Comparação Antes/Depois

### Dashboard Agente

**Antes:**
- Header: 3 linhas + 3 botões
- Métricas: 3 cards grandes (layout complexo)
- CTA: painel colorido pomposo
- Módulos: 4 cards visíveis
- **Total elementos:** ~35

**Depois:**
- Header: 2 linhas + 1 avatar
- Métricas: 3 cards compactos
- CTA: card simples com botão
- Módulos: 2 cards + link "ver mais"
- **Total elementos:** ~20 (**-43%**)

### MetricCard

**Antes:**
- Background colorido
- Ícone com background
- Número + label + detail (3 níveis)
- Borda + sombra

**Depois:**
- Background branco/surface
- Borda colorida (4px left)
- Número + label + detail opcional (2-3 níveis)
- Sem sombra
- **Redução:** -2 elementos visuais

### Button

**Antes:**
- 4 variantes
- 3 tamanhos
- Bordas em todos
- Sombra em alguns

**Depois:**
- 3 variantes
- 2 tamanhos
- Sem bordas (exceto ghost quando necessário)
- Sem sombra
- **Simplificação:** 33% menos opções

---

## 12. Métricas de Sucesso

### Objetivas
- **Tempo para completar tarefa principal:** -20%
- **Elementos por tela:** -30%
- **Tempo de loading percebido:** -25%
- **Contraste WCAG:** 100% AA compliance

### Subjetivas (pesquisa pós-implementação)
- **Clareza visual:** 8+/10
- **Facilidade de uso:** 8+/10
- **Preferência vs design anterior:** 70%+ preferem novo

### Técnicas
- **Bundle size:** sem aumento (mesmas libs)
- **Performance:** 60fps mantido
- **Tempo de build:** sem impacto

---

## 13. Referências e Inspirações

### Design Systems Minimalistas
- **Linear:** Hierarquia tipográfica, espaçamento generoso
- **Apple HIG:** Clareza, profundidade por camadas
- **Vercel:** Monocromático, foco em conteúdo
- **Stripe:** Dados primeiro, UI discreta

### Princípios
- **Dieter Rams:** "Less, but better"
- **Edward Tufte:** Data-ink ratio (maximizar informação, minimizar elementos)
- **Swiss Design:** Grid, tipografia, espaço em branco

### Mobile-First
- **iOS Guidelines:** Espaçamento 44pt, hierarquia clara
- **Material Design 3:** Elevação sutil, cores semânticas

---

## 14. Próximos Passos

1. **Validação com stakeholder (Pedro)**
   - Apresentar mockups comparativos
   - Discutir tradeoffs (menos elementos = menos funções visíveis)
   - Confirmar cronograma

2. **Protótipo interativo**
   - Criar protótipo Figma/Penpot com fluxo principal
   - Testar com 3-5 usuários reais (agentes)
   - Iterar com feedback

3. **Implementação incremental**
   - Começar por componentes base (Button, Card)
   - Aplicar em 1 tela piloto (Dashboard)
   - Medir métricas antes/depois
   - Expandir para demais telas

4. **Documentação viva**
   - Criar Storybook com todos os componentes
   - Documentar quando usar cada variante
   - Exemplos de do's and don'ts

---

## Conclusão

Este redesign minimalista não é apenas sobre estética — é sobre **funcionalidade através da simplicidade**. Cada elemento removido é uma decisão cognitiva a menos para o usuário. Cada espaço em branco é um respiro visual. Cada hierarquia clara é uma tarefa completada mais rápido.

**O objetivo:** Um dashboard que se torna invisível, permitindo que o agente foque no que importa — a vistoria técnica de qualidade.

**O resultado esperado:** Uma interface que não precisa de treinamento, que funciona sob sol forte, que carrega rápido, que não intimida. Uma ferramenta que desaparece para deixar o trabalho emergir.

---

**Autor:** Kiro AI — Design Engineer  
**Versão:** 1.0  
**Data:** 05 de agosto de 2026  
**Contato:** Disponível para dúvidas e iterações
