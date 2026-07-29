import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { useAuth } from '@/contexts/AuthContext';
import { resolveNavigation } from '@/config/navigation';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

type AppSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  onNavigate?: () => void;
  mobile?: boolean;
};

export function AppSidebar({ collapsed, onCollapsedChange, onNavigate, mobile = false }: AppSidebarProps) {
  const { profile, signOut, can } = useAuth();
  const groups = resolveNavigation(
    profile?.role === 'developer' ? 'developer' : 'owner',
    profile?.permissions ?? [],
  ).map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  }));
  const compact = collapsed && !mobile;
  const initials = profile?.displayName
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TC';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'group/sidebar relative flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          compact ? 'w-[88px]' : 'w-[232px]',
        )}
        aria-label="Navegação do console"
      >
        <div className={cn('flex h-20 items-center px-6', compact && 'justify-center px-0')}>
          <NavLink to="/app" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
            <TcsMark decorative size={compact ? 40 : 36} className="shrink-0" />
            {!compact && (
              <span className="min-w-0 leading-none">
                <strong className="block truncate text-base font-bold text-white">TCS Console</strong>
                <span className="mt-1.5 block truncate text-[9px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/50">
                  Painel interno
                </span>
              </span>
            )}
          </NavLink>
        </div>

        {!mobile && (
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'absolute -right-[17px] top-[23px] z-10 h-[34px] w-[34px] rounded-full border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md transition-all hover:scale-105 hover:bg-sidebar-accent hover:text-white focus-visible:opacity-100 group-hover/sidebar:opacity-100',
              compact ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => onCollapsedChange(!compact)}
            aria-label={compact ? 'Expandir navegação' : 'Recolher navegação'}
          >
            {compact ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        )}

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-5 pt-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-6">
              {!compact && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase text-sidebar-foreground/45">
                  {group.label}
                </p>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      end={item.to === '/app'}
                      aria-label={compact ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-white'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white',
                          compact && 'mx-auto h-12 w-12 justify-center rounded-xl px-0',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-transform group-hover/sidebar:scale-105',
                              isActive ? 'bg-warm text-warm-foreground shadow-sm' : 'bg-white/10 text-sidebar-foreground',
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                          </span>
                          {!compact && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  );

                  return compact ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('group/footer flex min-h-[95px] items-center border-t border-sidebar-border', compact ? 'mx-4 justify-center' : 'mx-6')}>
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  onClick={() => void signOut()}
                  aria-label="Sair"
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warm text-[11px] font-bold text-warm-foreground">
                {initials}
              </span>
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{profile?.displayName}</p>
                <p className="mt-1 truncate text-[11px] text-sidebar-foreground/50">{ptBrLabel(profile?.role)}</p>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md p-2 text-sidebar-foreground/55 opacity-0 hover:bg-sidebar-accent hover:text-white focus-visible:opacity-100 group-hover/footer:opacity-100"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
