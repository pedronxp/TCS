import { matchesInspectionForm } from '../inspectionFormFilter';

describe('matchesInspectionForm', () => {
  it('keeps every inspection for the default filter and matches only the selected form otherwise', () => {
    expect(matchesInspectionForm('risco_inundacao_v1', 'todos')).toBe(true);
    expect(matchesInspectionForm('risco_inundacao_v1', 'inspecao_bueiro_drenagem_v1')).toBe(false);
    expect(matchesInspectionForm('inspecao_bueiro_drenagem_v1', 'inspecao_bueiro_drenagem_v1')).toBe(true);
  });
});
