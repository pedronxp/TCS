import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface GuideItem {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  title: string;
  description: string;
}

interface GuideSection {
  heading: string;
  items: GuideItem[];
}

const GUIDE_CONTENT: Record<string, GuideSection[]> = {
  agent: [
    {
      heading: 'Realizando uma Vistoria',
      items: [
        {
          icon: 'plus-circle', color: '#3B82F6',
          title: 'Como iniciar uma vistoria',
          description: 'No dashboard toque em "Nova Vistoria" ou no ícone "+" da barra inferior. Preencha o endereço completo com número, selecione o formulário adequado ao tipo de edificação e responda todas as perguntas do checklist. Ao finalizar, o sistema calcula automaticamente o nível de risco (R1 a R4).',
        },
        {
          icon: 'camera', color: '#8B5CF6',
          title: 'Adicionando fotos',
          description: 'Durante a vistoria, na etapa de fotos, tire fotos das evidências de risco diretamente pelo app ou importe da galeria. As imagens ficam vinculadas à vistoria e aparecem no laudo e relatório. Não há limite de fotos por vistoria.',
        },
        {
          icon: 'map-pin', color: '#10B981',
          title: 'Geolocalização automática',
          description: 'O app captura automaticamente as coordenadas GPS da edificação ao iniciar a vistoria. Certifique-se de estar próximo ao local para maior precisão. A localização aparece no mapa tático e no documento gerado.',
        },
        {
          icon: 'save', color: '#F59E0B',
          title: 'Salvando e sincronizando',
          description: 'A vistoria é salva localmente assim que você conclui. O envio ao servidor ocorre automaticamente quando há internet. Vistorias pendentes de envio ficam marcadas com badge amarelo na lista de inspeções.',
        },
      ],
    },
    {
      heading: 'Módulos do App',
      items: [
        {
          icon: 'clipboard', color: '#F59E0B',
          title: 'Inspeções',
          description: 'Lista completa de todas as suas vistorias realizadas. Toque em uma vistoria para ver detalhes, nível de risco, fotos e respostas do formulário. Deslize para baixo para atualizar. Vistorias em vermelho são de alto risco (R3/R4).',
        },
        {
          icon: 'map', color: '#10B981',
          title: 'Mapa Tático',
          description: 'Visualize no mapa todas as edificações que você vistoriou. Os marcadores mudam de cor conforme o risco: verde (R1), amarelo (R2), laranja (R3) e vermelho (R4). Use os filtros para selecionar por período ou nível de risco.',
        },
        {
          icon: 'calendar', color: '#8B5CF6',
          title: 'Agendamentos',
          description: 'Aqui aparecem as vistorias que seu supervisor agendou para você. O número vermelho no ícone de calendário indica agendamentos pendentes. Toque em um agendamento para ver o endereço e iniciar a vistoria diretamente.',
        },
        {
          icon: 'user', color: '#06B6D4',
          title: 'Perfil',
          description: 'Acesse pelo ícone de usuário no canto superior direito. Aqui você pode alterar seu nome (uma vez), mudar a senha e verificar suas notificações push. Mantenha o perfil atualizado para que o supervisor identifique seus registros.',
        },
      ],
    },
    {
      heading: 'Documentos Gerados',
      items: [
        {
          icon: 'file-text', color: '#EF4444',
          title: 'Laudo Técnico',
          description: 'O laudo é gerado automaticamente ao concluir a vistoria. Contém protocolo único (ex: TCS-CIDADE-DATA-CÓDIGO), endereço, nível de risco, pontuação total e conduta recomendada. Para R3/R4, o laudo pode incluir Termo de Interdição. Acesse pelo botão "Laudo" dentro da vistoria.',
        },
        {
          icon: 'bar-chart-2', color: '#06B6D4',
          title: 'Relatório Técnico',
          description: 'Documento mais detalhado que o laudo: inclui todas as respostas do formulário, fotos tiradas e histórico completo da inspeção. Ideal para envio a órgãos externos. Acesse em "Relatório" dentro de qualquer vistoria concluída.',
        },
        {
          icon: 'share-2', color: '#F97316',
          title: 'Compartilhando documentos',
          description: 'Dentro do laudo ou relatório, toque no ícone de compartilhar para salvar o PDF no dispositivo ou enviar por WhatsApp, e-mail ou outro app. O arquivo é gerado em alta qualidade e inclui o logo oficial da Defesa Civil.',
        },
      ],
    },
    {
      heading: 'Uso Offline',
      items: [
        {
          icon: 'wifi-off', color: '#F59E0B',
          title: 'Trabalhando sem internet',
          description: 'O app funciona completamente offline. Você pode iniciar, responder e concluir vistorias sem conexão. Quando a internet voltar, um banner verde confirma a sincronização automática. Nunca perca dados por falta de sinal.',
        },
        {
          icon: 'refresh-cw', color: '#10B981',
          title: 'Sincronização automática',
          description: 'Ao reconectar, o app envia todas as vistorias pendentes em segundo plano. O badge amarelo some após a sincronização bem-sucedida. Você pode forçar a sincronização puxando a lista para baixo (pull to refresh).',
        },
      ],
    },
  ],

  supervisor: [
    {
      heading: 'Monitoramento da Equipe',
      items: [
        {
          icon: 'users', color: '#10B981',
          title: 'Módulo Equipe',
          description: 'Acesse pelo menu inferior. Veja a lista completa de agentes do município com total de vistorias realizadas no mês e progresso em relação à meta. Toque em um agente para ver o histórico completo de vistorias dele, incluindo laudos e relatórios gerados.',
        },
        {
          icon: 'trending-up', color: '#3B82F6',
          title: 'Ranking do Dashboard',
          description: 'O dashboard exibe automaticamente o ranking de produtividade dos agentes do mês atual. A barra de progresso mostra o avanço de cada agente em relação à meta mensal (padrão: 10 vistorias). Agentes sem vistorias no mês aparecem no final.',
        },
        {
          icon: 'alert-triangle', color: '#EF4444',
          title: 'Alertas de alto risco',
          description: 'Quando há vistorias com risco R3 ou R4 no município, um banner vermelho aparece no topo do dashboard com o total de alertas críticos. Toque no banner para ir ao mapa e localizar as edificações de risco. Priorize o acompanhamento dessas ocorrências.',
        },
      ],
    },
    {
      heading: 'Gestão de Operações',
      items: [
        {
          icon: 'calendar', color: '#8B5CF6',
          title: 'Criando agendamentos',
          description: 'Vá em Agendamentos → "+" para criar um novo. Informe o endereço, selecione o agente responsável, defina a data e hora e adicione observações se necessário. O agente recebe uma notificação push imediata e o agendamento aparece destacado na tela dele.',
        },
        {
          icon: 'send', color: '#F97316',
          title: 'Atribuindo vistorias',
          description: 'Dentro de qualquer vistoria existente, você pode reatribuí-la a outro agente ou adicionar observações. Use essa função para redistribuir carga de trabalho quando um agente está sobrecarregado ou para corrigir atribuições equivocadas.',
        },
        {
          icon: 'clock', color: '#06B6D4',
          title: 'Acompanhando pendências',
          description: 'O número no ícone de calendário do header mostra agendamentos que ainda não foram iniciados pelos agentes. Use o módulo de Agendamentos para verificar quais estão em atraso e entrar em contato com o agente responsável.',
        },
      ],
    },
    {
      heading: 'Análise e Mapa',
      items: [
        {
          icon: 'map', color: '#10B981',
          title: 'Mapa Tático',
          description: 'Visualize todas as vistorias do município em mapa interativo. Os pins mudam de cor conforme o risco. Use os filtros para selecionar por período, nível de risco ou agente. Toque em um pin para ver o endereço e acessar o detalhe da vistoria.',
        },
        {
          icon: 'clipboard', color: '#F59E0B',
          title: 'Inspeções',
          description: 'Acesse todas as vistorias do município, não apenas as suas. Filtre por agente, data ou nível de risco. Dentro de cada vistoria você pode visualizar o laudo técnico e relatório completo gerado pelo agente de campo.',
        },
        {
          icon: 'bar-chart-2', color: '#06B6D4',
          title: 'Estatísticas do mês',
          description: 'O dashboard exibe KPIs em tempo real: total de vistorias, casos críticos (R3/R4) e total de agentes ativos. Esses números são atualizados a cada acesso à tela. Puxe para baixo para forçar atualização.',
        },
      ],
    },
    {
      heading: 'Uso Offline',
      items: [
        {
          icon: 'wifi-off', color: '#F59E0B',
          title: 'Limitações sem internet',
          description: 'Sem conexão, os dados de equipe, mapa e agendamentos de outros agentes ficam indisponíveis. Suas vistorias pessoais de campo e agendamentos já carregados continuam acessíveis. Um banner amarelo indica o modo offline ativo.',
        },
      ],
    },
  ],

  admin: [
    {
      heading: 'Gestão de Usuários',
      items: [
        {
          icon: 'users', color: '#10B981',
          title: 'Módulo Usuários',
          description: 'Acesse pelo painel admin. Veja todos os usuários do município (agentes, supervisores). A aba "Pendentes" lista contas que ainda não foram aprovadas. Use o toggle ao lado de cada usuário para aprovar ou bloquear o acesso. Bloqueados não conseguem fazer login.',
        },
        {
          icon: 'key', color: '#8B5CF6',
          title: 'Gerando tokens de convite',
          description: 'Vá em Tokens → "+" para gerar um novo código de convite. Selecione a role do novo usuário (Agente ou Supervisor), defina o prazo de validade e compartilhe o código. O usuário usa esse código no cadastro. Você tem um limite mensal exibido na tela de geração.',
        },
        {
          icon: 'shield', color: '#3B82F6',
          title: 'Aprovação de administradores',
          description: 'Contas com role "Administrador" criadas via token ficam com acesso bloqueado até que o Master Admin aprove manualmente. Agentes e Supervisores são aprovados automaticamente ao se cadastrar com token válido.',
        },
        {
          icon: 'users', color: '#F97316',
          title: 'Grupos de trabalho',
          description: 'Organize agentes em grupos para facilitar a supervisão por região ou especialidade. Acesse em Grupos no menu admin. Crie um grupo, dê um nome, e adicione os agentes desejados. Supervisores podem filtrar vistorias por grupo.',
        },
      ],
    },
    {
      heading: 'Análise e Relatórios',
      items: [
        {
          icon: 'bar-chart-2', color: '#06B6D4',
          title: 'Relatórios gerenciais',
          description: 'Acesse pelo menu admin → Relatórios. Filtre vistorias por período, agente ou nível de risco. Exporte em PDF para relatórios formais ou compartilhe o arquivo diretamente. Os dados refletem todas as vistorias do seu município.',
        },
        {
          icon: 'clipboard', color: '#F59E0B',
          title: 'Todas as inspeções',
          description: 'Como administrador, você vê todas as vistorias de todos os agentes do município — não apenas as suas. Acesse laudos e relatórios de qualquer vistoria. Use os filtros para localizar vistorias específicas por endereço, agente ou data.',
        },
        {
          icon: 'pie-chart', color: '#8B5CF6',
          title: 'Estatísticas',
          description: 'O módulo Estatísticas (menu admin) exibe gráficos de distribuição de risco, evolução mensal de vistorias e comparativo entre agentes. Use para identificar tendências e áreas com concentração de risco no município.',
        },
        {
          icon: 'activity', color: '#EF4444',
          title: 'Logs de auditoria',
          description: 'Registra todas as ações administrativas: aprovações de usuário, tokens gerados, logins com falha e sincronizações. Acesse em Logs no menu admin. Cada entrada mostra data, hora, usuário responsável e detalhe da ação.',
        },
      ],
    },
    {
      heading: 'Formulários e Configurações',
      items: [
        {
          icon: 'edit-3', color: '#F97316',
          title: 'Editor de formulários',
          description: 'Personalize os formulários de vistoria para o seu município. Adicione, edite ou remova perguntas, ajuste pesos de pontuação por resposta e defina quais perguntas são obrigatórias. As mudanças valem para novas vistorias imediatamente.',
        },
        {
          icon: 'sliders', color: '#10B981',
          title: 'Configuração de risco',
          description: 'Defina os limites de pontuação que determinam cada nível de risco (R1, R2, R3, R4) para o seu município. Ajuste conforme a realidade local das edificações. Alterações afetam apenas novas vistorias — vistorias existentes mantêm a classificação original.',
        },
        {
          icon: 'hash', color: '#94A3B8',
          title: 'Protocolo dos laudos',
          description: 'O número de protocolo segue o formato TCS-CIDADE-AAAAMMDD-CÓDIGO. O código final é gerado automaticamente e é único por vistoria. Acesse o Guia de Protocolo no dashboard para ver a explicação completa de cada campo.',
        },
      ],
    },
    {
      heading: 'Limites e Suporte',
      items: [
        {
          icon: 'info', color: '#94A3B8',
          title: 'Limite mensal de tokens',
          description: 'Cada administrador tem uma cota mensal de tokens definida pelo Master Admin (padrão: 20). Ao atingir o limite, a geração fica bloqueada até o próximo mês ou até o Master Admin aumentar sua cota. O limite atual aparece na tela de geração de token.',
        },
      ],
    },
  ],

  master_admin: [
    {
      heading: 'Visão Global do Sistema',
      items: [
        {
          icon: 'activity', color: '#8B5CF6',
          title: 'Dashboard global',
          description: 'Seu painel exibe KPIs de todo o sistema: total de vistorias, edificações de alto risco, total de usuários ativos e número de municípios cadastrados. O ranking global mostra os agentes mais produtivos do mês em todos os municípios. Puxe para atualizar.',
        },
        {
          icon: 'map-pin', color: '#10B981',
          title: 'Municípios',
          description: 'Acesse pelo menu master. Cadastre novos municípios informando nome e UF. Cada município opera de forma independente com seus próprios administradores, equipes e formulários. O total de vistorias por município aparece no ranking do dashboard.',
        },
        {
          icon: 'alert-triangle', color: '#EF4444',
          title: 'Distribuição de risco',
          description: 'Toque no card "Distribuição de Risco" do dashboard para ver um ranking de municípios por concentração de casos R3/R4. Identifique rapidamente quais regiões estão com maior incidência de risco e priorize ações de suporte.',
        },
      ],
    },
    {
      heading: 'Gestão de Usuários e Acesso',
      items: [
        {
          icon: 'users', color: '#3B82F6',
          title: 'Usuários globais',
          description: 'Visualize todos os usuários do sistema sem filtro de município. Aprove ou bloqueie qualquer conta. A aba "Pendentes" lista administradores aguardando sua aprovação — apenas você pode liberar contas com role Admin. Agentes e Supervisores são aprovados automaticamente.',
        },
        {
          icon: 'key', color: '#8B5CF6',
          title: 'Monitoramento de tokens',
          description: 'A tela de Tokens exibe todos os convites gerados por qualquer admin do sistema. A seção "Por Administrador" mostra a quota usada por cada admin (ex: 8/20 tokens). Você pode identificar admins abusando do limite e tomar ações. Você recebe notificação push a cada token gerado.',
        },
        {
          icon: 'shield', color: '#10B981',
          title: 'Aprovando administradores',
          description: 'Quando um novo admin se cadastra via token, a conta fica bloqueada (isApproved = false) automaticamente. Vá em Usuários → aba "Pendentes" → toque no toggle do admin para liberar o acesso. O admin recebe acesso imediato após a aprovação.',
        },
      ],
    },
    {
      heading: 'Dados e Auditoria',
      items: [
        {
          icon: 'clipboard', color: '#F59E0B',
          title: 'Inspeções globais',
          description: 'Acesse todas as vistorias do sistema sem filtro de município. Use os filtros da tela para segmentar por cidade, agente, período ou nível de risco. Você pode visualizar qualquer laudo ou relatório técnico de qualquer município.',
        },
        {
          icon: 'bar-chart-2', color: '#06B6D4',
          title: 'Relatórios globais',
          description: 'Exporte dados consolidados de todos os municípios. Filtre por período, município ou nível de risco. Os relatórios PDF incluem o logo oficial e protocolo. Útil para prestação de contas a órgãos estaduais e federais.',
        },
        {
          icon: 'activity', color: '#F97316',
          title: 'Logs do sistema',
          description: 'Auditoria completa de todas as ações administrativas do sistema: aprovações, bloqueios, tokens gerados, logins com falha, edições de formulário e sincronizações. Acesse em Logs no menu master. Cada entrada mostra timestamp, usuário, município e detalhe da ação.',
        },
        {
          icon: 'trash-2', color: '#EF4444',
          title: 'Exclusão de vistorias',
          description: 'Como Master Admin, você pode excluir vistorias de qualquer município diretamente do dashboard. Ao excluir, informe o motivo — ele é registrado automaticamente nos logs de auditoria. Use com cautela: a exclusão é irreversível.',
        },
      ],
    },
  ],
};

interface DashboardGuideProps {
  role: string;
  inline?: boolean;
}

export function DashboardGuide({ role, inline }: DashboardGuideProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  const sections = GUIDE_CONTENT[role] ?? GUIDE_CONTENT['agent'];

  const trigger = inline ? (
    <TouchableOpacity
      style={[
        styles.inlineTrigger,
        { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder },
      ]}
      onPress={() => setVisible(true)}
      activeOpacity={0.8}
    >
      <View style={[styles.inlineIcon, { backgroundColor: `${theme.primary}15` }]}>
        <Feather name="help-circle" size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.inlineTitle, { color: theme.text }]}>Guia do Sistema</Text>
        <Text style={[styles.inlineDesc, { color: theme.textSecondary }]}>Saiba como usar cada módulo do app</Text>
      </View>
      <Feather name="chevron-right" size={16} color={theme.textSecondary} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={[styles.trigger, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
      onPress={() => setVisible(true)}
      activeOpacity={0.75}
    >
      <Feather name="help-circle" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );
  return (
    <>
      {trigger}

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Guia do Sistema</Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  Como usar cada módulo do app
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {sections.map((section, si) => (
                <View key={si} style={{ marginBottom: 24 }}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    {section.heading.toUpperCase()}
                  </Text>
                  {section.items.map((item, ii) => (
                    <View
                      key={ii}
                      style={[styles.guideCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
                    >
                      <View style={[styles.guideIcon, { backgroundColor: `${item.color}15` }]}>
                        <Feather name={item.icon} size={18} color={item.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.guideTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.guideDesc, { color: theme.textSecondary }]}>{item.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: theme.border }]}>
                <Feather name="shield" size={14} color={theme.textSecondary} />
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                  TCS · Relatório de Risco
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inlineTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16,
  },
  inlineIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  inlineTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  inlineDesc: { fontSize: 12, fontWeight: '400' },
  trigger: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetContent: { padding: 20 },
  sectionHeading: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginBottom: 10, marginTop: 4,
  },
  guideCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  guideIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  guideTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  guideDesc: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, paddingTop: 16, marginTop: 8,
  },
  footerText: { fontSize: 12, fontWeight: '500' },
});
