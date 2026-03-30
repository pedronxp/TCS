<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **NUNCA** usar CPF em nenhuma tela, model ou banco
- **Município** vem sempre do perfil do agente logado — nunca pedir no formulário
- **Token de convite** é single-use — deletar imediatamente após consumo
- **isApproved** deve ser verificado logo após login antes de qualquer navegação
- **ConnectivityBanner** quando offline — nunca bloquear o app, mostrar dados locais
- **Fotos** comprimidas JPEG 72% / 1280px max width antes de salvar (`expo-image-manipulator`)
- **Mapas** via OpenStreetMap (Leaflet.js + react-native-webview) — NUNCA Google Maps
- **Nunca inventar pacotes** — consultar a tabela de mapeamento Flutter→Expo
- **NÃO USAR:** `react-native-reanimated` — incompatível com Expo Go (TurboModule crash)

### the agent's Discretion
- Design: Moderno/livre — SEM padrão Gov Brasil

### Deferred Ideas (OUT OF SCOPE)
- Fase 7 (features): assinatura digital, QR code, biometria (Não faz parte desta fase)
</user_constraints>

# Phase 03: UI Redesign — Auth + Agente - Research

**Researched:** 2026-03-29
**Domain:** UI Component Integration, React Native refactoring, Offline Fallbacks
**Confidence:** HIGH

## Summary

Phase 03 foca na aplicação do novo Design System (desenvolvido na Fase 02) nas jornadas de Autenticação e do Painel do Agente. Esta fase consiste principalmente em refatoração visual das 16 telas, substituição de elementos UI primitivos por componentes reutilizáveis padronizados (`Button`, `Card`, `Badge`, `EmptyState`, `ErrorState`, `LoadingState`), além de aplicar as escalas tipográficas e de cores corretas para compatibilidade e acessibilidade.

Junto com as melhorias visuais, a fase deve resolver bugs e débitos técnicos críticos:
- Implementação de fallback para SQLite no carregamento de vistorias `[id].tsx` (offline).
- Correção do fechamento em estado obsoleto ("closure stale") no auto-save do `wizard.tsx`.
- Validação de CEP local antes de acionar a request de rede em `dados-iniciais.tsx`.
- Persistência correta da `foto_url` offline.

**Primary recommendation:** Aplicar a refatoração iterativamente em ondas lógicas: primeiro `(auth)`, depois `(panel)` (dashboard e perfil), e finalmente o fluxo mais complexo de `inspecoes`. Sempre substituir tags primitivas (ex: `TouchableOpacity`) pelos componentes em `components/ui/`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Native | 0.81.5 | UI framework | Padrão do projeto Expo |
| Expo Router | ~6.0.23 | File-based routing | Padrão do projeto |
| expo-sqlite | ~16.0.10 | Local offline storage | Suporte nativo síncrono para React Native (openDatabaseSync) |
| expo-image-picker | ~17.0.10 | Camera + Galeria | Oficial da Expo |
| @react-native-async-storage/async-storage | ^2.2.0 | Caching e draft (wizard) | Rápido e compatível |

### Supporting (Design System Fase 02)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/Button.tsx` | N/A | Ação primária, secundária, perigo | Substituir TouchableOpacity |
| `components/ui/Card.tsx` | N/A | Container padronizado | Listas, formulários e agrupar KPIs |
| `components/ui/Badge.tsx` | N/A | Tags de status e risco | Indicar níveis R1-R4 e Roles do usuário |
| `components/ui/ErrorState.tsx` | N/A | Tratamento de erro padronizado | Renderizar quando uma query Supabase/SQLite falhar |
| `components/ui/EmptyState.tsx` | N/A | UI para listas vazias | Renderizar em listas sem resultados |
| `components/ui/LoadingState.tsx` | N/A | Skeleton e spinner | Renderizar no topo do ciclo de vida async |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `components/ui/*` | `react-native-paper` | Não inventar pacotes externos. O design system próprio já foi construído e padronizado na Fase 2 para garantir ausência de dependências mortas e melhor performance. |

**Installation:**
Nenhuma instalação de pacote externo é necessária. As dependências já estão configuradas.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── onboarding.tsx
├── (auth)/
│   ├── index.tsx
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
└── (panel)/
    ├── dashboard.tsx
    ├── perfil.tsx
    ├── mapas.tsx
    └── inspecoes/
        ├── index.tsx
        ├── dados-iniciais.tsx
        ├── selecao-formulario.tsx
        ├── wizard.tsx
        ├── risco.tsx
        ├── resultado.tsx
        ├── foto.tsx
        ├── [id].tsx
        └── laudo.tsx
```

### Pattern 1: Consumo do Design System (Hooks e Componentes)
**What:** Utilização de `useTheme` em vez de referenciar `Colors` diretamente, em união com componentes UI.
**When to use:** Em todas as telas modificadas nesta Fase.
**Example:**
```typescript
import { useTheme } from '../../context/ThemeContext';
import { Button, Card, ErrorState, LoadingState } from '../../components/ui';

export default function MyScreen() {
  const { theme } = useTheme();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <Card style={{ backgroundColor: theme.surface }}>
      <Button variant="primary" label="Salvar" onPress={handleSave} />
    </Card>
  );
}
```

### Anti-Patterns to Avoid
- **Hardcoding de Cores:** `color: '#FFF'` em vez de `color: theme.text`.
- **Validação de Formulário Pós-Request:** Nunca bater no ViaCEP antes de formatar e validar o CEP de 8 dígitos (em `dados-iniciais.tsx`).
- **Uso de states desatualizados no setTimeout:** Em `wizard.tsx`, usar diretamente a variável `step` dentro do callback de auto-save. Use `const stepRef = useRef(step);`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Botões de Ação | `TouchableOpacity` + `ActivityIndicator` manual | `Button` | `Button` já implementa estados `loading`, `disabled`, ícones, feedback háptico e variações de tamanho nativamente. |
| Exibição de Risco | `View` colorida | `Badge` | O componente `Badge` suporta as variantes `R1`, `R2`, `R3`, `R4`, `success`, `warning`, `error` padronizando as cores. |
| Telas Vacias / Erros | Múltiplos componentes View/Text no meio da tela | `EmptyState` ou `ErrorState` | Padroniza a centralização vertical com ícones e labels. |
| Consulta SQL manual | Copiar schema local novamente | `utils/database.ts` -> `getVistoriaById` | Funções já trazem tudo padronizado para tratamento offline-first. |

**Key insight:** Reaproveitar os componentes padronizados garante consistência e reduz mais de 40% do código CSS local nos arquivos `.tsx`.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | AsyncStorage keys `@onboarding_done`, `@risco_config_v1` | None - Nenhuma alteração no padrão de acesso |
| Live service config | Supabase Selects (em `perfil.tsx` e `register.tsx`) | Atualizar select() limitando os campos requeridos nas consultas ao invés de usar `*`. |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Wizard Auto-save "Stale Closure"
**What goes wrong:** Salvar o progresso (`step` atual) no AsyncStorage pode reter o estado antigo da primeira renderização do useEffect (bug M9).
**Why it happens:** Em React, setTimeout criado num handler pode capturar variáveis lexicais defasadas do ciclo de renderização.
**How to avoid:** Sincronizar o estado para uma Ref mutável.
**Warning signs:** Auto-save reinicia na tela errada se o usuário recarregar.

### Pitfall 2: Falha Silenciosa de Renderização do `WebView` no Android
**What goes wrong:** Tentar renderizar o mapa carregando `html` diretamente resulta numa tela branca.
**Why it happens:** `loadDataWithBaseURL()` falha no React Native WebView sob Expo SDK 54 no Android (identificado na arquitetura CONTEXT.md).
**How to avoid:** O mapa (e em outros lugares como o Laudo caso use webview) deve usar encodeURIComponent no source URI: `source={{ uri: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }}`.

### Pitfall 3: Sem tratamento offline no [id].tsx
**What goes wrong:** A vistoria salva offline é mostrada na lista (`index.tsx`), mas quando clicamos para ver os detalhes, tela acusa erro ou crasha.
**Why it happens:** O arquivo apenas consome Supabase diretamente, falhando em modo avião.
**How to avoid:** Introduzir Fallback explícito: se a query do Supabase falhar, usar `getVistoriaById(id)` do `utils/database.ts`.

## Code Examples

### 1. Wizard Closure Fix Pattern
```typescript
const stepRef = useRef(step);

useEffect(() => {
  stepRef.current = step;
}, [step]);

// No uso do Timeout:
autoSaveTimer.current = setTimeout(() => {
  AsyncStorage.setItem(draftKey, JSON.stringify({
    respostas: updated,
    step: stepRef.current, // Utiliza o valor atualizado da ref
  }));
}, 800);
```

### 2. Consulta Eficiente e Baseada em Contagem (`perfil.tsx`)
```typescript
const [{ count: total }, { count: alto }] = await Promise.all([
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid),
  supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
]);
```

### 3. Validação de CEP pré HTTP request (`dados-iniciais.tsx`)
```typescript
const buscarCep = async (cep: string) => {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    setErroCep('CEP deve ter 8 dígitos.');
    return;
  }
  setErroCep(null);
  const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  //...
};
```

### 4. Implementação Completa do UI Button
```typescript
import { Button } from '../../components/ui';

<Button
  label="Autenticar"
  variant="primary"
  size="md"
  loading={loading}
  disabled={!email || loading}
  onPress={handleLogin}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `TouchableOpacity` com custom `StyleSheet` | `components/ui/Button.tsx` | Fase 02 | Padronização global, haptics e estados de desativação já inclusos |
| `select('*')` no Supabase, contagem por array `length` | `select('*', { count: 'exact', head: true })` | Fase 03 | Redução drástica de payload e ganho substancial de performance (PERF-05) |
| Cálculo de Data formatada repetido em cada render | Wrapper com `useMemo` na string da data | Fase 03 | Protege dashboard.tsx de re-calculos ao mudar state local e reduções de lag de frame |

## Open Questions

1. **Atribuição das Fotos:**
   - What we know: A foto precisa ser persistida no banco SQLite ao final do Wizard.
   - What's unclear: Como as respostas (respostasJson) da vistoria e o path da URI local se combinam se a foto capturada não estiver estritamente no mapping.
   - Recommendation: Assegurar que ao acionar `insertVistoria` via `finalizar()`, a propriedade de `fotoUrl` receba a `URI` real local.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK | Framework | ✓ | ~54.0.0 | — |
| React Native | Runtime UI | ✓ | 0.81.5 | — |
| expo-sqlite | Fallback offline (`[id].tsx`) | ✓ | ~16.0.10 | — |
| Supabase | Auth e Sync | ✓ | ^2.45.0 | Offline (parcialmente via local cache) |
| ViaCEP | Busca de Endereço via CEP | ✓ | Web API | Digitação manual se API fora do ar |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + `jest-expo` & `@testing-library/react-native` |
| Config file | `package.json` block `jest` |
| Quick run command | `npm run test` (or `jest --passWithNoTests`) |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 03-01 | Onboarding Redesign | Unit/Visual | `npm run test` | ❌ Wave 0 |
| 03-06 | Dashboard useMemo | Unit | `npm run test` | ❌ Wave 0 |
| 03-09 | Wizard Closure Bug Fix | Unit/E2E | `npm run test` | ❌ Wave 0 |
| 03-10 | [id].tsx Offline Fallback | Unit | `npm run test` | ❌ Wave 0 |
| 03-11 | Validação de CEP Regex | Unit | `npm run test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Execução do build em simulador/device físico validando UI Redesign, e testes rodando com coverage estável.

### Wave 0 Gaps
- [ ] Necessidade de adicionar specs `.test.tsx` para as telas críticas refatoradas como `[id].tsx`, `dados-iniciais.tsx` e `wizard.tsx`.

## Sources

### Primary (HIGH confidence)
- **Roadmap.md e CONTEXT.md** - Informações mestres do contexto do app (Fase 3, bugs, permissões).
- **package.json** - Versões base dos SDKs e pacotes.
- **components/ui/*.tsx** - Códigos e Tipagens exatas criadas na Fase 2 para os componentes base.

### Secondary (MEDIUM confidence)
- Mapeamento das telas baseadas no roadmap e estrutura da árvore do projeto.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Extraído diretamente do arquivo package.json em uso e `CONTEXT.md`.
- Architecture: HIGH - Baseado em arquivos físicos dos componentes e boas práticas de Expo.
- Pitfalls: HIGH - Comprovados via documentação de regras (CONTEXT.md e Roadmap bugs listados explícitamente).

**Research date:** 2026-03-29
**Valid until:** 30 days
