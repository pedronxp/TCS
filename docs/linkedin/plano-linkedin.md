# Kit LinkedIn — TCS / Defesa Civil
> Material para divulgar o projeto em etapas. Posts prontos + roteiro de prints + plano de networking.
> ⚠️ Antes de qualquer print: substituir dados reais por fictícios (ver seção 4 e 5).

---

## 1. ESTRATÉGIA GERAL

**Posicionamento:** você não está "mostrando um app" — está documentando a construção de um **SaaS multi-tenant de gestão de vistorias técnicas para Defesa Civil**, do zero, sozinho. Essa narrativa (build in public) gera muito mais engajamento do que prints soltos.

**Cadência sugerida:** 1 a 2 posts por semana. Série de 6 posts:

| # | Tema | Foco |
|---|---|---|
| 1 | Apresentação do projeto + problema | Gancho emocional |
| 2 | App mobile: vistoria offline-first | Produto |
| 3 | Mapas, fotos e PDF no celular | Produto (visual forte) |
| 4 | Arquitetura: Supabase + multi-tenancy | Técnico |
| 5 | RLS, RPCs e segurança no Postgres | Técnico |
| 6 | Roadmap SaaS: billing, dashboards, o que aprendi | Visão + lições |

---

## 2. POSTS PRONTOS

### Post 1 — Apresentação (problema)
```
E se uma vistoria de risco em uma encosta dependesse de papel, caneta
e sinal de internet que não existe?

Esse é o dia a dia de equipes de Defesa Civil no interior do Brasil.
E foi por isso que comecei a construir o [Nome do Projeto]:
uma plataforma completa para vistorias técnicas de risco.

O que ela faz hoje:
📱 App mobile offline-first — o agente faz a vistoria completa
   sem internet e tudo sincroniza depois
🗺️ Mapas com geolocalização das vistorias
📊 Classificação automática de risco (R1 a R4)
📄 Geração de laudo em PDF direto do celular
🏢 Multi-tenant: cada município tem seu ambiente isolado

Stack: React Native + Expo + Supabase (PostgreSQL).

Nas próximas semanas vou mostrar cada parte em detalhes —
o app, a arquitetura e as decisões técnicas por trás.

Se você trabalha com gestão pública, tecnologia cívica ou
desenvolvimento mobile, vamos trocar ideia 👇

#ReactNative #Supabase #GovTech #DefesaCivil #MobileDev
```

### Post 2 — App mobile (offline-first)
```
O requisito mais difícil do meu projeto não foi técnico.
Foi: "precisa funcionar SEM internet".

Agentes de Defesa Civil trabalham em áreas sem cobertura.
Então o app inteiro foi desenhado offline-first:

✅ Banco SQLite local no dispositivo
✅ Fila de sincronização com retry automático (até 5 tentativas)
✅ Fotos comprimidas antes de salvar (JPEG 72%, máx 1280px)
✅ Banner discreto avisa quando está offline — nunca bloqueia

O fluxo: o agente faz a vistoria completa offline →
ao recuperar sinal, tudo sobe para o Supabase em lotes.

Detalhe que pouca gente pensa: sincronização não é só
"enviar depois". É tratar conflito, falha parcial e
não perder NADA do trabalho de quem está em campo.

Tecnologia a serviço de quem resolve problema de verdade.

#OfflineFirst #ReactNative #Expo #MobileDevelopment
```

### Post 3 — Mapas, fotos e PDF
```
Três features do app que parecem simples, mas deram trabalho:

🗺️ MAPAS SEM GOOGLE MAPS
Leaflet + OpenStreetMap dentro de uma WebView.
Custo zero de API, tiles do CartoDB/Esri, e funciona
offline com cache. (E um bug clássico de tela branca
que só se resolve com data URI — dev de RN entende 😅)

📷 FOTOS INTELIGENTES
Compressão automática antes de salvar: 72% de qualidade,
máx 1280px. Resultado: foto legível para o laudo e
sincronização rápida até em 3G ruim.

📄 LAUDO EM PDF NO CELULAR
A vistoria vira um documento formal com fotos, coordenadas
e classificação de risco — gerado por Edge Function
no Supabase, sem servidor próprio.

Tudo pensado para um agente de campo com um celular comum.

#ReactNative #OpenStreetMap #Supabase #EdgeFunctions
```

### Post 4 — Arquitetura multi-tenant
```
Como estruturei um SaaS multi-tenant no Supabase
sem backend próprio:

🏗️ MODELO
Cada município = uma "organization".
Usuários pertencem a organizações (tabela de membros),
nunca por campo solto no perfil.

🔐 ISOLAMENTO
Row Level Security em TODAS as tabelas —
quase 200 policies. O banco garante que a Prefeitura A
nunca enxerga dados da Prefeitura B.

⚙️ RPC-FIRST
O app quase não faz queries diretas: ~50 funções
PostgreSQL (SECURITY DEFINER) concentram a lógica.
O banco é a autoridade.

🎨 FORMULÁRIOS HÍBRIDOS
Templates globais do sistema + formulários customizados
por organização, na mesma tabela (organization_id NULL
= template público).

O Rails/esse padrão me deu: zero servidor para manter,
segurança no nível do banco e escala quase gratuita.

Quem mais usa Supabase em produção assim?

#PostgreSQL #Supabase #SaaS #MultiTenant #Architecture
```

### Post 5 — Segurança/RLS
```
"Row Level Security" parece burocracia — até você ter
190+ policies protegendo dados de órgãos públicos.

No meu projeto, quase tudo passa por RLS no Postgres:

• Agente só vê as próprias vistorias
• Supervisor vê a equipe dele
• Admin só opera dentro da própria organização
• Templates de formulário: leitura global, escrita restrita

E o detalhe favorito: uma função my_organization_ids()
(SECURITY DEFINER) que resolve "de quais orgs ativas
o usuário faz parte" — usada em todas as policies,
sem duplicar lógica.

Segurança no banco > segurança no app.
Se o app for comprometido, o banco ainda protege.

#PostgreSQL #RLS #Security #Supabase
```

### Post 6 — Roadmap + lições
```
O que começou como "um app de vistorias" virou um
ecossistema completo:

✅ App mobile offline-first (em uso)
✅ Console web administrativo
✅ Bot de WhatsApp com IA
✅ 24 Edge Functions em produção

E o que vem agora (fase SaaS):
💳 Cobrança manual com comprovante + aprovação
📊 Analytics para gestão (MRR, uso por município)
🎨 Dashboards customizáveis por organização
🎫 Sistema de suporte completo (hoje só abre ticket)

3 lições construindo isso sozinho:

1️⃣ Escreva as policies de RLS cedo — refatorar
   segurança depois é 10x mais caro
2️⃣ Offline-first muda TODAS as decisões de arquitetura
3️⃣ Contexto documentado > memória (meu CONTEXT.md
   salva cada sessão de desenvolvimento)

Se você está construindo algo parecido ou quer trocar
experiência sobre GovTech/SaaS, me chama!

#BuildInPublic #SaaS #GovTech #IndieHacker
```

---

## 3. ROTEIRO DE PRINTS / GRAVAÇÕES

### Ferramentas sugeridas
- **Prints do app:** Android Studio Emulator → botão de captura (ou `Win+Shift+S` com o Expo Go na tela)
- **Vídeo curto (30-60s):** gravar emulador com OBS Studio (gratuito) — o LinkedIn prioriza vídeo
- **Mockups bonitos:** colar os prints em frames de celular com https://mockuphone.com ou Canva

### Post 1 — Apresentação
| Print | Tela | Observação |
|---|---|---|
| 1 | Login do app | Com logo visível |
| 2 | Dashboard/home | Com cards preenchidos |
| 3 | Foto de campo SUA (opcional) | "nascido de um problema real" humaniza |

### Post 2 — Offline-first
| Print | Tela |
|---|---|
| 1 | App com o ConnectivityBanner "offline" visível |
| 2 | Wizard de vistoria preenchido |
| 3 | Vídeo curto: ativar modo avião → preencher vistoria → desativar → sincronização rodando |

### Post 3 — Mapas/PDF
| Print | Tela |
|---|---|
| 1 | Mapa com marcadores das vistorias |
| 2 | Tela de foto da vistoria |
| 3 | Primeira página do PDF do laudo gerado |

### Post 4 — Arquitetura
| Print | Conteúdo |
|---|---|
| 1 | Diagrama simples da arquitetura (fazer no Excalidraw/draw.io: App ↔ Supabase ↔ Edge Functions) |
| 2 | Supabase Dashboard mostrando as tabelas (borrar nomes sensíveis se necessário) |
| 3 | Trecho de uma RPC no editor (código público ok) |

### Post 5 — RLS
| Print | Conteúdo |
|---|---|
| 1 | Lista de policies no Supabase Dashboard |
| 2 | Código da função `my_organization_ids()` |
| 3 | Diagrama do modelo users → organization_members → organizations |

### Post 6 — Roadmap
| Print | Conteúdo |
|---|---|
| 1 | Console web (dashboard admin) com dados fictícios |
| 2 | Roadmap visual (tabela do CONTEXT.md adaptada) |
| 3 | Colagem das 4 frentes: app / console / bot / functions |

---

## 4. CHECKLIST DE DADOS FICTÍCIOS (antes de qualquer print)

- [ ] Usuário de teste com nome fictício (ex.: "Carlos Agentino")
- [ ] Organização fictícia (ex.: "Defesa Civil — Cidade Exemplo") — **nunca mostrar Cataguases/Ubá/Astolfo Dutra**
- [ ] Endereços fictícios (ex.: "Rua das Amostras, 123 — Bairro Teste")
- [ ] GPS: ponto genérico (praça pública da cidade fictícia), nunca endereço real de vistoria
- [ ] E-mails fictícios (teste@exemplo.com.br)
- [ ] Esconder: chaves de API, URLs do Supabase com ref, tokens, logs com dados reais
- [ ] No console web: valores financeiros fictícios (R$ 199,00 etc.)

**Dica:** rodar o app apontando para os dados de teste, ou editar os prints depois cobrindo campos sensíveis com tarja preta (Paint já resolve).

---

## 5. PLANO DE NETWORKING

### Perfil (arrumar ANTES de postar)
- Headline: mencionar o projeto — ex.: *"Dev Mobile | Criando SaaS de vistorias técnicas para Defesa Civil | React Native + Supabase"*
- Seção "Destaques": fixar os melhores posts da série
- Sobre: 3 parágrafos — problema → solução → stack

### Conexões (meta: 10-15/semana com mensagem personalizada)
1. **Devs React Native/Expo e Supabase** no Brasil — comentam e impulsionam
2. **Servidores/gestores de Defesa Civil** — público do produto e potenciais clientes
3. **Comunidade GovTech/Civic Tech**
4. **Founders de SaaS B2G** (venda para governo)
5. Pessoas que comentarem seus posts — conectar no mesmo dia

**Mensagem modelo de conexão:**
```
Olá [nome], vi seu trabalho com [tema] e estou construindo
uma plataforma de vistorias técnicas para Defesa Civil.
Estou compartilhando o processo aqui no LinkedIn —
seria ótimo trocar experiências!
```

### Engajamento (tão importante quanto postar)
- Responder TODOS os comentários nos seus posts (algoritmo premia)
- Comentar com substância (3+ linhas) em posts de Defesa Civil, GovTech e React Native — 5x/semana
- Pedir **uma** opinião por post (a pergunta no final de cada post já faz isso)

### Hashtags (usar 4-5 por post)
`#ReactNative #Expo #Supabase #PostgreSQL #GovTech #DefesaCivil #SaaS #BuildInPublic #MobileDev #CivicTech`

### O que evitar
- Postar em horário morto (melhores: ter–qui, 8h–10h ou 18h–19h)
- Links externos no corpo do post (mata alcance) — colocar nos comentários
- Texto todo em CAIXA ou muitos emojis seguidos
- Apagar e repostar post que flopou nas primeiras horas
