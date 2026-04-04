# Phase 11: Mapa Nativo — Research

**Researched:** 2026-04-03
**Domain:** react-native-maps, Expo SDK 54, Google Maps Android, Map Clustering
**Confidence:** HIGH

---

## Summary

A tela de mapa do app (`app/(panel)/mapas.tsx`) já foi migrada de WebView+Leaflet para `react-native-maps` durante a fase 06. O arquivo atual usa `MapView` do react-native-maps com `ClusteredMapView` do `react-native-map-clustering`, `Marker`, `Heatmap`, e suporte a Google Maps no Android. A chave da Google Maps API **já está configurada** em `app.json` no campo `android.config.googleMaps.apiKey`. O pacote `react-native-maps` versão `1.20.1` está instalado — essa é a versão bundled pelo Expo SDK 54 no Expo Go, o que é correto.

O problema central da fase 11 é diagnosticar e corrigir por que o mapa ainda pode exibir tela branca. As causas mais prováveis são: (1) `ClusteredMapView` de `react-native-map-clustering` é uma biblioteca sem manutenção ativa que tem crashs conhecidos com Expo SDK 54 e React Native 0.81; (2) a chave da API pode não estar sendo injetada corretamente no AndroidManifest em dev builds; (3) o componente `ClusteredMapView` pode estar substituindo o `MapView` de forma que impede o mapa de renderizar.

**Recomendação primária:** Substituir `ClusteredMapView` (react-native-map-clustering) pelo `MapView` padrão do react-native-maps com clustering manual via `supercluster` ou simplesmente renderizar marcadores simples sem clustering. Manter a chave da API no campo `android.config.googleMaps.apiKey` (que funciona com react-native-maps 1.20.1 sem config plugin).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAPA-01 | Agente consegue visualizar o mapa sem tela branca no Android/iOS | Diagnóstico de `ClusteredMapView` + fallback para `MapView` padrão resolve o crash |
| MAPA-02 | Tiles do mapa carregam corretamente (substituir WebView+Leaflet) | react-native-maps 1.20.1 já instalado + Google Maps API key já em app.json — tiles devem carregar quando MapView renderiza corretamente |
</phase_requirements>

---

## Estado Atual do Arquivo (Análise da Tela Quebrada)

**Arquivo:** `app/(panel)/mapas.tsx`

A tela atual já usa react-native-maps (migração feita na fase 06). Estrutura do componente:

```
MapasScreen
├── ClusteredMapView (react-native-map-clustering)  ← RISCO PRINCIPAL
│   ├── Marker × N (vistorias)
│   └── Heatmap (Android only, quando showHeatmap=true)
├── Header flutuante (position: absolute)
├── Filtros (risco + período)
├── FABs (fit, heatmap, estilo)
├── Legenda
├── Popup do marcador selecionado
└── Modal de estilo do mapa
```

### O que o mapa mostra

- **Marcadores de vistorias** com coordenadas `latitude`/`longitude` da tabela `vistorias` no Supabase
- **Filtros** por nível de risco (R1/R2/R3/R4) e período (7d/30d/todos)
- **Heatmap** (Android apenas) com peso proporcional ao nível de risco
- **Clustering** de marcadores próximos (via `ClusteredMapView`)
- **Fallback offline** via SQLite (`getVistoriasByAgente` / `getVistoriasByMunicipio`)
- **Estilos de mapa**: padrão, satélite, relevo, escuro (modo escuro via `customMapStyle` JSON)
- **Localização do usuário** via `expo-location`
- **Popup de detalhes** ao clicar em marcador com link para tela de detalhes da vistoria

---

## Standard Stack

### Core (já instalado)
| Library | Version instalada | Purpose | Status |
|---------|---------|---------|--------|
| react-native-maps | 1.20.1 | MapView nativo (Google Maps / Apple Maps) | OK — versão correta para Expo SDK 54 |
| expo-location | ~19.0.8 | GPS do usuário | OK |
| react-native-map-clustering | 4.0.0 | Clustering de marcadores | RISCO — sem manutenção, crashs com SDK 54 |

### Dependências presentes mas redundantes (pós-migração)
| Library | Versão | Status |
|---------|--------|--------|
| leaflet | 1.9.4 | Pode ser removida (WebView abandonada) |
| leaflet.heat | 0.2.0 | Pode ser removida |
| leaflet.markercluster | 1.5.3 | Pode ser removida |
| react-native-webview | 13.15.0 | Ainda usada? Verificar outros usos antes de remover |

### Alternativas de clustering (se react-native-map-clustering for removido)
| Opção | Abordagem | Recomendação |
|-------|-----------|--------------|
| Marcadores simples (sem clustering) | Renderizar todos os `<Marker>` diretamente no `MapView` padrão | **Recomendado para fase 11** — mais simples, elimina o risco |
| react-native-clusterer | JSI bindings, C++ supercluster | Overkill para este caso |
| Clustering manual com supercluster | `@mapbox/supercluster` + `MapView` padrão | Alternativa robusta se clustering for requisito hard |

---

## Configuração no app.json — Estado Atual

```json
// app.json — como está HOJE (correto para react-native-maps 1.20.1)
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyD9THUSNNwA0aQ54cacCs9o0-SloWA9hPY"
        }
      }
    },
    "plugins": [
      // react-native-maps NÃO está nos plugins — CORRETO para v1.20.1
    ]
  }
}
```

**Por que isso está correto:** A versão 1.20.1 (bundled no Expo Go SDK 54) NÃO suporta o config plugin `["react-native-maps", {...}]`. O config plugin foi adicionado apenas a partir da versão 1.22+. Para 1.20.1, a chave da API deve ser colocada em `android.config.googleMaps.apiKey` — exatamente como está hoje.

**Risco de mudança:** Adicionar `react-native-maps` ao array `plugins` com v1.20.1 causa conflito e quebra o build.

---

## Architecture Patterns

### Padrão recomendado para fase 11: MapView padrão sem ClusteredMapView

```typescript
// Source: react-native-maps docs + análise da fase 11
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

// SUBSTITUIR: <ClusteredMapView ...> por <MapView ...>
// Sem clustering → mais simples, mais estável com Expo SDK 54

<MapView
  ref={mapRef}
  style={StyleSheet.absoluteFillObject}
  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
  mapType={currentStyleConfig.mapType}
  customMapStyle={mapStyle === 'escuro' ? DARK_MAP_STYLE : undefined}
  initialRegion={initialRegion}
  showsUserLocation
  showsMyLocationButton={false}
>
  {filteredMarkers.map(m => (
    <Marker
      key={m.id}
      coordinate={{ latitude: m.lat, longitude: m.lng }}
      pinColor={getRiscoColor(m.nivelRisco)}
      onPress={() => setSelectedMarker(m)}
    />
  ))}
  {showHeatmap && Platform.OS === 'android' && (
    <Heatmap points={heatmapPoints} ... />
  )}
</MapView>
```

### Por que PROVIDER_GOOGLE no Android é obrigatório

```typescript
// Sem PROVIDER_GOOGLE no Android, o mapa usa o provider padrão
// (pode ser OSM ou fallback sem tiles) — causa tela em branco
provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
```

### Região inicial robusta

```typescript
// Fallback para Brasília quando localização do usuário não está disponível
const initialRegion = userLocation
  ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
  : { latitude: -15.7801, longitude: -47.9292, latitudeDelta: 30, longitudeDelta: 30 };
// Este padrão já existe em mapas.tsx e está correto
```

### Anti-Patterns a Evitar

- **Não usar ClusteredMapView com Expo SDK 54 + RN 0.81**: crashs conhecidos reportados (expo/expo#40856)
- **Não adicionar react-native-maps ao array plugins**: conflito com v1.20.1 que não tem config plugin
- **Não remover android.config.googleMaps.apiKey**: sem isso, tiles do Google Maps não carregam no Android (tela em branco com logo Google no canto)
- **Não usar PROVIDER_DEFAULT no Android**: não garante Google Maps tiles

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|----------|---------------|-------------------|---------|
| Clustering de marcadores | Algoritmo de agrupamento manual | react-native-maps Marker simples (sem clustering na fase 11) | Clustering é otimização, não requisito para MAPA-01/02 |
| Heatmap de risco | Canvas/SVG custom | `<Heatmap>` do react-native-maps | Nativo, já implementado em mapas.tsx |
| Tiles de mapa | WebView + Leaflet | react-native-maps MapView | Decisão arquitetural já tomada na fase 06 |
| Localização do usuário | Tracking manual | `showsUserLocation` prop do MapView | Builtin, sem permissão extra necessária |

---

## Common Pitfalls

### Pitfall 1: ClusteredMapView causando tela branca / crash silencioso
**O que acontece:** `react-native-map-clustering` 4.0.0 tem crashs conhecidos com Expo SDK 54 + React Native 0.81 (New Architecture). O crash pode ser silencioso — tela branca sem erro no console.
**Por que acontece:** A biblioteca não é mantida ativamente; internamente wraps o MapView mas pode ter incompatibilidades com a nova arquitetura do React Native.
**Como evitar:** Substituir `ClusteredMapView` pelo `MapView` padrão do react-native-maps.
**Sinais de alerta:** Tela em branco imediatamente ao abrir o mapa (sem loading spinner, sem erro visível).

### Pitfall 2: Tela branca com logo Google no canto inferior esquerdo
**O que acontece:** Google Maps autentica mas não consegue carregar tiles — mostra só o logo.
**Por que acontece:** API key inválida, restrição de SHA-1 errada, ou API key não injetada corretamente no AndroidManifest.
**Como evitar:** Manter `android.config.googleMaps.apiKey` em app.json. Para Expo Go, a chave da API não é necessária (Expo Go já tem sua própria chave). Para development build / production build, a chave configurada deve ser válida e sem restrições de SHA-1 durante testes.
**Sinais de alerta:** Mapa funciona no Expo Go mas não no dev build.

### Pitfall 3: Config plugin conflitando com android.config.googleMaps.apiKey
**O que acontece:** Adicionar `["react-native-maps", {"androidGoogleMapsApiKey": "..."}]` ao `plugins` em app.json com v1.20.1 causa build failure ou comportamento inesperado.
**Por que acontece:** v1.20.1 não tem o config plugin — o plugin não existe nessa versão.
**Como evitar:** NÃO adicionar react-native-maps ao array plugins. A chave já está em `android.config.googleMaps.apiKey`.

### Pitfall 4: MapView não renderiza em tela cheia
**O que acontece:** `style={StyleSheet.absoluteFillObject}` no MapView às vezes não funciona se o container pai não tiver `flex: 1` ou dimensões definidas.
**Por que acontece:** react-native-maps precisa de dimensões fixas para renderizar.
**Como evitar:** Garantir que o container `<View style={styles.container}>` tem `flex: 1`. Já está correto em `mapas.tsx`.

### Pitfall 5: Heatmap causa erro no iOS
**O que acontece:** O componente `<Heatmap>` do react-native-maps não funciona no iOS — apenas Android.
**Por que acontece:** Limitação da lib: Heatmap é implementado apenas para Google Maps (Android).
**Como evitar:** Já tratado em `mapas.tsx` com `Platform.OS === 'android'`. Manter esse guard.

---

## Code Examples

### Substituição minimal de ClusteredMapView por MapView

```typescript
// Source: react-native-maps docs + análise de mapas.tsx atual
// ANTES (problemático):
import ClusteredMapView from 'react-native-map-clustering';
<ClusteredMapView
  ref={mapRef}
  style={StyleSheet.absoluteFillObject}
  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
  clusterColor="#3B82F6"
  clusterTextColor="#FFFFFF"
  radius={40}
  onClusterPress={() => {}}
  ...
>

// DEPOIS (estável):
import MapView from 'react-native-maps';
<MapView
  ref={mapRef}
  style={StyleSheet.absoluteFillObject}
  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
  ...
>
```

A mudança é cirúrgica: trocar o import e o componente. Todos os filhos (`Marker`, `Heatmap`) permanecem intactos — eles já são componentes do `react-native-maps`.

### Remover import do react-native-map-clustering

```typescript
// REMOVER esta linha:
import ClusteredMapView from 'react-native-map-clustering';

// MANTER estes:
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE, PROVIDER_DEFAULT, MapType } from 'react-native-maps';
```

### Verificar que o ref ainda funciona

```typescript
// MapView aceita o mesmo tipo de ref que ClusteredMapView wrappava
const mapRef = useRef<MapView>(null);
// animateToRegion e fitToCoordinates continuam funcionando normalmente
mapRef.current?.animateToRegion({...}, 1000);
(mapRef.current as any)?.fitToCoordinates(coords, {...});
```

---

## State of the Art

| Abordagem antiga | Abordagem atual | Quando mudou | Impacto |
|------------------|-----------------|--------------|---------|
| WebView + Leaflet | react-native-maps nativo | Fase 06 (2026-04-01) | Eliminou dependência de CDN, mapa agora é nativo |
| ClusteredMapView (react-native-map-clustering) | MapView padrão (recomendado fase 11) | Fase 11 | Elimina library sem manutenção |
| Config plugin para API key | android.config.googleMaps.apiKey | N/A (sempre foi assim para v1.20.1) | Configuração correta para versão bundled |

**Deprecated/outdated neste projeto:**
- `leaflet`, `leaflet.heat`, `leaflet.markercluster`: podem ser removidos do `package.json` (WebView abandonada)
- `react-native-map-clustering`: pode ser removido após substituição por MapView padrão

---

## Open Questions

1. **Por que o phase 11 foi criado se o phase 06 "verificou" o mapa como funcionando?**
   - O que sabemos: Fase 06 declarou MAPA-01/02 como "passed" com human verification UAT. O arquivo `mapas.tsx` usa `ClusteredMapView` atualmente.
   - O que está incerto: Se o mapa funciona hoje ou se o bug ressurgiu. O erro de tela branca pode ser intermitente (ex: só em dispositivos específicos) ou só aparece sem internet (CDN não é mais relevante, mas tiles do Google Maps requerem conexão).
   - Recomendação: A fase 11 deve executar a substituição de ClusteredMapView → MapView como ação principal, mesmo que o mapa "funcione" — é limpeza técnica que previne regressão.

2. **As bibliotecas leaflet devem ser removidas?**
   - O que sabemos: `leaflet`, `leaflet.heat`, `leaflet.markercluster` estão em `package.json` mas `mapas.tsx` não as usa mais.
   - O que está incerto: Se `react-native-webview` é usado por outras telas além do mapa antigo.
   - Recomendação: Incluir remoção de leaflet como tarefa na fase 11. Verificar outros usos de react-native-webview antes de remover.

3. **O Google Maps API key precisa de configuração adicional para production build?**
   - O que sabemos: A chave `AIzaSyD9THUSNNwA0aQ54cacCs9o0-SloWA9hPY` está em app.json. Para Expo Go, não é necessária. Para dev/prod builds, precisa ter SHA-1 do certificado de assinatura registrado no Google Cloud Console.
   - O que está incerto: Se o projeto usa Expo Go para testes ou development builds.
   - Recomendação: Para Expo Go (desenvolvimento), a configuração atual é suficiente. Para EAS Build, o plano deve incluir um aviso sobre SHA-1.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | v24.13.0 | — |
| react-native-maps | Map rendering | ✓ | 1.20.1 (instalado) | — |
| react-native-map-clustering | Clustering | ✓ | 4.0.0 (instalado, mas problemático) | MapView padrão |
| Google Maps API key | Android map tiles | ✓ | Configurada em app.json | Expo Go usa chave própria |
| expo-location | GPS do usuário | ✓ | ~19.0.8 (instalado) | — |

**Dependências sem fallback críticas:** Nenhuma — todas as dependências necessárias estão instaladas.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + jest-expo |
| Config file | package.json (jest.preset: jest-expo) |
| Quick run command | `npx jest --passWithNoTests` |
| Full suite command | `npx jest --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAPA-01 | Mapa renderiza sem tela branca | manual | N/A — requer dispositivo físico | N/A |
| MAPA-02 | Tiles carregam corretamente | manual | N/A — requer dispositivo físico | N/A |

**Justificativa manual-only:** react-native-maps não é renderizável em ambiente Jest sem dispositivo físico ou emulador. O MapView nativo depende de módulos nativos (Google Maps SDK) que não rodam em test runner. A validação é feita via Expo Go em dispositivo Android/iOS.

### Sampling Rate
- **Por tarefa:** `npx jest --passWithNoTests` (verifica que nenhum teste existente foi quebrado)
- **Merge de wave:** `npx jest --passWithNoTests`
- **Phase gate:** Verificação humana no dispositivo físico

### Wave 0 Gaps
Nenhum — infraestrutura de teste existente cobre os testes automatizáveis. Validação do mapa é manual por natureza.

---

## Plano de Implementação Recomendado

### Quantos planos: 1 plano (cirúrgico)

A mudança necessária é mínima e focada:

**Plano 11-01: Corrigir tela do mapa — substituir ClusteredMapView por MapView + limpar dependências obsoletas**

Escopo:
1. Em `app/(panel)/mapas.tsx`:
   - Remover import de `react-native-map-clustering`
   - Substituir `<ClusteredMapView>` por `<MapView>` (mesmo provider, mesmos filhos)
   - Manter todos os filhos: `Marker`, `Heatmap`, props de provider/mapType/customMapStyle
   - Manter `ref`, `showsUserLocation`, `initialRegion`, `mapType`, `customMapStyle`
   - Remover props exclusivas do ClusteredMapView: `clusterColor`, `clusterTextColor`, `clusterFontFamily`, `radius`, `onClusterPress`

2. Verificar outros usos de `react-native-webview` no projeto antes de remover do package.json

3. Remover do package.json (se não há outros usos):
   - `react-native-map-clustering`
   - `leaflet`, `leaflet.heat`, `leaflet.markercluster`

**Não mudar:**
- `app.json` — configuração atual está correta para v1.20.1
- `android.config.googleMaps.apiKey` — manter como está
- Lógica de `loadMarkers()`, filtros, popup, modal de estilo — toda a lógica de dados está correta

---

## Sources

### Primary (HIGH confidence)
- Leitura direta de `app/(panel)/mapas.tsx` — estado atual do arquivo
- Leitura direta de `app.json` — configuração atual
- Leitura direta de `package.json` — versões instaladas
- `.planning/phases/06-mapa-autentica-o/06-VERIFICATION.md` — histórico da migração

### Secondary (MEDIUM confidence)
- [expo/expo#40856](https://github.com/expo/expo/issues/40856) — crash de react-native-map-clustering com Expo SDK 54
- [expo/expo#39679](https://github.com/expo/expo/issues/39679) — docs incorretos: v1.20.1 não suporta config plugin
- [react-native-maps#5611](https://github.com/react-native-maps/react-native-maps/issues/5611) — android.config.googleMaps.apiKey funciona sem config plugin para v1.20.1
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54) — confirmação da versão bundled
- [Expo docs map-view](https://docs.expo.dev/versions/latest/sdk/map-view/) — setup do Expo Go (sem configuração adicional)

### Tertiary (LOW confidence)
- WebSearch: react-native-map-clustering alternativas 2025 — biblioteca descontinuada, alternativas disponíveis mas não investigadas em profundidade

---

## Metadata

**Confidence breakdown:**
- Estado atual do código: HIGH — leitura direta do arquivo
- Stack e versões: HIGH — node_modules verificado
- Causa raiz do problema: MEDIUM — baseado em issues relatadas, não em reprodução direta
- Configuração de API key: HIGH — múltiplas fontes confirmam que android.config.googleMaps.apiKey é o caminho correto para v1.20.1
- Impacto da substituição ClusteredMapView → MapView: HIGH — mudança mínima e cirúrgica

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (react-native-maps 1.20.1 é versão estável; configuração do Expo SDK 54 estável)
