import { NavLink } from 'react-router-dom';
import { LogOut, MenuSquare, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { assuranceLabel, ptBrLabel } from '@/lib/ptBrLabels';
import { resolveNavigation } from '@/config/navigation';

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { profile, signOut, can } = useAuth();
  const groups = resolveNavigation(
    profile?.role === 'developer' ? 'developer' : 'owner',
    profile?.permissions ?? []
  ).map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  }));

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          'glass', // Classe glass aplicada
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary">
              <MenuSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">TCS Console</p>
              <p className="text-xs text-muted-foreground">Ambiente interno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-2 hover:bg-sidebar-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-success-soft text-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-semibold text-foreground">{profile?.displayName}</p>
          <p className="text-xs text-sidebar-foreground">
            {ptBrLabel(profile?.role)} · {assuranceLabel(profile?.assuranceLevel)}
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
