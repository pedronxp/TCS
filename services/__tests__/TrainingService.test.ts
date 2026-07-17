jest.mock('../../utils/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

import {
  formatTrainingToken,
  generateTrainingToken,
  isTrainingClassEnded,
  leaveTrainingClass,
  normalizeTrainingToken,
  parseDateTimePtBr,
  TRAINING_ALLOWED_FORMS,
  trainingEntryMessage,
} from '../TrainingService';

describe('TrainingService helpers', () => {
  it('normalizes and formats collective training tokens', () => {
    expect(normalizeTrainingToken('ab12-cd34 ef56')).toBe('AB12CD34EF56');
    expect(formatTrainingToken('ab12 cd34 ef56 extra')).toBe('AB12-CD34-EF56');

    const generated = generateTrainingToken();
    expect(generated).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(normalizeTrainingToken(generated)).toHaveLength(12);
  });

  it('parses pt-BR date and time fields', () => {
    const parsed = parseDateTimePtBr('29/05/2026', '14:30');

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(29);
    expect(parsed?.getHours()).toBe(14);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('detects ended training classes', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(isTrainingClassEnded({ ativo: true, encerrado_em: null, fim_em: future })).toBe(false);
    expect(isTrainingClassEnded({ ativo: true, encerrado_em: null, fim_em: past })).toBe(true);
    expect(isTrainingClassEnded({ ativo: false, encerrado_em: null, fim_em: future })).toBe(true);
    expect(isTrainingClassEnded({ ativo: true, encerrado_em: past, fim_em: future })).toBe(true);
  });

  it('returns blocked-entry messages without asking for a new token', () => {
    expect(trainingEntryMessage({ status: 'full', participantCount: 40, participantLimit: 40 }))
      .toBe('Limite de participantes atingido. 40 de 40 alunos ja acessaram este treinamento.');

    expect(trainingEntryMessage({ status: 'expired', endsAt: '2026-05-29T18:00:00.000Z' }))
      .toContain('Treinamento encerrado.');

    expect(trainingEntryMessage({ status: 'not_started', startsAt: '2026-05-29T08:00:00.000Z' }))
      .toContain('Este treinamento ainda nao iniciou.');
  });

  it('limits training to the approved built-in forms', () => {
    expect(TRAINING_ALLOWED_FORMS).toEqual([
      'vistoria_deslizamento_v3',
      'risco_estrutural_novo_v2',
      'avaliacao_arvore_cbmmg_v1',
    ]);
  });

  it('notifies Supabase when a training participant leaves the class', async () => {
    const mockRpc = jest.requireMock('../../utils/supabase').supabase.rpc as jest.Mock;
    mockRpc.mockResolvedValue({ data: { ok: true, status: 'left' }, error: null });

    await leaveTrainingClass({ classId: 'class-1', deviceId: 'device-1' });

    expect(mockRpc).toHaveBeenCalledWith('training_class_leave', {
      p_class_id: 'class-1',
      p_device_id: 'device-1',
    });
  });
});
