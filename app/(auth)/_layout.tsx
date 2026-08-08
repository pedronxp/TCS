import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="planos" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="treinamento" />
      <Stack.Screen name="treinamento-loading" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="customer-onboarding" />
    </Stack>
  );
}
