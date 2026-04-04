# Fase 10: Formulário Estrutural Inteligente — Research

**Pesquisado:** 2026-04-02
**Domínio:** React Native / Expo — JSON form engine, lógica condicional, geração de imagens PNG via Node.js
**Confiança:** HIGH (tudo verificado diretamente no código-fonte do projeto)

---

## Resumo

O formulário `risco_estrutural_v1.json` tem 12 elementos × 5 perguntas cada = 60 perguntas no wizard. O wizard atual (`wizard.tsx`) é linear — sem lógica condicional, sem skip. Toda pergunta é exibida independentemente do contexto. Para o campo, isso é impraticável.

A solução de menor risco é criar um `risco_estrutural_v2.json` paralelo com lógica de skip embutida no JSON (campo `visivelSe`) e implementar o suporte correspondente no wizard. As imagens atuais (nv0–nv6) são barras de cor genéricas geradas por script Node.js puro já existente em `scripts/gerar-imagens-formulario.js` — o mesmo mecanismo pode gerar imagens contextuais por categoria de dano. O `react-native-svg` (v15.12.1) já está instalado mas não é necessário para a abordagem PNG: o wizard usa `Image` do RN com `require()` estático, o que exige que todas as chaves do `FORM_IMAGES` sejam conhecidas em tempo de build.

**Recomendação primária:** Criar `risco_estrutural_v2` com (a) skip automático quando Estado = "Bom" e (b) imagens PNG contextuais por categoria geradas pelo script existente, mantendo o mecanismo `FORM_IMAGES` + `require()`.

---

## Q1 — Estrutura Atual e Fórmula de Pontuação

### Os 12 Elementos (fases) e seus Pesos

| # | fase_id | Título | Peso | Impacto Máximo* |
|---|---------|--------|------|-----------------|
| 1 | fase_fundacao | Fundação | **1.5** | **19.5** |
| 2 | fase_estrutura | Estrutura (Pilares, Vigas, Lajes) | **1.5** | **19.5** |
| 3 | fase_alvenaria | Alvenaria / Vedação | 1.0 | 13.0 |
| 4 | fase_cobertura | Cobertura / Telhado | 0.9 | 11.7 |
| 5 | fase_piso | Piso / Contrapiso | 0.8 | 10.4 |
| 6 | fase_escadas | Escadas / Circulação | 1.0 | 13.0 |
| 7 | fase_muro_arrimo | Muro de Arrimo / Contenção | **1.4** | **18.2** |
| 8 | fase_fachada | Fachada / Revestimento | 0.8 | 10.4 |
| 9 | fase_drenagem | Drenagem / Águas Pluviais | 1.1 | 14.3 |
| 10 | fase_eletrica | Instalações Elétricas | 0.9 | 11.7 |
| 11 | fase_hidraulica | Instalações Hidráulicas | 0.8 | 10.4 |
| 12 | fase_talude | Talude / Encosta Próxima | **1.4** | **18.2** |

*Impacto máximo = (6+5+4+2) × peso = 17 × peso

### Fórmula Confirmada (verificada em wizard.tsx linha 247–280)

```
score_bruto_fase = Estado.pesoRisco + Gravidade.pesoRisco + Extensão.pesoRisco + Ativa.pesoRisco
score_elemento   = score_bruto_fase × peso_fase
```

**Classificação global** (`tipoCalculo: "ponderada_max_elemento"`):

| Critério | Nível |
|----------|-------|
| max_elemento < 6 E média < 6 | R1 — Baixo |
| max_elemento 6–10.9 OU média >= 6 | R2 — Médio |
| max_elemento 11–14.9 | R3 — Alto |
| max_elemento >= 15 OU 2+ elementos em Alto/Muito Alto | R4 — Iminente |

### Pesos por opção em cada sub-pergunta

| Sub-pergunta | Opções e pesos |
|---|---|
| Estado | Bom=0, Regular=2, Ruim=4, Péssimo=6 |
| Gravidade | Nenhuma=0, Leve=1, Moderada=3, Severa=5 |
| Extensão | Pontual=1, Setorial=2, Generalizada=4 |
| Ativa | Não=0, Sim=2 |

**Score máximo por elemento = 6+5+4+2 = 17. Multiplicado pelo peso máximo (1.5) = 25.5.**

### Elementos Críticos vs Descartáveis para Campo

**Críticos (gatilheiros R3/R4 — manter obrigatórios):**
- Fundação (peso 1.5) — qualquer dano severo = R3/R4 instantâneo
- Estrutura/Pilares/Vigas (peso 1.5) — idem
- Muro de Arrimo (peso 1.4) — colapso mata ocupantes vizinhos
- Talude (peso 1.4) — deslizamento mata a edificação inteira

**Intermediários (relevantes, manter como opcionais):**
- Drenagem (peso 1.1) — acelera deterioração de fundações
- Alvenaria (peso 1.0) — indica progressão de dano estrutural
- Escadas (peso 1.0) — rota de fuga, mas não determina R4

**Baixo impacto para campo rápido (candidatos a skip/opcional):**
- Fachada (peso 0.8) — estético, max score 13.6, não atinge R3 sozinho
- Piso/Contrapiso (peso 0.8) — máx 13.6, raramente gatilho
- Instalações Hidráulicas (peso 0.8) — máx 13.6
- Cobertura (peso 0.9) — importante mas não gatilha R4 sozinho (máx 15.3 — exceção se Péssimo+Severa+Generalizada+Ativa)
- Instalações Elétricas (peso 0.9) — risco de vida mas separado da estrutura

**Estratégia para ≤ 15 perguntas visíveis:**
- 4 elementos críticos × 1 pergunta de triagem (Estado) = 4 perguntas obrigatórias
- Skip automático: se Estado = "Bom" → pula Gravidade, Extensão, Ativa (poupa 3 perguntas por elemento)
- Se Estado ≠ "Bom" → exibe as 3 restantes
- Com 4 elementos críticos: 4 triagens + até 12 detalhe = 16 perguntas no pior caso, 4 no melhor
- Adicionar 2–3 elementos opcionais de alta visibilidade no campo (Alvenaria, Cobertura) = máx ~25, mín 4

---

## Q2 — Lógica Condicional no Wizard

### Estado Atual: NENHUM suporte a skip

**Verificado em wizard.tsx:**

A função `flattenPerguntas()` (linhas 199–225) aplana todas as perguntas de todas as fases em lista linear sem condições. Não há campo `visivelSe`, `dependeDe`, `skipSe` ou similar em `PerguntaModel`. O loop de exibição é simples: `perguntas[step]` sem filtragem.

A função `avancar()` (linha 448–455) avança linearmente, sem lógica de pulo.

### O que precisa ser implementado

**No JSON (campo novo `skipSe`):**

```json
{
  "id": "fund_gravidade",
  "texto": "Gravidade da manifestação",
  "tipo": "cards",
  "obrigatoria": false,
  "skipSe": {
    "perguntaId": "fund_estado",
    "opcaoId": "bom"
  },
  "opcoes": [...]
}
```

**Convenção proposta:** `skipSe.perguntaId` + `skipSe.opcaoId` — pula esta pergunta se a resposta atual da pergunta referenciada for a opcaoId especificada.

**No wizard.tsx — 3 pontos de mudança:**

1. **`PerguntaModel`** — adicionar campo `skipSe?: { perguntaId: string; opcaoId: string } | null`

2. **`flattenPerguntas()`** — propagar campo `skipSe` do JSON para o model

3. **`perguntas` filtradas** — criar `perguntasVisiveis` computada:

```typescript
const perguntasVisiveis = useMemo(() =>
  perguntas.filter(p => {
    if (!p.skipSe) return true;
    return respostas[p.skipSe.perguntaId] !== p.skipSe.opcaoId;
  }),
  [perguntas, respostas]
);
```

4. **Substituir `perguntas[step]` por `perguntasVisiveis[step]`** e `totalPerguntas` por `perguntasVisiveis.length`.

5. **`finalizar()`** — verificação de obrigatórias deve iterar `perguntasVisiveis`, não `perguntas`.

**Efeito colateral crítico:** Quando o usuário muda Estado de "Ruim" para "Bom", as respostas de Gravidade/Extensão/Ativa anteriores ficam em `respostas` mas não contribuem para o cálculo (pois `calcularNivelRisco` itera `perguntas`, não `perguntasVisiveis`). Precisamos garantir que as perguntas puladas tenham `pesoRisco = 0` nas opcoes, **ou** que `calcularNivelRisco` também filtre por `perguntasVisiveis`.

**Recomendação:** `calcularNivelRisco` deve usar `perguntasVisiveis` como base de iteração para garantir consistência.

---

## Q3 — SVGs no Expo/React Native

### Situação Atual Confirmada

O wizard usa `Image` do React Native com `require()` estático:
```typescript
const FORM_IMAGES: Record<string, any> = {
  nv0: require('../../../assets/formularios/imagens/nv0.png'),
  ...
};
```

Todos os `require()` são **estáticos em tempo de build** — exigência do Metro bundler. Isso significa que adicionar novas chaves ao `FORM_IMAGES` requer editar o arquivo TypeScript manualmente. Não é possível usar `require()` com string dinâmica.

### `react-native-svg` já instalado: v15.12.1

**Confirmado em package.json.** Isso abre duas rotas:

**Rota A: PNG via script Node.js (mesma abordagem atual — RECOMENDADA)**

O script `scripts/gerar-imagens-formulario.js` já existe e funciona com zlib puro (sem dependências externas). Gera PNGs de 240×120px. O mecanismo é:
1. Escrever função de geração no script
2. Executar `node scripts/gerar-imagens-formulario.js`
3. Os PNGs são copiados para `assets/formularios/imagens/`
4. Adicionar os novos `require()` em `FORM_IMAGES` no wizard
5. Referenciá-los por chave no JSON do formulário

Prós: sem nova biblioteca, sem risco de incompatibilidade, mesmo fluxo já testado.
Contras: PNGs são bitmaps — sem escalabilidade, sem acesso a cores do tema.

**Rota B: Componentes SVG inline com `react-native-svg`**

Como `react-native-svg` já está instalado, é possível criar componentes React que renderizam SVGs vetoriais diretamente:

```typescript
import Svg, { Rect, Line, Path } from 'react-native-svg';

function FissuraCapilarIcon({ color = '#666' }) {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      <Rect x="5" y="5" width="70" height="70" fill="#f5f5f5" rx="4"/>
      <Path d="M 20 10 L 25 30 L 22 50 L 30 70" stroke={color} strokeWidth={1} fill="none"/>
    </Svg>
  );
}
```

Esses componentes são renderizados em tempo de execução, aceitam as cores do tema, escalam perfeitamente. Não precisam de `require()` — são importações de módulo TypeScript normais.

Prós: vetorial, adapta ao tema dark/light, sem arquivos de asset extras.
Contras: requer criar componentes por categoria, o wizard precisaria de um mapa `imagemLocal` → componente em vez de `FORM_IMAGES`.

**Rota C: SVG como arquivo `.svg` com transformer**

Não há `metro.config.js` no projeto (confirmado). Usar `.svg` diretamente exigiria instalar `react-native-svg-transformer` e criar `metro.config.js`. É a rota mais trabalhosa e desnecessária dado que `react-native-svg` já está disponível.

### Decisão Recomendada: PNG via script para v2

Para a Fase 10, a abordagem mais segura e coerente com o projeto é **PNG via script Node.js**. As razões:

1. Não muda a arquitetura do wizard (mesmo `FORM_IMAGES` + `require()`)
2. O script já tem toda a infraestrutura (PNG encoder, gradientes, funções de pixel)
3. Novas imagens contextuais (fissura capilar, trinca, rachadura) são geradas offline
4. Sem risco de problemas em iOS/Android com SVG components em scroll rápido

Para uma fase futura (v3), componentes SVG seriam superiores — mas é fora de escopo agora.

---

## Q4 — Conteúdo Visual Necessário

### Imagens Existentes (23 arquivos em `assets/formularios/imagens/`)

```
nv0.png – nv6.png      — barras de cor (verde→vermelho) — GENÉRICAS
inclinacao_*.png        — diagramas de encosta — ESPECÍFICAS (deslizamento)
drenagem_*.png          — padrão de canais — ESPECÍFICAS (deslizamento)
veg_*.png               — tipos de vegetação — ESPECÍFICAS (deslizamento)
terreno_*.png           — tipos de terreno — ESPECÍFICAS (deslizamento)
opcao_nao.png           — ícone vermelho/negativo
opcao_sim.png           — ícone verde/positivo
```

### Imagens a Criar para v2 (mínimo viável)

As nv0–nv6 são barras de cor genéricas — o problema é que não mostram o dano. Para o formulário estrutural, são necessárias imagens que mostrem o dano real.

**Categoria: Estado de conservação (4 opções × reutilizável por elemento)**

| Chave FORM_IMAGES | Descrição visual | Método geração |
|---|---|---|
| `est_bom` | Estrutura íntegra — retângulo limpo, sem marcas | script: solid verde suave |
| `est_regular` | Fissura capilar — linha fina diagonal | script: background cinza, linha fina |
| `est_ruim` | Trinca moderada + armadura exposta | script: background + fissura larga + ponto vermelho |
| `est_pessimo` | Rachadura extensa ou colapso parcial | script: background + fissuras múltiplas + vermelho |

**Categoria: Gravidade (4 opções)**

| Chave | Descrição visual |
|---|---|
| `grav_nenhuma` | Símbolo check verde |
| `grav_leve` | Linha fina (fissura capilar < 0.2mm) |
| `grav_moderada` | Linha mais larga (trinca ~1mm) |
| `grav_severa` | Múltiplas linhas largas (rachadura) |

**Categoria: Extensão (3 opções)**

| Chave | Descrição visual |
|---|---|
| `ext_pontual` | Retângulo representando elemento, 1 ponto marcado |
| `ext_setorial` | Retângulo com seção hachurada (~30%) |
| `ext_generalizada` | Retângulo totalmente hachurado |

**Categoria: Ativa (2 opções)**
As existentes `opcao_nao` / `opcao_sim` já funcionam — reutilizar.

**Total de imagens novas: ~10 imagens** (Estado + Gravidade + Extensão compartilhadas entre elementos)

O ponto-chave: como todos os elementos estruturais têm as mesmas 4 sub-perguntas com as mesmas opções, **as imagens são compartilhadas** entre os 12 elementos. Não é necessário criar imagens por elemento — as imagens representam o tipo de dano, não o elemento específico.

---

## Q5 — Decisão v1 vs v2

### Análise do Fluxo de Seleção

Em `selecao-formulario.tsx`, a lista de formulários built-in é um array estático:

```typescript
const FORMULARIOS_BUILTIN = [
  { id: 'risco_estrutural_v1', ... },
  { id: 'vistoria_deslizamento_v1', ... },
];
```

Para adicionar `risco_estrutural_v2`:
1. Adicionar entrada ao array `FORMULARIOS_BUILTIN`
2. Adicionar `require()` ao objeto `ASSETS` no wizard
3. Criar o arquivo JSON em `assets/formularios/risco_estrutural_v2.json`

**Ambas as versões aparecem no menu** e o agente escolhe qual usar. Isso é intencional — permite transição gradual.

### Trade-offs v1 vs v2

| Critério | Modificar v1 | Criar v2 (RECOMENDADO) |
|---|---|---|
| Vistorias salvas | Risco de inconsistência nos `respostas_json` armazenados | Seguro — v1 continua intacto |
| Rollback | Impossível sem git restore | Trivial — desativa v2 |
| Coluna `formulario_id` no Supabase | `risco_estrutural_v1` existente inalterado | `risco_estrutural_v2` é novo registro |
| Cálculo de score | Pode regredir silenciosamente | Isolado, testável separadamente |
| Manutenção | Uma base de código | Duas versões até deprecação do v1 |
| Risco para campo | ALTO — agentes no campo usam v1 ativo | BAIXO — v1 continua disponível |

**Conclusão: Criar v2 é obrigatório.** Modificar v1 em produção enquanto agentes de campo têm vistorias salvas com esse ID é risco inaceitável.

### Cronograma de Deprecação Sugerido

1. **Fase 10:** Lançar v2 ao lado do v1 — ambos disponíveis
2. **Fase 11 ou seguinte:** Marcar v1 com badge "Legado" na seleção
3. **Fase futura:** Remover v1 após confirmação de que não há mais vistorias sendo salvas

---

## Standard Stack

### Core (já instalado)
| Biblioteca | Versão | Propósito | Status |
|---|---|---|---|
| react-native (Expo) | SDK 53 | Framework | Instalado |
| react-native-svg | 15.12.1 | SVG components (disponível, não obrigatório nesta fase) | Instalado |
| Node.js (scripts/) | runtime | Geração de PNGs contextuais | Existente |
| expo-router | — | Navegação | Instalado |

### Não Precisa Instalar
Nenhuma nova dependência é necessária para a abordagem PNG + skip condicional.

---

## Architecture Patterns

### Estrutura Proposta para v2

```
assets/formularios/
├── risco_estrutural_v1.json          — original, não tocar
├── risco_estrutural_v2.json          — novo, com skipSe + imagens contextuais
└── imagens/
    ├── nv0.png – nv6.png             — mantidos (usados por deslizamento)
    ├── est_bom.png                   — novo
    ├── est_regular.png               — novo
    ├── est_ruim.png                  — novo
    ├── est_pessimo.png               — novo
    ├── grav_nenhuma.png              — novo
    ├── grav_leve.png                 — novo
    ├── grav_moderada.png             — novo
    ├── grav_severa.png               — novo
    ├── ext_pontual.png               — novo
    ├── ext_setorial.png              — novo
    └── ext_generalizada.png          — novo

scripts/
└── gerar-imagens-formulario.js       — adicionar novas funções aqui

app/(panel)/inspecoes/
└── wizard.tsx                        — adicionar skipSe support + FORM_IMAGES entries
```

### Pattern: Skip Condicional no JSON

```json
{
  "id": "fase_fundacao",
  "titulo": "1. Fundação",
  "peso": 1.5,
  "perguntas": [
    {
      "id": "fund_estado",
      "texto": "Estado de conservação da fundação",
      "tipo": "cards",
      "obrigatoria": true,
      "opcoes": [
        { "id": "bom", "texto": "Bom", "imagemLocal": "est_bom", "pesoRisco": 0 },
        { "id": "regular", "texto": "Regular", "imagemLocal": "est_regular", "pesoRisco": 2 },
        { "id": "ruim", "texto": "Ruim", "imagemLocal": "est_ruim", "pesoRisco": 4 },
        { "id": "pessimo", "texto": "Péssimo", "imagemLocal": "est_pessimo", "pesoRisco": 6 }
      ]
    },
    {
      "id": "fund_gravidade",
      "texto": "Gravidade da manifestação",
      "tipo": "cards",
      "obrigatoria": false,
      "skipSe": { "perguntaId": "fund_estado", "opcaoId": "bom" },
      "opcoes": [...]
    },
    {
      "id": "fund_extensao",
      "texto": "Extensão da manifestação",
      "tipo": "cards",
      "obrigatoria": false,
      "skipSe": { "perguntaId": "fund_estado", "opcaoId": "bom" },
      "opcoes": [...]
    },
    {
      "id": "fund_ativa",
      "texto": "A manifestação está ativa?",
      "tipo": "cards",
      "obrigatoria": false,
      "skipSe": { "perguntaId": "fund_estado", "opcaoId": "bom" },
      "opcoes": [...]
    }
  ]
}
```

### Pattern: PerguntaModel com skipSe

```typescript
interface SkipSe {
  perguntaId: string;
  opcaoId: string;
}

interface PerguntaModel {
  id: string;
  texto: string;
  faseId?: string;
  grupo?: string;
  instrucao?: string;
  tipo: 'cards' | 'multipla_escolha' | 'texto' | 'foto';
  layout?: string;
  imagemExemplo?: string | null;
  obrigatoria: boolean;
  opcoes: OpcaoModel[];
  skipSe?: SkipSe | null;   // NOVO
}
```

### Pattern: perguntasVisiveis computadas

```typescript
const perguntasVisiveis = useMemo(() =>
  perguntas.filter(p => {
    if (!p.skipSe) return true;
    const resposta = respostas[p.skipSe.perguntaId];
    return resposta !== p.skipSe.opcaoId;
  }),
  [perguntas, respostas]
);
```

### Anti-Patterns a Evitar

- **Calcular risco sobre `perguntas` completas quando existem skips:** O `calcularNivelRisco` deve iterar `perguntasVisiveis` para evitar contabilizar respostas de perguntas puladas.
- **`require()` dinâmico:** `FORM_IMAGES[key]` funciona, mas as chaves devem existir no mapa estático. Nunca `require('../assets/' + key + '.png')`.
- **Modificar v1 em produção:** Qualquer mudança no JSON v1 afeta `respostas_json` já armazenados que usam os IDs antigos.
- **Criar imagens por elemento:** As imagens são por categoria de dano (Estado, Gravidade, Extensão), não por elemento (Fundação, Estrutura...). Compartilhar economiza 12× o número de arquivos.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar em Vez | Por quê |
|---|---|---|---|
| PNG contextual | Canvas API / biblioteca externa | Script Node.js puro existente (`gerar-imagens-formulario.js`) | Já funciona, sem dependências, mesmo output |
| SVG rendering | Converter para base64 data URI | `react-native-svg` (já instalado) ou PNG via script | Ambas as rotas são mais simples |
| Lógica de skip complexa | Framework de formulários externo (Formik, react-hook-form) | Campo `skipSe` simples no JSON + `useMemo` no wizard | Escopo limitado, não justifica dependência pesada |

---

## Riscos e Dependências

### Risco 1: Respostas de perguntas puladas no cálculo de risco
**O que vai errar:** Se `calcularNivelRisco` iterar `perguntas` (completo) em vez de `perguntasVisiveis`, um agente que respondeu Estado=Ruim, depois mudou para Estado=Bom ainda terá as respostas anteriores de Gravidade/Extensão/Ativa contabilizadas.
**Como evitar:** Passar `perguntasVisiveis` para `calcularNivelRisco` ou filtrar dentro da função.

### Risco 2: Draft salvo com respostas de perguntas agora puladas
**O que vai errar:** Auto-save salva `respostas` completas (incluindo perguntas puladas). Ao recarregar o draft, as respostas "ocultas" ainda existem.
**Como evitar:** Ao aplicar o draft, recalcular `perguntasVisiveis` com as respostas carregadas — as perguntas puladas ficam invisíveis mas suas respostas ficam no objeto. Isso é aceitável desde que `calcularNivelRisco` filtre por visibilidade.

### Risco 3: Verificação de obrigatórias ao finalizar
**O que vai errar:** `finalizar()` itera `perguntas.find(p => p.obrigatoria && !respostas[p.id])` — isso vai checar perguntas puladas.
**Como evitar:** Trocar para `perguntasVisiveis.find(...)`.

### Risco 4: FORM_IMAGES faltando chave nova no wizard
**O que vai errar:** Erro silencioso em produção — a imagem simplesmente não aparece (condição `FORM_IMAGES[op.imagemLocal]` é falsy).
**Como evitar:** Ao adicionar novo `imagemLocal` no JSON v2, sempre adicionar a entrada correspondente no `FORM_IMAGES` do wizard.

### Risco 5: Compatibilidade do script de geração de PNGs com Node.js disponível
**O que vai checar:** O script usa `zlib` (built-in) e `fs` (built-in) — sem dependências externas. Funciona em qualquer Node.js >= 12.

### Risco 6: Pergunta obrigatória = true nas sub-perguntas com skip
**Conflito de design:** Se `obrigatoria: true` e `skipSe` estão ambos presentes, a pergunta é obrigatória quando visível. Isso é correto. Mas as perguntas puladas (Estado=Bom) não devem ser obrigatórias — confirmar que o JSON v2 define `obrigatoria: false` nas sub-perguntas de detalhe.

---

## Conteúdo Visual — Lista Definitiva de Imagens a Criar

### Imagens Novas (10 arquivos)

| Arquivo | Chave FORM_IMAGES | Conteúdo Visual Sugerido |
|---|---|---|
| `est_bom.png` | `est_bom` | Retângulo cinza-claro com borda verde, sem marcas — "íntegro" |
| `est_regular.png` | `est_regular` | Retângulo com 1 linha fina diagonal — fissura capilar |
| `est_ruim.png` | `est_ruim` | Retângulo com linha mais larga + pequeno tracejado — trinca moderada |
| `est_pessimo.png` | `est_pessimo` | Retângulo com múltiplas linhas largas em vermelho — rachadura |
| `grav_nenhuma.png` | `grav_nenhuma` | Check verde sobre fundo cinza |
| `grav_leve.png` | `grav_leve` | Linha fina (1px) sobre fundo branco — capilar |
| `grav_moderada.png` | `grav_moderada` | Linha média (3px) com abertura — trinca |
| `grav_severa.png` | `grav_severa` | Linha larga (6px) com deslocamento — rachadura estrutural |
| `ext_pontual.png` | `ext_pontual` | Retângulo dividido em grade, 1 célula vermelha no centro |
| `ext_setorial.png` | `ext_setorial` | Retângulo dividido, ~30% hachurado em laranja |
| `ext_generalizada.png` | `ext_generalizada` | Retângulo quase totalmente hachurado em vermelho |

**Total: 11 arquivos novos.** `opcao_nao` e `opcao_sim` reutilizadas para "Ativa".

### Imagens Reutilizadas (sem mudança)
`nv0`–`nv6`, `opcao_nao`, `opcao_sim` — reutilizáveis sem alteração.

---

## Validation Architecture

nyquist_validation está habilitado. Framework de testes não foi detectado (sem `jest.config.*`, sem `vitest.config.*`, sem `pytest.ini`, sem pasta `tests/`). Testes para RN/Expo normalmente rodam com Jest + `@testing-library/react-native`.

| Requisito | Comportamento | Tipo de Teste | Observação |
|---|---|---|---|
| Skip condicional | Estado=Bom → Gravidade/Extensão/Ativa não aparecem | Unit (lógica de filtro) | Testável isoladamente sem UI |
| Cálculo de risco com skip | Respostas puladas não contribuem para score | Unit | Testar `calcularNivelRisco` com perguntas visíveis |
| Verificação de obrigatórias | Perguntas puladas não bloqueiam avanço | Unit | Testar `finalizar()` logic |
| Imagens novas registradas | Todas as chaves de `imagemLocal` existem em `FORM_IMAGES` | Manual/smoke | Verificar em runtime |
| v2 aparece na seleção | `FORMULARIOS_BUILTIN` inclui v2 | Smoke manual | Abrir tela de seleção |

**Wave 0 Gaps:** Não há infraestrutura de teste automatizado no projeto. Criar testes unitários para a lógica de skip seria possível mas exigiria setup inicial de Jest. Para esta fase, validação é manual/smoke.

---

## Open Questions

1. **Quantos elementos incluir no v2?**
   - O que sabemos: 4 críticos (Fundação, Estrutura, Muro Arrimo, Talude) são suficientes para determinar R3/R4
   - O que está em aberto: quantos elementos intermediários incluir (Drenagem, Alvenaria, Escadas)?
   - Recomendação: 7 elementos (4 críticos + Drenagem + Alvenaria + Cobertura) = máx 28 perguntas no pior caso, 7 no melhor caso quando tudo está Bom

2. **Foto por elemento ou foto geral?**
   - O v1 tem `foto` como 5ª pergunta de cada elemento (12 perguntas de foto = 12 fotos)
   - Para campo: 1 foto por elemento com dano = apenas quando Estado ≠ Bom
   - Alternativa: 1 foto geral da edificação + foto livre por elemento (opcional)
   - Recomendação: adicionar `skipSe` na pergunta de foto também (foto só aparece se Estado ≠ Bom)

3. **Feedback visual de progresso por elemento (não por pergunta)?**
   - O wizard atual mostra "PERGUNTA X/Y" — com skip, Y muda dinamicamente
   - Pode confundir o agente ("por que pulou de 5 para 9?")
   - Alternativa: mostrar progresso por elemento ("ELEMENTO 2/7") em vez de por pergunta

---

## Environment Availability

| Dependência | Requerida por | Disponível | Observação |
|---|---|---|---|
| Node.js | Gerar PNGs via script | Assumido (projeto usa npm/npx) | Verificar na máquina de build |
| react-native-svg 15.12.1 | SVG components (opcional nesta fase) | Sim (package.json confirmado) | — |
| Expo SDK 53 | App runtime | Instalado | — |

---

## Sources

### Primary (HIGH confidence — código-fonte lido diretamente)
- `assets/formularios/risco_estrutural_v1.json` — 12 elementos, pesos, estrutura completa
- `app/(panel)/inspecoes/wizard.tsx` — lógica do wizard, FORM_IMAGES, calcularNivelRisco
- `app/(panel)/inspecoes/selecao-formulario.tsx` — FORMULARIOS_BUILTIN, fluxo de seleção
- `assets/formularios/vistoria_deslizamento_v1.json` — padrão de imagemLocal específica por resposta
- `scripts/gerar-imagens-formulario.js` — infraestrutura de geração PNG
- `package.json` — react-native-svg v15.12.1 confirmado, sem metro.config.js

### Secondary (MEDIUM confidence)
- Nenhuma busca web necessária — todos os dados foram obtidos das fontes primárias

---

## Metadata

**Breakdown de confiança:**
- Estrutura atual (elementos, pesos, fórmula): HIGH — lido diretamente do JSON e do wizard
- Lógica condicional (skipSe): HIGH — wizard lido completamente, ausência confirmada
- SVG no Expo: HIGH — package.json verificado, metro.config.js ausente verificado
- Conteúdo visual necessário: HIGH — derivado da estrutura real do formulário
- Decisão v1 vs v2: HIGH — código de seleção lido, raciocínio de risco direto
- Script PNG existente: HIGH — arquivo lido, tecnologia confirmada (Node.js puro + zlib)

**Data da pesquisa:** 2026-04-02
**Válido até:** 2026-05-02 (formulário é asset local, sem dependências externas voláteis)
