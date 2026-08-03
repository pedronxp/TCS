import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, StateBanner } from '../../../components/ui';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Por que aparece "SEMCIDADE" no protocolo?',
    a: 'O município não foi informado durante o preenchimento da vistoria. Verifique os dados da inspeção e corrija o campo Município. Vistorias legadas sem município salvo manterão este valor.',
  },
  {
    q: 'Os 4 caracteres finais são aleatórios?',
    a: 'Não. Eles são derivados do ID interno único da vistoria (UUID). Isso garante que o mesmo registro sempre gere o mesmo protocolo, mesmo se gerado em dispositivos diferentes.',
  },
  {
    q: 'Posso usar o protocolo para pesquisar uma vistoria?',
    a: 'Sim. Na lista de inspeções e no Laudo Técnico, o número de protocolo completo é exibido. Em versões futuras, haverá campo de busca por protocolo.',
  },
  {
    q: 'Por que as letras I, O, 0 e 1 não aparecem no hash?',
    a: 'Para evitar confusão visual entre "I" (i maiúsculo) e "l" (l minúsculo), e entre "O" (letra) e "0" (zero). Todos os caracteres usados são visualmente distintos.',
  },
  {
    q: 'O protocolo muda se eu editar a vistoria?',
    a: 'Não. O protocolo é gerado uma única vez com base no ID imutável da vistoria e sua data. Edições nos campos não alteram o protocolo.',
  },
  {
    q: 'Posso ter dois protocolos iguais?',
    a: 'É muito improvável, mas um hash curto não elimina matematicamente a possibilidade de colisão. O sistema combina cidade, data e 4 caracteres derivados do UUID para reduzir esse risco; a unicidade definitiva deve ser validada no armazenamento.',
  },
];

function FaqCard({ item }: { item: FaqItem }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
      onPress={() => setOpen(o => !o)}
      activeOpacity={0.8}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQ, { color: theme.text, flex: 1 }]}>{item.q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: theme.textSecondary }]}>{item.a}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ProtocoloDocScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Protocolo documental"
          subtitle="Identificação oficial das vistorias"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>

        <StateBanner
          title="Identificador permanente"
          description="O protocolo é criado ao concluir a vistoria e não muda quando o conteúdo do documento é editado."
          variant="info"
        />

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.cardTitleRow}>
            <Feather name="file-text" size={16} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>O que é o Protocolo?</Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            O protocolo é o número oficial de identificação de cada vistoria registrada no sistema TCS. Ele aparece no Laudo Técnico, no Relatório de Vistoria e no Termo de Interdição.{'\n\n'}
            Cada vistoria tem um protocolo único, gerado automaticamente no momento em que a inspeção é concluída.
          </Text>
        </View>

        {/* Anatomia do protocolo */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Anatomia do protocolo</Text>

        <View style={[styles.protoBox, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.protoPartes}>
            <View style={[styles.protoParte, { backgroundColor: theme.primary }]}>
              <Text style={styles.protoParteText}>TCS</Text>
            </View>
            <Text style={[styles.protoDivider, { color: theme.textSecondary }]}>—</Text>
            <View style={[styles.protoParte, { backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }]}>
              <Text style={[styles.protoParteText, { color: theme.primary }]}>CAMPINAS</Text>
            </View>
            <Text style={[styles.protoDivider, { color: theme.textSecondary }]}>—</Text>
            <View style={[styles.protoParte, { backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }]}>
              <Text style={[styles.protoParteText, { color: theme.primary }]}>20260402</Text>
            </View>
            <Text style={[styles.protoDivider, { color: theme.textSecondary }]}>—</Text>
            <View style={[styles.protoParte, { backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }]}>
              <Text style={[styles.protoParteText, { color: theme.primary }]}>K7MP</Text>
            </View>
          </View>

          {/* Legenda */}
          {[
            { cor: theme.primary, label: 'TCS', desc: 'Prefixo fixo do sistema (Technical Civil Survey)' },
            { cor: theme.primary, label: 'CIDADE', desc: 'Município da vistoria — sem acentos, espaços ou caracteres especiais' },
            { cor: theme.primary, label: 'DATA', desc: 'Data da vistoria no formato AAAAMMDD (ordenável cronologicamente)' },
            { cor: theme.primary, label: 'HASH', desc: '4 caracteres derivados do ID interno. Sem letras I, O nem dígitos 0 e 1' },
          ].map(({ cor, label, desc }) => (
            <View key={label} style={[styles.legendRow, { borderTopColor: theme.border }]}>
              <View style={[styles.legendDot, { backgroundColor: cor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.legendLabel, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.legendDesc, { color: theme.textSecondary }]}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Exemplos reais */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Exemplos</Text>
        {[
          { proto: 'TCS-CAMPINAS-20260402-K7MP', desc: 'Vistoria em Campinas, dia 02/04/2026' },
          { proto: 'TCS-SAOPAULO-20260315-X3NR', desc: 'Vistoria em São Paulo, dia 15/03/2026' },
          { proto: 'TCS-RIOJANEIRO-20260101-B9QA', desc: 'Vistoria no Rio de Janeiro, dia 01/01/2026' },
          { proto: 'TCS-SEMCIDADE-20260210-M4LF', desc: '⚠ Município não informado — verifique os dados da vistoria' },
        ].map(({ proto, desc }) => {
          const warning = proto.includes('SEMCIDADE');
          return (
          <View key={proto} style={[styles.exampleCard, { backgroundColor: warning ? theme.warningLight : theme.surface, borderColor: warning ? theme.warning : theme.cardBorder }]}>
            <Text style={[styles.exampleProto, { color: warning ? theme.warning : theme.primary }]}>{proto}</Text>
            <Text style={[styles.exampleDesc, { color: theme.textSecondary }]}>{desc}</Text>
          </View>
        );})}

        {/* Caracteres permitidos no hash */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.cardTitleRow}>
            <Feather name="key" size={16} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Caracteres do Hash (HASH)</Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            O hash usa apenas os 32 caracteres abaixo — todos visualmente distintos:
          </Text>
          <View style={[styles.charBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.charText, { color: theme.primary }]}>
              A B C D E F G H J K L M N P Q R S T U V W X Y Z{'\n'}2 3 4 5 6 7 8 9
            </Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary, marginTop: 8 }]}>
            Letras removidas: <Text style={{ fontWeight: '700' }}>I</Text> (confunde com l) e <Text style={{ fontWeight: '700' }}>O</Text> (confunde com 0){'\n'}
            Dígitos removidos: <Text style={{ fontWeight: '700' }}>0</Text> (confunde com O) e <Text style={{ fontWeight: '700' }}>1</Text> (confunde com I)
          </Text>
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Perguntas Frequentes</Text>
        {FAQS.map((f, i) => <FaqCard key={i} item={f} />)}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60, gap: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 12, marginTop: 24,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 22 },
  // Protocolo visual
  protoBox: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 12 },
  protoPartes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18, alignItems: 'center' },
  protoParte: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  protoParteText: { color: '#FFF', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  protoDivider: { fontSize: 16, fontWeight: '800' },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  legendLabel: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  legendDesc: { fontSize: 13, lineHeight: 19 },
  // Exemplos
  exampleCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  exampleProto: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'monospace', marginBottom: 4 },
  exampleDesc: { fontSize: 12 },
  // Chars
  charBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 10 },
  charText: { fontSize: 13, fontWeight: '700', lineHeight: 22, letterSpacing: 2 },
  // FAQ
  faqCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 8 },
  faqHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  faqQ: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  faqA: { fontSize: 13, lineHeight: 21, marginTop: 10 },
});
