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

export type PortalNavigationGroup = 'work' | 'management' | 'account';

export interface PortalNavigationItem {
  label: string;
  shortLabel?: string;
  path: string;
  icon: LucideIcon;
  permission: PortalPermission;
  group: PortalNavigationGroup;
}

export const portalNavigationGroupLabels: Record<PortalNavigationGroup, string> = {
  work: 'Operação',
  management: 'Gestão',
  account: 'Conta e suporte',
};

const modules = [
  ['Vistorias', 'vistorias', ClipboardCheck, 'inspection.read', 'work'],
  ['Mapa', 'mapa', Map, 'map.read', 'work'],
  ['Agenda', 'agenda', CalendarDays, 'appointment.read', 'work'],
  ['Documentos', 'documentos', FileText, 'document.read', 'work'],
  ['Relatórios', 'relatorios', ChartNoAxesCombined, 'report.read', 'work'],
  ['Equipe', 'equipe', Users, 'team.read', 'management'],
  ['Convites', 'convites', UserRoundPlus, 'invite.agent', 'management'],
  ['Consumo', 'consumo', Gauge, 'usage.read', 'management'],
  ['Assinatura', 'assinatura', CreditCard, 'billing.read', 'management'],
  ['Configurações', 'configuracoes', Settings, 'settings.read', 'management'],
  ['Suporte', 'suporte', Headphones, 'support.read', 'account'],
  ['Perfil', 'perfil', CircleUserRound, 'profile.read', 'account'],
] as const satisfies ReadonlyArray<readonly [string, string, LucideIcon, PortalPermission, PortalNavigationGroup]>;

export function getPortalNavigation(access: PortalAccessContext): PortalNavigationItem[] {
  const root = portalHome(access.accountKind);
  const allowed = new Set(access.permissions);
  return [
    {
      label: 'Visão geral',
      shortLabel: 'Início',
      path: root,
      icon: Gauge,
      permission: 'dashboard.read',
      group: 'work',
    },
    ...modules
      .filter(([, , , permission]) => allowed.has(permission))
      .map(([label, path, icon, permission, group]) => ({
        label,
        path: `${root}/${path}`,
        icon,
        permission,
        group,
      })),
  ];
}
