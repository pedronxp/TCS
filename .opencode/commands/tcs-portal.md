---
description: Cria uma página nova no Portal do cliente (individual + municipal) com as duas rotas, menu e manifest
agent: tcs-page
---

Crie uma nova página no **Portal do cliente** (`/portal/*`): $ARGUMENTS

Siga o skill `tcs-console` (workflow Portal) e o agent `tcs-page`. Lembre-se da regra de ouro do portal: **2 rotas** (individual + municipal), **1 linha** em `portalNavigation.ts`, **2 entries** no manifest com `portalRoute()` (estados extras de assinatura), guardas via `PortalRoute` com redirect suave. Confirme objetivo e permissão comigo antes de codificar. Rode `npm run design:validate` ao final.
