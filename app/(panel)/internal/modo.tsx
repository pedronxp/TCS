import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { OwnerExperienceChoice } from '../../../components/OwnerExperienceChoice';
import { AppHeader, StateBanner } from '../../../components/ui';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
export default function OwnerModeScreen() {
  const { theme } = useTheme();
  const bottom = useBottomTabPadding();
  const { profile } = useAuth();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
    <AppHeader title="Modo do proprietário" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>{profile?.role === 'owner' ? <OwnerExperienceChoice /> : <StateBanner variant="warning" title="Acesso restrito" description="Esta preferência é exclusiva do proprietário." />}</ScrollView>
  </SafeAreaView>;
}
