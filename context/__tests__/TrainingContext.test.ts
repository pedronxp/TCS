jest.mock('../../services/TrainingService', () => ({
  TRAINING_ALLOWED_FORMS: ['vistoria_deslizamento_v3', 'risco_estrutural_novo_v2'],
  enterTrainingClass: jest.fn(),
  leaveTrainingClass: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { isTrainingSessionExpired, TrainingSession } from '../TrainingContext';

describe('TrainingContext session expiration', () => {
  const baseSession: TrainingSession = {
    mode: 'training',
    classId: 'class-1',
    className: 'Turma Teste',
    token: 'ABCD-EFGH-2345',
    participantId: 'participant-1',
    participantName: 'Aluno Teste',
    participantCount: 1,
    participantLimit: 40,
    startsAt: '2026-05-29T10:00:00.000Z',
    endsAt: '2026-05-29T12:00:00.000Z',
    allowedForms: ['vistoria_deslizamento_v3', 'risco_estrutural_novo_v2'],
    deviceId: 'device-1',
    createdAt: '2026-05-29T10:05:00.000Z',
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a local training session active before the configured end time', () => {
    jest.setSystemTime(new Date('2026-05-29T11:59:00.000Z'));

    expect(isTrainingSessionExpired(baseSession)).toBe(false);
  });

  it('expires a local training session after the configured end time', () => {
    jest.setSystemTime(new Date('2026-05-29T12:00:01.000Z'));

    expect(isTrainingSessionExpired(baseSession)).toBe(true);
  });

  it('treats an absent session as expired', () => {
    expect(isTrainingSessionExpired(null)).toBe(true);
  });
});
