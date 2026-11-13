import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { LoadingState } from '../../../components/ui';

/**
 * Rota legada de "Classificação de risco".
 *
 * A tela atual é `/(panel)/inspecoes/resultado`, que concentra a classificação,
 * o laudo, a ciência do morador e as evidências. Esta rota antiga criava a
 * vistoria a partir de uma tela de resultado — gravando registros sem
 * solicitante, sem coordenadas e sem formulário — e hoje não é alcançada por
 * nenhum fluxo do aplicativo.
 *
 * Em vez de manter um caminho que produz vistoria incompleta, a rota redireciona
 * para a tela vigente preservando os parâmetros, de modo que links antigos
 * continuem abrindo a vistoria correta.
 */
export default function ResultadoRiscoScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const redirecionou = useRef(false);

  useEffect(() => {
    if (redirecionou.current) return;
    redirecionou.current = true;
    const forwarded: Record<string, string> = {};
    const map: Record<string, string> = {
      id: 'id',
      nivel: 'nivelRisco',
      pontos: 'pontuacao',
      municipio: 'municipio',
      formularioId: 'formularioId',
    };
    for (const [origem, destino] of Object.entries(map)) {
      const valor = params[origem];
      const texto = Array.isArray(valor) ? valor[0] : valor;
      if (texto) forwarded[destino] = texto;
    }
    router.replace({ pathname: '/(panel)/inspecoes/resultado', params: forwarded });
  }, [params]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LoadingState message="Abrindo o resultado da vistoria..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
