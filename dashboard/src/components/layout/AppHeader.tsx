import { useState } from 'react';
import { Bell, Check, Download, KeyRound, LogOut, Menu, Moon, Pencil, Plus, Sun } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';
import type { Theme } from '@/hooks/useTheme';
import { ptBrLabel } from '@/lib/ptBrLabels';

type AppHeaderProps = {
  onOpenMobile: () => void;
  density: 'comfortable' | 'compact';
  onDensityChange: (density: 'comfortable' | 'compact') => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

type PageContext = {
  eyebrow: string;
  title: string;
};

const STATIC_PAGE_CONTEXTS: ReadonlyArray<{ prefix: string; context: PageContext }> = [
  { prefix: '/app/desenvolvimento/versoes', context: { eyebrow: 'Desenvolvimento', title: 'Versões e canais' } },
  { prefix: '/app/desenvolvimento/builds', context: { eyebrow: 'Desenvolvimento', title: 'Builds e pipelines' } },
  { prefix: '/app/desenvolvimento/formularios', context: { eyebrow: 'Desenvolvimento', title: 'Formulários e versões' } },
  { prefix: '/app/desenvolvimento/regras-risco', context: { eyebrow: 'Desenvolvimento', title: 'Regras e simulação' } },
  { prefix: '/app/desenvolvimento/sincronizacao', context: { eyebrow: 'Desenvolvimento', title: 'Sincronização' } },
  { prefix: '/app/desenvolvimento/armazenamento', context: { eyebrow: 'Desenvolvimento', title: 'Armazenamento' } },
  { prefix: '/app/desenvolvimento/logs', context: { eyebrow: 'Desenvolvimento', title: 'Logs e erros' } },
  { prefix: '/app/governanca/configuracoes', context: { eyebrow: 'Governança', title: 'Configurações do console' } },
  { prefix: '/app/governanca/arquivamento', context: { eyebrow: 'Governança', title: 'Arquivamento e retenção' } },
  { prefix: '/app/referencia-ui', context: { eyebrow: 'Referência', title: 'Interface do produto' } },
  { prefix: '/app/planos', context: { eyebrow: 'Negócio', title: 'Planos e limites' } },
  { prefix: '/app/assinaturas', context: { eyebrow: 'Negócio', title: 'Assinaturas e ciclos' } },
  { prefix: '/app/sessoes', context: { eyebrow: 'Segurança', title: 'Sessões e dispositivos' } },
  { prefix: '/app/suporte', context: { eyebrow: 'Suporte', title: 'Central de atendimento' } },
  { prefix: '/app/staff', context: { eyebrow: 'Governança', title: 'Equipe e permissões' } },
  { prefix: '/app/auditoria', context: { eyebrow: 'Governança', title: 'Auditoria e eventos' } },
];

function resolvePageContext(pathname: string, role: 'owner' | 'developer' | undefined): PageContext {
  if (pathname === '/app' || pathname === '/app/') {
    return role === 'developer'
      ? { eyebrow: 'Desenvolvimento', title: 'Saúde técnica' }
      : { eyebrow: 'Operação', title: 'Visão executiva' };
  }

  if (/^\/app\/clientes\/[^/]+\/usuarios\/[^/]+(?:\/|$)/.test(pathname)) {
    return { eyebrow: 'Clientes / Agente', title: 'Detalhe do agente' };
  }

  if (/^\/app\/clientes\/[^/]+(?:\/|$)/.test(pathname)) {
    return { eyebrow: 'Clientes / Detalhe', title: 'Detalhe do cliente' };
  }

  if (pathname === '/app/clientes' || pathname === '/app/clientes/') {
    return { eyebrow: 'Clientes', title: 'Carteira e implantação' };
  }

  return STATIC_PAGE_CONTEXTS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.context
    ?? { eyebrow: 'TCS Console', title: 'Área interna' };
}

export function AppHeader({ onOpenMobile, density, onDensityChange, theme, onThemeChange }: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, can, signOut } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const isCustomerDetail = /^\/app\/clientes\/[^/]+(?:\/|$)/.test(pathname)
    && !pathname.includes('/usuarios/');
  const pageContext = resolvePageContext(
    pathname,
    profile?.role === 'owner' || profile?.role === 'developer' ? profile.role : undefined,
  );
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
          <Menu aria-hidden="true" />
        </Button>

        <div className="hidden w-[260px] shrink-0 xl:block">
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{pageContext.eyebrow}</p>
          <p className="mt-1 truncate text-[13px] font-semibold">{pageContext.title}</p>
        </div>

        <div className="min-w-0 flex-1 xl:max-w-[390px]">
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
          {profile?.role === 'developer' && can('technical.read') ? (
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full">
              <Link to="/app/desenvolvimento/logs" aria-label="Abrir alertas técnicos">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : can('support.read') ? (
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full">
              <Link to="/app/suporte" aria-label="Abrir fila de suporte">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
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
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
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
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onThemeChange('light')}>
                {theme === 'light' && <Check />}
                <Sun className="h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onThemeChange('dark')}>
                {theme === 'dark' && <Check />}
                <Moon className="h-4 w-4" />
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
                <KeyRound />
                Alterar minha senha
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
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </header>
  );
}
