// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TcsMark } from './TcsMark';

describe('TcsMark', () => {
  it('usa a marca oficial do sistema', () => {
    render(<TcsMark />);
    const logo = screen.getByRole('img', { name: 'TCS — Relatório de Risco' });
    expect(logo.querySelector('img')?.getAttribute('src')).toBe('/tcs-system-logo.png');
  });

  it('remove texto alternativo quando decorativo', () => {
    const { container } = render(<TcsMark decorative />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
