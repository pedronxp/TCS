import { useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { TcsMark } from '@/components/brand/TcsMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import {
  getPortalNavigation,
  portalNavigationGroupLabels,
  type PortalNavigationGroup,
  type PortalNavigationItem,
} from '@/config/portalNavigation';
import { portalRestrictionMessage, portalSubscriptionPresentation } from '@/lib/portal';
import type { PortalAccessContext } from '@/types/portal';
import { cn } from '@/lib/utils';

const mobilePriorities = ['Visão geral', 'Vistorias', 'Agenda', 'Documentos', 'Mapa'];
const roleLabels = {
  coordinator: 'Coordenação municipal',
  supervisor: 'Supervisão municipal',
  agent: 'Agente municipal',
} as const;

export function PortalShell() {
  const { access, signOut } = usePortalAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  if (!access) return null;
  const navigation = getPortalNavigation(access);
  const prioritized = mobilePriorities
    .map((label) => navigation.find((item) => item.label === label))
    .filter((item): item is PortalNavigationItem => Boolean(item));
  const mobileNavigation = prioritized.length >= Math.min(3, navigation.length)
    ? prioritized.slice(0, 5)
    : navigation.slice(0, 5);
  const subscription = portalSubscriptionPresentation(access.subscriptionStatus, access.cancelAtPeriodEnd);
  const home = access.accountKind === 'organization' ? '/portal/municipal' : '/portal/individual';
  const audienceLabel = access.accountKind === 'organization' ? 'Portal municipal' : 'Portal individual';
  const identityDetail = getIdentityDetail(access);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError('Não foi possível sair. Sua sessão continua aberta; tente novamente.');
      setSigningOut(false);
    }
  }

  return (
    <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="min-h-screen bg-background text-foreground">
      <a href="#portal-content" className="sr-only z-[100] rounded-md bg-card px-4 py-2 shadow-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <aside className="glass fixed inset-y-0 left-0 z-50 hidden w-[272px] flex-col border-r border-border text-foreground lg:flex">
        <PortalBrand audienceLabel={audienceLabel} />
        <PortalNavigation items={navigation} home={home} />
        <PortalIdentity name={access.displayName} detail={identityDetail} onSignOut={handleSignOut} signingOut={signingOut} error={signOutError} />
      </aside>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 lg:hidden" />
          <DialogPrimitive.Content
            id="portal-mobile-menu"
            aria-describedby={undefined}
            className="glass surface-glass fixed inset-y-0 left-0 z-50 flex h-full w-[min(88vw,304px)] flex-col border-r border-border text-foreground outline-none lg:hidden"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              closeButtonRef.current?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">Navegação do portal</DialogPrimitive.Title>
            <div className="flex items-center justify-between pr-3">
              <PortalBrand audienceLabel={audienceLabel} />
              <DialogPrimitive.Close asChild>
                <Button ref={closeButtonRef} variant="ghost" size="icon" aria-label="Fechar menu">
                  <X aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <PortalNavigation items={navigation} home={home} onNavigate={() => setMobileOpen(false)} />
            <PortalIdentity name={access.displayName} detail={identityDetail} onSignOut={handleSignOut} signingOut={signingOut} error={signOutError} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-4 border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Abrir menu">
                <Menu aria-hidden="true" />
              </Button>
            </DialogPrimitive.Trigger>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{audienceLabel}</p>
              <p className="mt-1 truncate text-sm font-semibold">{access.organizationName ?? access.displayName}</p>
            </div>
          </div>
          <Badge variant={subscription.tone} className="shrink-0 text-foreground">{subscription.label}</Badge>
        </header>

        {!access.creationAllowed && (
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground sm:px-6 lg:px-8" role="status">
            <span className="font-semibold">Ações de criação indisponíveis. </span>
            {portalRestrictionMessage(access.restrictionCause)}
          </div>
        )}

        <main id="portal-content" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileNavigation.length}, minmax(0, 1fr))` }}
        aria-label="Navegação principal móvel"
      >
        {mobileNavigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === home}
            className={({ isActive }) => cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive && 'bg-secondary text-foreground',
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>
      </div>
    </DialogPrimitive.Root>
  );
}

function PortalBrand({ audienceLabel }: { audienceLabel: string }) {
  return (
    <Link to="/" className="flex h-[78px] items-center gap-3 px-6 text-foreground">
      <TcsMark decorative />
      <span className="min-w-0">
        <span className="block text-sm font-bold">TCS</span>
        <span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{audienceLabel}</span>
      </span>
    </Link>
  );
}

function PortalNavigation({ items, home, onNavigate }: { items: PortalNavigationItem[]; home: string; onNavigate?: () => void }) {
  const groups = (['work', 'management', 'account'] as PortalNavigationGroup[])
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter(({ items: groupItems }) => groupItems.length > 0);

  return (
    <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Módulos do portal">
      {groups.map(({ group, items: groupItems }, index) => (
        <div key={group} className={cn(index > 0 && 'mt-6')}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{portalNavigationGroupLabels[group]}</p>
          <div className="mt-2 space-y-1">
            {groupItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === home}
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'bg-success-soft text-foreground',
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PortalIdentity({
  name,
  detail,
  onSignOut,
  signingOut,
  error,
}: {
  name: string;
  detail: string;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  error: string | null;
}) {
  return (
    <div className="border-t border-border p-4">
      <p className="truncate text-sm font-semibold">{name}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={signingOut}
        className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> {signingOut ? 'Saindo…' : 'Sair'}
      </button>
      {error && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive-soft p-2 text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

function getIdentityDetail(access: PortalAccessContext) {
  if (access.accountKind === 'organization' && access.role) return roleLabels[access.role];
  return access.planName ?? 'Conta individual';
}
