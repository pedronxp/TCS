---
phase: 19
title: Bug Fixes + Melhorias
status: completed
completed_at: 2026-04-03
plans: 5
---

# Phase 19 — Bug Fixes + Melhorias — SUMÁRIO

## Planos Executados

### 19-01: Foto Wizard + GPS Fix
- **Foto persistente**: URI da câmera copiada para `FileSystem.documentDirectory/fotos/` no momento do clique, evitando invalidação do URI temporário ao retornar da activity do Android
- **GPS rua**: Filtro de termos genéricos (`TERMOS_INVALIDOS_RUA`) descarta `addr.road` quando retorna "Logradouro", "Rua", etc.
- **GPS bairro**: Prioridade reordenada para `suburb > neighbourhood > quarter > city_district` — campo correto para bairros brasileiros no Nominatim

### 19-02: Agendamento master_admin + Data/Hora
- **master_admin sem agentes**: Removida guarda `if (!profile?.municipio) return;` — agora busca todos os agentes sem filtro de município
- **Filtro municipio**: Skip do filtro `.eq('municipio')` para `role === 'master_admin'`
- **municipio do agendamento**: Usa `agenteSelecionado.municipio` quando criado por master_admin
- **Campos data/hora**: Dois campos separados com máscara automática `DD/MM/AAAA` e `HH:MM`
- **Agente picker**: Exibe município abaixo do nome quando visualizado por master_admin

### 19-03: NavBar Mapa + Laudo Visual + Mensagens
- **NavBar**: Rota `/mapas` removida de `NAVBAR_VISIBLE_PATHS` — barra some automaticamente ao abrir o mapa
- **Laudo visual**: Seção "Respostas do Formulário" redesenhada como cards numerados com badges coloridos para níveis de risco (R1/R2/R3/R4)
- **Mensagens/Alert no Modal**: Substituído `Alert.alert` por estado `termoNomeErro` inline (borda vermelha + texto "Campo obrigatório") em `resultado.tsx` e `laudo.tsx` — corrige falha silenciosa do Alert dentro de Modal no Android
- **setTimeout 300ms**: Garante que o modal feche antes de iniciar a geração do PDF

### 19-04: Auditoria + Dashboard Master + Estatísticas
- **Auditoria (logs.tsx)**: Removido botão de download (export CSV), expandido detalhes como rows legíveis com ícones por campo (municipio, protocolo, nivel_risco, ip, ator_uid)
- **Dashboard master (master/index.tsx)**: "Severidade Global" → "Distribuição de Risco"; legendas renomeadas para "R3/R4 Alto" e "R1/R2 Controlado"; "Eventos Recentes" → "Atividade Recente" com ícones por tipo de ação via `acaoIconMap`
- **Estatísticas (admin/estatisticas.tsx)**: Percentual adicionado nas barras de risco; card "Resumo de Agentes" com Agentes ativos, Média por agente e Recorde do período

### 19-05: Módulo de Grupo + Municípios
- **SQLite v8**: Migração cria tabelas `grupos` e `grupo_membros` com FK + CASCADE; `DB_VERSION` 7 → 8
- **grupos/index.tsx**: Lista grupos do município, criar novo (modal TextInput), excluir com confirmação, contador de membros
- **grupos/[id].tsx**: Detalhes do grupo, adicionar agentes (picker Supabase excluindo já-membros), remover membros
- **modulos.tsx**: Módulo "Grupos" adicionado para roles admin e supervisor
- **municipios.tsx**: Barra de proporção de risco adicionada em cada card (vermelho = altoRisco/totalVistorias), exibida apenas quando `totalVistorias > 0`

## Arquivos Modificados
- `app/(panel)/inspecoes/wizard.tsx`
- `app/(panel)/inspecoes/dados-iniciais.tsx`
- `app/(panel)/agendamentos/index.tsx`
- `components/BottomNavBar.tsx`
- `app/(panel)/inspecoes/resultado.tsx`
- `app/(panel)/inspecoes/laudo.tsx`
- `app/(panel)/admin/logs.tsx`
- `app/(panel)/master/index.tsx`
- `app/(panel)/admin/estatisticas.tsx`
- `utils/database.ts`
- `app/(panel)/modulos.tsx`
- `app/(panel)/master/municipios.tsx`

## Arquivos Criados
- `app/(panel)/grupos/index.tsx`
- `app/(panel)/grupos/[id].tsx`
