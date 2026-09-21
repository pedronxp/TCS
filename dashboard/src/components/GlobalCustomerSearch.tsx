import { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomers';
import { customerDetailPath } from '@/lib/customerRoutes';

export function GlobalCustomerSearch() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const query = useCustomers(value, '', 0, 6);
  const open = value.trim().length >= 2;

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar cliente…"
        aria-label="Buscar cliente"
        className="h-9 w-full rounded-lg border border-transparent bg-secondary/60 pl-9 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:bg-secondary focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/20"
      />
      {open && (
        <div
          className="glass absolute left-0 right-0 top-[44px] z-50 overflow-hidden rounded-lg border border-border text-popover-foreground"
          role="listbox"
        >
          {query.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
          ) : query.data?.items.length ? (
            query.data.items.map((customer) => (
              <button
                key={customer.customer_id}
                role="option"
                onClick={() => {
                  navigate(customerDetailPath(customer.customer_id));
                  setValue('');
                }}
                className="block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
              >
                <span className="block text-sm font-semibold">{customer.display_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {customer.municipality_name || customer.kind} · {customer.plan_name || 'sem plano'}
                </span>
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
