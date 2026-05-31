jest.mock('../../services/TrainingService', () => ({
  TRAINING_ALLOWED_FORMS: ['vistoria_deslizamento_v3', 'risco_estrutural_novo_v2'],
  enterTrainingClass: jest.fn(),
  leaveTrainingClass: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { isTrainingSessionExpired, TrainingSession } from '../TrainingContext';
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enterTrainingClass, TrainingEntryResult } from '../../services/TrainingService';
import { TrainingProvider, useTraining } from '../TrainingContext';

const mockedEnterTrainingClass = enterTrainingClass as jest.MockedFunction<typeof enterTrainingClass>;

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

function makeTrainingEntry(overrides: Partial<TrainingEntryResult> = {}): TrainingEntryResult {
  return {
    ok: true,
    status: 'accepted',
    classId: 'class-1',
    className: 'Turma Teste',
    token: 'ABCD-EFGH-2345',
    participantId: 'participant-1',
    participantName: 'Aluno Teste',
    participantCount: 1,
    participantLimit: 40,
    startsAt: '2099-05-29T10:00:00.000Z',
    endsAt: '2099-05-29T12:00:00.000Z',
    allowedForms: ['vistoria_deslizamento_v3', 'risco_estrutural_novo_v2'],
    ...overrides,
  };
}

type TrainingContextValue = ReturnType<typeof useTraining>;

function TrainingContextProbe({ onValue }: { onValue: (value: TrainingContextValue) => void }) {
  const value = useTraining();
  useEffect(() => {
    onValue(value);
  });
  return React.createElement(Text, null, value.loading ? 'loading' : 'ready');
}

describe('TrainingContext revalidation stability', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    mockedEnterTrainingClass.mockReset();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps public callbacks stable when revalidation refreshes session metadata', async () => {
    const snapshots: TrainingContextValue[] = [];
    const latest = () => snapshots[snapshots.length - 1];

    mockedEnterTrainingClass
      .mockResolvedValueOnce(makeTrainingEntry({ participantCount: 1 }))
      .mockResolvedValueOnce(makeTrainingEntry({ participantCount: 2 }));

    render(React.createElement(
      TrainingProvider,
      null,
      React.createElement(TrainingContextProbe, { onValue: value => snapshots.push(value) }),
    ));

    await waitFor(() => expect(latest()?.loading).toBe(false));

    await act(async () => {
      await latest().enter({ nome: 'Aluno Teste', token: 'ABCD-EFGH-2345' });
    });
    await waitFor(() => expect(latest().session?.participantCount).toBe(1));

    const firstRevalidate = latest().revalidate;
    const firstIsExpired = latest().isExpired;
    const firstExit = latest().exit;

    await act(async () => {
      await latest().revalidate();
    });
    await waitFor(() => expect(latest().session?.participantCount).toBe(2));

    expect(latest().revalidate).toBe(firstRevalidate);
    expect(latest().isExpired).toBe(firstIsExpired);
    expect(latest().exit).toBe(firstExit);
    expect(mockedEnterTrainingClass).toHaveBeenCalledTimes(2);
  });
});
