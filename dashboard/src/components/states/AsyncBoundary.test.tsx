// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncBoundary } from './AsyncBoundary';

describe('AsyncBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('exibe falha com tentar novamente quando o carregamento passa do limite', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();

    render(<AsyncBoundary loading error={undefined} onRetry={onRetry}>conteúdo</AsyncBoundary>);
    expect(screen.queryByText('Tempo limite excedido')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(15_000);
    expect(screen.getByText('Tempo limite excedido')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('volta ao conteúdo quando a consulta resolve antes do limite', async () => {
    vi.useFakeTimers();
    render(<AsyncBoundary loading={false}>catálogo carregado</AsyncBoundary>);
    expect(screen.getByText('catálogo carregado')).toBeInTheDocument();
    expect(screen.queryByText('Tempo limite excedido')).not.toBeInTheDocument();
  });

  it('limpa o timeout quando o carregamento termina antes do limite', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<AsyncBoundary loading>carregando</AsyncBoundary>);
    await vi.advanceTimersByTimeAsync(5_000);
    rerender(<AsyncBoundary loading={false}>pronto</AsyncBoundary>);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(screen.getByText('pronto')).toBeInTheDocument();
    expect(screen.queryByText('Tempo limite excedido')).not.toBeInTheDocument();
  });
});
