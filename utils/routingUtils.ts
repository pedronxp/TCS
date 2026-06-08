import { Linking, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';
import { normalizeCoordinatePair } from './coordinateUtils';

export async function tracarRota(lat: number, lng: number): Promise<void> {
  const destino = normalizeCoordinatePair(lat, lng);
  if (!destino) {
    Alert.alert('Rota indisponível', 'Não foi possível traçar a rota sem coordenadas válidas da vistoria.');
    return;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    let url: string;
    if (Platform.OS === 'ios') {
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        url = `maps://maps.apple.com/?saddr=${pos.coords.latitude},${pos.coords.longitude}&daddr=${destino.latitude},${destino.longitude}&dirflg=d`;
      } else {
        url = `maps://maps.apple.com/?daddr=${destino.latitude},${destino.longitude}&dirflg=d`;
      }
    } else {
      // Android — Google Maps navegação direta
      url = `google.navigation:q=${destino.latitude},${destino.longitude}&mode=d`;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback para Google Maps web (caso Google Maps não esteja instalado)
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${destino.latitude},${destino.longitude}`;
      await Linking.openURL(fallback);
    }
  } catch {
    Alert.alert('Erro', 'Não foi possível abrir o mapa de navegação. Tente novamente ou confira se há um app de mapas instalado.');
  }
}
