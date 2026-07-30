import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleUserRound,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  Headphones,
  Map,
  Settings,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { PortalAccessContext, PortalPermission } from '@/types/portal';
import { portalHome } from '@/lib/portal';

export interface PortalNavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission: PortalPermission;
}

const modules = [
  ['Vistorias', 'vistorias', ClipboardCheck, 'inspection.read'],
  ['Mapa', 'mapa', Map, 'map.read'],
  ['Agenda', 'agenda', CalendarDays, 'appointment.read'],
  ['Documentos', 'documentos', FileText, 'document.read'],
  ['Relatórios', 'relatorios', ChartNoAxesCombined, 'report.read'],
  ['Equipe', 'equipe', Users, 'team.read'],
  ['Convites', 'convites', UserRoundPlus, 'invite.agent'],
  ['Consumo', 'consumo', Gauge, 'usage.read'],
  ['Assinatura', 'assinatura', CreditCard, 'billing.read'],
  ['Suporte', 'suporte', Headphones, 'support.read'],
  ['Configurações', 'configuracoes', Settings, 'settings.read'],
  ['Perfil', 'perfil', CircleUserRound, 'profile.read'],
] as const satisfies ReadonlyArray<readonly [string, string, LucideIcon, PortalPermission]>;

export function getPortalNavigation(access: PortalAccessContext): PortalNavigationItem[] {
  const root = portalHome(access.accountKind);
  const allowed = new Set(access.permissions);
  return [
    { label: 'Visão geral', path: root, icon: Gauge, permission: 'dashboard.read' },
    ...modules
      .filter(([, , , permission]) => allowed.has(permission))
      .map(([label, path, icon, permission]) => ({
        label,
        path: `${root}/${path}`,
        icon,
        permission,
      })),
  ];
}
