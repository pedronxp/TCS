export type RootRedirectTarget =
  | '/onboarding'
  | '/(auth)/treinamento'
  | '/(panel)/treinamento'
  | '/(panel)/dashboard'
  | '/(auth)/customer-onboarding'
  | '/(auth)';

const TRAINING_ALLOWED_INSPECTION_ROUTES = new Set([
  'dados-iniciais',
  'selecao-formulario',
  'wizard',
  'resultado',
  'relatorio',
]);

export function resolveRootRedirect(input: {
  segments: readonly string[];
  onboardingDone: boolean;
  isAuthenticated: boolean;
  hasPendingCustomerSession?: boolean;
  hasTrainingSession: boolean;
  hasExpiredTrainingSession: boolean;
}): RootRedirectTarget | null {
  const {
    segments,
    onboardingDone,
    isAuthenticated,
    hasPendingCustomerSession = false,
    hasTrainingSession,
    hasExpiredTrainingSession,
  } = input;
  const inPanel = segments[0] === '(panel)';
  const inAuth = segments[0] === '(auth)';
  const inOnboarding = segments[0] === 'onboarding';
  const section = segments[1];
  const inspectionRoute = segments[2];
  const inTrainingAllowedPanel = inPanel && (
    section === 'treinamento'
    || (section === 'inspecoes' && TRAINING_ALLOWED_INSPECTION_ROUTES.has(inspectionRoute || ''))
  );

  const inResetFlow = inAuth && (segments[1] === 'verify-otp' || segments[1] === 'reset-password');
  if (inResetFlow) return null;

  if (!onboardingDone && !inOnboarding) return '/onboarding';

  if (hasExpiredTrainingSession) {
    return inAuth ? null : '/(auth)/treinamento';
  }

  if (hasTrainingSession) {
    return inTrainingAllowedPanel ? null : '/(panel)/treinamento';
  }

  if (hasPendingCustomerSession) {
    return inAuth && segments[1] === 'customer-onboarding'
      ? null
      : '/(auth)/customer-onboarding';
  }

  if (isAuthenticated && !inPanel) return '/(panel)/dashboard';
  if (!isAuthenticated && !inAuth && !inOnboarding) return '/(auth)';

  return null;
}
