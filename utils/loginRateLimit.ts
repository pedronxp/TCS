import AsyncStorage from '@react-native-async-storage/async-storage';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

interface LoginAttemptData {
  count: number;
  since: number;
}

function storageKey(email: string): string {
  return `tcs_login_attempts_${email.trim().toLowerCase()}`;
}

/** Registra uma tentativa de login e retorna se ainda está permitido. */
export async function recordLoginAttempt(email: string): Promise<boolean> {
  const key = storageKey(email);
  const raw = await AsyncStorage.getItem(key);
  let data: LoginAttemptData = raw ? JSON.parse(raw) : { count: 0, since: Date.now() };

  // Resetar janela se passou 15 min
  if (Date.now() - data.since > WINDOW_MS) {
    data = { count: 0, since: Date.now() };
  }

  data.count += 1;
  await AsyncStorage.setItem(key, JSON.stringify(data));
  return data.count <= MAX_ATTEMPTS;
}

/** Retorna timestamp de desbloqueio ou null se não bloqueado. */
export async function getLoginBlockedUntil(email: string): Promise<number | null> {
  const key = storageKey(email);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  const data: LoginAttemptData = JSON.parse(raw);
  if (data.count < MAX_ATTEMPTS) return null;

  const unblockAt = data.since + WINDOW_MS;
  if (Date.now() > unblockAt) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  return unblockAt;
}

/** Limpa tentativas após login bem-sucedido. */
export async function clearLoginAttempts(email: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(email));
}
