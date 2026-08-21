import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Download, KeyRound, LogOut, Menu, Moon, Palette, Pencil, Plus, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GlobalCustomerSearch } from '@/components/GlobalCustomerSearch';
import { Button } from '@/components/ui/Button';
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
import { ThemePickerModal } from '@/components/ThemePickerModal';
import type { Theme } from '@/hooks/useTheme';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';

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

type InboxNotification = {
  id: string;
  titulo: string;
  corpo: string;
  tipo: string;
  criada_em: string;
  lida: boolean;
};

const STATIC_PAGE_CONTEXTS: ReadonlyArray<{ prefix: string; context: PageContext }> = [
  { prefix: '/app/desenvolvimento/versoes', context: { eyebrow: 'Desenvolvimento', title: 'Versões e canais' } },
  { prefix: '/app/desenvolvimento/builds', context: { eyebrow: 'Desenvolvimento', title: 'Builds e pipelines' } },
  { prefix: '/app/desenvolvimento/formularios', context: { eyebrow: 'Desenvolvimento', title: 'Formulários e versões' } },
  { prefix: '/app/desenvolvimento/regras-risco', context: { eyebrow: 'Desenvolvimento', title: 'Regras e simulação' } },
  { prefix: '/app/desenvolvimento/sincronizacao', context: { eyebrow: 'Desenvolvimento', title: 'Sincronização' } },
  { prefix: '/app/desenvolvimento/armazenamento', context: { eyebrow: 'Desenvolvimento', title: 'Armazenamento' } },
  { prefix: '/app/desenvolvimento/logs', context: { eyebrow: 'Desenvolvimento', title: 'Logs e erros' } },
  { prefix: '/app/governanca/arquivamento', context: { eyebrow: 'Governança', title: 'Arquivamento e retenção' } },
  { prefix: '/app/referencia-ui', context: { eyebrow: 'Referência', title: 'Interface do produto' } },
  { prefix: '/app/planos', context: { eyebrow: 'Negócio', title: 'Planos e limites' } },
  { prefix: '/app/negocio/indicadores', context: { eyebrow: 'Negócio', title: 'Indicadores comerciais' } },
  { prefix: '/app/assinaturas', context: { eyebrow: 'Negócio', title: 'Assinaturas e ciclos' } },
  { prefix: '/app/protocolos', context: { eyebrow: 'Rastreabilidade', title: 'Registro de protocolos' } },
  { prefix: '/app/sessoes', context: { eyebrow: 'Segurança', title: 'Sessões e dispositivos' } },
  { prefix: '/app/dispositivo', context: { eyebrow: 'Segurança', title: 'Inventário de dispositivos' } },
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

  if (/^\/app\/clientes\/organizacoes\/[^/]+(?:\/|$)/.test(pathname)) {
    return { eyebrow: 'Clientes / Organização', title: 'Visão da organização' };
  }

  if (/^\/app\/clientes\/contas\/[^/]+(?:\/|$)/.test(pathname)) {
    return { eyebrow: 'Clientes / Conta individual', title: 'Visão da pessoa' };
  }

  if (/^\/app\/clientes\/[^/]+(?:\/|$)/.test(pathname)) {
    return { eyebrow: 'Clientes / Redirecionamento', title: 'Abrindo registro' };
  }

  if (pathname === '/app/clientes' || pathname === '/app/clientes/') {
    return { eyebrow: 'Clientes', title: 'Carteira e implantação' };
  }

  return STATIC_PAGE_CONTEXTS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.context
    ?? { eyebrow: 'TCS Console', title: 'Área interna' };
}

export function AppHeader({ onOpenMobile, density, onDensityChange, theme, onThemeChange }: AppHeaderProps) {
  const { pathname } = useLocation();
  const { profile, can, signOut } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState(false);
  const customerDetailKind = pathname.match(/^\/app\/clientes\/(organizacoes|contas)\/[^/]+(?:\/|$)/)?.[1];
  const isCustomerDetail = Boolean(customerDetailKind);
  const customerEditLabel = customerDetailKind === 'contas' ? 'Editar pessoa' : 'Editar organização';
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
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    const { data, error } = await supabase.from('notificacoes')
      .select('id,titulo,corpo,tipo,criada_em,lida')
      .order('criada_em', { ascending: false })
      .limit(8);
    if (error) {
      setNotificationsError(true);
    } else {
      setNotifications((data ?? []) as InboxNotification[]);
      setNotificationsError(false);
    }
    setNotificationsLoading(false);
  }, []);
  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  const unreadCount = notifications.filter((notification) => !notification.lida).length;
  const markNotificationRead = async (notification: InboxNotification) => {
    if (notification.lida) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, lida: true } : item));
    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', notification.id);
    if (error) void loadNotifications();
  };

  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-border/60 bg-card/80 backdrop-blur-md">
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
          {profile && <DropdownMenu open={notificationMenuOpen} onOpenChange={setNotificationMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full" aria-label="Abrir notificações">
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-2">
              <div className="flex items-center justify-between gap-3 px-2 py-1.5"><DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel><button type="button" className="text-xs text-primary hover:underline" onClick={() => void loadNotifications()}>Atualizar</button></div>
              <DropdownMenuSeparator />
              {notificationsLoading ? <p className="px-2 py-4 text-sm text-muted-foreground">Carregando notificações…</p> : notificationsError ? <p className="px-2 py-4 text-sm text-destructive">Não foi possível carregar as notificações.</p> : notifications.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma notificação para você.</p> : notifications.map((notification) => <DropdownMenuItem key={notification.id} onSelect={() => void markNotificationRead(notification)} className="items-start gap-3 whitespace-normal py-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.lida ? 'bg-transparent' : 'bg-primary'}`} /><span className="min-w-0"><span className="block font-medium">{notification.titulo}</span><span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{notification.corpo}</span><span className="mt-1 block text-[11px] text-muted-foreground">{formatNotificationDate(notification.criada_em)}</span></span></DropdownMenuItem>)}
              {(can('notification.manage') || can('technical.write')) && <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/app/avisos">Gerenciar avisos e campanhas</Link></DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>}
          {isCustomerDetail && can('customer.write') ? (
            <Button
              type="submit"
              form="customer-edit-form"
              className="hidden h-11 px-5 sm:inline-flex"
            >
              <Pencil />
              {customerEditLabel}
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
              <DropdownMenuItem onSelect={() => setThemePickerOpen(true)}>
                <Palette className="h-4 w-4 text-primary" />
                Personalizar tema...
              </DropdownMenuItem>
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
      <ThemePickerModal
        open={themePickerOpen}
        onOpenChange={setThemePickerOpen}
        currentTheme={theme}
        onSelectTheme={(selectedTheme) => {
          onThemeChange(selectedTheme);
        }}
      />
    </header>
  );
}

function formatNotificationDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
