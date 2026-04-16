// Placeholder de tipos do Supabase.
// Para gerar o arquivo real, rode:
//   npm run types:supabase
// (requer Supabase CLI instalado e login: `supabase login`)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
