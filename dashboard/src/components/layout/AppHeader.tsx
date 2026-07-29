import { Bell, Check, Download, LogOut, Menu, Pencil, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlobalCustomerSearch } from '@/components/GlobalCustomerSearch';
import { Button } from '@/components/ui/Button';
import { EnvironmentBadge } from '@/components/domain/Badges';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { cn } from '@/lib/utils';

type AppHeaderProps = {
  onOpenMobile: () => void;
  density: 'comfortable' | 'compact';
  onDensityChange: (density: 'comfortable' | 'compact') => void;
};

export function AppHeader({ onOpenMobile, density, onDensityChange }: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, can, signOut } = useAuth();
  const isCustomerDetail = /^\/app\/clientes\/[^/]+(?:\/|$)/.test(pathname)
    && !pathname.includes('/usuarios/');
  const pageContext = isCustomerDetail
    ? { eyebrow: 'Clientes / Detalhe', title: 'Detalhe do cliente' }
    : pathname.startsWith('/app/clientes')
      ? { eyebrow: 'Clientes', title: 'Carteira e implantação' }
    : pathname.startsWith('/app/sessoes')
      ? { eyebrow: 'TCS Console', title: 'Sessões e dispositivos' }
      : pathname.startsWith('/app/auditoria')
        ? { eyebrow: 'TCS Console', title: 'Auditoria e eventos' }
        : pathname.startsWith('/app/planos')
          ? { eyebrow: 'Negócio', title: 'Planos e limites' }
          : pathname.startsWith('/app/assinaturas')
            ? { eyebrow: 'TCS Console', title: 'Assinaturas e ciclos' }
            : pathname.startsWith('/app/suporte')
              ? { eyebrow: 'Suporte', title: 'Central de atendimento' }
              : pathname.startsWith('/app/staff')
                ? { eyebrow: 'TCS Console', title: 'Equipe e permissões' }
                : pathname.startsWith('/app/desenvolvimento/versoes')
                  ? { eyebrow: 'Desenvolvimento', title: 'Versões e canais' }
                  : pathname.startsWith('/app/desenvolvimento/builds')
                    ? { eyebrow: 'Desenvolvimento', title: 'Builds e pipelines' }
                    : pathname.startsWith('/app/desenvolvimento/formularios')
                      ? { eyebrow: 'Desenvolvimento', title: 'Formulários e versões' }
                      : pathname.startsWith('/app/desenvolvimento/regras-risco')
                        ? { eyebrow: 'Desenvolvimento', title: 'Regras e simulação' }
        : null;
  const initials = profile?.displayName
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TC';

  return (
    <header className="sticky top-0 z-30 h-[72px] border-b bg-card">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Abrir navegação">
          <Menu />
        </Button>

        {pageContext && (
          <div className="hidden w-[260px] shrink-0 xl:block">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{pageContext.eyebrow}</p>
            <p className="mt-1 truncate text-[13px] font-semibold">{pageContext.title}</p>
          </div>
        )}

        <div className={cn('min-w-0 flex-1', pageContext ? 'xl:max-w-[390px]' : 'sm:max-w-[520px]')}>
          <GlobalCustomerSearch />
        </div>

        <nav aria-label="Breadcrumb" className="sr-only">
          <span>Console</span>
          {pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean).map((part) => (
            <span key={part}> / {ptBrLabel(decodeURIComponent(part).replace(/-/g, ' '))}</span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden sm:inline-flex">
            <EnvironmentBadge environment={import.meta.env.MODE} />
          </span>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Alertas">
            <Bell className="h-4 w-4" />
          </Button>
          {isCustomerDetail && can('customer.write') ? (
            <Button
              type="submit"
              form="customer-edit-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Pencil />
              Editar cliente
            </Button>
          ) : pathname.startsWith('/app/auditoria') && can('audit.read') ? (
            <Button
              type="submit"
              form="audit-export-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Download />
              Exportar trilha
            </Button>
          ) : pathname.startsWith('/app/sessoes') && can('session.terminate') ? (
            <Button
              type="submit"
              form="session-revoke-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <LogOut />
              Revogar sessão
            </Button>
          ) : pathname.startsWith('/app/assinaturas') && can('commercial.write') ? (
            <Button
              type="submit"
              form="subscription-create-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Nova assinatura
            </Button>
          ) : pathname.startsWith('/app/staff') && can('staff.manage') ? (
            <Button
              type="submit"
              form="staff-create-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Adicionar membro
            </Button>
          ) : pathname.startsWith('/app/desenvolvimento/versoes') && (can('configuration.prepare') || can('configuration.publish')) ? (
            <Button
              type="submit"
              form="versions-create-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Nova versão
            </Button>
          ) : pathname.startsWith('/app/desenvolvimento/builds') && can('build.request') ? (
            <Button
              type="submit"
              form="build-request-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Solicitar build
            </Button>
          ) : pathname.startsWith('/app/desenvolvimento/formularios') && (can('configuration.prepare') || can('configuration.publish')) ? (
            <Button
              type="submit"
              form="forms-create-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Novo formulário
            </Button>
          ) : pathname.startsWith('/app/desenvolvimento/regras-risco') && (can('configuration.prepare') || can('configuration.publish')) ? (
            <Button
              type="submit"
              form="risk-create-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Plus />
              Nova configuração
            </Button>
          ) : pathname === '/app/clientes' && can('customer.write') ? (
            <Button className="hidden h-11 px-5 sm:inline-flex" onClick={() => navigate('/app/clientes?novo=1')}>
              <Plus />
              Novo cliente
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-warm text-[11px] font-bold text-warm-foreground"
                aria-label="Abrir menu do perfil"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{profile?.displayName}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{ptBrLabel(profile?.role)}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Densidade</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onDensityChange('comfortable')}>
                {density === 'comfortable' && <Check />}
                Confortável
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDensityChange('compact')}>
                {density === 'compact' && <Check />}
                Compacta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
