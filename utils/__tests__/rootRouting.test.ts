import { resolveRootRedirect } from '../rootRouting';

describe('resolveRootRedirect', () => {
  it('routes a first installation to onboarding', () => {
    expect(resolveRootRedirect({
      segments: ['(auth)'],
      onboardingDone: false,
      isAuthenticated: false,
      hasTrainingSession: false,
      hasExpiredTrainingSession: false,
    })).toBe('/onboarding');
  });

  it('routes a returning unauthenticated user to the public auth entry', () => {
    expect(resolveRootRedirect({
      segments: [],
      onboardingDone: true,
      isAuthenticated: false,
      hasTrainingSession: false,
      hasExpiredTrainingSession: false,
    })).toBe('/(auth)');
  });

  it('allows password recovery routes without forcing the public entry', () => {
    expect(resolveRootRedirect({
      segments: ['(auth)', 'reset-password'],
      onboardingDone: true,
      isAuthenticated: false,
      hasTrainingSession: false,
      hasExpiredTrainingSession: false,
    })).toBeNull();
  });
  it('prioritizes active training over an existing operational login on auth routes', () => {
    expect(resolveRootRedirect({
      segments: ['(auth)', 'treinamento-loading'],
      onboardingDone: true,
      isAuthenticated: true,
      hasTrainingSession: true,
      hasExpiredTrainingSession: false,
    })).toBe('/(panel)/treinamento');
  });

  it('moves an active training session away from the operational dashboard', () => {
    expect(resolveRootRedirect({
      segments: ['(panel)', 'dashboard'],
      onboardingDone: true,
      isAuthenticated: true,
      hasTrainingSession: true,
      hasExpiredTrainingSession: false,
    })).toBe('/(panel)/treinamento');
  });

  it('allows the training dashboard while a training session is active', () => {
    expect(resolveRootRedirect({
      segments: ['(panel)', 'treinamento'],
      onboardingDone: true,
      isAuthenticated: true,
      hasTrainingSession: true,
      hasExpiredTrainingSession: false,
    })).toBeNull();
  });

  it('keeps the existing operational redirect when training is not active', () => {
    expect(resolveRootRedirect({
      segments: ['(auth)', 'login'],
      onboardingDone: true,
      isAuthenticated: true,
      hasTrainingSession: false,
      hasExpiredTrainingSession: false,
    })).toBe('/(panel)/dashboard');
  });

  it('sends an expired training session back to the training entry route', () => {
    expect(resolveRootRedirect({
      segments: ['(panel)', 'treinamento'],
      onboardingDone: true,
      isAuthenticated: false,
      hasTrainingSession: false,
      hasExpiredTrainingSession: true,
    })).toBe('/(auth)/treinamento');
  });
});
