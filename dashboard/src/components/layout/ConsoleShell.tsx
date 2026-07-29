import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';

type Density = 'comfortable' | 'compact';

export function ConsoleShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tcs.sidebar.collapsed') === 'true');
  const [density, setDensity] = useState<Density>(() =>
    localStorage.getItem('tcs.console.density') === 'compact' ? 'compact' : 'comfortable',
  );
  const { pathname } = useLocation();
  const compactBoardPadding = [
    '/app/clientes',
    '/app/sessoes',
    '/app/auditoria',
    '/app/planos',
    '/app/assinaturas',
    '/app/suporte',
    '/app/staff',
    '/app/desenvolvimento/versoes',
    '/app/desenvolvimento/builds',
    '/app/desenvolvimento/formularios',
    '/app/desenvolvimento/regras-risco',
  ]
    .some((route) => pathname.startsWith(route));

  useEffect(() => {
    localStorage.setItem('tcs.sidebar.collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('tcs.console.density', density);
  }, [density]);

  useEffect(() => {
    const title = pathname === '/app'
      ? 'Visão geral'
      : pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part).replace(/-/g, ' ')).join(' / ');
    document.title = `${title} — TCS Console`;
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background" data-density={density}>
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <AppSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(232px,85vw)] border-0 p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Navegação do console</SheetTitle>
          <AppSidebar
            mobile
            collapsed={false}
            onCollapsedChange={() => undefined}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <AppHeader
          onOpenMobile={() => setMobileOpen(true)}
          density={density}
          onDensityChange={setDensity}
        />
        <main className={cn(
          'w-full',
          density === 'compact'
            ? 'p-3 sm:p-5 lg:p-8'
            : compactBoardPadding
              ? 'p-4 sm:p-8'
              : 'p-4 sm:p-8 lg:p-12',
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
