import { useEffect } from 'react';
import { router } from 'expo-router';

export default function LegacyTrainingLoadingRedirect() {
  useEffect(() => {
    router.replace('/(auth)/treinamento');
  }, []);
  return null;
}
