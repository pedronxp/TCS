import { View, Text, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';

export default function WelcomeScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center', paddingBottom: 120 }}>
        {/* Shield icon replacing logo.png */}
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <Feather name="shield" size={72} color="#FFFFFF" />
        </View>

        <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1, color: theme.text, marginBottom: 8 }}>
          Defesa Civil
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 24, textAlign: 'center', color: theme.textSecondary, marginBottom: 80 }}>
          Sistema de Vistoria Técnica de Risco
        </Text>

        <View style={{ width: '100%', gap: 16 }}>
          <Button
            variant="primary"
            label="Entrar"
            onPress={() => router.push('/(auth)/login')}
          />
          <Button
            variant="secondary"
            label="Validar Token de Acesso"
            onPress={() => router.push('/(auth)/register')}
          />
        </View>
      </View>

      {/* Absolute footer */}
      <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Feather name="lock" size={14} color={theme.textSecondary} />
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>Acesso restrito a agentes credenciados</Text>
      </View>
    </SafeAreaView>
  );
}
