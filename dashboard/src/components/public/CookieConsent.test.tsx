// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONSENT_KEY, CookieConsent } from './CookieConsent';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('consentimento de privacidade', () => {
  it('explica o uso do IP e permite manter somente o necessário', async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);

    expect(await screen.findByRole('dialog', { name: 'Preferências de privacidade' })).toBeVisible();
    expect(screen.getByText(/IP da conexão pode constar nos logs técnicos/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Somente necessários' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? '{}')).toMatchObject({ choice: 'necessary' });
  });

  it('não reaparece depois que a preferência foi salva', async () => {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: 'all' }));
    render(<CookieConsent />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
