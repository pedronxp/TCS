import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, Button, FormField, LoadingState, ErrorState } from '../../../components/ui';

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  waiting_customer: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

const EVENTO_LABEL: Record<string, string> = {
  message: 'Suporte TCS',
  customer_reply: 'Você',
  status: 'Atualização de status',
  priority: 'Prioridade alterada',
  assignee: 'Atendente designado',
};

interface Ticket {
  id: string;
  public_code: string | null;
  subject: string;
  description: string;
  status: string;
  created_at: string;
}

interface Evento {
  id: string;
  event_type: string;
  message: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: any;
}

export default function SuporteTicketScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data: tk, error: tkErr } = await supabase
        .from('support_tickets')
        .select('id, public_code, subject, description, status, created_at')
        .eq('id', id)
        .single();
      if (tkErr) throw tkErr;

      const { data: ev, error: evErr } = await supabase.rpc('my_ticket_events', { p_ticket_id: id });
      if (evErr) throw evErr;

      setTicket(tk as Ticket);
      setEventos((ev ?? []) as Evento[]);
    } catch {
      setErro('Não foi possível abrir o chamado.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const responder = async () => {
    if (resposta.trim().length < 2) return;
    setEnviando(true);
    try {
      const { error } = await supabase.rpc('reply_support_ticket', {
        p_ticket_id: id,
        p_message: resposta.trim(),
      });
      if (error) throw error;
      setResposta('');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível enviar a resposta.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) return <LoadingState message="Abrindo chamado..." />;
  if (erro || !ticket) return <ErrorState message={erro ?? 'Chamado não encontrado.'} onRetry={() => void carregar()} />;

  const fechado = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title={ticket.public_code ?? 'Chamado'}
          subtitle={ticket.subject}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.statusLinha}>
          <Badge label={STATUS_LABEL[ticket.status] ?? ticket.status} variant={fechado ? 'success' : 'warning'} size="sm" />
          <Text style={[styles.data, { color: theme.textSecondary }]}>
            Aberto em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>

        {/* Abertura */}
        <View style={[styles.bolha, styles.bolhaCliente, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.bolhaAutor, { color: theme.primary }]}>Você</Text>
          <Text style={[styles.bolhaTexto, { color: theme.text }]}>{ticket.description}</Text>
          <Text style={[styles.bolhaHora, { color: theme.textSecondary }]}>
            {new Date(ticket.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Timeline */}
        {eventos.filter(e => e.message).map(e => {
          const ehCliente = e.event_type === 'customer_reply' || e.actor_id === profile?.uid;
          return (
            <View
              key={e.id}
              style={[
                styles.bolha,
                ehCliente
                  ? [styles.bolhaCliente, { backgroundColor: theme.secondary }]
                  : [styles.bolhaSuporte, { backgroundColor: theme.surface, borderColor: theme.border }],
              ]}
            >
              <Text style={[styles.bolhaAutor, { color: ehCliente ? theme.primary : theme.textSecondary }]}>
                {EVENTO_LABEL[e.event_type] ?? 'Atualização'}
              </Text>
              <Text style={[styles.bolhaTexto, { color: theme.text }]}>{e.message}</Text>
              <Text style={[styles.bolhaHora, { color: theme.textSecondary }]}>
                {new Date(e.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}

        {fechado ? (
          <View style={[styles.avisoFechado, { borderColor: theme.border }]}>
            <Feather name="check-circle" size={16} color={theme.success} />
            <Text style={[styles.avisoFechadoTexto, { color: theme.textSecondary }]}>
              Este chamado foi {STATUS_LABEL[ticket.status].toLowerCase()}. Se o problema voltar, responda abaixo para reabri-lo.
            </Text>
          </View>
        ) : null}

        <View style={[styles.formResposta, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <FormField
            label="Responder"
            value={resposta}
            onChangeText={setResposta}
            placeholder="Escreva sua mensagem para o suporte..."
            multiline
            inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Button
            label="Enviar resposta"
            onPress={() => void responder()}
            loading={enviando}
            disabled={resposta.trim().length < 2}
            fullWidth
            iconLeft={<Feather name="send" size={16} color="#FFFFFF" />}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  statusLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  data: { fontSize: 12 },
  bolha: { borderRadius: 14, padding: 12, gap: 4, maxWidth: '92%' },
  bolhaCliente: { alignSelf: 'flex-end' },
  bolhaSuporte: { alignSelf: 'flex-start', borderWidth: 1 },
  bolhaAutor: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  bolhaTexto: { fontSize: 14, lineHeight: 20 },
  bolhaHora: { fontSize: 10, marginTop: 2 },
  avisoFechado: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderTopWidth: 1, paddingTop: 12 },
  avisoFechadoTexto: { flex: 1, fontSize: 12, lineHeight: 17 },
  formResposta: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, marginTop: 6 },
});
