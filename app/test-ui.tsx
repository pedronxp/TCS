import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../components/ui';
import { BottomNavBarInner } from '../components/BottomNavBar';

export default function TestUIScreen() {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const toggleLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'UI Sandbox (Teste)', headerBackTitle: 'Voltar' }} />
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        
        <SectionHeader title="Buttons" actionLabel="Toggle Loading" onAction={toggleLoading} />
        <Card style={styles.section}>
          <Button label="Primary Button" onPress={() => {}} loading={isLoading} style={styles.margin} />
          <Button label="Secondary Button" variant="secondary" onPress={() => {}} loading={isLoading} style={styles.margin} />
          <Button label="Ghost Button" variant="ghost" onPress={() => {}} loading={isLoading} style={styles.margin} />
          <Button label="Danger Button" variant="danger" onPress={() => {}} loading={isLoading} style={styles.margin} />
          <Button label="Disabled Button" disabled onPress={() => {}} style={styles.margin} />
        </Card>

        <SectionHeader title="Badges" />
        <Card style={styles.section}>
          <View style={styles.row}>
            <Badge variant="R1" />
            <Badge variant="R2" />
            <Badge variant="R3" />
            <Badge variant="R4" />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Badge variant="success" label="Concluído" />
            <Badge variant="warning" label="Atenção" />
            <Badge variant="error" label="Falha" />
            <Badge variant="info" label="Informação" />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Badge variant="agente" label="Agente" />
            <Badge variant="supervisor" label="Supervisor" />
            <Badge variant="admin" label="Admin" />
          </View>
        </Card>

        <SectionHeader title="Cards" />
        <View style={styles.section}>
          <Card style={styles.margin}>
            <Text style={{ color: theme.text }}>Card Default (Elevated)</Text>
          </Card>
          <Card variant="variant" style={styles.margin}>
            <Text style={{ color: theme.text }}>Card Variant (Surface Variant)</Text>
          </Card>
          <Card variant="flat" style={styles.margin}>
            <Text style={{ color: theme.text }}>Card Flat (Transparent)</Text>
          </Card>
        </View>

        <SectionHeader title="States" />
        <View style={styles.section}>
          <Card style={styles.margin}>
            <Text style={{ color: theme.text, marginBottom: 8, fontWeight: 'bold' }}>Empty State</Text>
            <EmptyState 
              title="Nenhum dado encontrado" 
              description="Isso é apenas um teste do componente." 
              icon="inbox" 
            />
          </Card>

          <Card style={styles.margin}>
            <Text style={{ color: theme.text, marginBottom: 8, fontWeight: 'bold' }}>Error State</Text>
            <ErrorState 
              title="Erro de Conexão" 
              message="Não foi possível carregar os dados no momento." 
              onRetry={() => alert('Retry clicked')} 
            />
          </Card>

          <Card style={styles.margin}>
            <Text style={{ color: theme.text, marginBottom: 8, fontWeight: 'bold' }}>Loading State</Text>
            <LoadingState message="Buscando informações..." />
          </Card>
        </View>

        <SectionHeader title="Bottom Navigation" />
        <View style={styles.section}>
          <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12 }}>Mock: Master Admin (Path: /master)</Text>
          <View style={{ height: 60, position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
             <BottomNavBarInner role="master_admin" pathname="/master" />
          </View>

          <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12 }}>Mock: Agente (Path: /inspecoes)</Text>
          <View style={{ height: 60, position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
             <BottomNavBarInner role="agente" pathname="/inspecoes" />
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  margin: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  }
});