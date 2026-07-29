import { useQuery } from '@tanstack/react-query';
import { jsonArray, jsonBoolean, jsonNumber, jsonObject, jsonString, type JsonObject } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type {
  AgentAppointment, AgentDocument, AgentFilters, AgentInspection, AgentInspectionPage,
  AgentMapPoint, AgentMapResult, AgentOperations, AgentSession, AgentSummary,
  AgentTechnicalEvent,
} from '@/types/agent';
import type { Json } from '@/types/supabase';

export const agentKeys = {
  root: (customerId: string, userId: string) => ['internal-agent', customerId, userId] as const,
  summary: (customerId: string, userId: string, filters: AgentFilters) => [...agentKeys.root(customerId, userId), 'summary', filters] as const,
  inspections: (customerId: string, userId: string, filters: AgentFilters, cursorAt: string | null, cursorId: string | null, pageSize: number) =>
    [...agentKeys.root(customerId, userId), 'inspections', filters, cursorAt, cursorId, pageSize] as const,
  map: (customerId: string, userId: string, filters: AgentFilters) => [...agentKeys.root(customerId, userId), 'map', filters] as const,
  operations: (customerId: string, userId: string) => [...agentKeys.root(customerId, userId), 'operations'] as const,
};

function required(record: JsonObject, key: string) {
  const value = jsonString(record[key]);
  if (!value) throw new Error(`Resposta do agente sem ${key}.`);
  return value;
}

function objects(value: Json | undefined) {
  return jsonArray(value).map(jsonObject).filter((item): item is JsonObject => item !== null);
}

function riskCounts(value: Json | undefined) {
  const record = jsonObject(value);
  return {
    r1: jsonNumber(record?.r1) ?? 0,
    r2: jsonNumber(record?.r2) ?? 0,
    r3: jsonNumber(record?.r3) ?? 0,
    r4: jsonNumber(record?.r4) ?? 0,
  };
}

function parseSession(value: Json | undefined): AgentSession | null {
  const record = jsonObject(value);
  if (!record) return null;
  return {
    id: required(record, 'id'), deviceName: jsonString(record.device_name),
    platform: required(record, 'platform'), status: required(record, 'status'),
    startedAt: jsonString(record.started_at), lastHeartbeatAt: required(record, 'last_heartbeat_at'),
    endedAt: jsonString(record.ended_at), endReason: jsonString(record.end_reason),
  };
}

function parseTechnical(value: Json | undefined): AgentTechnicalEvent | null {
  const record = jsonObject(value);
  if (!record) return null;
  return {
    id: jsonNumber(record.id), appVersion: jsonString(record.app_version),
    platform: required(record, 'platform'), category: required(record, 'category'),
    severity: required(record, 'severity'), summary: jsonString(record.summary),
    correlationId: jsonString(record.correlation_id), occurredAt: required(record, 'occurred_at'),
  };
}

export function parseAgentSummary(value: Json | null): AgentSummary {
  const root = jsonObject(value);
  const agent = jsonObject(root?.agent);
  const period = jsonObject(root?.period);
  const metrics = jsonObject(root?.metrics);
  if (!root || !agent || !period || !metrics) throw new Error('Resposta inválida ao carregar o agente.');
  return {
    agent: {
      userId: required(agent, 'user_id'), name: required(agent, 'name'),
      email: jsonString(agent.email), phone: jsonString(agent.phone), role: jsonString(agent.role),
      membershipStatus: required(agent, 'membership_status'), effectiveAccess: required(agent, 'effective_access'),
      joinedAt: jsonString(agent.joined_at), lastLogin: jsonString(agent.last_login),
      customerName: required(agent, 'customer_name'), planName: jsonString(agent.plan_name),
    },
    period: {
      from: required(period, 'from'), to: required(period, 'to'),
      comparisonFrom: required(period, 'comparison_from'), comparisonTo: required(period, 'comparison_to'),
    },
    metrics: {
      inspections: jsonNumber(metrics.inspections) ?? 0,
      previousInspections: jsonNumber(metrics.previous_inspections) ?? 0,
      activeDays: jsonNumber(metrics.active_days) ?? 0,
      lastInspectionAt: jsonString(metrics.last_inspection_at),
      geolocated: jsonNumber(metrics.geolocated) ?? 0,
      geolocatedPercent: jsonNumber(metrics.geolocated_percent) ?? 0,
      documentComplete: jsonNumber(metrics.document_complete) ?? 0,
      documentCompletePercent: jsonNumber(metrics.document_complete_percent) ?? 0,
      risks: riskCounts(metrics.risk_distribution),
    },
    activityByDay: objects(root.activity_by_day).map((row) => ({ day: required(row, 'day'), total: jsonNumber(row.total) ?? 0 })),
    lastSession: parseSession(root.last_session),
    lastTechnicalActivity: parseTechnical(root.last_technical_activity),
    canViewSensitive: jsonBoolean(root.can_view_sensitive) ?? false,
  };
}

export function parseAgentInspectionPage(value: Json | null): AgentInspectionPage {
  const root = jsonObject(value);
  if (!root) throw new Error('Resposta inválida ao carregar vistorias.');
  const items: AgentInspection[] = objects(root.items).map((row) => {
    const documents = jsonObject(row.documents);
    return {
      id: required(row, 'id'), protocol: jsonString(row.protocol), risk: jsonString(row.risk),
      status: jsonString(row.status), occurredAt: jsonString(row.occurred_at),
      formId: jsonString(row.form_id), formVersion: jsonNumber(row.form_version), score: jsonNumber(row.score),
      synchronized: jsonBoolean(row.synchronized), address: jsonString(row.address),
      hasCoordinates: jsonBoolean(row.has_coordinates) ?? false,
      documents: {
        laudo: jsonBoolean(documents?.laudo) ?? false,
        relatorio: jsonBoolean(documents?.relatorio) ?? false,
        termo: jsonBoolean(documents?.termo) ?? false,
      },
    };
  });
  const cursor = jsonObject(root.next_cursor);
  return {
    items, total: jsonNumber(root.total) ?? 0, pageSize: jsonNumber(root.page_size) ?? 25,
    nextCursor: cursor ? { occurredAt: required(cursor, 'occurred_at'), id: required(cursor, 'id') } : null,
    canViewSensitive: jsonBoolean(root.can_view_sensitive) ?? false,
  };
}

export function parseAgentMap(value: Json | null): AgentMapResult {
  const root = jsonObject(value);
  if (!root) throw new Error('Resposta inválida ao carregar mapa.');
  const points: AgentMapPoint[] = objects(root.points).map((row) => ({
    id: required(row, 'id'), latitude: jsonNumber(row.latitude) ?? 0,
    longitude: jsonNumber(row.longitude) ?? 0, count: jsonNumber(row.count) ?? 0,
    occurredAt: jsonString(row.occurred_at), risks: riskCounts(row.risk_distribution),
  }));
  return {
    points, filteredTotal: jsonNumber(root.filtered_total) ?? 0,
    geolocatedTotal: jsonNumber(root.geolocated_total) ?? 0,
    withoutCoordinates: jsonNumber(root.without_coordinates) ?? 0,
    canViewSensitive: jsonBoolean(root.can_view_sensitive) ?? false,
  };
}

export function parseAgentOperations(value: Json | null): AgentOperations {
  const root = jsonObject(value);
  if (!root) throw new Error('Resposta inválida ao carregar operações do agente.');
  const appointments: AgentAppointment[] = objects(root.appointments).map((row) => ({
    id: required(row, 'id'), title: required(row, 'title'), status: required(row, 'status'),
    scheduledAt: jsonString(row.scheduled_at), address: jsonString(row.address),
    latitude: jsonNumber(row.latitude), longitude: jsonNumber(row.longitude),
  }));
  const documents: AgentDocument[] = objects(root.documents).map((row) => {
    const kind = required(row, 'kind');
    if (!['laudo', 'relatorio', 'termo'].includes(kind)) throw new Error('Tipo de documento inválido.');
    return {
      documentId: required(row, 'document_id'), inspectionId: required(row, 'inspection_id'),
      kind: kind as AgentDocument['kind'], protocol: jsonString(row.protocol),
      generatedAt: jsonString(row.generated_at), storageLocation: jsonString(row.storage_location),
      downloadable: jsonBoolean(row.downloadable) ?? false,
    };
  });
  return {
    appointments, documents,
    sessions: objects(root.sessions).map((row) => parseSession(row)).filter((item): item is AgentSession => item !== null),
    technicalActivity: objects(root.technical_activity).map((row) => parseTechnical(row)).filter((item): item is AgentTechnicalEvent => item !== null),
    canViewSensitive: jsonBoolean(root.can_view_sensitive) ?? false,
  };
}

function filterArgs(filters: AgentFilters) {
  return {
    p_from: filters.from || null, p_to: filters.to || null,
    p_risks: filters.risk ? [filters.risk.toLowerCase()] : null,
    p_status: filters.status || null, p_form_id: filters.formId || null,
    p_search: filters.search.trim() || null,
  };
}

export function useAgentSummary(customerId: string, userId: string, filters: AgentFilters) {
  return useQuery({
    queryKey: agentKeys.summary(customerId, userId, filters), enabled: Boolean(customerId && userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_agent_summary', {
        p_customer_id: customerId, p_user_id: userId, ...filterArgs(filters),
      });
      if (error) throw error;
      return parseAgentSummary(data);
    },
  });
}

export function useAgentInspections(customerId: string, userId: string, filters: AgentFilters, cursorAt: string | null, cursorId: string | null, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: agentKeys.inspections(customerId, userId, filters, cursorAt, cursorId, pageSize),
    enabled: enabled && Boolean(customerId && userId), refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_agent_inspections', {
        p_customer_id: customerId, p_user_id: userId, ...filterArgs(filters),
        p_cursor_at: cursorAt, p_cursor_id: cursorId, p_page_size: pageSize,
      });
      if (error) throw error;
      return parseAgentInspectionPage(data);
    },
  });
}

export function useAgentMap(customerId: string, userId: string, filters: AgentFilters, enabled = true) {
  return useQuery({
    queryKey: agentKeys.map(customerId, userId, filters), enabled: enabled && Boolean(customerId && userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_agent_map', {
        p_customer_id: customerId, p_user_id: userId, ...filterArgs(filters),
        p_west: null, p_south: null, p_east: null, p_north: null, p_zoom: 10,
      });
      if (error) throw error;
      return parseAgentMap(data);
    },
  });
}

export function useAgentOperations(customerId: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: agentKeys.operations(customerId, userId), enabled: enabled && Boolean(customerId && userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_internal_agent_operations', { p_customer_id: customerId, p_user_id: userId });
      if (error) throw error;
      return parseAgentOperations(data);
    },
  });
}
