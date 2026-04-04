---
plan: 17-02
phase: 17-storage-protocolo
status: complete
---

## Summary

Adicionadas funções `uploadFotoVistoria()` e `uploadLaudoPdf()` ao `StorageService.ts` usando FormData. Migration v7 no SQLite com colunas `municipio_agente`, `laudo_url`, `laudo_gerado_em` em `vistorias_offline`. Em `wizard.tsx`: campo `municipio_agente` (cidade do agente) salvo junto com a vistoria; foto local upada para `fotos/{municipio}/{id}.jpg` quando online e URL pública substituída no SQLite e Supabase.
