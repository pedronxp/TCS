// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { StyleGuidePage } from './StyleGuidePage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);

describe('referência da interface', () => {
  it('documenta foundations e componentes compartilhados', () => {
    render(<MemoryRouter><StyleGuidePage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Foundations' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Components' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Motion' })).toBeVisible();
    expect(screen.getByText('--motion-ease-drawer')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Primário' })).toBeVisible();
    expect(screen.getByText('var(--background)')).toBeVisible();
    expect(screen.getByText('var(--primary)')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><StyleGuidePage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
