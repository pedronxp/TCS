import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { getPortalNavigation } from '@/config/portalNavigation';
import { portalRestrictionMessage, portalSubscriptionPresentation } from '@/lib/portal';
import { cn } from '@/lib/utils';

export function PortalShell() {
  const { access, signOut } = usePortalAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = useCallback(() => {
    setMobileOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileNavigation();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closeMobileNavigation, mobileOpen]);

  if (!access) return null;
  const navigation = getPortalNavigation(access);
  const mobileNavigation = navigation.slice(0, 5);
  const subscription = portalSubscriptionPresentation(access.subscriptionStatus, access.cancelAtPeriodEnd);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#portal-content" className="sr-only z-[100] rounded-md bg-card px-4 py-2 shadow-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <aside className="glass fixed inset-y-0 left-0 z-50 hidden w-[264px] flex-col text-foreground lg:flex">
        <PortalBrand />
        <PortalNavigation items={navigation} />
        <PortalIdentity name={access.displayName} detail={access.organizationName ?? access.planName ?? 'Conta individual'} onSignOut={signOut} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/45" aria-label="Fechar navegação" onClick={closeMobileNavigation} />
          <aside className="glass surface-glass relative flex h-full w-[286px] flex-col text-foreground" role="dialog" aria-modal="true" aria-label="Navegação do portal">
            <div className="flex items-center justify-between pr-3">
              <PortalBrand />
              <Button ref={closeButtonRef} variant="ghost" size="icon" className="hover:bg-secondary" onClick={closeMobileNavigation} aria-label="Fechar menu">
                <X />
              </Button>
            </div>
            <PortalNavigation items={navigation} onNavigate={closeMobileNavigation} />
            <PortalIdentity name={access.displayName} detail={access.organizationName ?? 'Conta individual'} onSignOut={signOut} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button ref={menuButtonRef} variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {access.accountKind === 'organization' ? 'Portal municipal' : 'Portal individual'}
              </p>
              <p className="mt-1 text-sm font-semibold">{access.organizationName ?? access.displayName}</p>
            </div>
          </div>
          <Badge variant={subscription.tone}>
            {subscription.label}
          </Badge>
        </header>

        {!access.creationAllowed && (
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning sm:px-6 lg:px-8" role="status">
            {portalRestrictionMessage(access.restrictionCause)}
          </div>
        )}

        <main id="portal-content" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden" aria-label="Navegação principal móvel">
        {mobileNavigation.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === (access.accountKind === 'organization' ? '/portal/municipal' : '/portal/individual')} className={({ isActive }) => cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-muted-foreground', isActive && 'bg-secondary text-primary')}>
            <item.icon className="h-5 w-5" />
            <span className="max-w-[70px] truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function PortalBrand() {
  return (
    <Link to="/" className="flex h-[78px] items-center gap-3 px-6 text-foreground">
      <TcsMark decorative />
      <span>
        <span className="block text-sm font-bold">TCS</span>
        <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Portal do cliente</span>
      </span>
    </Link>
  );
}

function PortalNavigation({ items, onNavigate }: { items: ReturnType<typeof getPortalNavigation>; onNavigate?: () => void }) {
  return (
    <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Módulos do portal">
      {items.map((item) => (
        <NavLink key={item.path} to={item.path} end={item.label === 'Visão geral'} onClick={onNavigate} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground', isActive && 'bg-success-soft text-primary')}>
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function PortalIdentity({ name, detail, onSignOut }: { name: string; detail: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="border-t border-border p-4">
      <p className="truncate text-sm font-semibold">{name}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      <button onClick={() => void onSignOut()} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );
}
