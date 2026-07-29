import {
  Activity,
  Boxes,
  Building2,
  ClipboardList,
  Code2,
  CreditCard,
  FileCode2,
  Gauge,
  GitBranch,
  Headphones,
  History,
  Settings,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react';
import type { InternalPermission } from '@/types/internal';

export interface NavigationItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  permission: InternalPermission;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const OWNER_NAVIGATION: NavigationGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/app', label: 'Visão executiva', icon: Gauge, permission: 'dashboard.executive.read' },
      { to: '/app/clientes', label: 'Clientes', icon: Building2, permission: 'customer.read' },
      { to: '/app/suporte', label: 'Suporte', icon: Headphones, permission: 'support.read' },
    ],
  },
  {
    label: 'Negócio',
    items: [
      { to: '/app/planos', label: 'Planos', icon: CreditCard, permission: 'commercial.read' },
      { to: '/app/assinaturas', label: 'Assinaturas', icon: ClipboardList, permission: 'commercial.read' },
      { to: '/app/sessoes', label: 'Sessões', icon: Smartphone, permission: 'session.read' },
    ],
  },
  {
    label: 'Governança',
    items: [
      { to: '/app/staff', label: 'Equipe interna', icon: Users, permission: 'staff.read' },
      { to: '/app/auditoria', label: 'Auditoria', icon: History, permission: 'audit.read' },
      { to: '/app/governanca/configuracoes', label: 'Configurações', icon: Settings, permission: 'configuration.publish' },
    ],
  },
];

export const DEVELOPER_NAVIGATION: NavigationGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/app', label: 'Saúde técnica', icon: Gauge, permission: 'dashboard.technical.read' },
      { to: '/app/clientes', label: 'Clientes', icon: Building2, permission: 'customer.read' },
      { to: '/app/suporte', label: 'Suporte', icon: Headphones, permission: 'support.read' },
    ],
  },
  {
    label: 'Desenvolvimento',
    items: [
      { to: '/app/desenvolvimento/versoes', label: 'Versões', icon: GitBranch, permission: 'technical.read' },
      { to: '/app/desenvolvimento/builds', label: 'Builds', icon: Boxes, permission: 'build.request' },
      { to: '/app/desenvolvimento/formularios', label: 'Formulários', icon: FileCode2, permission: 'technical.read' },
      { to: '/app/desenvolvimento/regras-risco', label: 'Regras de risco', icon: Shield, permission: 'technical.read' },
      { to: '/app/desenvolvimento/sincronizacao', label: 'Sincronização', icon: Activity, permission: 'technical.read' },
      { to: '/app/desenvolvimento/armazenamento', label: 'Armazenamento', icon: Boxes, permission: 'technical.read' },
      { to: '/app/desenvolvimento/logs', label: 'Logs e erros', icon: Code2, permission: 'technical.read' },
    ],
  },
  {
    label: 'Governança',
    items: [
      { to: '/app/auditoria', label: 'Auditoria', icon: History, permission: 'audit.read' },
    ],
  },
];

export function resolveNavigation(
  role: 'owner' | 'developer',
  permissions: readonly InternalPermission[],
): NavigationGroup[] {
  const allowed = new Set(permissions);
  return (role === 'developer' ? DEVELOPER_NAVIGATION : OWNER_NAVIGATION)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
