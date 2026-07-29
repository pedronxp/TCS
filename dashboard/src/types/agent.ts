export interface AgentFilters {
  from: string;
  to: string;
  risk: string;
  status: string;
  formId: string;
  search: string;
}

export interface AgentIdentity {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  membershipStatus: string;
  effectiveAccess: string;
  joinedAt: string | null;
  lastLogin: string | null;
  customerName: string;
  planName: string | null;
}

export interface AgentMetrics {
  inspections: number;
  previousInspections: number;
  activeDays: number;
  lastInspectionAt: string | null;
  geolocated: number;
  geolocatedPercent: number;
  documentComplete: number;
  documentCompletePercent: number;
  risks: Record<'r1' | 'r2' | 'r3' | 'r4', number>;
}

export interface AgentSummary {
  agent: AgentIdentity;
  period: { from: string; to: string; comparisonFrom: string; comparisonTo: string };
  metrics: AgentMetrics;
  activityByDay: { day: string; total: number }[];
  lastSession: AgentSession | null;
  lastTechnicalActivity: AgentTechnicalEvent | null;
  canViewSensitive: boolean;
}

export interface AgentInspection {
  id: string;
  protocol: string | null;
  risk: string | null;
  status: string | null;
  occurredAt: string | null;
  formId: string | null;
  formVersion: number | null;
  score: number | null;
  synchronized: boolean | null;
  address: string | null;
  hasCoordinates: boolean;
  documents: { laudo: boolean; relatorio: boolean; termo: boolean };
}

export interface AgentInspectionPage {
  items: AgentInspection[];
  total: number;
  pageSize: number;
  nextCursor: { occurredAt: string; id: string } | null;
  canViewSensitive: boolean;
}

export interface AgentMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  occurredAt: string | null;
  risks: Record<'r1' | 'r2' | 'r3' | 'r4', number>;
}

export interface AgentMapResult {
  points: AgentMapPoint[];
  filteredTotal: number;
  geolocatedTotal: number;
  withoutCoordinates: number;
  canViewSensitive: boolean;
}

export interface AgentAppointment {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AgentDocument {
  documentId: string;
  inspectionId: string;
  kind: 'laudo' | 'relatorio' | 'termo';
  protocol: string | null;
  generatedAt: string | null;
  storageLocation: string | null;
  downloadable: boolean;
}

export interface AgentSession {
  id: string;
  deviceName: string | null;
  platform: string;
  status: string;
  startedAt: string | null;
  lastHeartbeatAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface AgentTechnicalEvent {
  id: number | null;
  appVersion: string | null;
  platform: string;
  category: string;
  severity: string;
  summary: string | null;
  correlationId: string | null;
  occurredAt: string;
}

export interface AgentOperations {
  appointments: AgentAppointment[];
  documents: AgentDocument[];
  sessions: AgentSession[];
  technicalActivity: AgentTechnicalEvent[];
  canViewSensitive: boolean;
}
