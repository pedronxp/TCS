import { searchTokenMunicipalities, TOKEN_MUNICIPALITIES } from '../municipalitySearch';

describe('Catálogo de municípios para convites', () => {
  it('inclui o catálogo nacional, independente dos municípios contratantes', () => {
    expect(TOKEN_MUNICIPALITIES.length).toBeGreaterThan(5500);
  });
  it('encontra Belo Horizonte pelo apelido BH', () => {
    expect(searchTokenMunicipalities('BH')).toEqual([{ nome: 'Belo Horizonte', uf: 'MG' }]);
  });
  it('busca São Paulo sem acentos e com UF', () => {
    expect(searchTokenMunicipalities('sao paulo sp')).toEqual([{ nome: 'São Paulo', uf: 'SP' }]);
  });
  it('preserva a UF correta dos municípios', () => {
    expect(searchTokenMunicipalities('cabo frio')).toEqual([{ nome: 'Cabo Frio', uf: 'RJ' }]);
  });
  it('filtra por UF e permite espaços extras', () => {
    expect(searchTokenMunicipalities('  MG  ').every(city => city.uf === 'MG')).toBe(true);
    expect(searchTokenMunicipalities('cidade inexistente xyz')).toEqual([]);
  });
});
