## Context

O app e Expo/React Native e usa Expo Router, SQLite local, Supabase e `react-native-maps`. O modo treinamento ja existe como sessao local sem usuario Supabase real, com dashboard proprio e fluxo limitado de inspecao. O problema observado no Android combina tres superficies sensiveis: mapa nativo, navegacao do modo treinamento e carregamento inicial da vistoria com GPS/reverse geocode.

O formulario estrutural ativo e `assets/formularios/risco_estrutural_novo_v2.json`, consumido por `utils/formulariosAssets.ts`, `app/(panel)/inspecoes/wizard.tsx`, `utils/riscoUtils.ts` e telas de relatorio/laudo. A escala vigente e 0-10, com limites R1/R2/R3/R4, e deve continuar valida apos separar a pergunta de laje.

## Goals / Non-Goals

**Goals:**

- Corrigir a instabilidade visual Android relacionada a mapa/rota antes de iniciar nova vistoria.
- Garantir que `Nova Vistoria` no Modo Treinamento abra uma tela estavel imediatamente.
- Manter o fluxo de treinamento local-only e limitado aos formularios permitidos.
- Separar a avaliacao de laje da avaliacao de pilares/vigas.
- Tratar `Inexistente` em fundacao e pilares/vigas como resposta tecnica grave, com justificativa obrigatoria e impacto real no risco.
- Preservar a escala total 0-10, os limites R1-R4 e a rastreabilidade no calculo salvo.

**Non-Goals:**

- Criar novo modulo de mapas ou substituir `react-native-maps`.
- Alterar schema remoto de Supabase.
- Alterar regras do formulario de deslizamento.
- Transformar justificativa em assinatura, foto obrigatoria ou laudo manual.
- Mudar layout geral do wizard fora dos campos necessarios.

## Decisions

1. **Validar coordenadas em um ponto comum antes de qualquer mapa/rota.**
   - Decisao: reutilizar ou criar helper leve para aceitar apenas latitude/longitude finitas, dentro de faixa geografica valida e diferentes de `0,0`.
   - Racional: o mesmo criterio precisa proteger `MapView`, marcadores, enquadramento e `Como Chegar`.
   - Alternativa considerada: validar localmente em cada botao/tela. Rejeitada por aumentar divergencia e risco de regressao.

2. **Tratar artefato Android de mapa como problema de ciclo de vida nativo.**
   - Decisao: em telas com `MapView`, pausar/ocultar renderizacao sensivel no `blur`/unmount, limpar timers e impedir updates depois de desmontar.
   - Racional: no Android, superficies nativas podem ficar por cima durante transicoes se a tela anterior ainda esta renderizando.
   - Alternativa considerada: apenas trocar animacao de navegacao. Rejeitada porque nao resolve coordenadas invalidas nem timers ativos.

3. **A tela de dados iniciais deve renderizar antes do GPS.**
   - Decisao: GPS e reverse geocode continuam automaticos, mas nao bloqueiam o primeiro render; a tela mostra formulario e indicador localizado apenas na area de coordenadas.
   - Racional: o usuario precisa ver uma tela estavel mesmo se permissao, GPS ou rede demorarem.
   - Alternativa considerada: remover GPS automatico no treinamento. Rejeitada porque o fluxo de campo ainda se beneficia do preenchimento automatico.

4. **Ajuste estrutural fica no formulario built-in e nos helpers existentes.**
   - Decisao: atualizar `risco_estrutural_novo_v2.json` e estender os helpers para justificativa obrigatoria por opcao, preservando o padrao de observacoes condicionais ja usado.
   - Racional: evita criar fluxo paralelo e mantem relatorio/laudo lendo respostas pelo mesmo pipeline.
   - Alternativa considerada: criar um formulario v3 novo. Rejeitada por aumentar migracao e selecao de formulario sem necessidade imediata.

5. **A nova pergunta de laje deve preservar a escala 0-10.**
   - Decisao: redistribuir pesos para que o total maximo das perguntas pontuaveis continue 10. A implementacao deve atualizar testes que calculam maximo e limites.
   - Racional: dashboards, laudos e treinamento assumem a escala padronizada 0-10.
   - Alternativa considerada: permitir total 11 e normalizar depois. Rejeitada por dificultar auditoria e explicacao ao agente.

6. **`Inexistente` em fundacao e pilares/vigas nao e "nao aplicavel".**
   - Decisao: nesses dois campos, `Inexistente` deve ter peso/rule conservadora e justificativa obrigatoria. Nas demais perguntas estruturais, a opcao deve ser removida.
   - Racional: ausencia de fundacao ou elementos principais aumenta risco, diferente de itens secundarios nao aplicaveis.
   - Alternativa considerada: manter peso zero e usar apenas texto de justificativa. Rejeitada porque mascara risco no calculo.

## Risks / Trade-offs

- [Risk] Ajustar pesos pode alterar classificacoes de vistorias novas. -> Mitigacao: cobrir maximo 10, limites R1-R4 e casos de `Inexistente` em testes.
- [Risk] Guard global de treinamento pode continuar redirecionando durante transicoes. -> Mitigacao: testar as rotas permitidas e evitar navegacao concorrente apos `revalidate`.
- [Risk] Artefato do `MapView` pode depender do device/driver Android. -> Mitigacao: limpar timers, esconder mapa ao perder foco e validar em Android real ou em build de teste.
- [Risk] Justificativa obrigatoria pode quebrar autosave antigo com respostas incompletas. -> Mitigacao: exigir apenas para novas interacoes/avanco quando a resposta atual aciona a regra, sem migrar historico antigo.
