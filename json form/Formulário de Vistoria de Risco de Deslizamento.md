# Formulário de Vistoria de Risco de Deslizamento

**Versão:** 1.0  
**Data de Criação:** Abril de 2026  
**Objetivo:** Avaliação técnica de fatores de risco de deslizamento em encostas

---

## Instruções Gerais

Este formulário contém **10 questões** sobre as condições de uma encosta para classificar o risco de deslizamento. Cada questão apresenta múltiplas opções com pontuações associadas. A pontuação total determina o nível de risco: **Baixo**, **Médio**, **Alto** ou **Muito Alto**.

**Importante:** Selecione apenas uma opção por questão. A pontuação final é a soma de todas as respostas.

---

## Questões

### Questão 1: Caracterização do Local

**Campo:** Caracterização do local  
**Pergunta:** Como é a caracterização do local vistoriado?

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Encosta Natural** | Terreno sem intervenção humana | 0 |
| **Aterro** | Terreno com material depositado artificialmente | 2 |

---

### Questão 2: Inclinação da Encosta

**Campo:** Inclinação da encosta  
**Pergunta:** Qual é a inclinação aproximada da encosta?  
**Referência:** 10°=0 \| 17°=1 \| 30°=2 \| 60°=3 \| 90°=4

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **≤ 10°** | Inclinação suave | 0 |
| **17°** | Inclinação moderada | 1 |
| **30°** | Inclinação acentuada | 2 |
| **60°** | Inclinação muito acentuada | 3 |
| **90° (Vertical)** | Parede vertical | 4 |

---

### Questão 3: Água e Drenagem

**Campo:** Água - drenagem  
**Pergunta:** Como é o sistema de drenagem de água no local?  
**Referência:** Satisfatório=0 \| Precário=1 \| Inexistente=2

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Satisfatório** | Drenagem adequada e funcional | 0 |
| **Precário** | Drenagem com problemas parciais | 1 |
| **Inexistente** | Sem sistema de drenagem | 2 |

---

### Questão 4: Vegetação no Talude

**Campo:** Vegetação no talude  
**Pergunta:** Qual é o tipo de vegetação presente no talude?  
**Referência:** Árvores=0 \| Rasteira=1 \| Desmatada=2 \| Cultivo=2

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Presença de Árvores** | Cobertura arbórea densa | 0 |
| **Vegetação Rasteira** | Gramíneas e arbustos baixos | 1 |
| **Área Desmatada** | Solo exposto sem cobertura | 2 |
| **Área de Cultivo** | Uso agrícola do solo | 2 |

---

### Questão 5: Trincas

**Campo:** Trincas  
**Pergunta:** Há presença de trincas no terreno ou estruturas?

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Não** | Sem trincas visíveis | 0 |
| **Sim** | Trincas presentes no terreno | 2 |

---

### Questão 6: Degraus de Abatimento

**Campo:** Degraus de abatimento  
**Pergunta:** Há presença de degraus de abatimento no terreno?

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Não** | Superfície regular sem degraus | 0 |
| **Sim** | Degraus de abatimento visíveis | 2 |

---

### Questão 7: Inclinação de Estruturas

**Campo:** Inclinação de estruturas  
**Pergunta:** Há estruturas com inclinação anormal (postes, árvores, muros)?

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Não** | Estruturas verticais normais | 0 |
| **Sim** | Estruturas inclinadas detectadas | 2 |

---

### Questão 8: Muros Embarrigados

**Campo:** Muros embarrigados  
**Pergunta:** Há muros de arrimo com embarrigamento (deformação para fora)?

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Não** | Muros em bom estado | 0 |
| **Sim** | Muros com deformação visível | 2 |

---

### Questão 9: Trinca de Escorregamento Próxima

**Campo:** Trinca de escorregamento próxima  
**Pergunta:** Há trinca de escorregamento em área próxima?  
**Referência:** Sem risco=0 \| Esperado=1 \| Já ocorrido=3

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Sem Risco Aparente** | Nenhum sinal de escorregamento | 0 |
| **Esperado** | Sinais que indicam possibilidade | 1 |
| **Já Ocorrido** | Registro de escorregamento anterior | 3 |

---

### Questão 10: Processos de Instabilização

**Campo:** Processos de instabilização  
**Pergunta:** Qual é o status dos processos de instabilização do talude?  
**Referência:** Sem risco=0 \| Esperado=1 \| Já ocorrido=3

| Opção | Descrição | Pontuação |
|-------|-----------|-----------|
| **Sem Risco Aparente** | Talude estável sem sinais | 0 |
| **Esperado** | Condições favoráveis à instabilização | 1 |
| **Já Ocorrido** | Processo de instabilização registrado | 3 |

---

## Classificação de Risco

A pontuação total é calculada somando os pontos de todas as respostas. A classificação final é determinada conforme a tabela abaixo:

| Classificação | Intervalo de Pontos | Descrição |
|---|---|---|
| **RISCO BAIXO** | 0 a 1 | O local apresenta baixo risco de deslizamento. Monitoramento periódico recomendado. |
| **RISCO MÉDIO** | 2 a 3 | O local apresenta risco médio. Medidas preventivas e monitoramento frequente são necessários. |
| **RISCO ALTO** | 4 a 5 | O local apresenta alto risco. Intervenções urgentes e possível remoção temporária de moradores. |
| **RISCO MUITO ALTO** | 6+ | Risco extremo! Remoção imediata dos moradores e intervenção de emergência necessária. |

---

## Estrutura de Dados para Implementação

O formulário está estruturado em formato JSON para fácil integração em aplicações. Cada questão possui:

- **id:** Identificador único da questão
- **numero:** Número da questão (Questão 1, Questão 2, etc.)
- **campo:** Nome do campo conforme a planilha original
- **pergunta:** Texto completo da pergunta
- **tipo:** Tipo de questão (neste caso, sempre "multipla_escolha")
- **referencia:** Escala de referência (quando aplicável)
- **opcoes:** Array com as opções de resposta, cada uma contendo:
  - **id:** Identificador único da opção
  - **label:** Texto da opção
  - **pontuacao:** Pontos associados
  - **descricao:** Descrição breve da opção

---

## Exemplo de Uso

**Cenário:** Vistoria de uma encosta em zona urbana

1. **Questão 1 (Caracterização):** Encosta Natural → 0 pontos
2. **Questão 2 (Inclinação):** 30° → 2 pontos
3. **Questão 3 (Drenagem):** Precário → 1 ponto
4. **Questão 4 (Vegetação):** Área Desmatada → 2 pontos
5. **Questão 5 (Trincas):** Sim → 2 pontos
6. **Questão 6 (Degraus):** Não → 0 pontos
7. **Questão 7 (Estruturas):** Não → 0 pontos
8. **Questão 8 (Muros):** Não → 0 pontos
9. **Questão 9 (Escorregamento):** Esperado → 1 ponto
10. **Questão 10 (Instabilização):** Esperado → 1 ponto

**Total:** 0 + 2 + 1 + 2 + 2 + 0 + 0 + 0 + 1 + 1 = **9 pontos**  
**Classificação:** **RISCO MUITO ALTO** (≥ 6 pontos)

---

## Notas Técnicas

- O arquivo JSON (`formulario_vistoria.json`) contém todos os dados estruturados para integração direta em aplicações móveis ou web.
- As pontuações foram extraídas da planilha original e validadas conforme as referências técnicas.
- A classificação de risco segue a lógica: Baixo (0-1) → Médio (2-3) → Alto (4-5) → Muito Alto (6+).
- Cada questão é independente; não há lógica condicional entre respostas.
- O formulário é agnóstico de plataforma e pode ser implementado em qualquer tecnologia (React Native, Flutter, Swift, Kotlin, etc.).

---

**Documento gerado por:** Manus AI  
**Formato:** Markdown + JSON estruturado  
**Licença:** Uso livre para implementação em aplicações próprias
