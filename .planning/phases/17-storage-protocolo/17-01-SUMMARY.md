---
plan: 17-01
phase: 17-storage-protocolo
status: complete
---

## Summary

Aplicada migration Supabase com 5 novas colunas em `vistorias` (protocolo, protocolo_seq, municipio_agente, laudo_url, laudo_gerado_em), criada tabela `contadores_protocolo` com RLS service_role-only, e trigger `trg_gerar_protocolo` que gera automaticamente o protocolo `TCS-CGS-2026-00001` a cada INSERT sem protocolo. Também criados os buckets `fotos/` (público) e `laudos/` (autenticado) no Supabase Storage com políticas de acesso corretas.
