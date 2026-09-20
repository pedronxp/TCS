import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, ChevronsRight, Search, X } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { useAuth } from '@/contexts/AuthContext';
import { resolveNavigation } from '@/config/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

type AppSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  onNavigate?: () => void;
  mobile?: boolean;
};

// Sidebar glass minimalista: fundo translúcido + blur, item ativo com
// fundo success-soft e texto primary (verde). Funciona em light e dark.
export function AppSidebar({ collapsed, onCollapsedChange, onNavigate, mobile = false }: AppSidebarProps) {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const groups = resolveNavigation(
    profile?.role === 'developer' ? 'developer' : 'owner',
    profile?.permissions ?? [],
  );
  const compact = collapsed && !mobile;
  const normalizedQuery = normalizeNavigationQuery(query);
  const visibleGroups = useMemo(() => groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => normalizeNavigationQuery(item.label).includes(normalizedQuery)),
    }))
    .filter((group) => group.items.length > 0), [groups, normalizedQuery]);
  const consoleLabel = profile?.role === 'developer' ? 'Saúde técnica' : 'Visão executiva';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-card border-r border-border group/sidebar relative flex h-full flex-col text-foreground',
          compact ? 'w-[88px]' : 'w-[232px]',
        )}
        aria-label="Navegação do console"
      >
        <div className={cn('flex h-20 items-center px-6', compact && 'justify-center px-0')}>
          <NavLink to="/app" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
            <TcsMark decorative size={compact ? 40 : 36} className="shrink-0" />
            {!compact && (
              <span className="min-w-0 leading-none">
                <strong className="block truncate text-base font-bold text-foreground">TCS Console</strong>
                <span className="mt-1.5 block truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {consoleLabel}
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
              'absolute -right-[17px] top-[23px] z-10 h-[34px] w-[34px] rounded-full border-border bg-card text-foreground shadow-sm transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 [transition-timing-function:var(--motion-ease-out)] hover:bg-secondary focus-visible:opacity-100 group-hover/sidebar:opacity-100',
              compact ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => onCollapsedChange(!compact)}
            aria-label={compact ? 'Expandir navegação' : 'Recolher navegação'}
          >
            {compact ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" aria-hidden="true" />}
          </Button>
        )}

        <div className={cn('px-3 pb-2', compact && 'flex justify-center px-0')}>
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => onCollapsedChange(false)}
                  aria-label="Pesquisar no menu"
                >
                  <Search aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Pesquisar no menu</TooltipContent>
            </Tooltip>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar no menu"
                aria-label="Pesquisar no menu"
                className="h-10 bg-background pl-9 pr-9 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Limpar pesquisa do menu"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-5 pt-2">
          {visibleGroups.length === 0 && !compact && (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
              {normalizedQuery ? 'Nenhum módulo corresponde à pesquisa.' : 'Nenhum módulo foi liberado para este perfil.'}
            </p>
          )}
          {visibleGroups.map((group) => (
            <SidebarMenuGroup
              key={group.label}
              group={group}
              compact={compact}
              searching={Boolean(normalizedQuery)}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

function normalizeNavigationQuery(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt-BR');
}

const SIDEBAR_GROUPS_KEY = 'tcs:sidebar-collapsed-groups';

function readCollapsedGroups(): Set<string> {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_GROUPS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function SidebarMenuGroup({ group, compact, searching, onNavigate }: {
  group: ReturnType<typeof resolveNavigation>[number];
  compact: boolean;
  searching: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const hasActiveItem = group.items.some((item) =>
    item.to === '/app' ? location.pathname === '/app' : location.pathname.startsWith(item.to));
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedGroups().has(group.label));
  const [mounted, setMounted] = useState(false);

  // Ao navegar para uma rota dentro de um grupo fechado, abre o grupo.
  useEffect(() => {
    setMounted(true);
    if (hasActiveItem && readCollapsedGroups().has(group.label)) {
      setCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const expanded = compact || searching || !collapsed || !mounted;

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      const set = readCollapsedGroups();
      if (next) set.add(group.label); else set.delete(group.label);
      try { window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify([...set])); } catch { /* storage indisponível */ }
      return next;
    });
  };

  return (
    <div className="mb-3">
      {!compact && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="mb-2 flex w-full items-center justify-between rounded-md px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{group.label}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')}
            aria-hidden="true"
          />
        </button>
      )}
      {expanded && (
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
                    'flex h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-accent font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    compact && 'mx-auto h-12 w-12 justify-center rounded-xl px-0',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
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
      )}
    </div>
  );
}
