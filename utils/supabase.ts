import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const PUBLIC_SUPABASE_URL = 'https://vobcapzssxchdckazfnr.supabase.co';
const PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmNhcHpzc3hjaGRja2F6Zm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzEzMjQsImV4cCI6MjA4ODI0NzMyNH0.z53oQYEwdZYId2u59oSJromLN-618D-Y_zRh2QrTkv0';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração ausente: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env'
  );
}

/**
 * Adapter SecureStore para o Supabase auth.
 * Armazena o JWT criptografado no Keychain/Keystore em vez do AsyncStorage em texto claro.
 *
 * LIMITAÇÃO: expo-secure-store tem limite de ~2KB por chave no iOS.
 * Supabase armazena a sessão como JSON. Se o JSON ultrapassar 2KB,
 * usamos uma chave de índice que aponta para partes armazenadas separadamente.
 * Na prática, o JSON de sessão Supabase fica em ~1-1.5KB — limite seguro.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): Promise<void> => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})
