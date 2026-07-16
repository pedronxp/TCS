import {
  calcularRaioAlvoArvore,
  filtrarPerguntasPorPontuacao,
  filtrarPerguntasVisiveis,
  filtrarRespostasPorPerguntas,
  flattenPerguntas,
  validarDiametroArvore,
  validarRespostaFormulario,
  validarValorNumerico,
} from '../formulariosAssets';
import {
  calcularRiscoFormulario,
  parseCalculoRiscoSnapshot,
  resolverApresentacaoRisco,
} from '../riscoUtils';
import { buildShareMessage } from '../shareUtils';

const formulario = require('../../assets/formularios/avaliacao_arvore_cbmmg_v1.json');
const perguntas = flattenPerguntas(formulario);

function calcular(respostas: Record<string, string>) {
  return calcularRiscoFormulario({
    perguntas,
    respostas,
    limites: formulario.classificacao.limites,
    formularioId: formulario.id,
    formularioVersao: formulario.versao,
    tipoCalculo: formulario.tipoCalculo,
  });
}

describe('asset Avaliação de Árvore CBMMG', () => {
  it('preserva contrato metodológico, máximos por item e campos obrigatórios', () => {
    expect(formulario.id).toBe('avaliacao_arvore_cbmmg_v1');
    expect(formulario.featureCode).toBe('inspection_arv');
    expect(formulario.metodologia.escala.teto).toBe(10);
    expect(formulario.metodologia.faixasResultado.map((f: any) => f.label)).toEqual(['NÃO IMINENTE', 'RISCO IMINENTE']);

    const ids = ['arv_item1_alvo', 'arv_item2_severidade', 'arv_item3_diametro_faixa', 'arv_item4_outros_fatores'];
    expect(ids.map(id => Math.max(...perguntas.find(p => p.id === id)!.opcoes.map(o => o.pesoRisco)))).toEqual([3, 4, 3, 2]);
    expect(perguntas.find(p => p.id === 'arv_medida_mitigadora_descricao')?.obrigatoria).toBe(true);
    expect(perguntas.find(p => p.id === 'arv_defeito_determinante')?.obrigatoria).toBe(true);
    expect(perguntas.find(p => p.id === 'arv_item2_severidade')?.texto).toBe('Qual é o grau de risco mais elevado observado?');
  });

  it.each([
    ['pessoas_frequente', 3],
    ['pessoas_ocasional', 2],
    ['bens_propriedades', 1],
    ['nenhum_alvo', 0],
  ])('Item 1: %s vale %i', (resposta, pontos) => {
    expect(calcular({ arv_item1_alvo: resposta }).somaBruta).toBe(pontos);
  });

  it.each([
    ['extremamente_alto', 4],
    ['alto', 3],
    ['moderado', 2],
    ['baixo', 1],
  ])('Item 2: %s vale uma única pontuação de %i', (resposta, pontos) => {
    const calculo = calcular({ arv_item2_severidade: resposta });
    expect(calculo.somaBruta).toBe(pontos);
    expect(calculo.itens).toHaveLength(1);
  });

  it.each([
    ['maior_51', 3],
    ['entre_10_51', 2],
    ['menor_10', 1],
  ])('Item 3: %s vale %i', (resposta, pontos) => {
    expect(calcular({ arv_item3_diametro_faixa: resposta }).somaBruta).toBe(pontos);
  });

  it.each([
    ['sem_acrescimo', 0],
    ['acrescimo_1', 1],
    ['acrescimo_2', 2],
  ])('Item 4: %s vale %i', (resposta, pontos) => {
    expect(calcular({ arv_item4_outros_fatores: resposta }).somaBruta).toBe(pontos);
  });
});

describe('validações e condicionais CBMMG', () => {
  it('valida altura positiva e calcula raio de 1,5 vezes a altura', () => {
    const altura = perguntas.find(p => p.id === 'arv_altura_m')!;
    expect(validarValorNumerico(altura, '0')).toContain('mínimo');
    expect(validarValorNumerico(altura, '12,5')).toBeNull();
    expect(calcularRaioAlvoArvore('12,5')).toBe(18.8);
  });

  it('valida medição exata contra a faixa selecionada', () => {
    expect(validarDiametroArvore('maior_51', '51')).toContain('maior');
    expect(validarDiametroArvore('maior_51', '52')).toBeNull();
    expect(validarDiametroArvore('entre_10_51', '9')).toContain('entre');
    expect(validarDiametroArvore('entre_10_51', '42')).toBeNull();
    expect(validarDiametroArvore('menor_10', '10')).toContain('menor');
  });

  it('mostra justificativa do Item 4 e conduta apenas quando ativas', () => {
    const porResposta = filtrarPerguntasVisiveis(perguntas, { arv_item4_outros_fatores: 'acrescimo_2' });
    expect(porResposta.some(p => p.id === 'arv_outros_fatores_descricao')).toBe(true);
    expect(filtrarPerguntasPorPontuacao(porResposta, 8).some(p => p.id === 'arv_decisao_operacional')).toBe(false);
    expect(filtrarPerguntasPorPontuacao(porResposta, 9).some(p => p.id === 'arv_decisao_operacional')).toBe(true);
  });

  it('remove respostas condicionais obsoletas', () => {
    const visiveis = filtrarPerguntasVisiveis(perguntas, { arv_item4_outros_fatores: 'sem_acrescimo' });
    const filtradas = filtrarRespostasPorPerguntas({
      arv_item4_outros_fatores: 'sem_acrescimo',
      arv_outros_fatores_descricao: 'texto antigo',
    }, visiveis, formulario.id);
    expect(filtradas.arv_outros_fatores_descricao).toBeUndefined();
  });

  it('bloqueia campos técnicos obrigatórios e não intervenção sem REDS', () => {
    const respostas = {
      arv_item4_outros_fatores: 'acrescimo_2',
      arv_decisao_operacional: 'nao_intervir',
    };
    const ativas = filtrarPerguntasPorPontuacao(filtrarPerguntasVisiveis(perguntas, respostas), 9);
    for (const id of [
      'arv_medida_mitigadora_descricao',
      'arv_defeito_determinante',
      'arv_outros_fatores_descricao',
      'arv_nao_intervencao_justificativa',
      'arv_reds_numero',
    ]) {
      const pergunta = ativas.find(p => p.id === id)!;
      expect(pergunta).toBeTruthy();
      expect(validarRespostaFormulario(pergunta, undefined, respostas)).toContain('Responda');
    }
  });
});

describe('cálculo, snapshot e apresentação CBMMG', () => {
  const cenarios = [
    [{ arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'alto', arv_item3_diametro_faixa: 'entre_10_51', arv_item4_outros_fatores: 'sem_acrescimo' }, 8, 8, 'NÃO IMINENTE'],
    [{ arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto', arv_item3_diametro_faixa: 'entre_10_51', arv_item4_outros_fatores: 'sem_acrescimo' }, 9, 9, 'RISCO IMINENTE'],
    [{ arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto', arv_item3_diametro_faixa: 'maior_51', arv_item4_outros_fatores: 'sem_acrescimo' }, 10, 10, 'RISCO IMINENTE'],
    [{ arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto', arv_item3_diametro_faixa: 'maior_51', arv_item4_outros_fatores: 'acrescimo_1' }, 11, 10, 'RISCO IMINENTE'],
    [{ arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto', arv_item3_diametro_faixa: 'maior_51', arv_item4_outros_fatores: 'acrescimo_2' }, 12, 10, 'RISCO IMINENTE'],
  ] as const;

  it.each(cenarios)('soma bruta %# aplica teto e faixa', (respostas, bruto, total, label) => {
    const calculo = calcular({ ...respostas });
    expect(calculo.somaBruta).toBe(bruto);
    expect(calculo.pontuacaoTotal).toBe(total);
    expect(calculo.resultadoLabel).toBe(label);
    expect(calculo.tetoAplicado).toBe(10);
    expect(resolverApresentacaoRisco({ calculoRisco: calculo }).label).toBe(label);
  });

  it('preserva evidências operacionais e parser legado', () => {
    const calculo = calcular({
      arv_item1_alvo: 'pessoas_frequente', arv_item2_severidade: 'extremamente_alto',
      arv_item3_diametro_faixa: 'entre_10_51', arv_decisao_operacional: 'nao_intervir',
      arv_nao_intervencao_justificativa: 'Intervenção adiada por risco operacional da equipe.',
      arv_reds_numero: 'REDS-2026-001',
    });
    expect(calculo.evidencias?.arv_reds_numero).toBe('REDS-2026-001');
    expect(parseCalculoRiscoSnapshot(JSON.stringify(calculo))?.metodologiaId).toBe('cbmmg_ito06_quadro2');

    const legado = parseCalculoRiscoSnapshot({ pontuacaoTotal: 4, nivelRisco: 'r3', itens: [] });
    expect(legado?.pontuacaoTotal).toBe(4);
    expect(legado?.resultadoLabel).toBeUndefined();
  });

  it('compartilha resultado CBMMG sem expor R1/R4', () => {
    const mensagem = buildShareMessage({
      protocolo: 'TCS-001', endereco: 'Rua das Árvores, 10', municipio: 'Belo Horizonte',
      nivelRisco: 'r4', formularioId: formulario.id, pontuacaoTotal: 9,
      agenteNome: 'Agente', dataVistoria: '2026-07-16T12:00:00.000Z',
    });
    expect(mensagem).toContain('RISCO IMINENTE');
    expect(mensagem).toContain('Pontuação: 9 pontos');
    expect(mensagem).not.toContain('R4');
  });
});
