import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

/** Estado interno do formulário de endereço */
interface AddressForm {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  municipio: string;
  responsavelNome: string;
  lat: number | null;
  lng: number | null;
  gpsAcuracia: number | null;
}

export default function DadosIniciaisScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isMasterAdmin = profile?.role === 'master_admin';

  const [form, setForm] = useState<AddressForm>({
    cep: '', rua: '', numero: '', bairro: '',
    municipio: (!isMasterAdmin && profile?.municipio) ? profile.municipio : '',
    responsavelNome: '', lat: null, lng: null, gpsAcuracia: null,
  });
  const [detectandoGps, setDetectandoGps] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const cepRef = useRef<TextInput>(null);

  useEffect(() => {
    detectarGps();
  }, []);

  // Sincroniza municipio do profile quando carrega (caso profile chegue depois do mount)
  useEffect(() => {
    if (!isMasterAdmin && profile?.municipio) {
      setForm(f => f.municipio ? f : { ...f, municipio: profile.municipio });
    }
  }, [profile?.municipio]);

  /** Reverse geocode via Nominatim (OpenStreetMap).
   * Tenta vários campos de bairro em ordem de prioridade para endereços BR.
   */
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DefesaCivilApp/1.0' } }
      );
      const json = await resp.json();
      const addr = json.address || {};

      // Rua: priority order
      const rua = addr.road || addr.pedestrian || addr.footway || addr.path || '';
      // Bairro: tenta em ordem de especificidade para BR
      // Nominatim BR: o campo correto geralmente é city_district ou suburb
      const bairro =
        addr['city_district'] ||
        addr['district'] ||
        addr['neighbourhood'] ||
        addr['quarter'] ||
        addr['suburb'] ||
        addr['hamlet'] ||
        addr['village'] ||
        '';
      // Cidade/Município (só para master_admin)
      const cidade = addr.city || addr.town || addr.municipality || addr.county || '';

      setForm(f => ({
        ...f,
        rua: f.rua || rua,
        bairro: f.bairro || bairro,
        // Master admin: preenche cidade automaticamente pelo GPS
        municipio: isMasterAdmin && !f.municipio ? cidade : f.municipio,
      }));
    } catch (_) { /* Silently ignore */ }
  };

  /** Obtém a coordenada GPS e autocompleta o endereço */
  const detectarGps = async () => {
    setDetectandoGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS negado', 'Permissão de localização é necessária para preencher o endereço automaticamente.');
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 15000)),
      ]);
      setForm(f => ({ ...f, lat: loc.coords.latitude, lng: loc.coords.longitude, gpsAcuracia: loc.coords.accuracy }));
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      // Try last known position
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setForm(f => ({ ...f, lat: last.coords.latitude, lng: last.coords.longitude }));
          await reverseGeocode(last.coords.latitude, last.coords.longitude);
        }
      } catch (_) {}
    } finally {
      setDetectandoGps(false);
    }
  };

  /** Busca endereço pelo CEP via ViaCEP */
  const buscarCep = async (cepOverride?: string) => {
    const cepLimpo = (cepOverride ?? form.cep).replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setErroCep('CEP deve ter 8 dígitos.');
      return;
    }
    setErroCep(null);
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const json = await resp.json();
      if (json.erro) {
        setErroCep('CEP não encontrado');
      } else {
        setForm(f => ({
          ...f,
          rua: json.logradouro || f.rua,
          bairro: json.bairro || f.bairro,
        }));
      }
    } catch {
      setErroCep('Erro ao consultar CEP. Verifique sua conexão.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleCepChange = (t: string) => {
    const limpo = t.replace(/\D/g, '').substring(0, 8);
    const formatado = limpo.length > 5 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : limpo;
    setForm(f => ({ ...f, cep: formatado }));
    setErroCep(null);
    if (limpo.length === 8) buscarCep(formatado);
  };

  const avancar = () => {
    if (!form.rua.trim() || !form.numero.trim() || !form.bairro.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha Logradouro, Número e Bairro para continuar.');
      return;
    }
    if (!form.municipio.trim()) {
      Alert.alert(
        'Município não identificado',
        'Seu perfil não possui município associado. Contate um administrador para vincular seu município.',
      );
      return;
    }
    // Passa os dados para a próxima etapa via params
    router.push({
      pathname: '/(panel)/inspecoes/selecao-formulario',
      params: {
        cep: form.cep,
        rua: form.rua,
        numero: form.numero,
        bairro: form.bairro,
        municipio: form.municipio,
        responsavelNome: form.responsavelNome,
        lat: form.lat?.toString() ?? '',
        lng: form.lng?.toString() ?? '',
      }
    });
  };

  // ─── UI helpers ─────────────────────────────────────────────────────────────
  const inputStyle = [styles.input, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, color: theme.text }];

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={() => router.back()}>
          <Feather name="x" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>PASSO 1 DE 3</Text>
          <Text style={[styles.title, { color: theme.text }]}>Local e Identificação</Text>
        </View>
      </View>

      {/* Progress bar (1/3) */}
      <View style={[styles.progressTrack, { backgroundColor: theme.cardBorder }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '33%' }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* GPS SECTION */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>COORDENADAS ALVO</Text>
        <View style={[styles.gpsCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.gpsButton, { borderColor: theme.primary }]}
            onPress={detectarGps}
            disabled={detectandoGps}
          >
            {detectandoGps
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Feather name="navigation" size={16} color={theme.primary} />}
            <Text style={[styles.gpsButtonText, { color: theme.primary }]}>
              {detectandoGps ? 'BUSCANDO SINAL...' : 'ATUALIZAR GPS'}
            </Text>
          </TouchableOpacity>

          {form.lat !== null && (
            <View style={[styles.coordRow, { backgroundColor: theme.iconBackground }]}>
              <View>
                <Text style={[styles.coordLabel, { color: theme.textSecondary }]}>LATITUDE</Text>
                <Text style={[styles.coordValue, { color: theme.text }]}>{form.lat.toFixed(6)}°</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.coordLabel, { color: theme.textSecondary }]}>LONGITUDE</Text>
                <Text style={[styles.coordValue, { color: theme.text }]}>{form.lng?.toFixed(6)}°</Text>
              </View>
            </View>
          )}
          {form.gpsAcuracia !== null && (
            <Text style={[styles.accuracy, { color: form.gpsAcuracia <= 20 ? '#10B981' : form.gpsAcuracia <= 50 ? '#F59E0B' : '#EF4444' }]}>
              Precisão: ±{Math.round(form.gpsAcuracia)}m
            </Text>
          )}
        </View>

        {/* ADDRESS SECTION */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ENDEREÇO DA OCORRÊNCIA</Text>

        {/* CEP row */}
        <View style={styles.row}>
          <View style={{ flex: 3 }}>
            <TextInput
              ref={cepRef}
              style={[inputStyle, erroCep ? { borderColor: '#EF4444' } : null]}
              placeholder="CEP (ex: 12345-678)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              maxLength={9}
              value={form.cep}
              onChangeText={handleCepChange}
            />
            {erroCep !== null && erroCep.length > 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
                padding: 12, gap: 8, marginTop: 8,
              }}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 14, flex: 1 }}>{erroCep}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.cepButton, { backgroundColor: theme.iconBackground, borderColor: theme.primary }]}
            onPress={buscarCep}
            disabled={buscandoCep}
          >
            {buscandoCep
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Text style={[styles.cepButtonText, { color: theme.primary }]}>BUSCAR</Text>}
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Logradouro *</Text>
        <TextInput style={inputStyle} placeholder="Rua, Avenida, Travessa..." placeholderTextColor={theme.textSecondary} value={form.rua} onChangeText={t => setForm(f => ({ ...f, rua: t }))} />

        <View style={[styles.row, { marginTop: 12 }]}>
          <View style={{ flex: 2 }}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Número *</Text>
            <TextInput style={inputStyle} placeholder="Nº" placeholderTextColor={theme.textSecondary} keyboardType="numeric" value={form.numero} onChangeText={t => setForm(f => ({ ...f, numero: t }))} />
          </View>
          <View style={{ flex: 3, marginLeft: 12 }}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bairro *</Text>
            <TextInput style={inputStyle} placeholder="Bairro" placeholderTextColor={theme.textSecondary} value={form.bairro} onChangeText={t => setForm(f => ({ ...f, bairro: t }))} />
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Município {isMasterAdmin ? '(editável para master admin)' : '(automático)'}</Text>
        {isMasterAdmin ? (
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, color: theme.text }]}
            placeholder="Digite o município"
            placeholderTextColor={theme.textSecondary}
            value={form.municipio}
            onChangeText={t => setForm(f => ({ ...f, municipio: t }))}
          />
        ) : (
          <View style={[styles.input, styles.readonlyField, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
            <Text style={{ color: theme.textSecondary, flex: 1 }}>{form.municipio || 'Carregando...'}</Text>
            <Feather name="lock" size={14} color={theme.textSecondary} />
          </View>
        )}

        {/* RESPONSIBLE */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 24 }]}>IDENTIFICAÇÃO (OPCIONAL)</Text>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nome do Morador / Síndico</Text>
        <TextInput style={inputStyle} placeholder="Sem CPF — somente nome" placeholderTextColor={theme.textSecondary} value={form.responsavelNome} onChangeText={t => setForm(f => ({ ...f, responsavelNome: t }))} />

      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: theme.textSecondary }]}>CANCELAR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.primary }]} onPress={avancar} disabled={detectandoGps || buscandoCep}>
          <Text style={styles.nextBtnText}>AVANÇAR</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1 },
  closeBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  gpsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  gpsButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, justifyContent: 'center' },
  gpsButtonText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  coordRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, padding: 12 },
  coordLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  coordValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  accuracy: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  input: { height: 60, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontWeight: '500' },
  readonlyField: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  cepButton: { flex: 2, height: 60, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cepButtonText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nextBtn: { flex: 2, height: 56, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
