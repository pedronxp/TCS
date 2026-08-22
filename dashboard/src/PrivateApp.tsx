import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { Toaster } from '@/components/ui/Sonner';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHome } from '@/pages/DashboardHome';
import { ArquivamentoPage } from '@/pages/ArquivamentoPage';
import { BuildsPage } from '@/pages/BuildsPage';
import { PlansPage } from '@/pages/PlansPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { SupportPage } from '@/pages/SupportPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { TechnicalEventsPage } from '@/pages/TechnicalEventsPage';
import { AuditPage } from '@/pages/AuditPage';
import { VersionsPage } from '@/pages/VersionsPage';
import { FormsPage } from '@/pages/FormsPage';
import { RiskRulesPage } from '@/pages/RiskRulesPage';
import { StaffPage } from '@/pages/StaffPage';
import { StyleGuidePage } from '@/pages/StyleGuidePage';
import { CommercialMetricsPage } from '@/pages/CommercialMetricsPage';
import { ProtocolsPage } from '@/pages/ProtocolsPage';
import { ProtocolInspectionPage } from '@/pages/ProtocolInspectionPage';
import { ProtocolDocumentWorkspacePage } from '@/pages/ProtocolDocumentWorkspacePage';
import { TokensConsolePage } from '@/pages/TokensConsolePage';
import { TokenAnalyticsPage } from '@/pages/TokenAnalyticsPage';
import { OperationalStatisticsPage } from '@/pages/OperationalStatisticsPage';
import { NotificationCampaignsPage } from '@/pages/NotificationCampaignsPage';
import { ConsoleComunicadosPage } from '@/pages/ConsoleComunicadosPage';
import { legacyCustomerDetailPath, legacyCustomerMemberPath } from '@/lib/customerRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ConsoleProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function ProtectedConsole() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

function LegacyCustomerUserRedirect() {
  const { customerId, userId } = useParams();
  if (!customerId || !userId) return <Navigate to="/app/clientes" replace />;
  return <Navigate to={legacyCustomerMemberPath(customerId, userId)} replace />;
}

function LegacyCustomerDetailRedirect() {
  const { customerId, section } = useParams();
  if (!customerId) return <Navigate to="/app/clientes" replace />;
  return <Navigate to={legacyCustomerDetailPath(customerId, section)} replace />;
}

export default function PrivateApp() {
  return (
    <Routes>
      <Route element={<ConsoleProviders />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<ProtectedConsole />}>
          <Route index element={<DashboardHome />} />
          <Route path="clientes" element={<ProtectedRoute requirePermission="customer.read"><CustomersPage /></ProtectedRoute>} />
          <Route path="clientes/organizacoes/:recordId/:section?" element={<ProtectedRoute requirePermission="customer.read"><CustomerDetailPage kind="organization" /></ProtectedRoute>} />
          <Route path="clientes/contas/:recordId/:section?" element={<ProtectedRoute requirePermission="customer.read"><CustomerDetailPage kind="user" /></ProtectedRoute>} />
          <Route path="clientes/:customerId/usuarios/:userId/:userSection?" element={<ProtectedRoute requirePermission="customer.read"><LegacyCustomerUserRedirect /></ProtectedRoute>} />
          <Route path="clientes/:customerId/:section?" element={<ProtectedRoute requirePermission="customer.read"><LegacyCustomerDetailRedirect /></ProtectedRoute>} />
          <Route path="planos" element={<ProtectedRoute requirePermission="commercial.read"><PlansPage /></ProtectedRoute>} />
          <Route path="negocio/indicadores" element={<ProtectedRoute requirePermission="commercial.read"><CommercialMetricsPage /></ProtectedRoute>} />
          <Route path="assinaturas" element={<ProtectedRoute requirePermission="commercial.read"><SubscriptionsPage /></ProtectedRoute>} />
          <Route path="protocolos" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolsPage /></ProtectedRoute>} />
          <Route path="protocolos/:inspectionId/laudo" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="laudo" /></ProtectedRoute>} />
          <Route path="protocolos/:inspectionId/relatorio" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="relatorio" /></ProtectedRoute>} />
          <Route path="protocolos/:inspectionId/termo" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="termo" /></ProtectedRoute>} />
          <Route path="protocolos/:inspectionId/fotos" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="fotos" /></ProtectedRoute>} />
          <Route path="protocolos/:inspectionId" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolInspectionPage /></ProtectedRoute>} />
          <Route path="tokens" element={<ProtectedRoute requirePermission="token.manage"><TokensConsolePage /></ProtectedRoute>} />
          <Route path="tokens/analise" element={<ProtectedRoute requirePermission="token.manage"><TokenAnalyticsPage /></ProtectedRoute>} />
          <Route path="operacao/estatisticas" element={<ProtectedRoute requirePermission="technical.read"><OperationalStatisticsPage /></ProtectedRoute>} />
          <Route path="avisos" element={<ProtectedRoute requirePermission="technical.write"><NotificationCampaignsPage /></ProtectedRoute>} />
          <Route path="comunicacoes" element={<ProtectedRoute requirePermission="communication.manage"><ConsoleComunicadosPage /></ProtectedRoute>} />
          <Route path="sessoes" element={<ProtectedRoute requirePermission="session.read"><SessionsPage /></ProtectedRoute>} />
          <Route path="dispositivo" element={<ProtectedRoute requirePermission="session.read"><DevicesPage /></ProtectedRoute>} />
          <Route path="suporte" element={<ProtectedRoute requirePermission="support.read"><SupportPage /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute requirePermission="staff.read"><StaffPage /></ProtectedRoute>} />
          <Route path="auditoria" element={<ProtectedRoute requirePermission="audit.read"><AuditPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/versoes" element={<ProtectedRoute requirePermission="technical.read"><VersionsPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/builds" element={<ProtectedRoute requirePermission="build.request"><BuildsPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/formularios" element={<ProtectedRoute requirePermission="technical.read"><FormsPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/formularios/:formId" element={<ProtectedRoute requirePermission="technical.read"><FormsPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/regras-risco" element={<ProtectedRoute requirePermission="technical.read"><RiskRulesPage /></ProtectedRoute>} />
          <Route path="desenvolvimento/sincronizacao" element={<ProtectedRoute requirePermission="technical.read"><TechnicalEventsPage category="sync" title="Sincronização" /></ProtectedRoute>} />
          <Route path="desenvolvimento/armazenamento" element={<ProtectedRoute requirePermission="technical.read"><TechnicalEventsPage category="storage" title="Armazenamento" /></ProtectedRoute>} />
          <Route path="desenvolvimento/logs" element={<ProtectedRoute requirePermission="technical.read"><TechnicalEventsPage title="Logs e erros" /></ProtectedRoute>} />
          <Route path="governanca/configuracoes" element={<Navigate to="/app/auditoria" replace />} />
          <Route path="governanca/arquivamento" element={<ProtectedRoute requirePermission="configuration.publish"><ArquivamentoPage /></ProtectedRoute>} />
          <Route path="referencia-ui" element={<ProtectedRoute requirePermission="console.read"><StyleGuidePage /></ProtectedRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
