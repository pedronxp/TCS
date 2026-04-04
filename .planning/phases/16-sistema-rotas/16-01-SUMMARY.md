---
plan: 16-01
phase: 16-sistema-rotas
status: complete
completed: 2026-04-03
executor: agent
---

## One-liner

Sistema de rotas nativas implementado com `tracarRota()` utilitária que abre Google Maps (Android) ou Apple Maps (iOS) em modo navegação, integrado ao detalhe de vistoria e ao popup do mapa tático.

## What was built

### utils/routingUtils.ts (novo arquivo)

Utilitário puro `tracarRota(lat, lng)` que:
- Solicita permissão de localização via `expo-location`
- No iOS: abre Apple Maps com `maps://` e `saddr`/`daddr` (origem automática se permissão concedida)
- No Android: abre Google Maps diretamente em modo navegação via `google.navigation:q=LAT,LNG&mode=d`
- Fallback para Google Maps web (`https://www.google.com/maps/dir/`) se o app não estiver instalado
- Trata erros com `Alert.alert` sem propagar exceção

### app/(panel)/inspecoes/[id].tsx

- Importa `tracarRota` de `routingUtils`
- Adicionou `latitude` e `longitude` ao select do Supabase
- Propaga `latitude`/`longitude` no caminho offline (SQLite)
- Botão "Como Chegar" exibido apenas quando `hasCoords` é verdadeiro (lat e lng não nulos/zero)
- Botão posicionado abaixo das ações existentes, com ícone `navigation` e cor `theme.primary`

### app/(panel)/mapas.tsx

- Importa `tracarRota` de `routingUtils`
- Popup do marcador selecionado agora exibe dois botões lado a lado: "Ver detalhes" e "Traçar Rota"
- Botão "Traçar Rota" usa `selectedMarker.lat` e `selectedMarker.lng` (propriedades corretas da interface `VistoriaMarker`)
- Cor do botão usa `theme.primary` para consistência com o tema

### app.json

Nenhuma alteração necessária — `ACCESS_FINE_LOCATION` e `NSLocationWhenInUseUsageDescription` já estavam configurados.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing data] Latitude/longitude ausentes no select Supabase**
- **Found during:** Task 2
- **Issue:** A query do Supabase em `[id].tsx` não incluía `latitude` e `longitude`, tornando o botão sempre invisível
- **Fix:** Adicionados ao select string e ao mapeamento offline do SQLite
- **Files modified:** `app/(panel)/inspecoes/[id].tsx`
- **Commit:** 6beed48

### Skipped Tasks

**Task 4 — Botão em agendamentos/[id].tsx:** Arquivo não existe no projeto. Ignorado sem impacto.

## Commits

| Hash    | Descrição                                              |
| ------- | ------------------------------------------------------ |
| 453225c | feat(16-01): adicionar utilitário tracarRota            |
| 6beed48 | feat(16-01): botão Como Chegar em detalhe de vistoria   |
| df4d0bd | feat(16-01): botão Traçar Rota no popup do mapa         |

## Self-Check: PASSED

- `utils/routingUtils.ts` — FOUND
- `app/(panel)/inspecoes/[id].tsx` — import tracarRota e botão FOUND
- `app/(panel)/mapas.tsx` — import tracarRota e botão FOUND
- Commits 453225c, 6beed48, df4d0bd — FOUND
