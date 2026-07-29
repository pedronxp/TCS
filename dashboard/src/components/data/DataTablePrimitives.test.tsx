// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
  DataTableViewOptions,
} from './DataTablePrimitives';

afterEach(cleanup);

describe('primitivas compartilhadas de tabela', () => {
  it('expõe busca, limpeza de filtros e opções de colunas', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onClear = vi.fn();

    render(
      <DataTableToolbar
        query=""
        onQueryChange={onQueryChange}
        activeFilterCount={2}
        onClear={onClear}
        viewOptions={<DataTableViewOptions columns={[{ id: 'status', label: 'Status', visible: true, onVisibleChange: vi.fn() }]} />}
      />,
    );

    await user.type(screen.getByPlaceholderText('Buscar…'), 'aurora');
    await user.click(screen.getByRole('button', { name: /Limpar 2/i }));

    expect(onQueryChange).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Colunas/i })).toBeVisible();
  });

  it('aciona ordenação e paginação pelo teclado', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const onPageChange = vi.fn();

    render(
      <>
        <DataTableColumnHeader title="Cliente" direction="asc" onSort={onSort} />
        <DataTablePagination page={2} pageCount={4} onPageChange={onPageChange} />
      </>,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: /Próxima/i }));

    expect(onSort).toHaveBeenCalledOnce();
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
