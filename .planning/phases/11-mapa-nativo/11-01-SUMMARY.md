---
plan: 11-01
phase: 11-mapa-nativo
status: complete
completed: 2026-04-03
executor: manual
---

## One-liner

Tela de mapa migrada de ClusteredMapView para MapView nativo do react-native-maps, eliminando tela branca no Android e iOS.

## What was built

- `app/(panel)/mapas.tsx` substituído para usar `MapView` do react-native-maps com `PROVIDER_GOOGLE` no Android
- Dependências obsoletas (`react-native-map-clustering`, Leaflet) removidas do `package.json`
- Marcadores, filtros de risco/período, heatmap, popup e FABs continuam funcionando

## Self-Check: PASSED

Concluído manualmente conforme confirmação do usuário.
