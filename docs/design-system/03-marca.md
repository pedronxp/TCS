# 03 · Marca — TCS · Defesa Civil Digital

**Série:** Design System TCS (documento 03 — Marca) · **Data:** 2026-10-18 · **Status:** Diretrizes oficiais da identidade aprovada
**Base:** spec `docs/superpowers/specs/2026-10-17-identidade-visual-tcs-design.md` (aprovado por Pedro no canvas pen.dev `dda501f6…` — boards V1/V2/V3, frame `Marca TCS · Logo`, frame `Mascote oficial · Coruja Graphite`) e auditoria de todos os pontos de aplicação no repositório (2026-10-18).
**Pendência registrada:** nome de exibição da mascote (ver seção 6 — recomendação: **Vigi**).

> Como usar: nenhuma tela, PDF, e-mail ou ativo novo nasce sem passar por este documento. Em dúvida, use o SVG oficial e a versão mais simples do lockup. Este doc é **machine-readable por seção** — cada regra é verificável (contraste medido, arquivo citado, prompt reproduzível).

---

## 1. Arquitetura da marca

### 1.1 Conceito

O TCS é "Defesa Civil Digital": um instrumento de comando para equipes que decidem sobre risco R1–R4 em imóveis reais. A marca precisa sustentar dois extremos sem cair em nenhum: **não pode parecer "governo seco"** (institucional esquecível) **nem "Silicon Valley genérico"** (diagnóstico clássico do civic tech — ver Apêndice A).

A combinação escolhida resolve isso com três ideias:

| Ideia | Elemento | Por quê funciona |
|---|---|---|
| **Proteção** | Escudo hexagonal | Símbolo universal de defesa civil; o hexágono sugere célula territorial/estrutura técnica, não brasão romano |
| **Vigilância 24h** | Face de coruja no escudo | Coruja = quem enxerga no escuro, nunca dorme; traduz o produto (monitoramento contínuo de risco) |
| **Instrumento técnico** | Graphite + esmeralda | Dark-first de ferramenta profissional (linhagem Vercel/Supabase/Raycast), não de portal governamental |

### 1.2 Arquitetura de nomes

| Nível | Nome | Onde usar |
|---|---|---|
| Marca curta | **TCS** | Wordmark, sidebar, conversa interna |
| Nome de produto (legal/lojas) | **TCS — Relatório de Risco** | App stores, e-mails, assinaturas, `README.md`, laudo |
| Descritor/tagline | **DEFESA CIVIL DIGITAL** | Lockup, materiais de apresentação, primeira menção em texto |

Regras: nunca "T.C.S."; nunca "o TCS" como artigo masculino em copy oficial ("a TCS" quando precisar de artigo — preferir reescrever sem artigo); nunca traduzir o descritor.

### 1.3 Símbolo

**Escudo hexagonal com face de coruja** — SVG vetorial oficial (gerado no canvas, frame `Marca TCS · Logo`).

- A face de coruja é **geométrica, integrada ao escudo** — os olhos são parte da forma, não um personagem sobreposto.
- O olho é a unidade de medida da marca (ver clearspace §1.7).
- O símbolo é o único elemento autorizado em: favicon, app icon, sidebar, notificação, watermark, avatar.
- **Nunca reconstruir à mão.** Sempre copiar o SVG oficial. Geometria, ângulos e contraformas não são especificáveis em texto — são o ativo.

### 1.4 Logotipo

**"TCS"** em **Space Grotesk Bold (700)**, letter-spacing levemente negativo (−2%), sem ponto final.

- Cor do logotipo: **sempre a cor de texto da superfície** (claro `#F4F4F5` sobre graphite; `#171717` sobre claro). **Nunca esmeralda** — regra aprendida com a Supabase: *"Do not use any other color for the wordmark"* (Apêndice A). O esmeralda é sinal de ação; o nome não é ação.

### 1.5 Tagline

**"DEFESA CIVIL DIGITAL"** — Space Grotesk Medium (500), caixa alta, tracking +14–18%, tamanho ~30% da altura do wordmark.

- Cor: cor de texto **secundária** da superfície (zinc-400 `#A1A1AA` no dark; zinc-600 no light). A tagline não compete com o sinal esmeralda.
- A tagline acompanha apenas lockups; nunca aparece solta como "frase de efeito" em headers de página.

### 1.6 Lockups

| Lockup | Composição | Uso |
|---|---|---|
| **Horizontal (padrão)** | Símbolo **52px** à esquerda · "TCS" Space Grotesk Bold ~40px · tagline 11px abaixo do wordmark | Headers de login, páginas públicas, e-mail, papel timbrado |
| **Vertical (stacked)** | Símbolo centrado no topo · wordmark + tagline abaixo | Splash, boot, capas, fim de onboarding |
| **Ícone (símbolo isolado)** | Só o escudo-coruja | Sidebar **32px**, favicon 16–48px, avatar, watermark, notificação |
| **App icon** | Símbolo **branco** sobre gradiente esmeralda `#047857 → #10B981`, raio de canto **24** | Launcher iOS/Android, favicon (mesma receita) |
| **Lockup + RiskBar** | Lockup horizontal + barra R1–R4 (`#10B981 #F59E0B #F97316 #EF4444`) | Aberturas do app (welcome/onboarding), material de apresentação. A barra é assinatura visual secundária — **nunca** entra em favicon ou app icon |

Diagrama do lockup horizontal (proporção 52px):

```
┌────────────────────────────────────────────────┐
│ ┌────┐                                         │
│ │esc.│   TCS                                   │
│ │52px│   DEFESA CIVIL DIGITAL                  │
│ └────┘                                         │
└────────────────────────────────────────────────┘
  símbolo    wordmark ~40px      tagline 11px
```

### 1.7 Área de proteção (clearspace)

Unidade **O = altura do olho da coruja** no símbolo (medir no SVG oficial).

- Todo lockup reserva **1O de respiro em todos os lados** — acima do capacete/escudo, abaixo da tagline, à esquerda do símbolo e à direita do wordmark.
- Nada entra na área de proteção: texto, bordas, ícones, outros logos, pregas de layout.
- Em superfícies densas (sidebar), o container dá o respiro (padding 24px vertical no header da sidebar é o equivalente prático de 1O no símbolo de 32px).

### 1.8 Tamanhos mínimos

| Contexto | Mínimo | Abaixo disso |
|---|---|---|
| Favicon | símbolo **16px** | Não usar (o olho desaparece) |
| UI (sidebar/inline) | símbolo **24px** (sidebar padrão: 32px) | Trocar por inicial textual não é permitido — reduzir densidade da tela |
| Lockup em tela | largura **96px** | Usar só o símbolo (regra já validada em `docs/identidade-abertura-tcs.md`) |
| Impressão (laudo, papel timbrado) | largura **200px** do lockup; símbolo isolado nunca < 12mm | Sempre lockup horizontal em documentos; símbolo no cabeçalho com o nome por extenso ao lado |

### 1.9 Variações por fundo

| Fundo | Símbolo | Wordmark | Tagline |
|---|---|---|---|
| **Graphite (dark, padrão)** `#09090B` / card `#111114` | Esmeralda `#10B981` | `#F4F4F5` | `#A1A1AA` |
| **Claro** `#FFFFFF` / `#FAFAFA` | Esmeralda-700 `#047857` (nunca 500) | `#171717` | zinc-600 |
| **Gradiente esmeralda** (app icon, chips de marca) | **Branco** | Branco | Branco com 80% opacidade |
| **Foto / mapa / satélite** | Símbolo branco em chip graphite `#111114/90%` com blur — nunca esmeralda direto sobre imagem ruidosa | — | — |
| **Monocromático** (notificação Android, watermark) | Branco puro, geometria sólida, sem semitransparências decorativas | — | — |

### 1.10 Co-branding multi-tenant (municípios)

O TCS é multi-tenant municipal — a marca do cliente **coexiste, não substitui**:

1. A marca TCS é sempre a âncora (cabeçalho, protocolo, rodapé de documento).
2. A identidade municipal (ex.: "Defesa Civil · Campinas") aparece como **qualificador textual** ao lado da marca TCS, nunca como marca global do produto — regra herdada de `docs/identidade-abertura-tcs.md` ("não utiliza brasão municipal como marca global").
3. Brasão municipal só entra em **documento oficial emitido para aquele município** (laudo/termo), à direita do cabeçalho, com no máximo 40% da largura do bloco de marca TCS.
4. No bot WhatsApp, o nome da organização já assina a mensagem (`— {Município} · via TCS` em `bot-whatsapp/index.js`) — padrão mantido.

### 1.11 Usos incorretos (modelo NASA "do nots")

1. **Não esticar nem comprimir** — proporção é fixa; escalar sempre proporcional.
2. **Não girar, inclinar ou virar** o símbolo ou o lockup.
3. **Não recolorir** fora das combinações da §1.9 — sem azul, sem roxo, sem gradiente fora do app icon.
4. **Não adicionar** sombra projetada, contorno, brilho, moldura ou texto dentro do clearspace.
5. **Não reconstruir** o símbolo com outra fonte, forma ou "versão melhorada".
6. **Não usar o wordmark em esmeralda** (nem âmbar, nem branco sobre claro).
7. **Não usar o personagem mascote no lugar do símbolo** — são sistemas diferentes (símbolo = identidade; mascote = personagem, seção 3).
8. **Não aplicar opacidade** em usos oficiais — exceção única: watermark de símbolo em laudo PDF entre 6–8%.
9. **Não trocar o gradiente do app icon** (`#047857 → #10B981`, direção 135°) nem o branco do símbolo.
10. **Não aplicar sobre foto sem chip** (ver §1.9) e não usar sobre fundos com contraste de símbolo < 3:1.

---

## 2. Paleta de marca

### 2.1 Primária — Esmeralda

A esmeralda é **a única cor de marca do TCS**. Na linhagem Vercel/Supabase, ela tem papel disciplinado: é **sinal, não decoração** — ação primária, item ativo, foco, sucesso, identidade. Nada mais na interface é esmeralda.

| Tom | Hex | Uso autorizado |
|---|---|---|
| emerald-50 | `#ECFDF5` | Fundo de toast de sucesso (dark) |
| emerald-100 | `#D1FAE5` | Soft states em claro |
| emerald-200 | `#A7F3D0` | Decorativo |
| emerald-300 | `#6EE7B7` | Hover em chips esmeralda |
| emerald-400 | `#34D399` | Hover de links em dark |
| **emerald-500** | **`#10B981`** | **Cor de marca oficial** (dark-first): símbolo, links, ativo, foco, sucesso |
| emerald-600 | `#059669` | Transição/hover |
| **emerald-700** | **`#047857`** | **Esmeralda em fundo claro** (texto, links, CTA) e âncora do gradiente do app icon |
| emerald-800 | `#065F46` | Texto sobre claro com AA folgado; elemento de marca em print |
| emerald-900 | `#064E3B` | Fundos deep em dark |

### 2.2 Base — Graphite

| Token | Valor | Uso |
|---|---|---|
| Graphite bg | `#09090B` | Fundo oficial dark-first (HSL `240 11% 4%` em `dashboard/src/index.css`) |
| Card | `#111114` | Superfícies |
| Muted | `#16161A` | Wells, hovers |
| Border | `~#202023` | Hairlines (`rgba(255,255,255,.07)` equivalente) |
| Texto claro | `#F4F4F5` | Texto primário sobre graphite |
| Texto secundário | `#A1A1AA` | Labels, tagline |
| Splash/boot | `#09090B` | Splash do app e boot RN sobre graphite (substitui o branco atual — ver §4.2) |
| Fundo de geração (mascote) | `#0C0C0F` | Fundo padrão dos prompts de pose (§3.4) |

### 2.3 Âmbar — alerta

O âmbar é o **segundo idioma da marca**: cor de operação em campo (capacete da coruja, banner offline do app, avisos). Alerta, nunca decoração.

| Tom | Hex | Uso |
|---|---|---|
| amber-400 | `#FBBF24` | Hover em dark |
| **amber-500** | **`#F59E0B`** | Alerta em dark; capacete da coruja |
| amber-600 | `#D97706` | Alerta em claro / print R2 |
| **amber-700** | **`#B45309`** | Texto de alerta sobre claro (AA) |

### 2.4 Escala de risco R1–R4 (assinatura de produto, não de marca)

Dois conjuntos oficiais — **web/UI** e **impressão** (ambos já em uso no código; manter a paridade):

| Nível | Web (UI) | Print (PDF, `pdfDesignSystem.ts`) |
|---|---|---|
| R1 | `#10B981` | `#15803D` |
| R2 | `#F59E0B` | `#D97706` |
| R3 | `#F97316` | `#EA580C` |
| R4 | `#EF4444` | `#B91C1C` |

A RiskBar do app (`components/brand/TCSBrand.tsx`) ainda usa a paleta legada desaturada (`#2E7D5A #A66B22 #C45F2A #B24A4A`) — **débito nº 6 da seção 4.2**; novos usos usam a tabela acima.

### 2.5 Combinações AA garantidas (contraste medido, fórmula WCAG 2.1)

Medições confirmadas em 2026-10-18 (alvo: re-verificar em CI — meta do spec de identidade):

| Combinação | Razão | Veredito |
|---|---|---|
| Esmeralda-500 `#10B981` sobre graphite `#09090B` | **7,84:1** | ✅ AA texto (quase AAA) — uso padrão dark |
| Esmeralda-500 sobre card `#111114` | 7,43:1 | ✅ AA texto |
| Esmeralda-500 sobre branco | 2,54:1 | ❌ **proibido para texto**; só elemento gráfico ≥24px |
| Esmeralda-700 `#047857` sobre branco | **5,48:1** | ✅ AA texto em claro (usar 700, nunca 500) |
| Esmeralda-800 `#065F46` sobre branco | 7,68:1 | ✅ AA folgado (print) |
| Texto `#021C14` (HSL 160 84% 6%) sobre botão esmeralda-500 | **7,02:1** | ✅ **única combinação aprovada de texto sobre fundo esmeralda** — botão esmeralda carrega texto grafite-esverdeado, não branco |
| Branco sobre esmeralda-500 | 2,54:1 | ❌ proibido para texto |
| Âmbar-500 sobre graphite `#09090B` | 9,26:1 | ✅ AA alerta em dark |
| Âmbar-700 `#B45309` sobre branco | 5,02:1 | ✅ AA alerta em claro/print |
| `#F4F4F5` sobre `#09090B` | 18,1:1 | ✅ |
| `#A1A1AA` sobre `#09090B` | 7,76:1 | ✅ |
| R3 `#F97316` sobre graphite | 7,1:1 | ✅ |
| R4 `#EF4444` sobre graphite | 5,29:1 | ✅ AA texto (usar com peso 600+) |
| Print: `#15803D` / `#B91C1C` sobre branco | 5,02 / 6,47:1 | ✅ AA texto em PDF |
| Print: `#D97706` / `#EA580C` sobre branco | 3,19 / 3,56:1 | ⚠️ apenas texto grande (≥18pt) e gráficos |

Regra prática: **dark = esmeralda-500; claro/print = esmeralda-700/800; texto sobre esmeralda = `#021C14`.**

### 2.6 Cores proibidas (deriva de marca — nenhuma exceção)

| Cor proibida | Onde existe hoje | Destino |
|---|---|---|
| Azul-marinho `#1A3A5C` / `#1565C0` / `#0D2137` / `#1A73E8` | E-mails transacionais (`welcome-email`, `send-auth-email`) | Migra para graphite + esmeralda (§4.2 débito 3) |
| Teal `#0F766E` | Página de ciência eletrônica (`remote-document-acknowledgement`) | Migra para esmeralda-700 (débito 4) |
| Bege/marrom `#D7C3AA` / `#6F513A` | `dashboard/public/favicon.svg` legado | Substituído pelo novo favicon (débito 1) |
| Verde `#2F7D6D` | Cor de notificação em `app.json` | Migra para `#10B981` (débito 7) |
| Verde "Orca" `#22C55E` | Tema alternativo do console (`index.css`) | Tema ≠ marca: continua existindo como preferência, mas **nunca** em ativos de marca |
| Paleta desaturada de risco `#2E7D5A…` | RiskBar do app | Unificar com web (débito 6) |
| Padrões **Gov Brasil** (azul `#2152D3`, tipografia, componentes) | — | **Regra absoluta do projeto**: SEM padrão Gov Brasil |
| Navy `#153E75` como elemento de marca no PDF | `PDF_COLORS.navy` (laudo) | Navy pode permanecer como **tinta de corpo tipográfico** do documento, mas o elemento de marca (cabeçalho, protocolo TCS) assina em esmeralda-800 `#065F46` |

Cores semânticas de produto (`--destructive`, `--info`) existem na UI e não são marca — não migram para materiais de marca.

---

## 3. Mascote — sistema Coruja Sentinela

### 3.1 Personalidade

A Coruja Sentinela (canvas: frame `Mascote oficial · Coruja Graphite`) é a personificação do produto: **vigia, calma e protetora — nunca engraçada, nunca sarcástica.** Regra de ouro dos mascotes de produto: o mascote **amplifica** o tom já existente, não cria um novo (Duo é sarcástico porque a Duolingo é; a coruja é tranquilizadora porque a microcopy do TCS é). Nada de personalidade passivo-agressiva — o contexto é defesa civil, risco real e prefeituras.

- **Quem ela é:** a guardiã que nunca dorme; de olho nos protocolos, nas vistorias pendentes e nos prazos.
- **Como fala (quando fala):** 1 frase curta, pt-BR coloquial gentil, sempre orientando. "A Vigi está de olho nos seus envios."
- **Como NÃO fala:** nunca em erros (§3.8), nunca com humor em contexto de risco, nunca com gíria.

### 3.2 Regras de consistência (anatomia oficial)

Toda pose, gerada por IA ou redesenhada, **deve** manter (padrão Duo/Octocat: silhueta e traços assinatura estáveis):

1. **Capacete de obra âmbar** `#F59E0B` — o traço assinatura; sempre presente.
2. **Plumagem zinco-escura** `#27272A`–`#3F3F46` com **acentos esmeralda** `#10B981` no peito e pontas das penas (paleta adaptada ao Graphite, decisão do canvas).
3. **Olhos grandes esmeralda** com brilho branco — a principal ferramenta de expressão.
4. **Máximo 3 cores de família** (zinco + esmeralda + âmbar + branco); **sem gradiente no personagem**, sem textura de pele/pena realista.
5. **Estilo flat vector**, formas geométricas limpas, frontal ou 3/4 — nunca perfil completo.
6. **Sem roupas, acessórios ou props extras** (sem prancheta, sem lanterna, sem óculos) — o capacete é o único artefato.
7. Sem traços humanos que leiam como demografia específica (idade, gênero, etnia) — personagem neutra para contexto formal municipal.

### 3.3 As poses do sistema

**4 poses obrigatórias** (kit mínimo) **+ 1 variação de extensão**:

| # | Pose | Expressão/Composição | Momento mapeado no produto |
|---|---|---|---|
| 1 | **Sentinela** (neutral) | Ereta, asas dobradas, olhos bem abertos calmos, peito estufado | Splash/boot, login, hero, avatar padrão, assinatura do bot |
| 2 | **Comemorativa** | Asa erguida em "tudo certo", olhos em arcos felizes | Emissão concluída, sync finalizado, checklist completo, fatura paga |
| 3 | **Alerta** | Olhos arregalados, penas da cabeça eriçadas, corpo 10° para frente — **atenção séria, sem pânico** | Banner offline do app, fila "Atenção agora", risco alto, prazo estourando |
| 4 | **Sem dados** (empty state) | Cabeça inclinada para baixo/lateral, olhos semicerrados simpáticos, uma pena caindo | Listas vazias, busca sem resultado, "nada por aqui ainda" |
| 5 | **Orientação** (extensão da Sentinela) | Uma asa apontando, olhos calmos ao espectador, leve sorriso | Onboarding do Portal, tours, dicas, empty state com CTA |

### 3.4 Prompts de geração padronizados

**Prompt-base (pt-BR)** — prefixo fixo, só o sufixo de pose muda:

```text
Ilustração flat vector do mascote oficial da TCS: coruja sentinela com capacete
de obra âmbar (#F59E0B), plumagem zinco escura (#27272A a #3F3F46) com acentos
esmeralda (#10B981) no peito e nas pontas das penas, olhos grandes esmeralda com
brilho branco, composição frontal ao nível dos olhos, personagem centralizado com
15% de margem em todos os lados, estilo flat vector com formas geométricas
limpas, sombreamento mínimo em duas tonalidades de zinco, rim light esmeralda
sutil na silhueta à direita, fundo liso sólido #0C0C0F, sem texto, sem logotipo,
sem gradiente no personagem, paleta estrita: zinco, esmeralda, âmbar e branco.
[DESCRIÇÃO DA POSE]
```

**Sufixos por pose:**

1. **Sentinela:** "Postura ereta e atenta, asas dobradas junto ao corpo, peito levemente estufado, olhos bem abertos em expressão calma de vigilância, cabeça reta."
2. **Comemorativa:** "Asa direita erguida em saudação amigável, olhos em arcos felizes de contentamento (fechados em meia-lua para cima), penas relaxadas, bico fechado esboçando sorriso."
3. **Alerta:** "Olhos arregalados com pupilas reduzidas, penas da cabeça levemente eriçadas, corpo inclinado 10 graus para frente, uma asa levantada na altura do peito, expressão de atenção séria sem medo."
4. **Sem dados:** "Cabeça levemente inclinada para baixo à esquerda, olhos semicerrados e simpáticos, uma pequena pena solta caindo ao lado direito, postura relaxada de espera paciente."
5. **Orientação:** "Uma asa estendida apontando para a direita, olhos calmos voltados ao espectador, leve sorriso, postura inclinada como quem encaminha com atenção."

Regras de geração: gerar sempre em **1:1** (quadrado, avatar/busto) e **4:3** (corpo inteiro); revisar os olhos e o capacete em cada saída (são os traços que mais derivam); rejeitar qualquer saída com texto, logo extra, gradiente no personagem ou mais de 3 famílias de cor.

### 3.5 Tamanhos de uso

| Tamanho | Recorte | Uso |
|---|---|---|
| **24px** (mínimo inline) | Busto (cabeça + capacete) | Chips, assinatura de mensagem do bot, inline em tooltips |
| **32px** | Busto | Avatar em comunicados, perfil WhatsApp, comentários |
| **48px** | Busto | Empty states compactos, toasts de sucesso |
| **64px** (limite busto/corpo) | — | Abaixo disso sempre busto; a partir daqui corpo inteiro |
| **96px** | Corpo | Empty states de página, cards de onboarding |
| **160px** | Corpo | Splash/boot, painel lateral de onboarding |
| **240–320px** | Corpo | Welcome do app, aside de login |
| **480px** (máximo) | Corpo | Hero de onboarding/capa — acima disso não escalar (usar composição de página, não mascote maior) |

### 3.6 Expressões e frases pt-BR (vocabulário oficial)

Frases-padrão por pose — reuso em empty states, alt text e assinaturas (adaptar tempo verbal, manter o registro):

| Pose | Frase-padrão | Alt text |
|---|---|---|
| Sentinela | "A Vigi está de olho." / "Vigilância ativa 24h." | "Vigi, a coruja sentinela da TCS, em posição atenta" |
| Comemorativa | "Tudo certo por aqui." / "Enviado com sucesso." | "Vigi comemorando, com a asa erguida" |
| Alerta | "Atenção aí." / "Sem conexão — a Vigi continua guardando tudo." | "Vigi alerta, de olhos arregalados" |
| Sem dados | "Nada por aqui ainda." / "Assim que chegar a primeira vistoria, a Vigi avisa." | "Vigi aguardando pacientemente, sem dados para mostrar" |
| Orientação | "Por aqui, siga a Vigi." / "Comece por aqui." | "Vigi apontando o caminho" |

### 3.7 Aplicação por superfície

| Superfície | Pose/tamanho | Regras |
|---|---|---|
| **App splash/boot** | Sentinela busto 96–116px sobre graphite + wordmark | Substitui o spinner azul isolado; manter "Preparando sua operação" |
| **Empty states** (app + console + portal) | Sem dados 48–96px + frase-padrão + CTA | A coruja é dona do empty state (padrão Wumpus); sempre com ação de saída |
| **Onboarding (Portal + app)** | Orientação 96–160px | Uma aparição por passo — nunca mascote repetido em todas as telas |
| **Login (aside do Console)** | Sentinela 160–240px | Conforme board V1 do canvas |
| **Assinatura do bot WhatsApp** | Busto 32px (foto de perfil) + assinatura textual existente | Perfil = busto Sentinela; mensagem mantém "— {Município} · via TCS" |
| **Erro amigável** (recuperável) | Sentinela com olhos calmos 48px | Só em falhas recuperáveis com próximo passo claro; texto em voz do produto |
| **Cabeçalho/rodapé de laudo PDF** | **NÃO usar personagem** — só o símbolo esmeralda | Documento oficial (§3.8) |
| **Comunicados de severidade baixa/média** | Busto 24–32px opcional | Nunca em severidade alta/emergência |

### 3.8 Onde NÃO usar (proibições absolutas)

1. **Erro crítico ou destrutivo** — perda de dados, falha de sync sem recuperação, R4, interdição, acidente. Mascote não ironiza tragédia; silêncio é a resposta da marca.
2. **Documentos oficiais** — laudo, termo de interdição, ciência eletrônica (só o símbolo no cabeçalho).
3. **Diálogo de confirmação destrutiva** ("Excluir cliente?"), auditoria de acesso sensitive, logs.
4. **Notificação push de alto risco** — usa ícone de alerta do sistema, nunca a coruja.
5. **Comunicado de severidade alta/emergência** — texto puro, formato oficial.
6. **Nunca como controle interativo** — a coruja não é botão, não é clicável, não abre menu.
7. **Nunca com fala em erro** e nunca em primeira pessoa técnica ("Ops! Deu algo errado por aqui 🙈" — proibido).
8. **Nunca animada em loop decorativo** — respeitar `prefers-reduced-motion` (padrão já validado em `docs/validacao-identidade-abertura-tcs.md`); animação só na transição de boot.
9. **Nunca em material jurídico/LGPD** (termos, política, base legal).

---

## 4. Aplicações no produto (mapa completo)

Auditoria de 2026-10-18 em todo o repositório. "Hoje" descreve o estado real encontrado no código; "Diretriz 2.0" é o alvo desta identidade.

### 4.1 Mapa por superfície

| # | Superfície | Ponto no código | Hoje | Diretriz 2.0 |
|---|---|---|---|---|
| 1 | Login do Console | `dashboard/src/components/auth/AuthFrame.tsx` (TcsMark 42px + "TCS"), `pages/LoginPage.tsx` | PNG raster + wordmark | Lockup horizontal (símbolo esmeralda 52px + TCS + tagline); Sentinela no aside (board V1) |
| 2 | Sidebar do Console | `dashboard/src/components/layout/AppSidebar.tsx` (36/40px) | PNG raster | Símbolo SVG **32px**; wordmark "TCS Console" na cor de texto |
| 3 | Título da aba | `components/layout/ConsoleShell.tsx` (`{página} — TCS Console`) | OK | Manter o padrão |
| 4 | Favicon web | `dashboard/index.html` (`/tcs-system-logo.png`), `dashboard/public/favicon.svg` (legado bege/marrom) | Divergente | Favicon = app icon em miniatura (símbolo branco sobre gradiente esmeralda), 16/32/48px |
| 5 | App icon iOS | `app.json` → `assets/icon.png` | Legado "TCS Cursos e Serviços" | Símbolo branco sobre gradiente `#047857→#10B981`, raio 24, conteúdo nos 66% centrais de 1024px |
| 6 | Android adaptive | `app.json` `adaptiveIcon` (foreground/monochrome/background `#FFFFFF`) | Fundo branco | Foreground: símbolo branco nos 432px centrais; background: gradiente esmeralda; monochrome: símbolo branco (themed icons) |
| 7 | Splash Expo | `app.json` splash (`splash-icon.png` sobre `#FFFFFF`) | Fundo branco | Símbolo esmeralda sobre **graphite `#09090B`** (dark e light), 20% de respiro |
| 8 | Boot React Native | `app/_layout.tsx` → `OpeningBoot` (`components/brand`) | ProductIdentity boot + spinner | Sentinela busto 96–116px + wordmark; manter "Preparando sua operação" |
| 9 | Welcome do app | `app/(auth)/index.tsx` (ProductIdentity hero + RiskBar) | Hero + RiskBar | Lockup vertical + Sentinela; RiskBar R1–R4 mantida como assinatura |
| 10 | Onboarding/showcase app | `app/onboarding.tsx` (step `welcome`), `app/showcase.tsx` | Identidade repetida | Pose Orientação por passo; ícones lucide (kit canvas) |
| 11 | Portal do cliente | `components/portal/PortalShell.tsx` (TcsMark), `pages/portal/PortalAuthPage.tsx` ("Portal TCS"), `PortalPasswordRecoveryPage.tsx` | PNG raster | Lockup horizontal; Orientação no onboarding do Portal (`PortalOnboardingChecklist`) |
| 12 | Páginas públicas | `components/layout/PublicLayout.tsx`, `pages/public/CommercialPage.tsx` (28px), `PlansCatalogPage.tsx`, `DocumentAcknowledgementLinkPage.tsx` (48px), `components/public/AppExperienceShowcase.tsx` (68/34px), `AuthCallbackPage.tsx` | PNG em tamanhos ad hoc | Padronizar: símbolo 32px em headers de navegação, 48px em páginas de documento, lockup horizontal em footers |
| 13 | Bot WhatsApp — perfil | Número da organização (painel) | Sem diretriz | Foto de perfil: busto Sentinela 1:1 1024px para toda org sem logo próprio |
| 14 | Bot WhatsApp — assinatura | `bot-whatsapp/index.js` `textoComunicado` → `— {Org} · via TCS` | OK | Manter; severidade alta/emergência remove elemento afetivo |
| 15 | Laudo PDF | `utils/laudoPdfBuilder.ts` (4 layouts: classico/oficio/ficha/resumo), `DEFESA_CIVIL_LOGO_BASE64`, `supabase/functions/_shared/pdfDesignSystem.ts` | Brasão municipal genérico em todos os layouts | Cabeçalho: símbolo TCS esmeralda + "Defesa Civil · {Município}" (co-branding §1.10); protocolo TCS em esmeralda-800; **sem personagem** |
| 16 | Watermark PDF | Laudo (futuro) | Inexistente | Símbolo (nunca o personagem) a 6–8% de opacidade, centralizado, atrás do conteúdo |
| 17 | E-mail transacional | `supabase/functions/welcome-email/`, `send-auth-email/`, `send-monthly-report/` (FROM_NAME "TCS — Relatório de Risco") | Azul-marinho legado + brasão + "Sistema de Gestão de Risco Municipal" | Header graphite + símbolo esmeralda + "TCS — Relatório de Risco"; CTA esmeralda-700; rodapé "TCS — Relatório de Risco · Defesa Civil Digital"; máx. 1 emoji e só em boas-vindas |
| 18 | Ciência eletrônica | `supabase/functions/remote-document-acknowledgement/index.ts` (brand "TCS · DEFESA CIVIL", teal `#0F766E`) + `DocumentAcknowledgementLinkPage.tsx` | Teal divergente | Alinhar ao esmeralda/graphite; página de documento oficial — sem mascote |
| 19 | Notificações push | `app.json` expo-notifications (cor `#2F7D6D`), `services/NotificationService.ts` (`#10B981`/`#EF4444`) | Cor divergente no app.json | Ícone monocromático branco (símbolo); accent `#10B981`; push de alto risco usa ícone de alerta, sem mascote |
| 20 | Avatar em comunicados | Inbox do Console (`WhatsAppPage`, `ComunicadoComposerFields.tsx`) | Sem avatar padrão | Busto Sentinela 32px como remetente padrão quando a org não envia logo |
| 21 | Simulador mobile | `components/layout/MobileFrameSimulator.tsx` | Moldura neutra | Mantém neutro (ferramenta interna, sem marca) |
| 22 | README | `README.md` | "TCS — Relatório de Risco" + badges | Manter |
| 23 | Style guide interno | `pages/StyleGuidePage.tsx` | Sem seção de marca | Futuro: seção "Marca" viva (lockups, poses, tom de voz) servida deste doc |

### 4.2 Débito de marca (divergências a corrigir)

Ordem sugerida por impacto:

1. **Favicon legado** — `dashboard/public/favicon.svg` (bege/marrom "TCS" + barras) → novo app-icon em miniatura; trocar o `href` do `dashboard/index.html`.
2. **Splash e adaptive icon em branco** — `app.json` splash bg `#FFFFFF` e adaptive bg `#FFFFFF` → graphite/gradiente esmeralda (dark-first é a direção oficial V1).
3. **E-mails em azul-marinho** — gradiente `#1a3a5c→#0d2137`, CTA `#1a73e8`, hero `#1565c0` → graphite + esmeralda; remover brasão municipal genérico do header.
4. **Ciência eletrônica em teal** `#0F766E` → esmeralda-700 sobre claro.
5. **PNG raster no lugar de SVG** — `TcsMark` (`/tcs-system-logo.png`) e `assets/brand/tcs-mark-v5.png` → migrar para o SVG oficial (nitidez em todas as densidades, dark/light via `currentColor`).
6. **RiskBar do app desaturada** (`#2E7D5A #A66B22 #C45F2A #B24A4A`) ≠ web (`#10B981 #F59E0B #F97316 #EF4444`) → unificar (paridade mobile × web já é meta do spec).
7. **Cor de notificação** `#2F7D6D` → `#10B981`.
8. **Brasão municipal genérico como logo global** (`assets/logo.png`, `DEFESA_CIVIL_LOGO_BASE64`) → restringir a co-branding em laudo (§1.10).

---

## 5. Tom de voz

pt-BR, direto e tranquilizador. A microcopy atual do produto é o ponto mais elogiado da experiência — este doc formaliza o padrão para que ele sobreviva à escala.

### 5.1 Três princípios

**1. Nunca culpe quem usa.**
O erro é um fato do sistema, não um defeito da pessoa. Descreva o que aconteceu, sem acusações, sem "você esqueceu", sem jargão de engenharia.

**2. Sempre termine com o próximo passo.**
Nenhuma mensagem termina em beco sem saída: ou a pessoa tem uma ação clara para agora, ou você diz o que acontece sozinho a seguir.

**3. Tranquilize com precisão.**
Afirmação verificável e específica vale mais que promessa genérica. "Permissões existentes não mudam" tranquiliza porque é checável. "100% seguro" é vazio.

### 5.2 Padrões reais do produto (referência viva — manter)

| Onde | Texto | Princípio |
|---|---|---|
| `LoginPage` | "Use seu e-mail corporativo. Você voltará ao ponto em que estava." | Próximo passo + precisão |
| `LoginPage` | "Primeiro acesso com Google? A equipe TCS revisará a conta antes de liberar o Console. Permissões existentes não mudam." | Anti-culpa + tranquilizar com fato |
| `PortalProfilePage` | "Não foi possível concluir a saída global. Esta sessão continua aberta; tente novamente." | Anti-culpa + estado atual |
| `PortalProfilePage` | "A saída global revoga os tokens de atualização. Tokens de acesso já emitidos em outros dispositivos podem permanecer válidos até expirar." | Precisão (sem prometer demais) |
| `PortalAuthPage` | "Abra a mensagem da TCS no mesmo dispositivo. Se não aparecer, confira a caixa de spam antes de tentar novamente." | Próximo passo + fallback |
| `OpeningBoot` | "Preparando sua operação" | Verbo, sem "carregando…" genérico |
| `bot-whatsapp` | "— {Município} · via TCS" | Assinatura sóbria, institucional |

### 5.3 Exemplos bom/ruim (padrão para novos textos)

| ❌ Ruim | ✅ Bom | Por quê |
|---|---|---|
| "Credenciais inválidas." | "Não foi possível entrar. Confira o e-mail e a senha — a senha diferencia maiúsculas — e tente novamente." | Ruim culpa e não ensina; bom dá o fato + causa provável + ação |
| "Você não tem permissão para acessar esta página." | "Seu perfil não inclui este módulo. Peça ao administrador da organização e volte quando for liberado — suas outras permissões continuam iguais." | Ruim termina o diálogo no "não"; bom aponta quem resolve e preserva o que funciona |
| "Erro ao sincronizar. Tente novamente mais tarde." | "A vistoria não foi sincronizada. Ela fica salva no aparelho e será enviada automaticamente quando a conexão voltar." | Ruim esconde o estado; bom tranquiliza com precisão (nada se perde) e diz o que acontece sozinho |
| "FALHA CRÍTICA: dados corrompidos!" | "Não foi possível carregar o laudo. Nada foi alterado. Tente abrir novamente; se persistir, avie o suporte com o protocolo em mãos." | Ruim dramatiza; bom mantém a calma institucional e dá protocolo de saída |
| "Ops! Deu ruim 🙈" | (sem mascote, sem humor) "Algo não saiu como esperávamos. Sua sessão continua ativa." | Humor nunca em erro (§3.8); a marca fala séria quando algo falhou |

### 5.4 Vocabulário

- **Dizer:** vistoria, laudo, protocolo, município, organização, agente, fila, risco R1–R4.
- **Não dizer:** "imóvel problemático", "vítima", "usuário final" (quem usa é agente/coordenador/prefeitura), jargão interno ("queue", "batch", "payload") na UI.
- **Números pt-BR:** `1.284`, `R$ 1.234,56`, "12 de abril de 2026", `tabular-nums` (padrão do console).
- **Voz ativa, frases curtas (máx ~15 palavras em UI).** Botões começam com verbo: "Entrar", "Registrar ciência", "Sincronizar".
- **Sem "por favor" repetido; sem juridiquês na UI** (base legal fica no documento, não no botão).
- **A coruja não tem voz em erros.** Em orientação/empty state pode assinar 1 frase curta (§3.6); o restante é sempre voz do produto.

---

## 6. Nome da mascote

Pendência formal do spec de identidade ("Confirmar apelido/nome oficial da Coruja"). Critérios usados no ranking, baseados nas melhores práticas de naming de mascotes (Apêndice A): **curto e fonético > esperto** (Duo, Wumpus, Freddie); funciona em pt-BR coloquial e em contexto municipal formal; carrega a missão; flexiona com artigo; sem colisão relevante de marca.

### 6.1 Candidatos ranqueados

| # | Nome | Justificativa | Contra |
|---|---|---|---|
| **1** | **Vigi** ⭐ recomendado | Duas sílabas, fonético, sem ambiguidade — o padrão dos grandes nomes de mascote. Deriva de "vigiar/vigia": **o nome é a missão** (vigilância 24h). Coloquial brasileiro ("fica de vigia", "olho vivo") sem virar gíria. Flexiona natural: "a Vigi", "da Vigi". Funciona em microcopy ("A Vigi está de olho"), no bot ("Vigi · Defesa Civil Digital") e em empty states. Sem colisão relevante no setor. | Pode ler informal demais isolado — mitigado apresentando sempre "Vigi, a Coruja Sentinela da TCS" na primeira menção de cada superfície |
| 2 | **Teca** | Nome próprio brasileiro, afetuoso, fácil de pronunciar. Ecoa "técnica/tecnologia" — conversa com "vistoria técnica" e a alma tech do produto. Coruja como sabedoria. | Não carrega a missão de vigilância; fonética próxima de "TCS" pode confundir em áudio/mídia |
| 3 | **Sentinela** | Herança direta do conceito aprovado ("Coruja Sentinela"); épico e institucional. | 4 sílabas — descreve, não chama. Melhor como **epíteto do papel** ("a sentinela da TCS") do que como nome |
| 4 | **Luna** | Evoca noite/lua (habitat da coruja); feminino, doce, universal. | Genérico: alto risco de colisão de marca, zero relação com defesa civil ou vistoria — não diferencia |
| 5 | **Coruja** / "Coruja TCS" | Nome funcional de exibição já sugerido no spec; imediatamente entendível, zero risco de interpretação. | Sem personalidade própria — não vira personagem nem assina mensagens; funciona como espécie, não como nome |

### 6.2 Recomendação

**Vigi** — apresentação completa: **"Vigi, a Coruja Sentinela da TCS"**.

- Primeira menção em cada superfície: forma completa; depois, "a Vigi".
- Alt text padrão: "Vigi, mascote coruja da TCS".
- No bot WhatsApp: foto de perfil (busto) + assinatura textual existente ("— {Município} · via TCS") — a Vigi não assina texto de mensagens.
- Enquanto Pedro não confirmar, telas usam apenas "Coruja Sentinela" (sem nome próprio) — a adoção do nome é bloqueadora para os textos de §3.6, não para os ativos visuais.

---

## 7. Governança

### 7.1 Checklist de review de marca (5 perguntas antes de publicar)

1. O símbolo é o SVG oficial, sem esticar/girar/recolorir, com clearspace de 1O?
2. O esmeralda está sendo usado como **sinal** (ação/ativo/identidade), não como decoração?
3. Todas as combinações de texto usam pares AA da §2.5 (dark: 500; claro: 700/800; texto sobre esmeralda: `#021C14`)?
4. A coruja aparece só em momento de orientação/calma (§3.7) e **nunca** nas proibições da §3.8?
5. A mensagem segue os 3 princípios de tom de voz (§5.1) e termina com próximo passo?

### 7.2 Próximos passos

1. Confirmar com Pedro o nome oficial (recomendação: **Vigi**) — pendência aberta no spec.
2. Gerar as 4 poses oficiais com os prompts padronizados (§3.4), revisar olhos/capacete, versionar em `assets/brand/` (app) e `dashboard/public/` (web).
3. Migrar `TcsMark` e `TCSBrand` para o SVG oficial (débito 5) e substituir o favicon (débito 1).
4. Corrigir splash/adaptive (`app.json`) para graphite + gradiente (débito 2).
5. Migrar e-mails e ciência eletrônica para a paleta oficial (débitos 3 e 4).
6. Registrar os pares AA da §2.5 no CI (meta do spec: contraste AA + paridade de hex mobile × HSL web).
7. Atualizar `StyleGuidePage` com seção "Marca" viva servida deste documento.

---

## Apêndice A — Referências da pesquisa (out/2026)

**Marcas institucionais/tech**
- Supabase — Brand Assets & Design System: "Do not use any other color for the wordmark"; verde canônico restrito a CTA/primary; guidelines vivas e programáticas (supabase.com/brand-assets, /design-system).
- Vercel — Geist: disciplina monocromática com regras "never" explícitas; marca como sistema verificável; brand guidelines públicas com regras de trademark (vercel.com/geist).
- Raycast — dark-first developer tools; brand guidelines com assets centralizados.
- FEMA/DHS Style Guide: paleta única aprovada, "variation from these colors is strictly prohibited" — modelo de rigidez institucional.
- NASA Brand Center: referência de manual de "do nots" regulamentado.
- GovTech/Civic tech 2026: diagnóstico dos dois extremos ("looks like government" vs "Silicon Valley genérico"); consistência como construtora de confiança pública (PRSA; Center for Civic Futures).

**Estrutura de brand guidelines (2026)**
- Estrutura padrão de 7 seções: brand essentials, logo system, paleta, tipografia, imagem, voz, aplicações (Digital Polo 2026).
- Tendência: guidelines AI-queryáveis/machine-readable — brand.md (Strategy/Voice/Visual/Governance), hierarquia de marca-mãe × sub-marcas (Frontify 2026). Este documento segue essa estrutura e o princípio de governança multi-nível (marca TCS × identidade municipal).
- Misuse examples explícitos por seção (não genéricos) — prática de NASA/JPMorgan.

**Mascotes de produto**
- Duolingo (Duo): personalidade específica e consistência de uso em todos os touchpoints; o loop comportamental importa mais que o desenho.
- GitHub (Octocat): remix comunitário a partir de traços assinatura estáveis.
- Mailchimp (Freddie): textura autoral vence o polish genérico de SaaS.
- Discord (Wumpus): o mascote como dono dos empty states.
- Melhores práticas 2026 (ziggle.art; svgapp.ai): nome curto e fonético > clever; 2–3 cores máx; olhos grandes como ferramenta de expressão; 1 traço assinatura; mapear cada pose a um momento específico do produto; mascote amplifica o tom existente (Attic Salt); evitar traços que leiam como demografia específica.

## Apêndice B — Inventário de ativos atuais (auditoria 2026-10-18)

| Ativo | Local | Estado |
|---|---|---|
| Símbolo (escudo-coruja SVG) | Canvas pen.dev, frame `Marca TCS · Logo` | ✅ Aprovado — exportar para o repo |
| Mascote — 3 variações + paleta esmeralda | Canvas, frames `Mascotes · 3 variações` / `Mascote oficial · Coruja Graphite` | ✅ Aprovado — gerar 4 poses oficiais (§3.4) |
| `tcs-mark-v5.png` | `assets/brand/` (app Expo) | Legado — migrar para SVG |
| `tcs-system-logo.png` | `dashboard/public/` (referenciado por `TcsMark`) | Legado — migrar para SVG |
| `favicon.svg` / `favicon.png` | `dashboard/public/`, `assets/` | ❌ Legado bege — substituir (débito 1) |
| `icon.png` | `assets/` | ❌ Legado "TCS Cursos e Serviços" — substituir |
| `splash-icon.png` | `assets/` (bg `#FFFFFF` no `app.json`) | ❌ Trocar fundo para graphite |
| `android-icon-foreground/monochrome/background.png` | `assets/` | ⚠️ Reaproveitar máscaras, trocar conteúdo/fundo |
| `notification-icon.png` | `assets/` (cor `#2F7D6D` no `app.json`) | ⚠️ Alinhar cor ao esmeralda |
| `logo.png` (brasão municipal genérico) | `assets/` | Restringir a co-branding de laudo (§1.10) |
| `DEFESA_CIVIL_LOGO_BASE64` | `supabase/functions/_shared/defesaCivilLogo.ts` | Usado no laudo + e-mails — substituir pelo símbolo TCS com qualificador municipal |
| App icon 2x (PNGs do canvas) | `~/.pencil/documents/dda501f6-…/exports/` | Fonte para os próximos exports |

**Documentos irmãos:** `docs/identidade-abertura-tcs.md` e `docs/validacao-identidade-abertura-tcs.md` (área segura de launcher/adaptive/splash, critérios de aprovação) permanecem válidos para os ativos nativos; este documento os estende com paleta, mascote e tom de voz.
