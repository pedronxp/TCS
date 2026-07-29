// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

describe('fundação shadcn da TCS', () => {
  it('aplica variantes semânticas ao botão', () => {
    render(<Button variant="destructive">Revogar acesso</Button>);
    expect(screen.getByRole('button', { name: 'Revogar acesso' })).toHaveClass('bg-destructive');
  });

  it('permite navegar entre abas pelo teclado', async () => {
    const user = userEvent.setup();
    render(<Tabs defaultValue="resumo"><TabsList aria-label="Seções"><TabsTrigger value="resumo">Resumo</TabsTrigger><TabsTrigger value="auditoria">Auditoria</TabsTrigger></TabsList><TabsContent value="resumo">Conteúdo do resumo</TabsContent><TabsContent value="auditoria">Conteúdo da auditoria</TabsContent></Tabs>);
    await user.click(screen.getByRole('tab', { name: 'Resumo' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Auditoria' })).toHaveFocus();
    expect(screen.getByText('Conteúdo da auditoria')).toBeVisible();
  });
});
afterEach(cleanup);
