---
date: "2026-03-31 02:30"
promoted: false
---

Bug do mapa corrigido: tela branca no Android era causada por baseUrl vazio no WebView bloqueando CDN do Leaflet — corrigido para baseUrl 'https://unpkg.com'. Bloqueio do iOS também removido, mapa agora funciona em ambas as plataformas. Commit: 384a11f
