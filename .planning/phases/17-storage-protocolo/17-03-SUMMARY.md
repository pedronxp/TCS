---
plan: 17-03
phase: 17-storage-protocolo
status: complete
---

## Summary

Em `resultado.tsx`: após gerar PDF, `salvarLaudoNoStorage()` faz upload para `laudos/{municipio}/{id}.pdf` em background, salva URL signed (7 dias) em Supabase + SQLite, e atualiza estado local. Botão "Baixar Laudo Salvo" (verde) aparece quando URL válida; botão "Regenerar Laudo" (amarelo) aparece quando `laudo_gerado_em` > 7 dias. Protocolo exibido no header vindo do banco (não mais gerado localmente).
