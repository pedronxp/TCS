import {
  RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE,
  RESPOSTA_ESPECIAL_LABEL,
  ehRespostaEspecial,
  formatarRespostaEspecial,
  temRespostaValida,
} from '../respostasEspeciais';

describe('respostasEspeciais', () => {
  it('trata o marcador especial como resposta válida', () => {
    expect(temRespostaValida(RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE)).toBe(true);
  });

  it('não trata texto em branco como resposta válida', () => {
    expect(temRespostaValida('   ')).toBe(false);
  });

  it('reconhece o marcador especial e devolve o rótulo amigável', () => {
    expect(ehRespostaEspecial(RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE)).toBe(true);
    expect(formatarRespostaEspecial(RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE)).toBe(
      RESPOSTA_ESPECIAL_LABEL,
    );
  });

  it('não converte respostas comuns para o rótulo especial', () => {
    expect(formatarRespostaEspecial('q1_a')).toBeNull();
  });
});
