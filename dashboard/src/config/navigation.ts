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
  Hash,
  Headphones,
  History,
  Megaphone,
  Shield,
  Smartphone,
  KeyRound,
  BellRing,
  TrendingUp,
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
      { to: '/app/operacao/estatisticas', label: 'Estatísticas da operação', icon: Activity, permission: 'dashboard.executive.read' },
      { to: '/app/desenvolvimento/formularios', label: 'Formulários', icon: FileCode2, permission: 'technical.read' },
    ],
  },
  {
    label: 'Negócio',
    items: [
      { to: '/app/negocio/indicadores', label: 'Indicadores', icon: TrendingUp, permission: 'commercial.read' },
      { to: '/app/planos', label: 'Planos', icon: CreditCard, permission: 'commercial.read' },
      { to: '/app/assinaturas', label: 'Assinaturas', icon: ClipboardList, permission: 'commercial.read' },
      { to: '/app/protocolos', label: 'Protocolos', icon: Hash, permission: 'protocol.read' },
    ],
  },
  {
    label: 'Governança',
    items: [
      { to: '/app/staff', label: 'Pessoas e acessos', icon: Users, permission: 'staff.read' },
      { to: '/app/tokens', label: 'Tokens de convite', icon: KeyRound, permission: 'token.manage' },
      { to: '/app/avisos', label: 'Avisos e notificações', icon: BellRing, permission: 'technical.write' },
      { to: '/app/comunicacoes', label: 'Comunicados e comunidades', icon: Megaphone, permission: 'communication.manage' },
      { to: '/app/sessoes', label: 'Sessões e segurança', icon: Smartphone, permission: 'session.read' },
      { to: '/app/dispositivo', label: 'Dispositivos', icon: Smartphone, permission: 'session.read' },
      { to: '/app/auditoria', label: 'Auditoria', icon: History, permission: 'audit.read' },
      { to: '/app/governanca/arquivamento', label: 'Arquivamento', icon: Boxes, permission: 'configuration.publish' },
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
      { to: '/app/protocolos', label: 'Protocolos', icon: Hash, permission: 'protocol.read' },
      { to: '/app/operacao/estatisticas', label: 'Estatísticas da operação', icon: Activity, permission: 'dashboard.technical.read' },
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
      { to: '/app/tokens', label: 'Tokens de convite', icon: KeyRound, permission: 'token.manage' },
      { to: '/app/avisos', label: 'Avisos e notificações', icon: BellRing, permission: 'technical.write' },
      { to: '/app/comunicacoes', label: 'Comunicados e comunidades', icon: Megaphone, permission: 'communication.manage' },
      { to: '/app/sessoes', label: 'Sessões e segurança', icon: Smartphone, permission: 'session.read' },
      { to: '/app/dispositivo', label: 'Dispositivos', icon: Smartphone, permission: 'session.read' },
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
