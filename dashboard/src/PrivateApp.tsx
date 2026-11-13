import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { Toaster } from '@/components/ui/Sonner';
import { AsyncLoading } from '@/components/states/AsyncBoundary';
import { legacyCustomerDetailPath, legacyCustomerMemberPath } from '@/lib/customerRoutes';

// Code-splitting por rota: cada página do console vira um chunk carregado sob
// demanda no primeiro acesso à rota (maplibre-gl e recharts saem do bundle
// inicial). Padrão de adaptação de named export também usado em PortalApp.tsx.
const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardHome = lazy(() => import('@/pages/DashboardHome').then((module) => ({ default: module.DashboardHome })));
const BuildsPage = lazy(() => import('@/pages/BuildsPage').then((module) => ({ default: module.BuildsPage })));
const PlansPage = lazy(() => import('@/pages/PlansPage').then((module) => ({ default: module.PlansPage })));
const SubscriptionsPage = lazy(() => import('@/pages/SubscriptionsPage').then((module) => ({ default: module.SubscriptionsPage })));
const FaturasPage = lazy(() => import('@/pages/FaturasPage').then((module) => ({ default: module.FaturasPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const SessionsPage = lazy(() => import('@/pages/SessionsPage').then((module) => ({ default: module.SessionsPage })));
const DevicesPage = lazy(() => import('@/pages/DevicesPage').then((module) => ({ default: module.DevicesPage })));
const SupportPage = lazy(() => import('@/pages/SupportPage').then((module) => ({ default: module.SupportPage })));
const CustomersPage = lazy(() => import('@/pages/CustomersPage').then((module) => ({ default: module.CustomersPage })));
const CustomerDetailPage = lazy(() => import('@/pages/CustomerDetailPage').then((module) => ({ default: module.CustomerDetailPage })));
const TechnicalEventsPage = lazy(() => import('@/pages/TechnicalEventsPage').then((module) => ({ default: module.TechnicalEventsPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then((module) => ({ default: module.AuditPage })));
const VersionsPage = lazy(() => import('@/pages/VersionsPage').then((module) => ({ default: module.VersionsPage })));
const FormsPage = lazy(() => import('@/pages/FormsPage').then((module) => ({ default: module.FormsPage })));
const RiskRulesPage = lazy(() => import('@/pages/RiskRulesPage').then((module) => ({ default: module.RiskRulesPage })));
const StaffPage = lazy(() => import('@/pages/StaffPage').then((module) => ({ default: module.StaffPage })));
const StyleGuidePage = lazy(() => import('@/pages/StyleGuidePage').then((module) => ({ default: module.StyleGuidePage })));
const CommercialMetricsPage = lazy(() => import('@/pages/CommercialMetricsPage').then((module) => ({ default: module.CommercialMetricsPage })));
const ProtocolsPage = lazy(() => import('@/pages/ProtocolsPage').then((module) => ({ default: module.ProtocolsPage })));
const ProtocolInspectionPage = lazy(() => import('@/pages/ProtocolInspectionPage').then((module) => ({ default: module.ProtocolInspectionPage })));
const ProtocolDocumentWorkspacePage = lazy(() => import('@/pages/ProtocolDocumentWorkspacePage').then((module) => ({ default: module.ProtocolDocumentWorkspacePage })));
const TokensConsolePage = lazy(() => import('@/pages/TokensConsolePage').then((module) => ({ default: module.TokensConsolePage })));
const TokenAnalyticsPage = lazy(() => import('@/pages/TokenAnalyticsPage').then((module) => ({ default: module.TokenAnalyticsPage })));
const NotificationCampaignsPage = lazy(() => import('@/pages/NotificationCampaignsPage').then((module) => ({ default: module.NotificationCampaignsPage })));
const ConsoleComunicadosPage = lazy(() => import('@/pages/ConsoleComunicadosPage').then((module) => ({ default: module.ConsoleComunicadosPage })));
const ConsoleComunicadoOrgPage = lazy(() => import('@/pages/ConsoleComunicadoOrgPage').then((module) => ({ default: module.ConsoleComunicadoOrgPage })));
const ConsoleWhatsAppPage = lazy(() => import('@/pages/ConsoleWhatsAppPage').then((module) => ({ default: module.ConsoleWhatsAppPage })));
const ConsoleWhatsAppOrgPage = lazy(() => import('@/pages/ConsoleWhatsAppOrgPage').then((module) => ({ default: module.ConsoleWhatsAppOrgPage })));
const ConsoleWhatsAppCommunitiesPage = lazy(() => import('@/pages/ConsoleWhatsAppCommunitiesPage').then((module) => ({ default: module.ConsoleWhatsAppCommunitiesPage })));
const InboxPage = lazy(() => import('@/pages/InboxPage').then((module) => ({ default: module.InboxPage })));
const IaOverviewPage = lazy(() => import('@/pages/ia/IaOverviewPage').then((module) => ({ default: module.IaOverviewPage })));
const IaKeysPage = lazy(() => import('@/pages/ia/IaKeysPage').then((module) => ({ default: module.IaKeysPage })));
const IaAgentPage = lazy(() => import('@/pages/ia/IaAgentPage').then((module) => ({ default: module.IaAgentPage })));
const IaRolloutPage = lazy(() => import('@/pages/ia/IaRolloutPage').then((module) => ({ default: module.IaRolloutPage })));
const IaAcessosPage = lazy(() => import('@/pages/ia/IaAcessosPage').then((module) => ({ default: module.IaAcessosPage })));
const IaLogsPage = lazy(() => import('@/pages/ia/IaLogsPage').then((module) => ({ default: module.IaLogsPage })));

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
    <Suspense fallback={<AsyncLoading label="Carregando página." />}>
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
            <Route path="faturas" element={<ProtectedRoute requirePermission="commercial.read"><FaturasPage /></ProtectedRoute>} />
            <Route path="analytics" element={<ProtectedRoute requirePermission="commercial.read"><AnalyticsPage /></ProtectedRoute>} />
            <Route path="protocolos" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolsPage /></ProtectedRoute>} />
            <Route path="protocolos/:inspectionId/laudo" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="laudo" /></ProtectedRoute>} />
            <Route path="protocolos/:inspectionId/relatorio" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="relatorio" /></ProtectedRoute>} />
            <Route path="protocolos/:inspectionId/termo" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="termo" /></ProtectedRoute>} />
            <Route path="protocolos/:inspectionId/fotos" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolDocumentWorkspacePage kind="fotos" /></ProtectedRoute>} />
            <Route path="protocolos/:inspectionId" element={<ProtectedRoute requirePermission="protocol.read"><ProtocolInspectionPage /></ProtectedRoute>} />
            <Route path="tokens" element={<ProtectedRoute requirePermission="token.manage"><TokensConsolePage /></ProtectedRoute>} />
            <Route path="tokens/analise" element={<ProtectedRoute requirePermission="token.manage"><TokenAnalyticsPage /></ProtectedRoute>} />
            <Route path="avisos" element={<ProtectedRoute requirePermission="technical.write"><NotificationCampaignsPage /></ProtectedRoute>} />
            <Route path="mensagens" element={<ProtectedRoute requirePermission="console.read"><InboxPage workspace="internal" /></ProtectedRoute>} />
            <Route path="comunicacoes" element={<ProtectedRoute requirePermission="communication.manage"><ConsoleComunicadosPage /></ProtectedRoute>} />
            <Route path="comunicacoes/:orgId" element={<ProtectedRoute requirePermission="communication.manage"><ConsoleComunicadoOrgPage /></ProtectedRoute>} />
            <Route path="whatsapp" element={<ProtectedRoute requirePermission="whatsapp.read"><ConsoleWhatsAppPage /></ProtectedRoute>} />
            <Route path="whatsapp/:orgId/comunidades" element={<ProtectedRoute requirePermission="whatsapp.read"><ConsoleWhatsAppCommunitiesPage /></ProtectedRoute>} />
            <Route path="whatsapp/:orgId" element={<ProtectedRoute requirePermission="whatsapp.read"><ConsoleWhatsAppOrgPage /></ProtectedRoute>} />
            <Route path="sessoes" element={<ProtectedRoute requirePermission="session.read"><SessionsPage /></ProtectedRoute>} />
            <Route path="ia" element={<ProtectedRoute requirePermission="ia.read"><IaOverviewPage /></ProtectedRoute>} />
            <Route path="ia/chaves" element={<ProtectedRoute requirePermission="ia.read"><IaKeysPage /></ProtectedRoute>} />
            <Route path="ia/agente" element={<ProtectedRoute requirePermission="ia.read"><IaAgentPage /></ProtectedRoute>} />
            <Route path="ia/rollout" element={<ProtectedRoute requirePermission="ia.read"><IaRolloutPage /></ProtectedRoute>} />
            <Route path="ia/acessos" element={<ProtectedRoute requirePermission="ia.read"><IaAcessosPage /></ProtectedRoute>} />
            <Route path="ia/logs" element={<ProtectedRoute requirePermission="ia.read"><IaLogsPage /></ProtectedRoute>} />
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
            <Route path="referencia-ui" element={<ProtectedRoute requirePermission="console.read"><StyleGuidePage /></ProtectedRoute>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
