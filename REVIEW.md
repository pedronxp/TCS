# Code Review — TCS Relatório de Risco

**Data:** 2026-04-09  
**Revisor:** Claude (gsd-code-reviewer)  
**Profundidade:** Standard  
**Arquivos revisados:** 7

---

## Sumário Executivo

A base de código está bem estruturada e demonstra boas práticas em geral (escaping de HTML, rate limiting, fallback offline). Os problemas identificados concentram-se em três áreas: **race conditions em operações assíncronas sem guarda de montagem**, **safe-area hardcoded que quebra em dispositivos edge-to-edge Android**, e **memory leaks por `setTimeout` órfão no mapa**. Nenhum problema crítico de segurança foi encontrado.

---

## CRITICAL

### CR-01: Race condition — `setLoading`/`setVistoria` chamados após desmontagem do componente

**Arquivo:** `app/(panel)/inspecoes/resultado.tsx:105–172`  
**Problema:** `loadDados` é uma função `async` disparada em `useEffect`. Não há nenhuma guarda de montagem (`isMounted`) nem `AbortController`. Se o usuário navegar para fora da tela antes da Promise do Supabase ou do SQLite resolver, o código continua chamando `setVistoria`, `setLoading` e `populateReport` em um componente já desmontado. No React Native isso produz o warning _"Can't perform a React state update on an unmounted component"_ e pode causar comportamento imprevisível na fila de setState do contexto `ReportContext`.

**Correção:**
```tsx
useEffect(() => {
  let cancelled = false;

  const loadDados = async () => {
    try {
      const { data, error } = await supabase.from('vistorias')...;
      if (cancelled) return;           // <-- guarda aqui
      if (!error && data) {
        setVistoria(normalizar(data));
        // ...
        return;
      }
      const local = getVistoriaById(id as string);
      if (cancelled) return;           // <-- e aqui
      if (local) { setVistoria(normalizar(local)); return; }
      // fallback params...
    } catch { /* ... */ }
    finally { if (!cancelled) setLoading(false); }
  };

  loadDados();
  return () => { cancelled = true; };
}, [id]);
```

---

### CR-02: Race condition — `loadMarkers` no mapa sem guarda de montagem

**Arquivo:** `app/(panel)/mapas.tsx:201–336`  
**Problema:** Mesmo padrão do CR-01. `loadMarkers` é async e chamada no `useEffect` com dependências `[profile, isOnlineReal]`. Se o perfil mudar rapidamente (login/logout) ou a conectividade oscilar enquanto a query do Supabase está em voo, `setMarkers`, `setAgendamentos` e `setLoading(false)` serão invocados em um componente potencialmente desmontado ou em um render com estado obsoleto.

**Correção:** Adicionar `let cancelled = false` + `return () => { cancelled = true }` no `useEffect` e verificar `if (cancelled) return` antes de cada chamada de `setState` após cada `await`.

---

### CR-03: `setTimeout` órfão no `loadMarkers` — memory leak garantido

**Arquivo:** `app/(panel)/mapas.tsx:270–293`  
**Problema:** Há dois `setTimeout` aninhados dentro de `loadMarkers` (linhas 270 e 282/288) que não são registrados em nenhuma `ref` e nunca passam por `clearTimeout`. Como `loadMarkers` pode ser chamada múltiplas vezes (ao mudar `isOnlineReal`, ao pressionar o botão de refresh), cada chamada acumula timers pendentes. Se o componente for desmontado durante o delay de 1200ms ou 300ms, os callbacks tentarão chamar `mapRef.current?.animateToRegion` em uma referência inválida.

**Correção:**
```tsx
const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Dentro de loadMarkers, substituir os setTimeouts:
if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
loadTimerRef.current = setTimeout(() => { ... }, 1200);

// No cleanup do useEffect:
return () => {
  cancelled = true;
  if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
};
```

---

## HIGH

### HR-01: `paddingTop: 54` hardcoded no header flutuante do mapa — quebra em Android edge-to-edge

**Arquivo:** `app/(panel)/mapas.tsx:688` (estilo `headerOverlay`)  
**Problema:** O header flutuante do mapa usa `paddingTop: 54` fixo. Em dispositivos Android com `edge-to-edge` habilitado (Android 15+ ou `navigationBarColor` transparente), a status bar pode ter entre 24 px e 48 px dependendo do fabricante e do furo de câmera. O valor 54 é um chute que vai coincidir por acaso em Pixels mas vai exibir os botões por baixo da status bar em outros dispositivos.

O componente **não importa** `useSafeAreaInsets` em nenhum ponto — diferente de `BottomNavBar.tsx` que o usa corretamente.

**Correção:**
```tsx
// No componente MapasScreen, adicionar:
const insets = useSafeAreaInsets();

// No estilo do headerOverlay (style inline ou StyleSheet dinâmico):
<View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
```

---

### HR-02: `filtroPeriodo` não filtra vistorias sem `dataVistoria`

**Arquivo:** `app/(panel)/mapas.tsx:342–346`  
**Problema:** O filtro de período verifica `if (filtroPeriodo !== 'todos' && m.dataVistoria)`. Se `m.dataVistoria` for `null` (campo opcional no banco), a condição interna não é avaliada e o marcador **passa pelo filtro** — aparece no mapa mesmo nos filtros "7 dias" e "30 dias". Vistorias sem data ficam sempre visíveis independente do filtro selecionado, o que é semanticamente incorreto.

**Correção:**
```tsx
if (filtroPeriodo !== 'todos') {
  if (!m.dataVistoria) return false;   // sem data: excluir dos filtros por período
  const dias = filtroPeriodo === '7d' ? 7 : 30;
  if (new Date(m.dataVistoria) < new Date(Date.now() - dias * 86400000)) return false;
}
```

---

### HR-03: `require('react-native')` dinâmico dentro de handler — padrão incorreto

**Arquivo:** `app/(panel)/inspecoes/resultado.tsx:471–472`  
**Problema:** O handler do botão "Baixar Laudo Salvo" usa `const { Linking } = require('react-native')` inline em vez do import estático já disponível em todo o projeto. Além de ser um antipadrão (`require` dentro de closure impede tree-shaking e confunde bundlers Metro), na prática `Linking` já é importado no `app/_layout.tsx` via `import * as Linking from 'expo-linking'`. O mais correto seria usar `expo-linking` consistentemente ou o `Linking` importado estaticamente.

**Correção:**
```tsx
// Adicionar no topo do arquivo:
import { Linking } from 'react-native';

// No handler:
onPress={() => Linking.openURL(vistoria.laudo_url)}
```

---

### HR-04: `laudoExpirado()` retorna `false` quando `laudo_gerado_em` está ausente — botão de regeneração nunca aparece para laudos antigos

**Arquivo:** `app/(panel)/inspecoes/resultado.tsx:216–220`  
**Problema:** A função `laudoExpirado` retorna `false` quando `laudo_gerado_em` é `null`. Isso significa que um `laudo_url` existente sem data de geração (vistorias antigas migradas, ou se o `UPDATE` do Supabase falhou silenciosamente) sempre será considerado "válido" e o botão de regeneração nunca aparecerá — potencialmente exibindo um link para um PDF expirado/removido do Storage.

**Correção:**
```tsx
const laudoExpirado = (): boolean => {
  if (!vistoria?.laudo_gerado_em) return true;  // sem data = tratar como expirado
  const geradoEm = new Date(vistoria.laudo_gerado_em).getTime();
  return (Date.now() - geradoEm) / (1000 * 60 * 60 * 24) >= 7;
};
```

---

### HR-05: Foto remota baixada mas não deletada em caso de erro na leitura

**Arquivo:** `utils/laudoPdfBuilder.ts:364–371`  
**Problema:** O código baixa a foto remota para cache (`downloadAsync`), lê como base64, e então deleta. Porém, se `readAsStringAsync` lançar exceção, o bloco `catch` interrompe o fluxo antes de `deleteAsync` ser chamado — o arquivo temporário `foto_laudo_<timestamp>.jpg` fica no cache para sempre.

**Correção:**
```ts
const tempUri = `${FileSystem.cacheDirectory}foto_laudo_${Date.now()}.jpg`;
let downloaded: string | null = null;
try {
  const result = await FileSystem.downloadAsync(dados.foto_url, tempUri);
  downloaded = result.uri;
  const base64Str = await FileSystem.readAsStringAsync(downloaded, { encoding: FileSystem.EncodingType.Base64 });
  fotoBase64 = `data:image/jpeg;base64,${base64Str}`;
} catch (e) {
  console.warn("Erro ao processar foto remota", e);
} finally {
  if (downloaded) FileSystem.deleteAsync(downloaded, { idempotent: true }).catch(() => {});
}
```

---

## MEDIUM

### MR-01: `useEffect` no `_layout.tsx` raiz re-executa roteamento a cada mudança de `session/profile` sem cancelar AsyncStorage pendente

**Arquivo:** `app/_layout.tsx:94–120`  
**Problema:** O `useEffect` de roteamento chama `AsyncStorage.getItem('@onboarding_done').then(...)`. Se `session` ou `profile` mudarem rapidamente (ex: token refresh automático do Supabase), múltiplas leituras de AsyncStorage ficam em voo simultaneamente. O último a resolver vence e pode navegar para uma rota errada com estado stale. A leitura de `segmentsRef.current` mitiga parcialmente, mas a corrida de Promises do AsyncStorage permanece.

**Correção:** Usar um `cancelled` flag ou `useRef` para cancelar a Promise anterior antes de disparar a próxima:
```tsx
const routingCancelRef = useRef(false);

useEffect(() => {
  routingCancelRef.current = false;
  if (loading || !appReady) return;

  AsyncStorage.getItem('@onboarding_done').then(val => {
    if (routingCancelRef.current) return;
    // ... lógica de roteamento
  });

  return () => { routingCancelRef.current = true; };
}, [session, profile, loading, appReady]);
```

---

### MR-02: Popup do mapa não respeita a safe-area inferior — `bottom: 32` pode ficar atrás da gesture bar

**Arquivo:** `app/(panel)/mapas.tsx:719` (estilo `markerPopup`)  
**Problema:** O popup de detalhes do marcador usa `bottom: 32` fixo. Em Android com gesture navigation habilitada, a gesture bar tem altura de 24–48 px dependendo do dispositivo. Com `bottom: 32`, o popup pode ficar parcialmente encoberto ou inacessível por um toque. Os FABs (`fabGroup`) usam `bottom: 80` e também não consultam `insets.bottom`.

**Correção:**
```tsx
// Calcular dinamicamente:
const insets = useSafeAreaInsets();
const popupBottom = Math.max(insets.bottom, 16) + 16; // acima da gesture bar

// Aplicar como style inline:
<View style={[styles.markerPopup, { backgroundColor: theme.surfaceHighlight, bottom: popupBottom }]}>
```

---

### MR-03: `NAVBAR_VISUAL_HEIGHT` hardcoded em `useBottomTabPadding` pode ficar desatualizado

**Arquivo:** `utils/useBottomTabPadding.ts:15`  
**Problema:** `NAVBAR_VISUAL_HEIGHT = 68` é um magic number que precisa ser mantido manualmente em sincronia com as alturas reais definidas em `BottomNavBar.tsx` (topBar 3px + marginBottom 6px + iconPill 34px + marginBottom 3px + label ~13px + paddingTop). Se os estilos da navbar mudarem, o padding calculado ficará errado sem qualquer aviso de compilação.

**Sugestão:** Exportar a constante de `BottomNavBar.tsx` e importá-la em `useBottomTabPadding`, ou usar um `onLayout` callback na navbar para medir a altura real e expô-la via Context.

---

### MR-04: `isActive` no `BottomNavBar` pode dar falso-positivo em rotas aninhadas

**Arquivo:** `components/BottomNavBar.tsx:75–78`  
**Problema:** A verificação `norm.endsWith(p)` sem delimitador de segmento pode dar match incorreto. Por exemplo, se existisse uma rota `/admin_relatorios`, ela daria match em `matchPaths: ['/relatorios']` porque `endsWith('/relatorios')` é verdadeiro. Embora as rotas atuais não causem colisão, o padrão é frágil.

**Correção:** Usar verificação mais estrita:
```tsx
const isActive = (tab: NavTab) => {
  const norm = pathname.replace(/\/+$/, '');
  return (tab.matchPaths ?? [tab.route]).some(p =>
    norm === p || norm.endsWith('/' + p.replace(/^\//, ''))
  );
};
```

---

### MR-05: `respostasHtml` pode incluir entradas com string vazia no PDF

**Arquivo:** `utils/laudoPdfBuilder.ts:319–347`  
**Problema:** Quando uma chave contém `'foto'`, a função retorna `''` (string vazia) e o `join('')` inclui `<tr>` vazio no HTML. Isso não quebra visualmente o PDF, mas é um `<tr>` sem conteúdo na tabela que confunde parsers de PDF e pode causar linha em branco no layout.

**Correção:**
```ts
respostasHtml = Object.entries(respostas as Record<string, unknown>)
  .filter(([k]) => !k.includes('foto'))   // filtrar antes do map
  .map(([k, val]) => { ... })
  .join('');
```

---

### MR-06: `Stack.Screen` para rotas deletadas ainda presentes no layout

**Arquivo:** `app/(panel)/_layout.tsx:59–61`  
**Problema:** As telas `supervisor/equipe`, `supervisor/agente` e `supervisor/atribuicao` foram deletadas (aparecem como `D` no `git status`), mas suas declarações `<Stack.Screen>` permanecem no layout. O Expo Router em produção não vai quebrar por isso, mas gera ruído de manutenção e pode causar erros de navegação se alguém tentar navegar para essas rotas programaticamente.

**Correção:** Remover as três linhas:
```tsx
// Remover:
<Stack.Screen name="supervisor/equipe" />
<Stack.Screen name="supervisor/agente" />
<Stack.Screen name="supervisor/atribuicao" />
```

---

## LOW

### LR-01: `filtroPeriodo !== 'todos'` no `filteredMarkers` usa `Date.now()` a cada render

**Arquivo:** `app/(panel)/mapas.tsx:342–346`  
**Problema:** `filteredMarkers` é recalculado a cada render com `Date.now()` inline. Se `markers` for grande (limite de 500 itens), isso executa `new Date(m.dataVistoria)` para cada marcador em cada render. Não é um bug crítico, mas é desnecessário dado que a data de "agora" não muda entre renders no mesmo ciclo.

**Sugestão:** Memoizar com `useMemo`:
```tsx
const filteredMarkers = useMemo(() => {
  const now = Date.now();
  return markers.filter(m => { ... });
}, [markers, filter, filtroPeriodo]);
```

---

### LR-02: `pingSupabase` chamado duas vezes no boot

**Arquivo:** `app/_layout.tsx:22–26` e `app/(panel)/_layout.tsx:25`  
**Problema:** `pingSupabase` (em `_layout.tsx`) e `pingSupabaseKeepAlive` (em `(panel)/_layout.tsx`) são chamados separadamente no boot da aplicação. Ambos fazem uma query leve ao Supabase. Dependendo da velocidade de navegação, isso representa duas queries consecutivas ao banco no free tier logo no startup.

**Sugestão:** Centralizar o keep-alive em um único lugar (preferencialmente no layout raiz) e remover a chamada duplicada no panel layout.

---

### LR-03: `console.warn` no `laudoPdfBuilder.ts` — substituir por `logger`

**Arquivo:** `utils/laudoPdfBuilder.ts:359, 370`  
**Problema:** O projeto usa um utilitário `logger` centralizado (importado em outros módulos como `mapas.tsx`). As linhas de `console.warn` em `laudoPdfBuilder.ts` fogem desse padrão e não serão capturadas pelos logs de auditoria.

**Correção:**
```ts
import { logger } from './logger';
// ...
logger.warn('pdf', 'Erro ao ler foto do file system', { erro: String(e) });
logger.warn('pdf', 'Erro ao baixar foto remota', { erro: String(e) });
```

---

### LR-04: `pesoRisco` não está sendo validado como número antes da comparação

**Arquivo:** `utils/laudoPdfBuilder.ts:339`  
**Problema:** `if (opDef.pesoRisco > 0)` assume que `pesoRisco` é sempre um número. Se o JSON do formulário tiver `pesoRisco: "5"` (string), a comparação `"5" > 0` é `true` em JavaScript via coerção, mas `[+${opDef.pesoRisco} pts]` no HTML poderia exibir um valor inesperado se a coerção não ocorrer em outro contexto.

**Correção:**
```ts
if (Number(opDef.pesoRisco) > 0) {
  pontuacaoDesc = `...[+${Number(opDef.pesoRisco)} pts]...`;
}
```

---

## Resumo por Arquivo

| Arquivo | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| `app/(panel)/mapas.tsx` | CR-02, CR-03 | HR-01, HR-02 | MR-01 (via _layout), MR-02, LR-01 | — |
| `app/(panel)/inspecoes/resultado.tsx` | CR-01 | HR-03, HR-04 | — | — |
| `utils/laudoPdfBuilder.ts` | — | HR-05 | MR-05 | LR-03, LR-04 |
| `app/(panel)/_layout.tsx` | — | — | MR-06 | LR-02 |
| `app/_layout.tsx` | — | — | MR-01 | LR-02 |
| `components/BottomNavBar.tsx` | — | — | MR-04 | — |
| `utils/useBottomTabPadding.ts` | — | — | MR-03 | — |

**Total: 3 CRITICAL · 5 HIGH · 6 MEDIUM · 4 LOW**

---

_Revisado em: 2026-04-09_  
_Revisor: Claude (gsd-code-reviewer)_
