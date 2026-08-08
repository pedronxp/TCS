import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizarTexto, validarNome, validarMunicipio } from '../../../utils/validationUtils';
import { safeBack } from '../../../utils/navigationUtils';
import { normalizeCoordinatePair } from '../../../utils/coordinateUtils';
import {
  AppHeader,
  Button,
  Card,
  FlowProgress,
  FormField,
  SectionHeader,
  StateBanner,
} from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

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
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { trainingProfile } = useTraining();
  const activeProfile = trainingProfile || profile;
  const backFallback = trainingProfile ? '/(panel)/treinamento' : '/(panel)/inspecoes';
  const isMasterAdmin = activeProfile?.role === 'master_admin';
  const params = useLocalSearchParams<{
    agendamentoId?: string;
    ruaPreenchida?: string;
    latPreenchida?: string;
    lngPreenchida?: string;
    municipioPreenchido?: string;
  }>();

  const latPre = params.latPreenchida ? parseFloat(params.latPreenchida) : null;
  const lngPre = params.lngPreenchida ? parseFloat(params.lngPreenchida) : null;
  const coordsPreenchidas = normalizeCoordinatePair(latPre, lngPre);

  const [form, setForm] = useState<AddressForm>({
    cep: '', rua: params.ruaPreenchida ?? '', numero: '', bairro: '',
    municipio: params.municipioPreenchido || activeProfile?.municipio || '',
    responsavelNome: '',
    lat: coordsPreenchidas?.latitude ?? null,
    lng: coordsPreenchidas?.longitude ?? null,
    gpsAcuracia: null,
  });
  const [municipioOrigem, setMunicipioOrigem] = useState<'perfil' | 'gps' | 'cep' | 'manual'>('perfil');
  const [detectandoGps, setDetectandoGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);
  const cepRef = useRef<TextInput>(null);

  useEffect(() => {
    if (coordsPreenchidas) return;
    detectarGps();
  }, []);

  // Sincroniza municipio do profile quando carrega (caso profile chegue depois do mount)
  useEffect(() => {
    if (activeProfile?.municipio) {
      setForm(f => f.municipio ? f : { ...f, municipio: activeProfile.municipio });
    }
  }, [activeProfile?.municipio]);

  /** Reverse geocode via Nominatim (OpenStreetMap).
   * Tenta vários campos de bairro em ordem de prioridade para endereços BR.
   * zoom=16 retorna dados no nível de bairro (mais estável que zoom=18 no OSM BR).
   */
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DefesaCivilApp/1.0' } }
      );
      const json = await resp.json();
      const addr = json.address || {};

      // Rua: rejeitar valores genéricos que o Nominatim retorna no Brasil
      // (ex: "Logradouro", "Rua", "Avenida" sem nome real)
      const TERMOS_INVALIDOS_RUA = ['logradouro', 'rua', 'avenida', 'via', 'estrada', 'travessa', 'alameda', 'viela'];
      const ruaCandidata = addr.road || addr.pedestrian || addr.footway || addr.path || '';
      const rua = TERMOS_INVALIDOS_RUA.includes(ruaCandidata.toLowerCase().trim()) ? '' : ruaCandidata;

      // Bairro: no OSM Brasil, neighbourhood mapeia o bairro individual real.
      // suburb frequentemente retorna agrupamentos maiores (ex: "Zona Norte").
      // city_district e district são áreas administrativas, não bairros.
      const bairro =
        addr['neighbourhood'] ||
        addr['suburb'] ||
        addr['quarter'] ||
        addr['hamlet'] ||
        addr['village'] ||
        addr['city_district'] ||
        addr['district'] ||
        '';
      // Cidade/Município
      const cidade = addr.city || addr.town || addr.municipality || addr.county || '';

      setForm(f => ({
        ...f,
        rua: f.rua || rua,
        bairro: f.bairro || bairro,
        // Preenche município detectado pelo GPS para todos os roles
        municipio: cidade || f.municipio,
      }));
      if (cidade) setMunicipioOrigem('gps');
    } catch (_) {
      setGpsMessage('Não foi possível preencher o endereço automaticamente. Você pode informar os dados manualmente.');
    }
  };

  /** Obtém a coordenada GPS e autocompleta o endereço */
  const detectarGps = async () => {
    setDetectandoGps(true);
    setGpsMessage(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsMessage('Permissão de localização negada. Preencha o endereço manualmente para continuar.');
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 15000)),
      ]);
      const valid = normalizeCoordinatePair(loc.coords.latitude, loc.coords.longitude);
      if (!valid) {
        setGpsMessage('O GPS retornou coordenadas inválidas. Preencha o endereço manualmente para continuar.');
        return;
      }
      setForm(f => ({ ...f, lat: valid.latitude, lng: valid.longitude, gpsAcuracia: loc.coords.accuracy }));
      await reverseGeocode(valid.latitude, valid.longitude);
    } catch (e) {
      // Try last known position
      try {
        const last = await Location.getLastKnownPositionAsync();
        const valid = last ? normalizeCoordinatePair(last.coords.latitude, last.coords.longitude) : null;
        if (last && valid) {
          setForm(f => ({ ...f, lat: valid.latitude, lng: valid.longitude }));
          await reverseGeocode(valid.latitude, valid.longitude);
        } else {
          setGpsMessage('Não foi possível obter o GPS agora. Preencha o endereço manualmente para continuar.');
        }
      } catch (_) {
        setGpsMessage('Não foi possível obter o GPS agora. Preencha o endereço manualmente para continuar.');
      }
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
        const cidadeCep = json.localidade || '';
        setForm(f => ({
          ...f,
          rua: json.logradouro || f.rua,
          bairro: json.bairro || f.bairro,
          municipio: cidadeCep || f.municipio,
        }));
        if (cidadeCep) setMunicipioOrigem('cep');
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
    const municipioCheck = validarMunicipio(form.municipio);
    if (!municipioCheck.valido) {
      Alert.alert('Município inválido', municipioCheck.erro || 'Município não identificado. Contate um administrador.');
      return;
    }
    if (form.responsavelNome.trim()) {
      const nomeCheck = validarNome(form.responsavelNome, 'Nome do Morador');
      if (!nomeCheck.valido) {
        Alert.alert('Nome inválido', nomeCheck.erro || 'Verifique o nome informado.');
        return;
      }
    }
    // Sanitizar campos de texto livre antes de avançar
    const ruaLimpa = sanitizarTexto(form.rua).substring(0, 200);
    const bairroLimpo = sanitizarTexto(form.bairro).substring(0, 100);
    const responsavelLimpo = sanitizarTexto(form.responsavelNome).substring(0, 100);
    // Passa os dados para a próxima etapa via params
    router.push({
      pathname: '/(panel)/inspecoes/selecao-formulario',
      params: {
        cep: form.cep,
        rua: ruaLimpa,
        numero: form.numero.trim().substring(0, 20),
        bairro: bairroLimpo,
        municipio: sanitizarTexto(form.municipio).substring(0, 80),
        responsavelNome: responsavelLimpo,
        lat: form.lat?.toString() ?? '',
        lng: form.lng?.toString() ?? '',
        ...(params.agendamentoId ? { agendamentoId: params.agendamentoId } : {}),
      }
    });
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AppHeader
        title="Local e identificação"
        subtitle="Nova vistoria"
        onBack={() => safeBack(backFallback)}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <FlowProgress currentStep={1} totalSteps={3} label="Dados da ocorrência" />

        <SectionHeader
          title="Localização da ocorrência"
          subtitle="Use o GPS para registrar a posição e preencher o endereço"
        />
        <Card style={styles.locationCard}>
          <View style={styles.locationIntro}>
            <View style={[styles.locationIcon, { backgroundColor: theme.secondary }]}>
              <Feather name="navigation" size={22} color={theme.primary} />
            </View>
            <View style={styles.locationCopy}>
              <Text style={[styles.locationTitle, { color: theme.text }]}>Posição do aparelho</Text>
              <Text style={[styles.locationDescription, { color: theme.textSecondary }]}>Quanto maior a precisão, melhor o registro técnico.</Text>
            </View>
          </View>

          <Button
            label={form.lat !== null ? 'Atualizar localização' : 'Obter localização'}
            variant="secondary"
            onPress={detectarGps}
            loading={detectandoGps}
            iconLeft={<Feather name="crosshair" size={18} color={theme.primaryDark} />}
            fullWidth
          />

          {form.lat !== null && (
            <View style={styles.coordinateGrid}>
              <View style={[styles.coordinateCell, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.coordinateLabel, { color: theme.textSecondary }]}>Latitude</Text>
                <Text style={[styles.coordinateValue, { color: theme.text }]}>{form.lat.toFixed(6)}°</Text>
              </View>
              <View style={[styles.coordinateCell, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.coordinateLabel, { color: theme.textSecondary }]}>Longitude</Text>
                <Text style={[styles.coordinateValue, { color: theme.text }]}>{form.lng?.toFixed(6)}°</Text>
              </View>
            </View>
          )}
          {form.gpsAcuracia !== null && (
            <StateBanner
              variant={form.gpsAcuracia <= 20 ? 'success' : 'warning'}
              title={`Precisão de ±${Math.round(form.gpsAcuracia)} m`}
              description={form.gpsAcuracia <= 20 ? 'Sinal adequado para o registro.' : 'Se possível, aguarde em uma área aberta e atualize a localização.'}
            />
          )}
          {gpsMessage && (
            <StateBanner variant="warning" title="Localização não confirmada" description={gpsMessage} />
          )}
        </Card>

        <SectionHeader
          title="Endereço"
          subtitle="Confira os dados preenchidos automaticamente antes de avançar"
        />

        <View style={styles.cepRow}>
          <FormField
            ref={cepRef}
            label="CEP"
            placeholder="00000-000"
            keyboardType="numeric"
            returnKeyType="search"
            maxLength={9}
            value={form.cep}
            onChangeText={handleCepChange}
            onSubmitEditing={() => buscarCep()}
            error={erroCep ?? undefined}
            helperText="Opcional, mas ajuda no preenchimento"
            containerStyle={styles.cepField}
          />
          <Button
            label="Buscar"
            variant="secondary"
            onPress={() => buscarCep()}
            loading={buscandoCep}
            style={styles.cepButton}
          />
        </View>

        <FormField
          label="Logradouro"
          required
          placeholder="Rua, avenida ou travessa"
          value={form.rua}
          onChangeText={t => setForm(f => ({ ...f, rua: t }))}
          autoCapitalize="words"
        />

        <View style={styles.fieldRow}>
          <FormField
            label="Número"
            required
            placeholder="Nº ou s/n"
            value={form.numero}
            onChangeText={t => setForm(f => ({ ...f, numero: t }))}
            containerStyle={styles.numberField}
          />
          <FormField
            label="Bairro"
            required
            placeholder="Bairro"
            value={form.bairro}
            onChangeText={t => setForm(f => ({ ...f, bairro: t }))}
            autoCapitalize="words"
            containerStyle={styles.neighborhoodField}
          />
        </View>

        <FormField
          label="Município"
          required
          placeholder="Município da ocorrência"
          value={form.municipio}
          onChangeText={t => { setForm(f => ({ ...f, municipio: t })); setMunicipioOrigem('manual'); }}
          autoCapitalize="words"
          helperText={municipioOrigem === 'gps'
            ? 'Detectado pelo GPS — você pode corrigir'
            : municipioOrigem === 'cep'
              ? 'Preenchido pelo CEP — você pode corrigir'
              : municipioOrigem === 'perfil'
                ? 'Preenchido com o município do seu perfil'
                : 'Informado manualmente'}
        />
        {municipioOrigem !== 'manual' && form.municipio && profile?.municipio && form.municipio !== profile.municipio && (
          <StateBanner
            variant="warning"
            title="Município diferente do perfil"
            description={`Seu perfil está vinculado a ${profile.municipio}. Esta vistoria será registrada em ${form.municipio}.`}
          />
        )}

        <SectionHeader
          title="Pessoa de referência"
          subtitle="Informação opcional para identificar o atendimento"
        />
        <FormField
          label="Nome do morador ou responsável"
          placeholder="Informe somente o nome"
          value={form.responsavelNome}
          onChangeText={t => setForm(f => ({ ...f, responsavelNome: t }))}
          autoCapitalize="words"
          helperText="Não informe CPF ou outros documentos pessoais"
        />

      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
        <Button label="Cancelar" variant="ghost" onPress={() => safeBack(backFallback)} style={styles.cancelButton} />
        <Button
          label="Escolher formulário"
          onPress={avancar}
          disabled={buscandoCep}
          iconRight={<Feather name="arrow-right" size={18} color={theme.onPrimary} />}
          style={styles.nextButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  locationCard: { gap: Spacing[4] },
  locationIntro: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: SpacingAlias.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCopy: { flex: 1 },
  locationTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  locationDescription: { marginTop: 3, fontSize: FontSize.sm, lineHeight: 17 },
  coordinateGrid: { flexDirection: 'row', gap: Spacing[2] },
  coordinateCell: { flex: 1, borderRadius: SpacingAlias.radiusMd, padding: Spacing[3] },
  coordinateLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  coordinateValue: { marginTop: Spacing[1], fontSize: FontSize.base, fontWeight: FontWeight.bold },
  cepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2] },
  cepField: { flex: 1 },
  cepButton: { marginTop: 24 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  numberField: { flex: 2 },
  neighborhoodField: { flex: 3 },
  footer: { borderTopWidth: 1, padding: Spacing[4], flexDirection: 'row', gap: Spacing[2] },
  cancelButton: { flex: 1 },
  nextButton: { flex: 2 },
});
