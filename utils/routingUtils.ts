import { Linking, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export async function tracarRota(lat: number, lng: number): Promise<void> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    let url: string;
    if (Platform.OS === 'ios') {
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        url = `maps://maps.apple.com/?saddr=${pos.coords.latitude},${pos.coords.longitude}&daddr=${lat},${lng}&dirflg=d`;
      } else {
        url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      }
    } else {
      // Android — Google Maps navegação direta
      url = `google.navigation:q=${lat},${lng}&mode=d`;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback para Google Maps web (caso Google Maps não esteja instalado)
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      await Linking.openURL(fallback);
    }
  } catch {
    Alert.alert('Erro', 'Não foi possível abrir o mapa de navegação.');
  }
}
