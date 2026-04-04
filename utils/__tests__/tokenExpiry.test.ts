/**
 * Testes unitários para a lógica de validação de token de convite (AUTH-01)
 * Cobre o processamento da resposta do RPC validate_invite_token
 */

interface TokenValidation {
  id: string;
  codigo: string;
  municipio: string;
  role: string;
  valido: boolean;
  motivo: string;
}

/**
 * Extrai a lógica de validação do register.tsx para teste isolado.
 * Esta função replica exatamente o que register.tsx faz com a resposta do RPC.
 */
function processTokenValidation(
  tokenValidation: TokenValidation | null,
  validationError: Error | null,
): { municipio: string; role: string } {
  if (validationError || !tokenValidation) {
    throw new Error('Token inválido ou já utilizado.');
  }
  if (!tokenValidation.valido) {
    throw new Error(tokenValidation.motivo);
  }
  return { municipio: tokenValidation.municipio, role: tokenValidation.role };
}

describe('processTokenValidation (AUTH-01)', () => {
  it('aceita token válido e retorna municipio e role', () => {
    const result = processTokenValidation(
      { id: 'uuid-1', codigo: 'ABCD-EFGH-IJKL', municipio: 'São Paulo', role: 'agent', valido: true, motivo: 'ok' },
      null,
    );
    expect(result.municipio).toBe('São Paulo');
    expect(result.role).toBe('agent');
  });

  it('lança erro com motivo quando token expirado', () => {
    expect(() => processTokenValidation(
      { id: 'uuid-2', codigo: 'ABCD-EFGH-IJKL', municipio: 'SP', role: 'agent', valido: false, motivo: 'Token expirado. Solicite um novo ao administrador.' },
      null,
    )).toThrow('Token expirado. Solicite um novo ao administrador.');
  });

  it('lança erro com motivo quando token já utilizado', () => {
    expect(() => processTokenValidation(
      { id: 'uuid-3', codigo: 'ABCD-EFGH-IJKL', municipio: 'SP', role: 'agent', valido: false, motivo: 'Token já utilizado.' },
      null,
    )).toThrow('Token já utilizado.');
  });

  it('lança erro genérico quando RPC retorna erro', () => {
    expect(() => processTokenValidation(
      null,
      new Error('relation "invite_tokens" does not exist'),
    )).toThrow('Token inválido ou já utilizado.');
  });

  it('lança erro genérico quando RPC retorna null', () => {
    expect(() => processTokenValidation(null, null)).toThrow('Token inválido ou já utilizado.');
  });
});
