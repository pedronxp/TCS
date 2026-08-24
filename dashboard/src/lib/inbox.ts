import { supabase } from '@/lib/supabase';

export type InboxWorkspace = 'internal' | 'organization' | 'individual';
export type InboxSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';

export interface InboxItem {
  id: string;
  eventType: string;
  moduleKey: string;
  severity: InboxSeverity;
  title: string;
  body: string;
  routeKey: string | null;
  organizationId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  threadKey: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface InboxResult {
  unreadCount: number;
  items: InboxItem[];
}

type RpcResult = { data: unknown; error: { message: string } | null };
type InboxRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc = supabase.rpc.bind(supabase) as unknown as InboxRpc;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function severity(value: unknown): InboxSeverity {
  return ['info', 'success', 'warning', 'error', 'critical'].includes(String(value))
    ? value as InboxSeverity
    : 'info';
}

export async function getInbox(
  workspace: InboxWorkspace,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<InboxResult> {
  const { data, error } = await rpc('get_my_inbox', {
    p_workspace_kind: workspace,
    p_limit: options.limit ?? 50,
    p_unread_only: options.unreadOnly ?? false,
  });
  if (error) throw new Error(error.message);
  const root = object(data);
  const rows = Array.isArray(root?.items) ? root.items : [];
  return {
    unreadCount: typeof root?.unread_count === 'number' ? root.unread_count : 0,
    items: rows.flatMap((value) => {
      const row = object(value);
      const id = text(row?.id);
      if (!row || !id) return [];
      return [{
        id,
        eventType: text(row.event_type) ?? 'system.event',
        moduleKey: text(row.module_key) ?? 'system',
        severity: severity(row.severity),
        title: text(row.title) ?? 'Atualização do sistema',
        body: text(row.body) ?? 'Uma informação foi atualizada.',
        routeKey: text(row.route_key),
        organizationId: text(row.organization_id),
        entityType: text(row.entity_type),
        entityId: text(row.entity_id),
        payload: object(row.payload) ?? {},
        threadKey: text(row.thread_key),
        createdAt: text(row.created_at) ?? new Date().toISOString(),
        readAt: text(row.read_at),
      } satisfies InboxItem];
    }),
  };
}

export async function markInboxMessageRead(eventId: string, workspace: InboxWorkspace) {
  const { error } = await rpc('mark_inbox_message_read', {
    p_event_id: eventId,
    p_workspace_kind: workspace,
  });
  if (error) throw new Error(error.message);
}

export async function markAllInboxMessagesRead(workspace: InboxWorkspace) {
  const { error } = await rpc('mark_all_inbox_messages_read', {
    p_workspace_kind: workspace,
  });
  if (error) throw new Error(error.message);
}

export function inboxHome(workspace: InboxWorkspace) {
  if (workspace === 'internal') return '/app/mensagens';
  return workspace === 'organization'
    ? '/portal/municipal/mensagens'
    : '/portal/individual/mensagens';
}

export function resolveInboxRoute(item: InboxItem, workspace: InboxWorkspace) {
  if (item.routeKey?.startsWith('whatsapp.')) {
    if (workspace === 'internal' && item.organizationId) return `/app/whatsapp/${item.organizationId}`;
    if (workspace === 'organization') return '/portal/municipal/whatsapp';
  }
  if (item.routeKey?.startsWith('communication.')) {
    if (workspace === 'internal' && item.organizationId) return `/app/comunicacoes/${item.organizationId}`;
    if (workspace === 'organization') return '/portal/municipal/comunicados';
  }
  if (item.routeKey?.startsWith('customer.') && workspace === 'internal' && item.entityId) {
    return `/app/clientes/${item.entityId}`;
  }
  return inboxHome(workspace);
}

