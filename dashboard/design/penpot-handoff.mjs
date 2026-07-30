export const penpotProject = 'TCS — Web Dashboard';
export const requiredBreakpoints = [1440, 1024, 768, 390];
export const penpotTarget = {
  teamId: '64054412-1123-81ed-8008-5ce7021c500a',
  fileId: 'a1a9e568-e174-80fb-8008-5ce7be9647bc',
  initialPageId: 'a1a9e568-e174-80fb-8008-5ce7be9647bd',
  verifiedExistingPages: [
    '01 · Foundations',
    '02 · Components',
    '03 · Dashboard',
    '04 · Clientes',
    '05 · Detalhe do cliente',
    '06 · Suporte',
    '07 · Planos',
    '08 · Comercial público',
    '09 · Login',
    '10 · Assinaturas',
    '11 · Sessões',
    '12 · Equipe interna',
    '13 · Auditoria',
    '14 · Versões',
    '15 · Builds',
    '16 · Formulários',
    '17 · Regras de risco',
    '18 · Sincronização',
    '19 · Armazenamento',
    '20 · Logs e erros',
    '21 · Configurações',
    '22 · Arquivamento',
    '23 · Templates operacionais',
    '24 · Dashboard técnico',
    '25 · Detalhe do agente',
    '26 · Portais — Arquitetura',
    '27 · Portais — Componentes e estados',
    '28 · Portal Individual',
    '29 · Municipal — Coordenador',
    '30 · Municipal — Supervisor',
    '31 · Municipal — Agente',
    '32 · Conta, planos e checkout',
    '33 · Convites municipais',
    '34 · Portais — Validação responsiva',
  ],
};

const internalSnapshot = (id, breakpoint = 1440) =>
  `tests/visual/__screenshots__/internal-routes.spec.ts/${breakpoint}/${id}.png`;
const publicSnapshot = (id, breakpoint = 1440) =>
  `tests/visual/__screenshots__/public-entry.spec.ts/${breakpoint}/${id}.png`;

export const templateBoards = [
  {
    id: 'template-public-page',
    name: 'TPL · Página pública',
    template: 'public-page',
    representativeRoute: 'commercial-public',
    source: publicSnapshot('commercial'),
    structure: ['layout público', 'hero', 'prova de valor', 'CTA', 'rodapé'],
  },
  {
    id: 'template-authentication',
    name: 'TPL · Autenticação',
    template: 'authentication',
    representativeRoute: 'login',
    source: publicSnapshot('login'),
    structure: ['composição editorial', 'formulário', 'erro', 'carregamento', 'retorno autenticado'],
  },
  {
    id: 'template-dashboard',
    name: 'TPL · Dashboard',
    template: 'dashboard',
    representativeRoute: 'dashboard-owner',
    source: internalSnapshot('dashboard-owner'),
    structure: ['cabeçalho', 'contexto ou release', 'métricas', 'atenção', 'atalhos'],
  },
  {
    id: 'template-listing',
    name: 'TPL · Listagem',
    template: 'listing',
    representativeRoute: 'customers',
    source: internalSnapshot('customers'),
    structure: ['cabeçalho', 'métricas', 'toolbar', 'tabela ou lista', 'paginação'],
  },
  {
    id: 'template-context-detail',
    name: 'TPL · Detalhe contextual',
    template: 'context-detail',
    representativeRoute: 'customer-detail',
    source: internalSnapshot('customer-detail'),
    structure: ['contexto persistente', 'filtros compartilhados', 'módulos ou abas', 'ações auditáveis'],
  },
  {
    id: 'template-timeline',
    name: 'TPL · Timeline',
    template: 'timeline',
    representativeRoute: 'audit',
    source: internalSnapshot('audit'),
    structure: ['filtros', 'sequência cronológica', 'detalhe sanitizado', 'estado vazio'],
  },
  {
    id: 'template-editor',
    name: 'TPL · Editor versionado',
    template: 'editor',
    representativeRoute: 'plans',
    source: internalSnapshot('plans'),
    structure: ['versão atual', 'edição', 'pré-visualização', 'validação', 'publicação e rollback'],
  },
  {
    id: 'template-settings',
    name: 'TPL · Configurações',
    template: 'settings',
    representativeRoute: 'configuration',
    source: internalSnapshot('configuration'),
    structure: ['grupos', 'origem do valor', 'alteração pendente', 'publicação segura'],
  },
  {
    id: 'template-technical-operation',
    name: 'TPL · Operação técnica',
    template: 'technical-operation',
    representativeRoute: 'sync',
    source: internalSnapshot('sync'),
    structure: ['resumo de saúde', 'filtros específicos', 'eventos ou fila', 'ações operacionais'],
  },
].map((board) => ({
  ...board,
  targetPage: '23 · Templates operacionais',
  frame: { width: 1440, height: 900 },
  approvalStatus: 'approved',
}));

export const specificBoards = [
  {
    id: 'dashboard-developer',
    name: '24 · Dashboard técnico',
    targetPage: '24 · Dashboard técnico',
    route: '/app',
    audience: ['developer'],
    permission: 'dashboard.technical.read',
    frame: { width: 1440, height: 1025 },
    source: internalSnapshot('dashboard-developer'),
    responsiveSources: requiredBreakpoints.map((breakpoint) => internalSnapshot('dashboard-developer', breakpoint)),
    sections: [
      'cabeçalho com ações de versões e eventos',
      'linha de versões persistidas',
      'leitura operacional',
      'indicadores técnicos',
      'fila de atenção',
      'atalhos de sincronização, armazenamento e builds',
    ],
    approvalStatus: 'approved',
  },
  {
    id: 'agent-detail',
    name: '25 · Detalhe do agente',
    targetPage: '25 · Detalhe do agente',
    route: '/app/clientes/:customerId/usuarios/:userId/:userSection?',
    audience: ['owner', 'developer'],
    permission: 'customer.read',
    frame: { width: 1440, height: 1276 },
    source: internalSnapshot('agent-detail'),
    responsiveSources: requiredBreakpoints.map((breakpoint) => internalSnapshot('agent-detail', breakpoint)),
    sections: [
      'contexto de cliente e agente',
      'filtros compartilhados de período, risco, status, formulário e busca',
      'resumo e distribuição de risco',
      'vistorias, mapa, agenda e documentos',
      'acesso, sessões e atividade técnica permitida',
      'ações administrativas auditáveis com MFA',
    ],
    approvalStatus: 'approved',
  },
];

export const portalBoards = [
  ['26 · Portais — Arquitetura', 'Arquitetura, jornadas e matriz de acesso', 1],
  ['27 · Portais — Componentes e estados', 'Componentes, estados e acessibilidade', 1],
  ['28 · Portal Individual', 'Portal Individual', 4],
  ['29 · Municipal — Coordenador', 'Municipal Coordenador', 4],
  ['30 · Municipal — Supervisor', 'Municipal Supervisor', 4],
  ['31 · Municipal — Agente', 'Municipal Agente', 4],
  ['32 · Conta, planos e checkout', 'Conta, planos e checkout', 1],
  ['33 · Convites municipais', 'Convites municipais', 1],
  ['34 · Portais — Validação responsiva', 'Validação responsiva', 1],
].flatMap(([targetPage, name, count]) =>
  Array.from({ length: Number(count) }, (_, index) => ({
    id: `portal-${String(targetPage).slice(0, 2)}-${index + 1}`,
    name: Number(count) === 1 ? name : `${name} · ${requiredBreakpoints[index]} px`,
    targetPage,
    breakpoint: Number(count) === 1 ? null : requiredBreakpoints[index],
    approvalStatus: 'approved',
    source: 'penpot-connected-file',
  })));

export const penpotHandoff = {
  project: penpotProject,
  target: penpotTarget,
  status: 'approved-in-penpot',
  pages: [
    {
      name: '23 · Templates operacionais',
      boards: templateBoards,
    },
    ...specificBoards.map((board) => ({
      name: board.targetPage,
      boards: [board],
    })),
    ...portalBoards.reduce((pages, board) => {
      const existing = pages.find((page) => page.name === board.targetPage);
      if (existing) existing.boards.push(board);
      else pages.push({ name: board.targetPage, boards: [board] });
      return pages;
    }, []),
  ],
};
