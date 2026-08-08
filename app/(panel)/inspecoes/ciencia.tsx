import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useTheme } from '../../../context/ThemeContext';
import { SignaturePad } from '../../../components/SignaturePad';
import {
  AppHeader,
  Badge,
  Button,
  EmptyState,
  FormField,
  SectionHeader,
  StateBanner,
} from '../../../components/ui';
import { Spacing } from '../../../constants/Spacing';
import { TCSPalette } from '../../../constants/Colors';
import {
  INITIAL_ACKNOWLEDGEMENT_DECLARATION,
  AcknowledgementOutcome,
  LocalAcknowledgementEvent,
  LocalGeneratedDocument,
  SignatureStroke,
} from '../../../types/documentAcknowledgement';
import {
  getAcknowledgementEvent,
  getGeneratedDocument,
  listAcknowledgementEventsForDocument,
  retryAcknowledgementEvent,
} from '../../../utils/documentAcknowledgementDatabase';
import {
  createAcknowledgementEvent,
  appendAcknowledgementCorrection,
  createRemoteAcknowledgementLink,
  fetchRemoteAcknowledgementHistory,
  RemoteAcknowledgementHistoryEvent,
  syncPendingDocumentAcknowledgements,
  verifyDocumentIntegrity,
  remoteAcknowledgementUrl,
} from '../../../services/DocumentAcknowledgementService';
import {
  buildAcknowledgementReceiptHtml,
  buildCombinedDocumentHtml,
} from '../../../utils/acknowledgementReceiptBuilder';
import { formatarDataHora } from '../../../utils/htmlUtils';
import { safeBack } from '../../../utils/navigationUtils';

const OUTCOME_OPTIONS: Array<{ value: AcknowledgementOutcome; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { value: 'acknowledged', label: 'Ciente', icon: 'check-circle' },
  { value: 'refused', label: 'Recusa', icon: 'x-circle' },
  { value: 'unable_to_sign', label: 'Impossibilidade', icon: 'alert-circle' },
];

const OUTCOME_LABELS: Record<AcknowledgementOutcome, string> = {
  acknowledged: 'Ciência confirmada',
  refused: 'Recusa registrada',
  unable_to_sign: 'Impossibilidade de assinatura registrada',
};

const DOCUMENT_LABELS: Record<LocalGeneratedDocument['documentType'], string> = {
  report: 'Relatório de risco',
  technical_report: 'Laudo técnico',
  interdiction_term: 'Termo de interdição',
};

export default function ElectronicAcknowledgementScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const { profile } = useAuth();
  const { isOnlineReal } = useConnectivity();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [document, setDocument] = useState<LocalGeneratedDocument | null>(null);
  const [event, setEvent] = useState<LocalAcknowledgementEvent | null>(null);
  const [outcome, setOutcome] = useState<AcknowledgementOutcome>('acknowledged');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('Morador ou responsável');
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [signatureInteractionActive, setSignatureInteractionActive] = useState(false);
  const [includeWitness, setIncludeWitness] = useState(false);
  const [witnessName, setWitnessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [remoteHistory, setRemoteHistory] = useState<RemoteAcknowledgementHistoryEvent[]>([]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [sharingRemoteLink, setSharingRemoteLink] = useState(false);

  const reload = useCallback(() => {
    if (!documentId) return;
    const nextDocument = getGeneratedDocument(documentId);
    setDocument(nextDocument);
    setEvent(nextDocument ? listAcknowledgementEventsForDocument(nextDocument.id)[0] ?? null : null);
  }, [documentId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!documentId || !isOnlineReal) return;
    fetchRemoteAcknowledgementHistory(documentId).then(setRemoteHistory).catch(() => setRemoteHistory([]));
  }, [documentId, isOnlineReal, event?.syncStatus]);

  const handleSubmit = async () => {
    if (!document || !profile?.uid) {
      Alert.alert('Sessão necessária', 'Entre novamente para registrar a ciência.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createAcknowledgementEvent({
        documentId: document.id,
        outcome,
        declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
        declarationAccepted,
        recipientName,
        recipientRelationship: relationship,
        signatureStrokes: outcome === 'acknowledged' ? signature : null,
        reason: outcome === 'acknowledged' ? null : reason,
        witness: includeWitness && witnessName.trim()
          ? { name: witnessName.trim(), confirmation: 'present' }
          : null,
        witnessRequired: includeWitness,
        createdBy: profile.uid,
        trainingMode: document.trainingMode,
      });
      if (isOnlineReal && !document.trainingMode) {
        await syncPendingDocumentAcknowledgements();
      }
      setEvent(getAcknowledgementEvent(created.id));
      Alert.alert(
        document.trainingMode ? 'Treinamento registrado' : 'Ciência salva',
        isOnlineReal || document.trainingMode
          ? 'O resultado foi registrado. Confira o estado e o protocolo abaixo.'
          : 'A coleta está pendente de sincronização e ainda não possui protocolo definitivo.'
      );
    } catch (error) {
      Alert.alert('Não foi possível registrar', error instanceof Error ? error.message : 'Revise os dados e tente novamente.');
    } finally {
      setSubmitting(false);
      reload();
    }
  };

  const retrySync = async () => {
    if (!event || !isOnlineReal) return;
    retryAcknowledgementEvent(event.id);
    setSubmitting(true);
    await syncPendingDocumentAcknowledgements();
    setSubmitting(false);
    reload();
  };

  const shareReceipt = async (combined: boolean) => {
    if (!document || !event) return;
    if (combined && !(await verifyDocumentIntegrity(document))) {
      Alert.alert(
        'Exportação bloqueada',
        'O arquivo não está disponível ou diverge do hash desta versão. Ele não pode ser exportado como cópia do original.'
      );
      return;
    }
    const html = combined
      ? buildCombinedDocumentHtml(document.previewHtml, document, event)
      : buildAcknowledgementReceiptHtml(document, event);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: combined ? 'Documento e comprovante' : 'Comprovante de ciência',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF gerado', uri);
    }
  };

  const checkIntegrity = async () => {
    if (!document) return;
    const valid = await verifyDocumentIntegrity(document);
    Alert.alert(
      valid ? 'Integridade confirmada' : 'Falha de integridade',
      valid
        ? 'O arquivo confere com o hash preservado para esta versão.'
        : 'O arquivo não está disponível ou diverge do hash registrado. Ele não deve ser apresentado como original.'
    );
  };

  const shareRemoteLink = async () => {
    if (!document || document.trainingMode) return;
    if (!isOnlineReal) {
      Alert.alert('Conexão necessária', 'Conecte-se à internet para publicar o documento e gerar o link seguro.');
      return;
    }
    setSharingRemoteLink(true);
    try {
      const link = await createRemoteAcknowledgementLink(document);
      const url = remoteAcknowledgementUrl(link.token);
      await Share.share({
        title: 'TCS — ciência eletrônica',
        message: `Acesse o documento e registre sua ciência até ${formatarDataHora(link.expiresAt)}:\n${url}`,
      });
      Alert.alert('Link pronto', 'O link é individual, expira em 72 horas e deixa de funcionar depois do registro.');
    } catch (error) {
      Alert.alert('Não foi possível criar o link', error instanceof Error ? error.message : 'Tente novamente após sincronizar o documento.');
    } finally {
      setSharingRemoteLink(false);
      reload();
    }
  };

  const correctEvent = async (action: 'corrected' | 'invalidated') => {
    if (!event) return;
    setSubmitting(true);
    try {
      await appendAcknowledgementCorrection(event.id, action, correctionReason);
      setCorrectionReason('');
      setRemoteHistory(await fetchRemoteAcknowledgementHistory(event.documentId));
      Alert.alert('Histórico atualizado', 'A correção foi anexada sem alterar o evento original.');
    } catch (error) {
      Alert.alert('Correção não registrada', error instanceof Error ? error.message : 'Verifique sua permissão.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!document) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="file-text"
          title="Documento não encontrado"
          description="Esta versão não está disponível neste aparelho ou foi substituída."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const pending = event && event.syncStatus !== 'confirmed';
  const statusVariant = event?.syncStatus === 'confirmed' ? 'success' : event?.syncStatus === 'failed' ? 'error' : 'warning';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Ciência eletrônica"
        subtitle={`Versão ${document.documentVersion} · ${DOCUMENT_LABELS[document.documentType]}`}
        onBack={() => safeBack(`/(panel)/inspecoes/${document.vistoriaId}`)}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!signatureInteractionActive}
      >
        {document.trainingMode && (
          <StateBanner
            variant="warning"
            title="Modo de teste"
            description="Este registro não possui validade operacional."
          />
        )}

        <SectionHeader title="Documento apresentado" subtitle="Confira a versão antes de registrar a ciência" />
        <View style={[styles.preview, { borderColor: theme.border }]}>
          <WebView originWhitelist={['*']} source={{ html: document.previewHtml }} scrollEnabled nestedScrollEnabled />
        </View>
        <Button
          label="Verificar integridade desta versão"
          variant="secondary"
          onPress={checkIntegrity}
          iconLeft={<Feather name="shield" size={17} color={theme.primaryDark} />}
          fullWidth
        />
        {!event && !document.trainingMode && (
          <Button
            label="Enviar link para ciência"
            variant="secondary"
            onPress={shareRemoteLink}
            loading={sharingRemoteLink}
            disabled={!isOnlineReal}
            iconLeft={<Feather name="link" size={17} color={theme.primaryDark} />}
            fullWidth
          />
        )}

        {event ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Badge
              label={event.syncStatus === 'confirmed' ? 'Registro confirmado' : event.syncStatus === 'failed' ? 'Falha de sincronização' : 'Pendente de sincronização'}
              variant={statusVariant}
              showDot
            />
            <Text style={[styles.detail, { color: theme.text }]}>Resultado: {OUTCOME_LABELS[event.outcome]}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>Destinatário: {event.recipientName}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>Coleta: {formatarDataHora(event.occurredAtDevice)}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>Protocolo: {event.protocol || 'aguardando servidor'}</Text>
            {event.errorCode && <Text style={[styles.detail, { color: theme.error }]}>Erro: {event.errorCode}</Text>}
            {pending && event.syncStatus === 'failed' && (
              <Button
                label="Tentar sincronizar novamente"
                onPress={retrySync}
                disabled={!isOnlineReal}
                loading={submitting}
                fullWidth
              />
            )}
            <View style={styles.rowButtons}>
              <Button label="Comprovante" variant="secondary" onPress={() => shareReceipt(false)} style={styles.rowButton} />
              <Button label="Documento" variant="ghost" onPress={() => shareReceipt(true)} style={styles.rowButton} />
            </View>
            {remoteHistory.length > 1 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>HISTÓRICO DO REGISTRO</Text>
                {remoteHistory.map(item => (
                  <View key={item.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{item.event_kind} · {item.protocol}</Text>
                    {item.correction_reason && <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.correction_reason}</Text>}
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{formatarDataHora(item.recorded_at_server)}</Text>
                  </View>
                ))}
              </View>
            )}
            {event.syncStatus === 'confirmed' && profile?.role !== 'agent' && !document.trainingMode && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CORREÇÃO OU INVALIDAÇÃO</Text>
                <TextInput
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  placeholder="Motivo auditável"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                />
                <View style={styles.rowButtons}>
                  <TouchableOpacity disabled={submitting} onPress={() => correctEvent('corrected')} style={[styles.smallButton, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Anexar correção</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={submitting} onPress={() => correctEvent('invalidated')} style={[styles.smallButton, { borderColor: theme.error }]}>
                    <Text style={{ color: theme.error, fontWeight: '700' }}>Invalidar evento</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <SectionHeader title="Resultado da apresentação" subtitle="Selecione como o destinatário recebeu o documento" />
            <View style={styles.outcomes}>
              {OUTCOME_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: outcome === option.value }}
                  onPress={() => { setOutcome(option.value); setDeclarationAccepted(false); }}
                  style={[styles.outcomeButton, {
                    borderColor: outcome === option.value ? theme.primary : theme.border,
                    backgroundColor: outcome === option.value ? theme.secondary : theme.surface,
                  }]}
                >
                  <Feather name={option.icon} size={18} color={outcome === option.value ? theme.primary : theme.textSecondary} />
                  <Text style={{ color: outcome === option.value ? theme.primary : theme.text, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormField
              label="Nome do destinatário"
              required
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Nome completo do destinatário"
            />
            <FormField
              label="Relação com o atendimento"
              required
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Ex.: morador, proprietário ou responsável"
            />

            {outcome === 'acknowledged' ? (
              <>
                <View style={[styles.declaration, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
                  <Text style={[styles.declarationText, { color: theme.text }]}>{INITIAL_ACKNOWLEDGEMENT_DECLARATION.text}</Text>
                  <View style={styles.switchRow}>
                    <Switch value={declarationAccepted} onValueChange={setDeclarationAccepted} />
                    <Text style={[styles.switchLabel, { color: theme.text }]}>Confirmo que a declaração foi lida e aceita</Text>
                  </View>
                </View>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ASSINATURA DO DESTINATÁRIO</Text>
                <SignaturePad
                  value={signature}
                  onChange={setSignature}
                  color={theme.text}
                  borderColor={theme.border}
                  backgroundColor={theme.surfaceHighlight}
                  textColor={theme.textSecondary}
                  onInteractionChange={setSignatureInteractionActive}
                />
              </>
            ) : (
              <TextInput
                accessibilityLabel="Motivo"
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder={outcome === 'refused' ? 'Descreva a recusa' : 'Descreva a impossibilidade de assinatura'}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}
              />
            )}

            <View style={styles.switchRow}>
              <Switch value={includeWitness} onValueChange={setIncludeWitness} />
              <Text style={[styles.switchLabel, { color: theme.text }]}>Registrar testemunha presente</Text>
            </View>
            {includeWitness && (
              <TextInput
                value={witnessName}
                onChangeText={setWitnessName}
                placeholder="Nome da testemunha"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}
              />
            )}

            {!isOnlineReal && !document.trainingMode && (
              <StateBanner
                variant="warning"
                title="Registro offline"
                description="A ciência será salva neste aparelho. O protocolo definitivo será emitido após a sincronização."
              />
            )}
            <Button label="Registrar resultado" onPress={handleSubmit} loading={submitting} fullWidth />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  content: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[3] },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  preview: { height: 360, borderWidth: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF' },
  outcomes: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  outcomeButton: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  declaration: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  declarationText: { fontSize: 13, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  switchLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginBottom: 7 },
  primaryButton: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 16 },
  primaryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  outlineButton: { minHeight: 44, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginVertical: 10 },
  outlineButtonText: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 10 },
  status: { fontSize: 12, fontWeight: '900', marginBottom: 9 },
  detail: { fontSize: 13, marginBottom: 5 },
  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rowButton: { flex: 1 },
  smallButton: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 11, alignItems: 'center' },
});
