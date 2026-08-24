import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';

type Density = 'comfortable' | 'compact';

function consolePageTitle(pathname: string) {
  if (pathname === '/app') return 'Visão geral';
  if (pathname === '/app/whatsapp') return 'WhatsApp Bot';
  if (/^\/app\/whatsapp\/[^/]+\/comunidades$/.test(pathname)) return 'Comunidades do WhatsApp';
  if (/^\/app\/whatsapp\/[^/]+$/.test(pathname)) return 'Operação do WhatsApp';
  if (pathname === '/app/comunicacoes') return 'Comunicados da Defesa Civil';
  if (/^\/app\/comunicacoes\/[^/]+$/.test(pathname)) return 'Comunicação da organização';
  return pathname
    .split('/')
    .filter(Boolean)
    .slice(1)
    .map((part) => decodeURIComponent(part).replace(/-/g, ' '))
    .join(' / ');
}

export function ConsoleShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tcs.sidebar.collapsed') === 'true');
  const [density, setDensity] = useState<Density>(() =>
    localStorage.getItem('tcs.console.density') === 'compact' ? 'compact' : 'comfortable',
  );
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const compactBoardPadding = [
    '/app/clientes',
    '/app/sessoes',
    '/app/auditoria',
    '/app/planos',
    '/app/assinaturas',
    '/app/protocolos',
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
    document.title = `${consolePageTitle(pathname)} — TCS Console`;
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background" data-density={density}>
      <a
        href="#console-content"
        className="sr-only z-[100] rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
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
          theme={theme}
          onThemeChange={setTheme}
        />
        <main id="console-content" tabIndex={-1} aria-label="Conteúdo do console" className={cn(
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
