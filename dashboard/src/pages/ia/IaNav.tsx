import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ITEMS = [
  { to: '/app/ia', label: 'Visão geral', end: true },
  { to: '/app/ia/chaves', label: 'Chaves de API', end: false },
  { to: '/app/ia/agente', label: 'Agente WhatsApp', end: false },
  { to: '/app/ia/rollout', label: 'Liberação (rollout)', end: false },
  { to: '/app/ia/logs', label: 'Uso e sessões', end: false },
];

export function IaNav() {
  return (
    <nav aria-label="Módulo IA" className="flex flex-wrap gap-2">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
