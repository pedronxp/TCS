export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_sessions: {
        Row: {
          auth_session_id: string
          device_id: string
          device_name: string | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          last_heartbeat_at: string
          last_ip: unknown
          mac_address: string | null
          organization_id: string | null
          platform: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          auth_session_id: string
          device_id: string
          device_name?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          last_heartbeat_at?: string
          last_ip?: unknown
          mac_address?: string | null
          organization_id?: string | null
          platform: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          auth_session_id?: string
          device_id?: string
          device_name?: string | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          last_heartbeat_at?: string
          last_ip?: unknown
          mac_address?: string | null
          organization_id?: string | null
          platform?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          criadoEm: string | null
          descricao: string | null
          id: string
          municipio: string | null
          nivel: string | null
          nomeUsuario: string | null
          tipo: string | null
          uidUsuario: string | null
        }
        Insert: {
          criadoEm?: string | null
          descricao?: string | null
          id?: string
          municipio?: string | null
          nivel?: string | null
          nomeUsuario?: string | null
          tipo?: string | null
          uidUsuario?: string | null
        }
        Update: {
          criadoEm?: string | null
          descricao?: string | null
          id?: string
          municipio?: string | null
          nivel?: string | null
          nomeUsuario?: string | null
          tipo?: string | null
          uidUsuario?: string | null
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          agente_nome: string | null
          agente_uid: string | null
          compartilhado_com_equipe: boolean
          confirmacao_canal: string | null
          confirmacao_cliente: string
          confirmacao_em: string | null
          criado_em: string | null
          criado_por_nome: string | null
          criado_por_uid: string | null
          data_agendada: string
          duracao_minutos: number
          endereco: string | null
          id: string
          inspection_id: string | null
          lat: number | null
          lng: number | null
          municipio: string
          observacoes: string | null
          organization_id: string | null
          origem: string
          status: string | null
          titulo: string
        }
        Insert: {
          agente_nome?: string | null
          agente_uid?: string | null
          compartilhado_com_equipe?: boolean
          confirmacao_canal?: string | null
          confirmacao_cliente?: string
          confirmacao_em?: string | null
          criado_em?: string | null
          criado_por_nome?: string | null
          criado_por_uid?: string | null
          data_agendada: string
          duracao_minutos?: number
          endereco?: string | null
          id?: string
          inspection_id?: string | null
          lat?: number | null
          lng?: number | null
          municipio: string
          observacoes?: string | null
          organization_id?: string | null
          origem?: string
          status?: string | null
          titulo: string
        }
        Update: {
          agente_nome?: string | null
          agente_uid?: string | null
          compartilhado_com_equipe?: boolean
          confirmacao_canal?: string | null
          confirmacao_cliente?: string
          confirmacao_em?: string | null
          criado_em?: string | null
          criado_por_nome?: string | null
          criado_por_uid?: string | null
          data_agendada?: string
          duracao_minutos?: number
          endereco?: string | null
          id?: string
          inspection_id?: string | null
          lat?: number | null
          lng?: number | null
          municipio?: string
          observacoes?: string | null
          organization_id?: string | null
          origem?: string
          status?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_agente_uid_fkey"
            columns: ["agente_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "agendamentos_criado_por_uid_fkey"
            columns: ["criado_por_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "agendamentos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_api_keys: {
        Row: {
          api_key: string
          cooldown_until: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          last_error_at: string | null
          last_error_code: string | null
          last_ok_at: string | null
          model: string
          monthly_token_limit: number | null
          notes: string | null
          priority: number
          provider: string
          status: string
          tokens_used_month: number
          updated_at: string
          use_for: string[]
        }
        Insert: {
          api_key: string
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_ok_at?: string | null
          model?: string
          monthly_token_limit?: number | null
          notes?: string | null
          priority?: number
          provider?: string
          status?: string
          tokens_used_month?: number
          updated_at?: string
          use_for?: string[]
        }
        Update: {
          api_key?: string
          cooldown_until?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_ok_at?: string | null
          model?: string
          monthly_token_limit?: number | null
          notes?: string | null
          priority?: number
          provider?: string
          status?: string
          tokens_used_month?: number
          updated_at?: string
          use_for?: string[]
        }
        Relationships: []
      }
      ai_cron_settings: {
        Row: {
          created_at: string
          cron_secret: string
          id: boolean
        }
        Insert: {
          created_at?: string
          cron_secret?: string
          id?: boolean
        }
        Update: {
          created_at?: string
          cron_secret?: string
          id?: boolean
        }
        Relationships: []
      }
      ai_feature_grants: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          granted_by: string | null
          id: string
          note: string | null
          organization_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          granted_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feature_grants_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "ai_features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ai_feature_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feature_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      ai_features: {
        Row: {
          created_at: string
          description: string | null
          key: string
          name: string
          stage: string
          surface: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          name: string
          stage?: string
          surface?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          name?: string
          stage?: string
          surface?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_code: string | null
          fallback_used: boolean
          feature: string | null
          id: number
          key_id: string | null
          latency_ms: number | null
          model: string | null
          organization_id: string | null
          provider: string | null
          success: boolean
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          feature?: string | null
          id?: never
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          organization_id?: string | null
          provider?: string | null
          success: boolean
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          fallback_used?: boolean
          feature?: string | null
          id?: never
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          organization_id?: string | null
          provider?: string | null
          success?: boolean
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "ai_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_login_notice: {
        Row: {
          beta_date: string
          enabled: boolean
          message: string
          singleton: boolean
          title: string
          updated_at: string
          updated_by: string | null
          whatsapp_url: string
        }
        Insert: {
          beta_date?: string
          enabled?: boolean
          message?: string
          singleton?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string
        }
        Update: {
          beta_date?: string
          enabled?: boolean
          message?: string
          singleton?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string
        }
        Relationships: []
      }
      app_update_config: {
        Row: {
          apk_url: string | null
          enabled: boolean
          latest_version: string
          latest_version_code: number
          mandatory: boolean
          message: string | null
          min_required_version_code: number
          platform: string
          updated_at: string
        }
        Insert: {
          apk_url?: string | null
          enabled?: boolean
          latest_version: string
          latest_version_code: number
          mandatory?: boolean
          message?: string | null
          min_required_version_code: number
          platform: string
          updated_at?: string
        }
        Update: {
          apk_url?: string | null
          enabled?: boolean
          latest_version?: string
          latest_version_code?: number
          mandatory?: boolean
          message?: string | null
          min_required_version_code?: number
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      atribuicoes: {
        Row: {
          agendada_para: string | null
          agente_nome: string
          agente_uid: string
          concluida_em: string | null
          criada_em: string
          criado_por_role: string
          endereco_completo: string
          id: string
          lat: number
          lng: number
          municipio: string
          observacao: string | null
          organization_id: string | null
          prioridade: string
          status: string
          supervisor_nome: string
          supervisor_uid: string
        }
        Insert: {
          agendada_para?: string | null
          agente_nome: string
          agente_uid: string
          concluida_em?: string | null
          criada_em?: string
          criado_por_role?: string
          endereco_completo: string
          id: string
          lat: number
          lng: number
          municipio: string
          observacao?: string | null
          organization_id?: string | null
          prioridade?: string
          status?: string
          supervisor_nome: string
          supervisor_uid: string
        }
        Update: {
          agendada_para?: string | null
          agente_nome?: string
          agente_uid?: string
          concluida_em?: string | null
          criada_em?: string
          criado_por_role?: string
          endereco_completo?: string
          id?: string
          lat?: number
          lng?: number
          municipio?: string
          observacao?: string | null
          organization_id?: string | null
          prioridade?: string
          status?: string
          supervisor_nome?: string
          supervisor_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          alvo_id: string | null
          alvo_tipo: string | null
          ator_nome: string | null
          ator_role: string | null
          ator_uid: string | null
          criado_em: string
          detalhes: Json | null
          id: string
          organization_id: string | null
        }
        Insert: {
          acao: string
          alvo_id?: string | null
          alvo_tipo?: string | null
          ator_nome?: string | null
          ator_role?: string | null
          ator_uid?: string | null
          criado_em?: string
          detalhes?: Json | null
          id?: string
          organization_id?: string | null
        }
        Update: {
          acao?: string
          alvo_id?: string | null
          alvo_tipo?: string | null
          ator_nome?: string | null
          ator_role?: string | null
          ator_uid?: string | null
          criado_em?: string
          detalhes?: Json | null
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bairros: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bairros_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          aprovado_por: string | null
          atualizado_em: string
          competencia: string
          comprovante_enviado_em: string | null
          comprovante_path: string | null
          criado_em: string
          id: string
          motivo_rejeicao: string | null
          organization_id: string
          pago_em: string | null
          status: string
          subscription_id: string
          valor_centavos: number
          vencimento: string
        }
        Insert: {
          aprovado_por?: string | null
          atualizado_em?: string
          competencia: string
          comprovante_enviado_em?: string | null
          comprovante_path?: string | null
          criado_em?: string
          id?: string
          motivo_rejeicao?: string | null
          organization_id: string
          pago_em?: string | null
          status?: string
          subscription_id: string
          valor_centavos: number
          vencimento: string
        }
        Update: {
          aprovado_por?: string | null
          atualizado_em?: string
          competencia?: string
          comprovante_enviado_em?: string | null
          comprovante_path?: string | null
          criado_em?: string
          id?: string
          motivo_rejeicao?: string | null
          organization_id?: string
          pago_em?: string | null
          status?: string
          subscription_id?: string
          valor_centavos?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_notice_rules: {
        Row: {
          ativo: boolean
          atualizado_em: string
          corpo: string
          criado_em: string
          criado_por: string | null
          dias_offset: number
          id: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          corpo: string
          criado_em?: string
          criado_por?: string | null
          dias_offset: number
          id?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          corpo?: string
          criado_em?: string
          criado_por?: string | null
          dias_offset?: number
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          fatura_antecedencia_dias: number
          singleton: boolean
          tolerancia_dias: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          fatura_antecedencia_dias?: number
          singleton?: boolean
          tolerancia_dias?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          fatura_antecedencia_dias?: number
          singleton?: boolean
          tolerancia_dias?: number
        }
        Relationships: []
      }
      bot_chats: {
        Row: {
          chat_id: string
          comunidade_id: string | null
          comunidade_nome: string | null
          nome: string
          sessao_id: string
          tipo: string
          total_admins: number
          total_participantes: number
          visto_em: string
        }
        Insert: {
          chat_id: string
          comunidade_id?: string | null
          comunidade_nome?: string | null
          nome: string
          sessao_id: string
          tipo?: string
          total_admins?: number
          total_participantes?: number
          visto_em?: string
        }
        Update: {
          chat_id?: string
          comunidade_id?: string | null
          comunidade_nome?: string | null
          nome?: string
          sessao_id?: string
          tipo?: string
          total_admins?: number
          total_participantes?: number
          visto_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_chats_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "bot_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessoes: {
        Row: {
          acao_pendente: string | null
          atualizado_em: string
          criado_em: string
          expected_phone: string | null
          id: string
          identification: string | null
          organization_id: string
          pairing_method: string | null
          pairing_prepared_at: string | null
          pairing_ready: boolean
          status: string
          telefone: string | null
          vinculado_em: string | null
          vinculado_por: string
        }
        Insert: {
          acao_pendente?: string | null
          atualizado_em?: string
          criado_em?: string
          expected_phone?: string | null
          id?: string
          identification?: string | null
          organization_id: string
          pairing_method?: string | null
          pairing_prepared_at?: string | null
          pairing_ready?: boolean
          status?: string
          telefone?: string | null
          vinculado_em?: string | null
          vinculado_por: string
        }
        Update: {
          acao_pendente?: string | null
          atualizado_em?: string
          criado_em?: string
          expected_phone?: string | null
          id?: string
          identification?: string | null
          organization_id?: string
          pairing_method?: string | null
          pairing_prepared_at?: string | null
          pairing_ready?: boolean
          status?: string
          telefone?: string | null
          vinculado_em?: string | null
          vinculado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      builds: {
        Row: {
          apk_url: string | null
          changelog: string | null
          completed_at: string | null
          created_at: string | null
          drive_folder_url: string | null
          eas_build_id: string | null
          error_message: string | null
          github_run_id: string | null
          id: string
          initiated_by: string | null
          initiated_by_name: string | null
          profile: string
          provider: string
          status: string
          version: string
        }
        Insert: {
          apk_url?: string | null
          changelog?: string | null
          completed_at?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          eas_build_id?: string | null
          error_message?: string | null
          github_run_id?: string | null
          id?: string
          initiated_by?: string | null
          initiated_by_name?: string | null
          profile?: string
          provider?: string
          status?: string
          version: string
        }
        Update: {
          apk_url?: string | null
          changelog?: string | null
          completed_at?: string | null
          created_at?: string | null
          drive_folder_url?: string | null
          eas_build_id?: string | null
          error_message?: string | null
          github_run_id?: string | null
          id?: string
          initiated_by?: string | null
          initiated_by_name?: string | null
          profile?: string
          provider?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      canais_externos: {
        Row: {
          ativo: boolean
          chat_id: string | null
          config: Json
          created_at: string
          id: string
          link_convite: string | null
          nome: string | null
          organization_id: string
          telefone_admin: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chat_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          link_convite?: string | null
          nome?: string | null
          organization_id: string
          telefone_admin?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chat_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          link_convite?: string | null
          nome?: string | null
          organization_id?: string
          telefone_admin?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canais_externos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_envios: {
        Row: {
          bot_atualizado_em: string | null
          canal_id: string
          comunicado_id: string
          created_at: string
          enviado_em: string
          erro: string | null
          id: string
          origem: string
          processing_started_at: string | null
          registrado_por: string
          sessao_id: string | null
          status: string
          tentativas: Json | null
          uncertain_at: string | null
          worker_id: string | null
        }
        Insert: {
          bot_atualizado_em?: string | null
          canal_id: string
          comunicado_id: string
          created_at?: string
          enviado_em?: string
          erro?: string | null
          id?: string
          origem?: string
          processing_started_at?: string | null
          registrado_por: string
          sessao_id?: string | null
          status?: string
          tentativas?: Json | null
          uncertain_at?: string | null
          worker_id?: string | null
        }
        Update: {
          bot_atualizado_em?: string | null
          canal_id?: string
          comunicado_id?: string
          created_at?: string
          enviado_em?: string
          erro?: string | null
          id?: string
          origem?: string
          processing_started_at?: string | null
          registrado_por?: string
          sessao_id?: string | null
          status?: string
          tentativas?: Json | null
          uncertain_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_envios_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_externos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_envios_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_envios_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "bot_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_config: {
        Row: {
          accept_images: boolean
          bot_secret: string | null
          bot_session_id: string | null
          business_hours: Json | null
          created_at: string
          feature_permissions: Json
          human_handoff_phone: string | null
          ia_enabled: boolean
          id: string
          master_prompt: string | null
          mode: string
          model_overrides: Json | null
          numero_bot: string | null
          organization_id: string | null
          session_ttl_hours: number
          updated_at: string
          updated_by: string | null
          welcome_message: string | null
        }
        Insert: {
          accept_images?: boolean
          bot_secret?: string | null
          bot_session_id?: string | null
          business_hours?: Json | null
          created_at?: string
          feature_permissions?: Json
          human_handoff_phone?: string | null
          ia_enabled?: boolean
          id?: string
          master_prompt?: string | null
          mode?: string
          model_overrides?: Json | null
          numero_bot?: string | null
          organization_id?: string | null
          session_ttl_hours?: number
          updated_at?: string
          updated_by?: string | null
          welcome_message?: string | null
        }
        Update: {
          accept_images?: boolean
          bot_secret?: string | null
          bot_session_id?: string | null
          business_hours?: Json | null
          created_at?: string
          feature_permissions?: Json
          human_handoff_phone?: string | null
          ia_enabled?: boolean
          id?: string
          master_prompt?: string | null
          mode?: string
          model_overrides?: Json | null
          numero_bot?: string | null
          organization_id?: string | null
          session_ttl_hours?: number
          updated_at?: string
          updated_by?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_config_bot_session_id_fkey"
            columns: ["bot_session_id"]
            isOneToOne: false
            referencedRelation: "bot_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_templates: {
        Row: {
          default_text: string
          description: string | null
          key: string
          texto: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_text: string
          description?: string | null
          key: string
          texto: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_text?: string
          description?: string | null
          key?: string
          texto?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      commercial_activation_tokens: {
        Row: {
          benefit: Json
          expires_at: string
          id: string
          issued_at: string
          issued_by: string
          kind: string
          max_uses: number
          reason: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          used_count: number
        }
        Insert: {
          benefit: Json
          expires_at: string
          id?: string
          issued_at?: string
          issued_by: string
          kind: string
          max_uses?: number
          reason: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          used_count?: number
        }
        Update: {
          benefit?: Json
          expires_at?: string
          id?: string
          issued_at?: string
          issued_by?: string
          kind?: string
          max_uses?: number
          reason?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          used_count?: number
        }
        Relationships: []
      }
      commercial_entitlements: {
        Row: {
          billing_user_id: string | null
          commercial_order_id: string
          created_at: string
          credit_quantity: number | null
          ends_at: string | null
          entitlement_type: string
          id: number
          organization_id: string | null
          plan_version_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          billing_user_id?: string | null
          commercial_order_id: string
          created_at?: string
          credit_quantity?: number | null
          ends_at?: string | null
          entitlement_type: string
          id?: never
          organization_id?: string | null
          plan_version_id?: string | null
          starts_at?: string
          status?: string
        }
        Update: {
          billing_user_id?: string | null
          commercial_order_id?: string
          created_at?: string
          credit_quantity?: number | null
          ends_at?: string | null
          entitlement_type?: string
          id?: never
          organization_id?: string | null
          plan_version_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_entitlements_commercial_order_id_fkey"
            columns: ["commercial_order_id"]
            isOneToOne: true
            referencedRelation: "commercial_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_entitlements_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_ledger_entries: {
        Row: {
          amount_cents: number
          commercial_order_id: string
          created_at: string
          currency: string
          entry_type: string
          id: number
          provider_payment_event_id: number
        }
        Insert: {
          amount_cents: number
          commercial_order_id: string
          created_at?: string
          currency: string
          entry_type: string
          id?: never
          provider_payment_event_id: number
        }
        Update: {
          amount_cents?: number
          commercial_order_id?: string
          created_at?: string
          currency?: string
          entry_type?: string
          id?: never
          provider_payment_event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_ledger_entries_commercial_order_id_fkey"
            columns: ["commercial_order_id"]
            isOneToOne: false
            referencedRelation: "commercial_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_ledger_entries_provider_payment_event_id_fkey"
            columns: ["provider_payment_event_id"]
            isOneToOne: true
            referencedRelation: "provider_payment_events"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_orders: {
        Row: {
          amount_cents: number
          billing_cycle: string
          billing_user_id: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          organization_id: string | null
          plan_version_id: string | null
          quantity: number
          status: string
        }
        Insert: {
          amount_cents: number
          billing_cycle?: string
          billing_user_id?: string | null
          created_at?: string
          currency?: string
          id: string
          kind: string
          organization_id?: string | null
          plan_version_id?: string | null
          quantity: number
          status?: string
        }
        Update: {
          amount_cents?: number
          billing_cycle?: string
          billing_user_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          organization_id?: string | null
          plan_version_id?: string | null
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_orders_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_token_events: {
        Row: {
          actor_id: string | null
          event_type: string
          id: number
          occurred_at: string
          operation_id: string | null
          reason: string | null
          token_id: string
        }
        Insert: {
          actor_id?: string | null
          event_type: string
          id?: never
          occurred_at?: string
          operation_id?: string | null
          reason?: string | null
          token_id: string
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          id?: never
          occurred_at?: string
          operation_id?: string | null
          reason?: string | null
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_token_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "commercial_activation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_token_redemptions: {
        Row: {
          id: number
          operation_id: string
          redeemed_at: string
          redeemed_by: string
          token_id: string
        }
        Insert: {
          id?: never
          operation_id: string
          redeemed_at?: string
          redeemed_by: string
          token_id: string
        }
        Update: {
          id?: never
          operation_id?: string
          redeemed_at?: string
          redeemed_by?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_token_redemptions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "commercial_activation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_trial_claims: {
        Row: {
          claimed_at: string
          token_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          token_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          token_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_trial_claims_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "commercial_activation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicado_destinos: {
        Row: {
          bairro_id: string | null
          comunicado_id: string
          created_at: string
          id: string
          todo_municipio: boolean
        }
        Insert: {
          bairro_id?: string | null
          comunicado_id: string
          created_at?: string
          id?: string
          todo_municipio?: boolean
        }
        Update: {
          bairro_id?: string | null
          comunicado_id?: string
          created_at?: string
          id?: string
          todo_municipio?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_destinos_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicado_destinos_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicado_leituras: {
        Row: {
          comunicado_id: string
          leitor_uid: string
          lido_em: string
        }
        Insert: {
          comunicado_id: string
          leitor_uid: string
          lido_em?: string
        }
        Update: {
          comunicado_id?: string
          leitor_uid?: string
          lido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_leituras_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          autor_uid: string
          conteudo: string
          created_at: string
          expira_em: string | null
          id: string
          organization_id: string
          publicado_em: string | null
          publicar_em: string | null
          severidade: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_uid: string
          conteudo: string
          created_at?: string
          expira_em?: string | null
          id?: string
          organization_id: string
          publicado_em?: string | null
          publicar_em?: string | null
          severidade?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_uid?: string
          conteudo?: string
          created_at?: string
          expira_em?: string | null
          id?: string
          organization_id?: string
          publicado_em?: string | null
          publicar_em?: string | null
          severidade?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizadoEm: string
          escritas_hoje: number
          id: string
          limiteBaixo: number
          limiteMedio: number
          valor: Json | null
        }
        Insert: {
          atualizadoEm?: string
          escritas_hoje?: number
          id: string
          limiteBaixo?: number
          limiteMedio?: number
          valor?: Json | null
        }
        Update: {
          atualizadoEm?: string
          escritas_hoje?: number
          id?: string
          limiteBaixo?: number
          limiteMedio?: number
          valor?: Json | null
        }
        Relationships: []
      }
      contadores_protocolo: {
        Row: {
          ano: number
          municipio_codigo: string
          ultimo_seq: number | null
        }
        Insert: {
          ano: number
          municipio_codigo: string
          ultimo_seq?: number | null
        }
        Update: {
          ano?: number
          municipio_codigo?: string
          ultimo_seq?: number | null
        }
        Relationships: []
      }
      dashboard_templates: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          layout: Json
          organization_id: string | null
          role: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          layout?: Json
          organization_id?: string | null
          role?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          layout?: Json
          organization_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgement_events: {
        Row: {
          capture_source: string
          client_event_id: string
          correction_of: string | null
          correction_reason: string | null
          created_by: string
          declaration_hash: string | null
          declaration_text: string | null
          declaration_version: string | null
          device_id_hash: string | null
          document_id: string
          event_kind: string
          id: string
          occurred_at_device: string
          organization_id: string | null
          outcome: string | null
          owner_user_id: string
          protocol: string
          reason: string | null
          recipient_name: string | null
          recipient_relationship: string | null
          recorded_at_server: string
          remote_request_id: string | null
          signature_hash: string | null
          signature_storage_path: string | null
          signature_strokes: Json | null
          witness: Json | null
        }
        Insert: {
          capture_source?: string
          client_event_id: string
          correction_of?: string | null
          correction_reason?: string | null
          created_by: string
          declaration_hash?: string | null
          declaration_text?: string | null
          declaration_version?: string | null
          device_id_hash?: string | null
          document_id: string
          event_kind?: string
          id: string
          occurred_at_device: string
          organization_id?: string | null
          outcome?: string | null
          owner_user_id: string
          protocol: string
          reason?: string | null
          recipient_name?: string | null
          recipient_relationship?: string | null
          recorded_at_server?: string
          remote_request_id?: string | null
          signature_hash?: string | null
          signature_storage_path?: string | null
          signature_strokes?: Json | null
          witness?: Json | null
        }
        Update: {
          capture_source?: string
          client_event_id?: string
          correction_of?: string | null
          correction_reason?: string | null
          created_by?: string
          declaration_hash?: string | null
          declaration_text?: string | null
          declaration_version?: string | null
          device_id_hash?: string | null
          document_id?: string
          event_kind?: string
          id?: string
          occurred_at_device?: string
          organization_id?: string | null
          outcome?: string | null
          owner_user_id?: string
          protocol?: string
          reason?: string | null
          recipient_name?: string | null
          recipient_relationship?: string | null
          recorded_at_server?: string
          remote_request_id?: string | null
          signature_hash?: string | null
          signature_storage_path?: string | null
          signature_strokes?: Json | null
          witness?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgement_events_correction_of_fkey"
            columns: ["correction_of"]
            isOneToOne: false
            referencedRelation: "document_acknowledgement_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgement_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgement_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgement_requests: {
        Row: {
          completed_at: string | null
          completed_event_id: string | null
          created_at: string
          created_by: string
          document_id: string
          expires_at: string
          id: string
          organization_id: string | null
          owner_user_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          token_hash: string
        }
        Insert: {
          completed_at?: string | null
          completed_event_id?: string | null
          created_at?: string
          created_by: string
          document_id: string
          expires_at: string
          id?: string
          organization_id?: string | null
          owner_user_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          completed_at?: string | null
          completed_event_id?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          expires_at?: string
          id?: string
          organization_id?: string | null
          owner_user_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgement_requests_completed_event_id_fkey"
            columns: ["completed_event_id"]
            isOneToOne: false
            referencedRelation: "document_acknowledgement_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgement_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgement_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          actor_context: string
          actor_user_id: string | null
          affected_user_id: string | null
          body: string
          correlation_id: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          module_key: string
          organization_id: string | null
          payload: Json
          route_key: string | null
          severity: string
          thread_key: string | null
          title: string
        }
        Insert: {
          actor_context?: string
          actor_user_id?: string | null
          affected_user_id?: string | null
          body: string
          correlation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          module_key: string
          organization_id?: string | null
          payload?: Json
          route_key?: string | null
          severity?: string
          thread_key?: string | null
          title: string
        }
        Update: {
          actor_context?: string
          actor_user_id?: string | null
          affected_user_id?: string | null
          body?: string
          correlation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          module_key?: string
          organization_id?: string | null
          payload?: Json
          route_key?: string | null
          severity?: string
          thread_key?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          active: boolean
          category: string
          code: string
          description: string | null
          name: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          description?: string | null
          name: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      formularios: {
        Row: {
          ativo: boolean | null
          atualizadoEm: string
          classificacao: Json | null
          codigoSistema: string | null
          criadoEm: string | null
          criadoPorNome: string
          criadoPorUid: string | null
          descricao: string | null
          fases: Json | null
          id: string
          municipio: string | null
          organization_id: string | null
          perguntas: Json | null
          publicadoEm: string | null
          status: string
          tipoCalculo: string | null
          titulo: string
          versao: number
        }
        Insert: {
          ativo?: boolean | null
          atualizadoEm?: string
          classificacao?: Json | null
          codigoSistema?: string | null
          criadoEm?: string | null
          criadoPorNome?: string
          criadoPorUid?: string | null
          descricao?: string | null
          fases?: Json | null
          id?: string
          municipio?: string | null
          organization_id?: string | null
          perguntas?: Json | null
          publicadoEm?: string | null
          status?: string
          tipoCalculo?: string | null
          titulo: string
          versao?: number
        }
        Update: {
          ativo?: boolean | null
          atualizadoEm?: string
          classificacao?: Json | null
          codigoSistema?: string | null
          criadoEm?: string | null
          criadoPorNome?: string
          criadoPorUid?: string | null
          descricao?: string | null
          fases?: Json | null
          id?: string
          municipio?: string | null
          organization_id?: string | null
          perguntas?: Json | null
          publicadoEm?: string | null
          status?: string
          tipoCalculo?: string | null
          titulo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "formularios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          byte_size: number
          content_hash: string
          content_snapshot: Json
          created_at: string
          created_at_device: string
          created_by: string
          document_type: string
          document_version: number
          id: string
          organization_id: string | null
          owner_user_id: string
          pdf_hash: string
          status: string
          storage_path: string
          supersedes_id: string | null
          template_version: string
          training_mode: boolean
          vistoria_id: string
        }
        Insert: {
          byte_size: number
          content_hash: string
          content_snapshot: Json
          created_at?: string
          created_at_device: string
          created_by: string
          document_type: string
          document_version: number
          id: string
          organization_id?: string | null
          owner_user_id: string
          pdf_hash: string
          status?: string
          storage_path: string
          supersedes_id?: string | null
          template_version: string
          training_mode?: boolean
          vistoria_id: string
        }
        Update: {
          byte_size?: number
          content_hash?: string
          content_snapshot?: Json
          created_at?: string
          created_at_device?: string
          created_by?: string
          document_type?: string
          document_version?: number
          id?: string
          organization_id?: string | null
          owner_user_id?: string
          pdf_hash?: string
          status?: string
          storage_path?: string
          supersedes_id?: string | null
          template_version?: string
          training_mode?: boolean
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_recipients: {
        Row: {
          created_at: string
          dismissed_at: string | null
          event_id: string
          organization_id: string | null
          read_at: string | null
          recipient_user_id: string
          workspace_kind: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          event_id: string
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id: string
          workspace_kind: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          event_id?: string
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id?: string
          workspace_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_recipients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_client_provisioning: {
        Row: {
          created_at: string
          created_by: string
          email: string
          mode: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          mode: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          mode?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      individual_protocol_allocation_events: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          id: string
          idempotency_key: string
          inspection_id: string
          protocol: string
          protocol_seq: number
          protocol_year: number
          user_id: string
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          idempotency_key: string
          inspection_id: string
          protocol: string
          protocol_seq: number
          protocol_year: number
          user_id: string
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          idempotency_key?: string
          inspection_id?: string
          protocol?: string
          protocol_seq?: number
          protocol_year?: number
          user_id?: string
        }
        Relationships: []
      }
      individual_protocol_counters: {
        Row: {
          last_seq: number
          protocol_year: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seq: number
          protocol_year: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seq?: number
          protocol_year?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_access_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: number
          metadata: Json
          reason: string | null
          result: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          reason?: string | null
          result: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          reason?: string | null
          result?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      internal_app_versions: {
        Row: {
          changelog: string
          created_at: string
          created_by: string | null
          published_at: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          changelog?: string
          created_at?: string
          created_by?: string | null
          published_at?: string | null
          status: string
          updated_at?: string
          version: string
        }
        Update: {
          changelog?: string
          created_at?: string
          created_by?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      internal_build_requests: {
        Row: {
          approved_by: string | null
          changelog: string
          created_at: string
          decided_at: string | null
          environment: string
          executed_at: string | null
          id: string
          operation_id: string
          profile: string
          provider: string
          reason: string
          requested_by: string
          status: string
          version: string
        }
        Insert: {
          approved_by?: string | null
          changelog?: string
          created_at?: string
          decided_at?: string | null
          environment: string
          executed_at?: string | null
          id?: string
          operation_id: string
          profile: string
          provider: string
          reason: string
          requested_by: string
          status: string
          version: string
        }
        Update: {
          approved_by?: string | null
          changelog?: string
          created_at?: string
          decided_at?: string | null
          environment?: string
          executed_at?: string | null
          id?: string
          operation_id?: string
          profile?: string
          provider?: string
          reason?: string
          requested_by?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      internal_form_versions: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          reason: string
          snapshot: Json
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          reason: string
          snapshot: Json
          status: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          reason?: string
          snapshot?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_operations: {
        Row: {
          action: string
          actor_id: string
          completed_at: string | null
          created_at: string
          id: string
          operation_id: string
          request_hash: string
          result: Json | null
          status: string
        }
        Insert: {
          action: string
          actor_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          operation_id: string
          request_hash: string
          result?: Json | null
          status?: string
        }
        Update: {
          action?: string
          actor_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          operation_id?: string
          request_hash?: string
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      internal_release_settings: {
        Row: {
          development_version: string
          minimum_version: string
          published_version: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          development_version: string
          minimum_version: string
          published_version: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          development_version?: string
          minimum_version?: string
          published_version?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_release_settings_development_version_fkey"
            columns: ["development_version"]
            isOneToOne: false
            referencedRelation: "internal_app_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "internal_release_settings_minimum_version_fkey"
            columns: ["minimum_version"]
            isOneToOne: false
            referencedRelation: "internal_app_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "internal_release_settings_published_version_fkey"
            columns: ["published_version"]
            isOneToOne: false
            referencedRelation: "internal_app_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      internal_risk_config_versions: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          municipality: string
          reason: string
          status: string
          version: number
        }
        Insert: {
          configuration: Json
          created_at?: string
          created_by?: string | null
          id?: string
          municipality: string
          reason: string
          status: string
          version: number
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          municipality?: string
          reason?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      internal_sensitive_access: {
        Row: {
          customer_key: string
          expires_at: string
          granted_at: string
          id: string
          reason: string
          revoked_at: string | null
          staff_user_id: string
          ticket_id: string
        }
        Insert: {
          customer_key: string
          expires_at: string
          granted_at?: string
          id?: string
          reason: string
          revoked_at?: string | null
          staff_user_id: string
          ticket_id: string
        }
        Update: {
          customer_key?: string
          expires_at?: string
          granted_at?: string
          id?: string
          reason?: string
          revoked_at?: string | null
          staff_user_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_sensitive_access_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_staff: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_staff_permission_overrides: {
        Row: {
          created_at: string
          created_by: string
          effect: string
          permission: string
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effect: string
          permission: string
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effect?: string
          permission?: string
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          codigo: string
          criadoEm: string
          criadoPor: string | null
          criadoPorNome: string
          email_destinatario: string | null
          expiraEm: string | null
          management_id: string
          municipio: string | null
          notificadoExpirando: boolean
          organization_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string | null
          token_hash: string | null
          usado: boolean | null
          usado_em: string | null
          usadoEm: string | null
          usadoPorIp: string | null
          usadoPorNome: string | null
          usadoPorUid: string | null
        }
        Insert: {
          codigo: string
          criadoEm?: string
          criadoPor?: string | null
          criadoPorNome?: string
          email_destinatario?: string | null
          expiraEm?: string | null
          management_id?: string
          municipio?: string | null
          notificadoExpirando?: boolean
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string | null
          token_hash?: string | null
          usado?: boolean | null
          usado_em?: string | null
          usadoEm?: string | null
          usadoPorIp?: string | null
          usadoPorNome?: string | null
          usadoPorUid?: string | null
        }
        Update: {
          codigo?: string
          criadoEm?: string
          criadoPor?: string | null
          criadoPorNome?: string
          email_destinatario?: string | null
          expiraEm?: string | null
          management_id?: string
          municipio?: string | null
          notificadoExpirando?: boolean
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string | null
          token_hash?: string | null
          usado?: boolean | null
          usado_em?: string | null
          usadoEm?: string | null
          usadoPorIp?: string | null
          usadoPorNome?: string | null
          usadoPorUid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_configuration_events: {
        Row: {
          configuration_version: number
          created_at: string
          id: number
        }
        Insert: {
          configuration_version: number
          created_at?: string
          id?: never
        }
        Update: {
          configuration_version?: number
          created_at?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "module_configuration_events_configuration_version_fkey"
            columns: ["configuration_version"]
            isOneToOne: false
            referencedRelation: "module_configuration_versions"
            referencedColumns: ["configuration_version"]
          },
        ]
      }
      module_configuration_versions: {
        Row: {
          configuration_version: number
          id: string
          membership_role: string | null
          modules: Json
          operation_id: string
          organization_id: string | null
          plan_version_id: string | null
          published_at: string
          published_by: string
          reason: string
          scope_type: string
        }
        Insert: {
          configuration_version?: never
          id?: string
          membership_role?: string | null
          modules: Json
          operation_id: string
          organization_id?: string | null
          plan_version_id?: string | null
          published_at?: string
          published_by: string
          reason: string
          scope_type: string
        }
        Update: {
          configuration_version?: never
          id?: string
          membership_role?: string | null
          modules?: Json
          operation_id?: string
          organization_id?: string | null
          plan_version_id?: string | null
          published_at?: string
          published_by?: string
          reason?: string
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_configuration_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_configuration_versions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios: {
        Row: {
          ativo: boolean
          criado_em: string
          criado_por: string | null
          dominios_email: string[] | null
          estado: string
          ibge_codigo: string | null
          id: string
          nome: string
          uf: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          dominios_email?: string[] | null
          estado?: string
          ibge_codigo?: string | null
          id?: string
          nome: string
          uf?: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          dominios_email?: string[] | null
          estado?: string
          ibge_codigo?: string | null
          id?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          corpo: string
          criada_em: string
          destinatario_role: string | null
          destinatario_uid: string | null
          id: string
          lida: boolean
          municipio: string | null
          payload: Json
          tipo: string
          titulo: string
        }
        Insert: {
          corpo: string
          criada_em?: string
          destinatario_role?: string | null
          destinatario_uid?: string | null
          id?: string
          lida?: boolean
          municipio?: string | null
          payload?: Json
          tipo: string
          titulo: string
        }
        Update: {
          corpo?: string
          criada_em?: string
          destinatario_role?: string | null
          destinatario_uid?: string | null
          id?: string
          lida?: boolean
          municipio?: string | null
          payload?: Json
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      notification_campaigns: {
        Row: {
          body: string
          category: string
          completed_at: string | null
          created_at: string
          created_by: string
          failure_reason: string | null
          id: string
          municipio: string | null
          payload: Json
          priority: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          target_platforms: string[]
          target_roles: string[]
          title: string
        }
        Insert: {
          body: string
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          failure_reason?: string | null
          id?: string
          municipio?: string | null
          payload?: Json
          priority?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          target_platforms: string[]
          target_roles?: string[]
          title: string
        }
        Update: {
          body?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failure_reason?: string | null
          id?: string
          municipio?: string | null
          payload?: Json
          priority?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          target_platforms?: string[]
          target_roles?: string[]
          title?: string
        }
        Relationships: []
      }
      notification_endpoints: {
        Row: {
          active: boolean
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          platform: string
          provider: string
          subscription: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          platform: string
          provider: string
          subscription?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          platform?: string
          provider?: string
          subscription?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_monthly_reports: {
        Row: {
          competencia: string
          criado_em: string
          enviado_em: string | null
          id: string
          organization_id: string
          resumo: Json
        }
        Insert: {
          competencia: string
          criado_em?: string
          enviado_em?: string | null
          id?: string
          organization_id: string
          resumo: Json
        }
        Update: {
          competencia?: string
          criado_em?: string
          enviado_em?: string | null
          id?: string
          organization_id?: string
          resumo?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_monthly_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          organization_id: string
          role: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          expires_at: string
          id?: string
          organization_id: string
          role: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          organization_id: string
          role: string
          scope: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id: string
          role: string
          scope?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id?: string
          role?: string
          scope?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_module_entitlements: {
        Row: {
          configuration: Json
          enabled: boolean
          module_key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          configuration?: Json
          enabled?: boolean
          module_key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          configuration?: Json
          enabled?: boolean
          module_key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_module_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_module_members: {
        Row: {
          granted_at: string
          granted_by: string | null
          module_key: string
          organization_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          module_key: string
          organization_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          module_key?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_module_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_onboarding: {
        Row: {
          checklist: Json
          coordinator_trained_at: string | null
          organization_id: string
          pilot_started_at: string | null
          review_completed_at: string | null
          review_due_at: string | null
          updated_at: string
        }
        Insert: {
          checklist?: Json
          coordinator_trained_at?: string | null
          organization_id: string
          pilot_started_at?: string | null
          review_completed_at?: string | null
          review_due_at?: string | null
          updated_at?: string
        }
        Update: {
          checklist?: Json
          coordinator_trained_at?: string | null
          organization_id?: string
          pilot_started_at?: string | null
          review_completed_at?: string | null
          review_due_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contract_reference: string | null
          created_at: string
          display_name: string
          id: string
          legal_name: string | null
          metadata: Json
          municipality_name: string | null
          offline_tolerance_minutes: number
          session_policy: string
          session_timeout_minutes: number
          slug: string
          state_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contract_reference?: string | null
          created_at?: string
          display_name: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          municipality_name?: string | null
          offline_tolerance_minutes?: number
          session_policy?: string
          session_timeout_minutes?: number
          slug: string
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contract_reference?: string | null
          created_at?: string
          display_name?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          municipality_name?: string | null
          offline_tolerance_minutes?: number
          session_policy?: string
          session_timeout_minutes?: number
          slug?: string
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_admins: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      password_recovery_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      payment_provider_connections: {
        Row: {
          access_token_expires_at: string | null
          connected_at: string | null
          connected_by: string | null
          credential_ciphertext: string | null
          disconnected_at: string | null
          last_error_code: string | null
          last_refreshed_at: string | null
          provider: string
          provider_user_id: string | null
          refresh_ciphertext: string | null
          refresh_lock_expires_at: string | null
          refresh_lock_id: string | null
          scopes: string[]
          state: string
          updated_at: string
        }
        Insert: {
          access_token_expires_at?: string | null
          connected_at?: string | null
          connected_by?: string | null
          credential_ciphertext?: string | null
          disconnected_at?: string | null
          last_error_code?: string | null
          last_refreshed_at?: string | null
          provider: string
          provider_user_id?: string | null
          refresh_ciphertext?: string | null
          refresh_lock_expires_at?: string | null
          refresh_lock_id?: string | null
          scopes?: string[]
          state?: string
          updated_at?: string
        }
        Update: {
          access_token_expires_at?: string | null
          connected_at?: string | null
          connected_by?: string | null
          credential_ciphertext?: string | null
          disconnected_at?: string | null
          last_error_code?: string | null
          last_refreshed_at?: string | null
          provider?: string
          provider_user_id?: string | null
          refresh_ciphertext?: string | null
          refresh_lock_expires_at?: string | null
          refresh_lock_id?: string | null
          scopes?: string[]
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_provider_oauth_attempts: {
        Row: {
          actor_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          pkce_verifier_ciphertext: string
          provider: string
          redirect_uri: string
          state_hash: string
        }
        Insert: {
          actor_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          pkce_verifier_ciphertext: string
          provider?: string
          redirect_uri: string
          state_hash: string
        }
        Update: {
          actor_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          pkce_verifier_ciphertext?: string
          provider?: string
          redirect_uri?: string
          state_hash?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          configuration: Json
          enabled: boolean
          feature_code: string
          plan_id: string
        }
        Insert: {
          configuration?: Json
          enabled?: boolean
          feature_code: string
          plan_id: string
        }
        Update: {
          configuration?: Json
          enabled?: boolean
          feature_code?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_code_fkey"
            columns: ["feature_code"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          configuration: Json
          hard_limit: number | null
          plan_id: string
          resource_code: string
          warning_percent: number
        }
        Insert: {
          configuration?: Json
          hard_limit?: number | null
          plan_id: string
          resource_code: string
          warning_percent?: number
        }
        Update: {
          configuration?: Json
          hard_limit?: number | null
          plan_id?: string
          resource_code?: string
          warning_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_purchase_requests: {
        Row: {
          billing_cycle: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          customer_message: string | null
          id: string
          metadata: Json
          municipality_name: string | null
          organization_name: string | null
          plan_id: string
          requester_id: string | null
          resolved_subscription_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          customer_message?: string | null
          id?: string
          metadata?: Json
          municipality_name?: string | null
          organization_name?: string | null
          plan_id: string
          requester_id?: string | null
          resolved_subscription_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          customer_message?: string | null
          id?: string
          metadata?: Json
          municipality_name?: string | null
          organization_name?: string | null
          plan_id?: string
          requester_id?: string | null
          resolved_subscription_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_purchase_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_purchase_requests_resolved_subscription_id_fkey"
            columns: ["resolved_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_version_features: {
        Row: {
          configuration: Json
          enabled: boolean
          feature_code: string
          plan_version_id: string
        }
        Insert: {
          configuration?: Json
          enabled?: boolean
          feature_code: string
          plan_version_id: string
        }
        Update: {
          configuration?: Json
          enabled?: boolean
          feature_code?: string
          plan_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_version_features_feature_code_fkey"
            columns: ["feature_code"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_version_features_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_version_limits: {
        Row: {
          configuration: Json
          hard_limit: number | null
          plan_version_id: string
          resource_code: string
          warning_percent: number
        }
        Insert: {
          configuration?: Json
          hard_limit?: number | null
          plan_version_id: string
          resource_code: string
          warning_percent?: number
        }
        Update: {
          configuration?: Json
          hard_limit?: number | null
          plan_version_id?: string
          resource_code?: string
          warning_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_version_limits_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          plan_id: string
          published_at: string | null
          version: number
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          plan_id: string
          published_at?: string | null
          version: number
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          plan_id?: string
          published_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          audience: string
          code: string
          created_at: string
          current_version: number
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          audience: string
          code: string
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string
          code?: string
          created_at?: string
          current_version?: number
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_checkout_sessions: {
        Row: {
          amount_cents: number
          checkout_url: string | null
          commercial_order_id: string | null
          completed_at: string | null
          created_at: string
          currency: string
          expires_at: string
          id: string
          idempotency_key: string
          organization_id: string | null
          periodicity: string
          plan_id: string
          plan_version_id: string
          provider: string | null
          provider_session_id: string | null
          requester_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          checkout_url?: string | null
          commercial_order_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          organization_id?: string | null
          periodicity: string
          plan_id: string
          plan_version_id: string
          provider?: string | null
          provider_session_id?: string | null
          requester_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          checkout_url?: string | null
          commercial_order_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          organization_id?: string | null
          periodicity?: string
          plan_id?: string
          plan_version_id?: string
          provider?: string | null
          provider_session_id?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_checkout_sessions_commercial_order_id_fkey"
            columns: ["commercial_order_id"]
            isOneToOne: true
            referencedRelation: "commercial_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_checkout_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_checkout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_checkout_sessions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_payment_events: {
        Row: {
          error_code: string | null
          event_type: string
          id: number
          payload_hash: string
          processed_at: string | null
          provider: string
          provider_event_id: string
          provider_event_time: string
          received_at: string
          status: string
        }
        Insert: {
          error_code?: string | null
          event_type: string
          id?: number
          payload_hash: string
          processed_at?: string | null
          provider: string
          provider_event_id: string
          provider_event_time: string
          received_at?: string
          status?: string
        }
        Update: {
          error_code?: string | null
          event_type?: string
          id?: number
          payload_hash?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          provider_event_time?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      portal_rollout_settings: {
        Row: {
          billing_enabled: boolean
          foundation_enabled: boolean
          individual_enabled: boolean
          municipal_agent_enabled: boolean
          municipal_coordinator_enabled: boolean
          municipal_supervisor_enabled: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_enabled?: boolean
          foundation_enabled?: boolean
          individual_enabled?: boolean
          municipal_agent_enabled?: boolean
          municipal_coordinator_enabled?: boolean
          municipal_supervisor_enabled?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_enabled?: boolean
          foundation_enabled?: boolean
          individual_enabled?: boolean
          municipal_agent_enabled?: boolean
          municipal_coordinator_enabled?: boolean
          municipal_supervisor_enabled?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      protocol_allocation_events: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          id: string
          idempotency_key: string
          inspection_id: string
          organization_id: string
          protocol: string
          protocol_seq: number
          protocol_series: string
          protocol_series_id: string
          protocol_year: number
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          idempotency_key: string
          inspection_id: string
          organization_id: string
          protocol: string
          protocol_seq: number
          protocol_series: string
          protocol_series_id: string
          protocol_year: number
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          idempotency_key?: string
          inspection_id?: string
          organization_id?: string
          protocol?: string
          protocol_seq?: number
          protocol_series?: string
          protocol_series_id?: string
          protocol_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocol_allocation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_allocation_events_protocol_series_id_organization_fkey"
            columns: ["protocol_series_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "protocol_series"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      protocol_counters: {
        Row: {
          last_seq: number
          organization_id: string
          protocol_series_id: string
          protocol_year: number
          updated_at: string
        }
        Insert: {
          last_seq: number
          organization_id: string
          protocol_series_id: string
          protocol_year: number
          updated_at?: string
        }
        Update: {
          last_seq?: number
          organization_id?: string
          protocol_series_id?: string
          protocol_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_counters_protocol_series_id_organization_id_fkey"
            columns: ["protocol_series_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "protocol_series"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      protocol_series: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payment_events: {
        Row: {
          commercial_order_id: string
          confirmed_at: string
          id: number
          payload: Json
          provider: string
          provider_payment_id: string
        }
        Insert: {
          commercial_order_id: string
          confirmed_at?: string
          id?: never
          payload?: Json
          provider: string
          provider_payment_id: string
        }
        Update: {
          commercial_order_id?: string
          confirmed_at?: string
          id?: never
          payload?: Json
          provider?: string
          provider_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_payment_events_commercial_order_id_fkey"
            columns: ["commercial_order_id"]
            isOneToOne: false
            referencedRelation: "commercial_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      public_marketing_snapshot: {
        Row: {
          agentes: number
          id: boolean
          latest_protocols: Json
          municipios: Json
          pendencias: number
          total_vistorias: number
          updated_at: string
        }
        Insert: {
          agentes?: number
          id?: boolean
          latest_protocols?: Json
          municipios?: Json
          pendencias?: number
          total_vistorias?: number
          updated_at?: string
        }
        Update: {
          agentes?: number
          id?: boolean
          latest_protocols?: Json
          municipios?: Json
          pendencias?: number
          total_vistorias?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number | null
          uid: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number | null
          uid: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number | null
          uid?: string
          window_start?: string
        }
        Relationships: []
      }
      retention_settings: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          inatividade_dias: number
          relatorio_ativo: boolean
          singleton: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          inatividade_dias?: number
          relatorio_ativo?: boolean
          singleton?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          inatividade_dias?: number
          relatorio_ativo?: boolean
          singleton?: boolean
        }
        Relationships: []
      }
      revisoes_qe: {
        Row: {
          checklist: Json
          ciclo: number
          criado_em: string
          id: string
          municipio: string | null
          nota: number | null
          organization_id: string | null
          parecer: string | null
          respondida_em: string | null
          revisor_nome: string | null
          revisor_uid: string | null
          status: string
          vistoria_id: string
        }
        Insert: {
          checklist?: Json
          ciclo?: number
          criado_em?: string
          id?: string
          municipio?: string | null
          nota?: number | null
          organization_id?: string | null
          parecer?: string | null
          respondida_em?: string | null
          revisor_nome?: string | null
          revisor_uid?: string | null
          status?: string
          vistoria_id: string
        }
        Update: {
          checklist?: Json
          ciclo?: number
          criado_em?: string
          id?: string
          municipio?: string | null
          nota?: number | null
          organization_id?: string | null
          parecer?: string | null
          respondida_em?: string | null
          revisor_nome?: string | null
          revisor_uid?: string | null
          status?: string
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisoes_qe_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisoes_qe_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_configs: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          configuracao: Json
          id: string
          municipio: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          configuracao: Json
          id?: string
          municipio: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          configuracao?: Json
          id?: string
          municipio?: string
        }
        Relationships: []
      }
      subscription_audit_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: number
          metadata: Json
          organization_id: string | null
          outcome: string
          reason: string | null
          request_id: string | null
          source: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: number
          metadata?: Json
          organization_id?: string | null
          outcome?: string
          reason?: string | null
          request_id?: string | null
          source?: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: number
          metadata?: Json
          organization_id?: string | null
          outcome?: string
          reason?: string | null
          request_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_settings: {
        Row: {
          authoritative_audit_enabled: boolean
          default_warning_percent: number
          entitlement_enforcement_enabled: boolean
          google_customer_auth_enabled: boolean
          hardened_auth_enabled: boolean
          individual_bootstrap_enabled: boolean
          municipal_bootstrap_enabled: boolean
          password_recovery_enabled: boolean
          session_enforcement_enabled: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authoritative_audit_enabled?: boolean
          default_warning_percent?: number
          entitlement_enforcement_enabled?: boolean
          google_customer_auth_enabled?: boolean
          hardened_auth_enabled?: boolean
          individual_bootstrap_enabled?: boolean
          municipal_bootstrap_enabled?: boolean
          password_recovery_enabled?: boolean
          session_enforcement_enabled?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authoritative_audit_enabled?: boolean
          default_warning_percent?: number
          entitlement_enforcement_enabled?: boolean
          google_customer_auth_enabled?: boolean
          hardened_auth_enabled?: boolean
          individual_bootstrap_enabled?: boolean
          municipal_bootstrap_enabled?: boolean
          password_recovery_enabled?: boolean
          session_enforcement_enabled?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_day: number | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          grace_ends_at: string | null
          id: string
          organization_id: string | null
          overrides: Json
          plan_id: string
          plan_version_id: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_event_time: string | null
          provider_subscription_id: string | null
          starts_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_day?: number | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          grace_ends_at?: string | null
          id?: string
          organization_id?: string | null
          overrides?: Json
          plan_id: string
          plan_version_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_event_time?: string | null
          provider_subscription_id?: string | null
          starts_at?: string
          status: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_day?: number | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          grace_ends_at?: string | null
          id?: string
          organization_id?: string | null
          overrides?: Json
          plan_id?: string
          plan_version_id?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_event_time?: string | null
          provider_subscription_id?: string | null
          starts_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sla_policies: {
        Row: {
          default_assignee: string | null
          escalation_minutes: number | null
          plan_id: string
          priority: string
          resolution_minutes: number | null
          response_minutes: number
        }
        Insert: {
          default_assignee?: string | null
          escalation_minutes?: number | null
          plan_id: string
          priority: string
          resolution_minutes?: number | null
          response_minutes: number
        }
        Update: {
          default_assignee?: string | null
          escalation_minutes?: number | null
          plan_id?: string
          priority?: string
          resolution_minutes?: number | null
          response_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_sla_policies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          ticket_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          ticket_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          escalate_at: string | null
          id: string
          organization_id: string | null
          plan_id: string | null
          priority: string
          public_code: string
          requester_id: string
          resolution_due_at: string | null
          response_due_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description: string
          escalate_at?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          priority?: string
          public_code?: string
          requester_id: string
          resolution_due_at?: string | null
          response_due_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          escalate_at?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          priority?: string
          public_code?: string
          requester_id?: string
          resolution_due_at?: string | null
          response_due_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          criadoEm: string | null
          descricao: string | null
          id: string
          mensagem: string | null
          modulo: string | null
          municipio: string | null
          nivel: string | null
          nomeUsuario: string | null
          uidUsuario: string | null
        }
        Insert: {
          criadoEm?: string | null
          descricao?: string | null
          id?: string
          mensagem?: string | null
          modulo?: string | null
          municipio?: string | null
          nivel?: string | null
          nomeUsuario?: string | null
          uidUsuario?: string | null
        }
        Update: {
          criadoEm?: string | null
          descricao?: string | null
          id?: string
          mensagem?: string | null
          modulo?: string | null
          municipio?: string | null
          nivel?: string | null
          nomeUsuario?: string | null
          uidUsuario?: string | null
        }
        Relationships: []
      }
      technical_events: {
        Row: {
          app_version: string | null
          category: string
          correlation_id: string | null
          created_at: string
          event_key: string
          id: number
          metadata: Json
          occurred_at: string
          organization_id: string | null
          platform: string
          severity: string
          summary: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          category: string
          correlation_id?: string | null
          created_at?: string
          event_key?: string
          id?: number
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          platform: string
          severity: string
          summary: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          category?: string
          correlation_id?: string | null
          created_at?: string
          event_key?: string
          id?: number
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          platform?: string
          severity?: string
          summary?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_classes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          criado_por_nome: string | null
          encerrado_em: string | null
          fim_em: string
          formularios_permitidos: string[]
          id: string
          inicio_em: string
          limite_participantes: number
          nome: string
          token: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          encerrado_em?: string | null
          fim_em: string
          formularios_permitidos?: string[]
          id?: string
          inicio_em: string
          limite_participantes: number
          nome: string
          token: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          encerrado_em?: string | null
          fim_em?: string
          formularios_permitidos?: string[]
          id?: string
          inicio_em?: string
          limite_participantes?: number
          nome?: string
          token?: string
        }
        Relationships: []
      }
      training_participants: {
        Row: {
          device_id: string
          entrou_em: string
          id: string
          nome: string
          status: string
          training_class_id: string
          ultimo_acesso_em: string
        }
        Insert: {
          device_id: string
          entrou_em?: string
          id?: string
          nome: string
          status?: string
          training_class_id: string
          ultimo_acesso_em?: string
        }
        Update: {
          device_id?: string
          entrou_em?: string
          id?: string
          nome?: string
          status?: string
          training_class_id?: string
          ultimo_acesso_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_participants_training_class_id_fkey"
            columns: ["training_class_id"]
            isOneToOne: false
            referencedRelation: "training_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          consumed: number
          id: string
          organization_id: string | null
          period_end: string
          period_start: string
          resource_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          consumed?: number
          id?: string
          organization_id?: string | null
          period_end: string
          period_start: string
          resource_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          consumed?: number
          id?: string
          organization_id?: string | null
          period_end?: string
          period_start?: string
          resource_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          amount: number
          created_at: string
          id: number
          operation_key: string
          organization_id: string | null
          resource_code: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          operation_key: string
          organization_id?: string | null
          resource_code: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          operation_key?: string
          organization_id?: string | null
          resource_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tutorial_preferences: {
        Row: {
          completed_at: string | null
          id: string
          organization_id: string | null
          suppressed: boolean
          tutorial_key: string
          tutorial_version: number
          updated_at: string
          user_id: string
          workspace_kind: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          organization_id?: string | null
          suppressed?: boolean
          tutorial_key: string
          tutorial_version?: number
          updated_at?: string
          user_id: string
          workspace_kind: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          organization_id?: string | null
          suppressed?: boolean
          tutorial_key?: string
          tutorial_version?: number
          updated_at?: string
          user_id?: string
          workspace_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tutorial_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          createdAt: string | null
          email: string | null
          fcmToken: string | null
          isApproved: boolean | null
          lastLogin: string | null
          municipio: string | null
          name: string | null
          nameChanged: boolean | null
          organization_id: string | null
          phone: string | null
          role: string | null
          token_limit: number | null
          uid: string
          username: string
        }
        Insert: {
          createdAt?: string | null
          email?: string | null
          fcmToken?: string | null
          isApproved?: boolean | null
          lastLogin?: string | null
          municipio?: string | null
          name?: string | null
          nameChanged?: boolean | null
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          token_limit?: number | null
          uid: string
          username: string
        }
        Update: {
          createdAt?: string | null
          email?: string | null
          fcmToken?: string | null
          isApproved?: boolean | null
          lastLogin?: string | null
          municipio?: string | null
          name?: string | null
          nameChanged?: boolean | null
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          token_limit?: number | null
          uid?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vistorias: {
        Row: {
          agenteNome: string | null
          agenteUid: string | null
          archived_at: string | null
          calculoRisco: Json | null
          criadoEm: string | null
          dataVistoria: string | null
          drive_file_ids: Json | null
          drive_folder_url: string | null
          endereco: string | null
          enderecoBairro: string | null
          enderecoCep: string | null
          enderecoNumero: string | null
          enderecoRua: string | null
          formularioId: string | null
          formularioVersao: number | null
          fotoPath: string | null
          fotosUrls: string[] | null
          fotoUrl: string | null
          id: string
          latitude: number | null
          laudo_gerado_em: string | null
          laudo_url: string | null
          longitude: number | null
          municipio: string | null
          municipio_agente: string | null
          nivelRisco: string | null
          organization_id: string | null
          pontuacaoTotal: number | null
          protocol_seq: number | null
          protocol_series: string | null
          protocol_year: number | null
          protocolo: string | null
          protocolo_seq: number | null
          relatorio_gerado_em: string | null
          responsavelNome: string | null
          respostasJson: Json | null
          sincronizado: boolean | null
          status: string
          storage_location: string
          termo_gerado_em: string | null
        }
        Insert: {
          agenteNome?: string | null
          agenteUid?: string | null
          archived_at?: string | null
          calculoRisco?: Json | null
          criadoEm?: string | null
          dataVistoria?: string | null
          drive_file_ids?: Json | null
          drive_folder_url?: string | null
          endereco?: string | null
          enderecoBairro?: string | null
          enderecoCep?: string | null
          enderecoNumero?: string | null
          enderecoRua?: string | null
          formularioId?: string | null
          formularioVersao?: number | null
          fotoPath?: string | null
          fotosUrls?: string[] | null
          fotoUrl?: string | null
          id?: string
          latitude?: number | null
          laudo_gerado_em?: string | null
          laudo_url?: string | null
          longitude?: number | null
          municipio?: string | null
          municipio_agente?: string | null
          nivelRisco?: string | null
          organization_id?: string | null
          pontuacaoTotal?: number | null
          protocol_seq?: number | null
          protocol_series?: string | null
          protocol_year?: number | null
          protocolo?: string | null
          protocolo_seq?: number | null
          relatorio_gerado_em?: string | null
          responsavelNome?: string | null
          respostasJson?: Json | null
          sincronizado?: boolean | null
          status?: string
          storage_location?: string
          termo_gerado_em?: string | null
        }
        Update: {
          agenteNome?: string | null
          agenteUid?: string | null
          archived_at?: string | null
          calculoRisco?: Json | null
          criadoEm?: string | null
          dataVistoria?: string | null
          drive_file_ids?: Json | null
          drive_folder_url?: string | null
          endereco?: string | null
          enderecoBairro?: string | null
          enderecoCep?: string | null
          enderecoNumero?: string | null
          enderecoRua?: string | null
          formularioId?: string | null
          formularioVersao?: number | null
          fotoPath?: string | null
          fotosUrls?: string[] | null
          fotoUrl?: string | null
          id?: string
          latitude?: number | null
          laudo_gerado_em?: string | null
          laudo_url?: string | null
          longitude?: number | null
          municipio?: string | null
          municipio_agente?: string | null
          nivelRisco?: string | null
          organization_id?: string | null
          pontuacaoTotal?: number | null
          protocol_seq?: number | null
          protocol_series?: string | null
          protocol_year?: number | null
          protocolo?: string | null
          protocolo_seq?: number | null
          relatorio_gerado_em?: string | null
          responsavelNome?: string | null
          respostasJson?: Json | null
          sincronizado?: boolean | null
          status?: string
          storage_location?: string
          termo_gerado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_sessions: {
        Row: {
          attempts: number
          code_expires_at: string | null
          consent_at: string | null
          consent_lgpd: boolean
          context: Json | null
          created_at: string
          expires_at: string | null
          id: string
          last_interaction_at: string
          organization_id: string | null
          phone: string
          state: string
          user_id: string | null
          verification_code: string | null
        }
        Insert: {
          attempts?: number
          code_expires_at?: string | null
          consent_at?: string | null
          consent_lgpd?: boolean
          context?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_interaction_at?: string
          organization_id?: string | null
          phone: string
          state?: string
          user_id?: string | null
          verification_code?: string | null
        }
        Update: {
          attempts?: number
          code_expires_at?: string | null
          consent_at?: string | null
          consent_lgpd?: boolean
          context?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_interaction_at?: string
          organization_id?: string | null
          phone?: string
          state?: string
          user_id?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_agent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          id: string
          jid: string
          nome: string | null
          organization_id: string
          sessao_id: string
          sincronizado_em: string
          telefone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jid: string
          nome?: string | null
          organization_id: string
          sessao_id: string
          sincronizado_em?: string
          telefone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jid?: string
          nome?: string | null
          organization_id?: string
          sessao_id?: string
          sincronizado_em?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "bot_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_bairros: {
        Row: {
          active: boolean
          bairro_id: string
          chat_id: string
          organization_id: string
          sessao_id: string
          validated_at: string
          validated_by: string | null
        }
        Insert: {
          active?: boolean
          bairro_id: string
          chat_id: string
          organization_id: string
          sessao_id: string
          validated_at?: string
          validated_by?: string | null
        }
        Update: {
          active?: boolean
          bairro_id?: string
          chat_id?: string
          organization_id?: string
          sessao_id?: string
          validated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_bairros_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_bairros_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_bairros_sessao_id_chat_id_fkey"
            columns: ["sessao_id", "chat_id"]
            isOneToOne: false
            referencedRelation: "bot_chats"
            referencedColumns: ["sessao_id", "chat_id"]
          },
        ]
      }
    }
    Views: {
      notifications: {
        Row: {
          corpo: string | null
          criada_em: string | null
          destinatario_role: string | null
          destinatario_uid: string | null
          id: string | null
          lida: boolean | null
          municipio: string | null
          payload: Json | null
          tipo: string | null
          titulo: string | null
        }
        Insert: {
          corpo?: string | null
          criada_em?: string | null
          destinatario_role?: string | null
          destinatario_uid?: string | null
          id?: string | null
          lida?: boolean | null
          municipio?: string | null
          payload?: Json | null
          tipo?: string | null
          titulo?: string | null
        }
        Update: {
          corpo?: string | null
          criada_em?: string | null
          destinatario_role?: string | null
          destinatario_uid?: string | null
          id?: string | null
          lida?: boolean | null
          municipio?: string | null
          payload?: Json | null
          tipo?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_legacy_municipal_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      accept_organization_invite: { Args: { p_token: string }; Returns: Json }
      admin_reset_password: {
        Args: { p_new_password: string; p_uid: string }
        Returns: undefined
      }
      ai_assert_internal: { Args: { allow_support?: boolean }; Returns: string }
      ai_cron_status: { Args: never; Returns: Json }
      ai_feature_set_stage: {
        Args: { p_key: string; p_stage: string }
        Returns: undefined
      }
      ai_features_list: { Args: never; Returns: Json }
      ai_grant_remove: { Args: { p_id: string }; Returns: undefined }
      ai_grant_set: {
        Args: {
          p_enabled: boolean
          p_feature_key: string
          p_note: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: string
      }
      ai_grants_list: { Args: never; Returns: Json }
      ai_internal_role: { Args: never; Returns: string }
      ai_key_save: {
        Args: {
          p_api_key: string
          p_id: string
          p_label: string
          p_model: string
          p_monthly_token_limit: number
          p_priority: number
          p_provider: string
          p_use_for: string[]
        }
        Returns: string
      }
      ai_key_set_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      ai_keys_list: { Args: never; Returns: Json }
      ai_module_set: {
        Args: {
          p_enabled: boolean
          p_module_key: string
          p_organization_id: string
        }
        Returns: undefined
      }
      ai_modules_matrix: { Args: never; Returns: Json }
      ai_overview: { Args: never; Returns: Json }
      ai_usage_recent: { Args: { p_limit?: number }; Returns: Json }
      append_document_acknowledgement_correction: {
        Args: {
          p_action: string
          p_original_event_id: string
          p_reason: string
        }
        Returns: Json
      }
      apply_confirmed_commercial_payment: {
        Args: {
          p_amount_cents: number
          p_currency: string
          p_external_reference: string
          p_provider_payload: Json
          p_provider_payment_id: string
        }
        Returns: Json
      }
      apply_municipal_commercial_release: {
        Args: {
          p_days: number
          p_operation_id: string
          p_organization_id: string
          p_plan_version_id: string
        }
        Returns: Json
      }
      approve_invoice_payment: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      authorize_inspection_laudo_generation: {
        Args: { p_customer_id?: string; p_inspection_id: string }
        Returns: Json
      }
      authorize_inspection_upload: {
        Args: { p_inspection_id: string }
        Returns: boolean
      }
      authorize_internal_agent_document: {
        Args: {
          p_customer_id: string
          p_inspection_id: string
          p_kind: string
          p_user_id: string
        }
        Returns: Json
      }
      authorize_internal_customer_document: {
        Args: { p_customer_id: string; p_inspection_id: string; p_kind: string }
        Returns: Json
      }
      authorize_internal_protocol_resource: {
        Args: { p_inspection_id: string; p_kind: string }
        Returns: Json
      }
      begin_customer_affiliation: {
        Args: { p_choice: string; p_token?: string }
        Returns: Json
      }
      begin_mercado_pago_oauth_attempt: {
        Args: {
          p_expires_at: string
          p_pkce_verifier_ciphertext: string
          p_redirect_uri: string
          p_state_hash: string
        }
        Returns: string
      }
      billing_daily_engine: { Args: never; Returns: Json }
      bootstrap_individual_customer: {
        Args: { p_idempotency_key: string; p_terms_version: string }
        Returns: Json
      }
      bootstrap_municipal_customer: {
        Args: { p_idempotency_key: string; p_payload: Json }
        Returns: Json
      }
      bot_authorize_session_access: {
        Args: { p_manage?: boolean; p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      bot_claim_pending_deliveries: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          canal_id: string
          comunicado_id: string
          id: string
        }[]
      }
      bot_delete_auth_state: {
        Args: {
          p_key_category?: string
          p_key_id?: string
          p_session_id: string
        }
        Returns: boolean
      }
      bot_load_auth_state: { Args: { p_session_id: string }; Returns: Json }
      bot_report_session_runtime: {
        Args: {
          p_last_error?: string
          p_session_id: string
          p_state: string
          p_worker_id: string
        }
        Returns: undefined
      }
      bot_report_worker_heartbeat: {
        Args: { p_state?: string; p_version?: string; p_worker_id: string }
        Returns: undefined
      }
      bot_set_auth_state: {
        Args: {
          p_encrypted_payload: string
          p_key_category: string
          p_key_id: string
          p_session_id: string
        }
        Returns: boolean
      }
      bot_template_set: {
        Args: { p_key: string; p_texto: string }
        Returns: undefined
      }
      bot_templates_list: { Args: never; Returns: Json }
      cancel_legacy_invite_tokens: {
        Args: { p_codigos: string[] }
        Returns: number
      }
      chatbot_config_get: { Args: never; Returns: Json }
      chatbot_config_update: {
        Args: {
          p_accept_images?: boolean
          p_feature_permissions?: Json
          p_human_handoff_phone?: string
          p_ia_enabled?: boolean
          p_master_prompt?: string
          p_model_overrides?: Json
          p_numero_bot?: string
          p_session_ttl_hours?: number
          p_welcome_message?: string
        }
        Returns: undefined
      }
      check_email_domain: {
        Args: { p_email: string; p_municipio: string }
        Returns: boolean
      }
      check_email_registered: { Args: { p_email: string }; Returns: boolean }
      check_password_recovery_rate_limit: {
        Args: { p_email: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count: number
          p_uid: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_mercado_pago_credential_refresh: {
        Args: { p_lock_id: string }
        Returns: Json
      }
      claim_public_preview_attempt: {
        Args: { p_client_ip: string; p_device_id: string }
        Returns: Json
      }
      cleanup_password_recovery_requests: { Args: never; Returns: undefined }
      close_training_class: { Args: { p_class_id: string }; Returns: undefined }
      complete_mercado_pago_credential_refresh: {
        Args: {
          p_access_token_expires_at: string
          p_credential_ciphertext: string
          p_lock_id: string
          p_refresh_ciphertext: string
          p_scopes: string[]
        }
        Returns: boolean
      }
      consume_mercado_pago_oauth_attempt: {
        Args: { p_state_hash: string }
        Returns: Json
      }
      consume_password_recovery_quota: {
        Args: { p_email: string; p_ip: string }
        Returns: Json
      }
      consume_subscription_usage: {
        Args: { p_amount?: number; p_resource_code: string }
        Returns: Json
      }
      consumir_token: {
        Args: {
          p_codigo: string
          p_email: string
          p_nome: string
          p_uid: string
        }
        Returns: Json
      }
      convert_individual_customer_to_municipal_organization: {
        Args: {
          p_customer_id: string
          p_display_name: string
          p_import_individual_inspections: boolean
          p_member_role: string
          p_municipality_name: string
          p_operation_id: string
          p_plan_id: string
          p_reason: string
          p_state_code: string
        }
        Returns: Json
      }
      create_commercial_order: {
        Args: {
          p_billing_cycle?: string
          p_kind: string
          p_operation_id: string
          p_organization_id?: string
          p_plan_version_id: string
          p_quantity: number
        }
        Returns: Json
      }
      create_console_invite_token: {
        Args: {
          p_expires_in_minutes: number
          p_municipio: string
          p_operation_id: string
          p_reason: string
          p_role: string
          p_uf: string
        }
        Returns: Json
      }
      create_document_acknowledgement_link: {
        Args: { p_document_id: string; p_expires_in_hours?: number }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      create_internal_customer_appointment: {
        Args: {
          p_address?: string
          p_agent_id?: string
          p_customer_id: string
          p_notes?: string
          p_operation_id?: string
          p_scheduled_at: string
          p_title: string
        }
        Returns: Json
      }
      create_internal_customer_appointment_v2: {
        Args: {
          p_address?: string
          p_agent_id?: string
          p_client_confirmed?: boolean
          p_confirmation_channel?: string
          p_customer_id: string
          p_duration_minutes: number
          p_notes?: string
          p_operation_id?: string
          p_scheduled_at: string
          p_shared_with_team?: boolean
          p_title: string
        }
        Returns: Json
      }
      create_legacy_invite_token: {
        Args: {
          p_expires_in_hours: number
          p_municipio: string
          p_role: string
        }
        Returns: Json
      }
      create_municipio: {
        Args: { p_estado: string; p_nome: string; p_uf: string }
        Returns: Json
      }
      create_notification_campaign:
        | {
            Args: {
              p_body: string
              p_category: string
              p_municipio: string
              p_operation_id: string
              p_payload: Json
              p_platforms: string[]
              p_priority: string
              p_reason: string
              p_roles: string[]
              p_title: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_body: string
              p_category: string
              p_municipio: string
              p_operation_id: string
              p_payload: Json
              p_platforms: string[]
              p_priority: string
              p_reason: string
              p_roles: string[]
              p_scheduled_at?: string
              p_title: string
            }
            Returns: Json
          }
      create_operational_form: {
        Args: { p_descricao?: string; p_titulo: string }
        Returns: string
      }
      create_organization_invite: {
        Args: { p_email?: string; p_expires_in_hours?: number; p_role: string }
        Returns: Json
      }
      create_training_class: {
        Args: {
          p_fim_em: string
          p_inicio_em: string
          p_limite_participantes: number
          p_nome: string
          p_token: string
        }
        Returns: string
      }
      decide_internal_build: {
        Args: { p_approve: boolean; p_reason: string; p_request_id: string }
        Returns: Json
      }
      delete_operational_appointment: {
        Args: { p_id: string }
        Returns: undefined
      }
      delete_operational_form: { Args: { p_id: string }; Returns: undefined }
      delete_operational_inspection: {
        Args: { p_inspection_id: string; p_reason: string }
        Returns: undefined
      }
      disconnect_mercado_pago_connection: { Args: never; Returns: undefined }
      duplicate_operational_form: { Args: { p_id: string }; Returns: string }
      end_active_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: boolean
      }
      enforce_my_operational_rate_limit: {
        Args: { p_action: string }
        Returns: boolean
      }
      expire_stale_active_sessions: { Args: never; Returns: number }
      fail_mercado_pago_credential_refresh: {
        Args: { p_error_code: string; p_lock_id: string }
        Returns: undefined
      }
      finalize_document_acknowledgement: {
        Args: { p_payload: Json }
        Returns: Json
      }
      finalize_inspection_laudo_generation: {
        Args: {
          p_generated_at?: string
          p_inspection_id: string
          p_storage_path: string
        }
        Returns: Json
      }
      finalize_internal_individual_provisioning: {
        Args: {
          p_email: string
          p_mode: string
          p_name: string
          p_operation_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      finalize_remote_document_acknowledgement: {
        Args: { p_payload: Json; p_token_hash: string }
        Returns: Json
      }
      get_ai_features: { Args: never; Returns: string[] }
      get_customer_entry_context: { Args: never; Returns: Json }
      get_customer_entry_context_base: { Args: never; Returns: Json }
      get_customer_entry_context_legacy: { Args: never; Returns: Json }
      get_customer_onboarding_timeline: { Args: never; Returns: Json }
      get_dashboard_kpis_admin: { Args: { p_municipio: string }; Returns: Json }
      get_dashboard_kpis_master: { Args: never; Returns: Json }
      get_dashboard_layout: { Args: { p_role?: string }; Returns: Json }
      get_effective_entitlements: { Args: never; Returns: Json }
      get_internal_agent_map: {
        Args: {
          p_customer_id: string
          p_east?: number
          p_form_id?: string
          p_from?: string
          p_north?: number
          p_risks?: string[]
          p_search?: string
          p_south?: number
          p_status?: string
          p_to?: string
          p_user_id: string
          p_west?: number
          p_zoom?: number
        }
        Returns: Json
      }
      get_internal_agent_operations: {
        Args: { p_customer_id: string; p_user_id: string }
        Returns: Json
      }
      get_internal_agent_summary: {
        Args: {
          p_customer_id: string
          p_form_id?: string
          p_from?: string
          p_risks?: string[]
          p_search?: string
          p_status?: string
          p_to?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_internal_builds_dashboard: {
        Args: { p_event_limit?: number; p_request_limit?: number }
        Returns: Json
      }
      get_internal_customer_detail: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_internal_customer_operations: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_internal_dashboard: { Args: never; Returns: Json }
      get_internal_device_workspace: {
        Args: {
          p_limit?: number
          p_platform?: string
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      get_internal_module_configuration_workspace: {
        Args: never
        Returns: Json
      }
      get_internal_operational_statistics: { Args: never; Returns: Json }
      get_internal_protocol_inspection: {
        Args: { p_inspection_id: string }
        Returns: Json
      }
      get_internal_release_catalog: { Args: never; Returns: Json }
      get_internal_session_detail: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_internal_session_workspace: {
        Args: {
          p_limit?: number
          p_platform?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_internal_staff_profile: { Args: never; Returns: Json }
      get_internal_token_analytics: {
        Args: { p_municipio?: string; p_uf?: string }
        Returns: Json
      }
      get_mercado_pago_connection_credentials: { Args: never; Returns: Json }
      get_mercado_pago_workspace: { Args: never; Returns: Json }
      get_municipios_stats: {
        Args: never
        Returns: {
          alto_risco: number
          municipio: string
          total_agentes: number
          total_vistorias: number
        }[]
      }
      get_my_inbox: {
        Args: {
          p_limit?: number
          p_unread_only?: boolean
          p_workspace_kind: string
        }
        Returns: Json
      }
      get_my_municipio: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_my_user_profile: { Args: never; Returns: Json }
      get_notification_delivery_readiness: { Args: never; Returns: Json }
      get_operational_user: { Args: { p_uid: string }; Returns: Json }
      get_owner_analytics: { Args: never; Returns: Json }
      get_portal_access_context: { Args: never; Returns: Json }
      get_portal_access_context_before_whatsapp: { Args: never; Returns: Json }
      get_public_auth_capabilities: { Args: never; Returns: Json }
      get_public_preview_status: {
        Args: { p_client_ip: string; p_device_id: string }
        Returns: Json
      }
      get_push_token_by_uid: { Args: { p_uid: string }; Returns: string }
      get_risk_by_municipio: {
        Args: never
        Returns: {
          alto: number
          baixo: number
          municipio: string
        }[]
      }
      get_subscription_context: { Args: never; Returns: Json }
      get_top_municipios: { Args: { p_limit?: number }; Returns: Json }
      get_tutorial_preference: {
        Args: {
          p_organization_id: string
          p_tutorial_key: string
          p_tutorial_version: number
          p_workspace_kind: string
        }
        Returns: Json
      }
      has_subscription_feature: {
        Args: { p_feature_code: string }
        Returns: boolean
      }
      heartbeat_active_session: { Args: never; Returns: boolean }
      ingest_client_technical_event: {
        Args: {
          p_app_version: string
          p_category: string
          p_correlation_id: string
          p_event_key: string
          p_metadata?: Json
          p_platform: string
          p_severity: string
          p_summary: string
        }
        Returns: number
      }
      ingest_technical_event: {
        Args: {
          p_app_version: string
          p_category: string
          p_correlation_id: string
          p_event_key: string
          p_metadata?: Json
          p_organization_id: string
          p_platform: string
          p_severity: string
          p_summary: string
        }
        Returns: number
      }
      internal_assign_customer_to_organization: {
        Args: {
          p_import_individual_inspections?: boolean
          p_organization_id: string
          p_reason?: string
          p_role?: string
          p_transfer_existing_membership?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      internal_bot_runtime_status: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      internal_bot_session_pairing_metadata: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      internal_clear_whatsapp_contacts: {
        Args: { p_organization_id: string; p_sessao_id?: string }
        Returns: number
      }
      internal_comunicados_org: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      internal_criar_sessao_bot: {
        Args: { p_organization_id: string }
        Returns: string
      }
      internal_definir_status_sessao_bot: {
        Args: { p_sessao_id: string; p_status: string }
        Returns: boolean
      }
      internal_delete_whatsapp_contact: {
        Args: { p_contact_id: string }
        Returns: boolean
      }
      internal_disparar_envio_bot: {
        Args: { p_canal_id?: string; p_comunicado_id: string }
        Returns: number
      }
      internal_link_customer_to_organization: {
        Args: { p_organization_id: string; p_role?: string; p_user_id: string }
        Returns: Json
      }
      internal_list_bot_runtime_status: { Args: never; Returns: Json }
      internal_list_orgs_comunicados: { Args: never; Returns: Json }
      internal_list_whatsapp_contacts: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      internal_listar_sessoes_bot: { Args: never; Returns: Json }
      internal_operar_sessao_bot: {
        Args: { p_acao: string; p_sessao_id: string }
        Returns: boolean
      }
      internal_reset_password: {
        Args: { p_new_password: string; p_target_user_id: string }
        Returns: Json
      }
      internal_set_comunicado_status: {
        Args: {
          p_comunicado_id: string
          p_publicar_em?: string
          p_status: string
        }
        Returns: boolean
      }
      internal_upsert_canal_externo: {
        Args: { p_payload: Json }
        Returns: string
      }
      internal_upsert_comunicado: { Args: { p_payload: Json }; Returns: string }
      internal_vincular_canal_chat: {
        Args: { p_canal_id: string; p_chat_id: string }
        Returns: boolean
      }
      is_approved: { Args: never; Returns: boolean }
      is_owner_admin: { Args: never; Returns: boolean }
      issue_commercial_token: {
        Args: {
          p_benefit: Json
          p_expires_at: string
          p_kind: string
          p_max_uses: number
          p_operation_id: string
          p_reason: string
        }
        Returns: Json
      }
      list_commercial_activation_tokens: { Args: never; Returns: Json }
      list_console_invite_tokens: {
        Args: { p_municipio?: string }
        Returns: {
          created_at: string
          expires_at: string
          management_id: string
          municipio: string
          revoked_at: string
          role: string
          status: string
          used: boolean
        }[]
      }
      list_internal_agent_inspections: {
        Args: {
          p_cursor_at?: string
          p_cursor_id?: string
          p_customer_id: string
          p_form_id?: string
          p_from?: string
          p_page_size?: number
          p_risks?: string[]
          p_search?: string
          p_status?: string
          p_to?: string
          p_user_id: string
        }
        Returns: Json
      }
      list_internal_audit_timeline: {
        Args: {
          p_from?: string
          p_limit?: number
          p_result?: string
          p_search?: string
          p_source?: string
          p_to?: string
        }
        Returns: Json
      }
      list_internal_customers: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      list_internal_forms: { Args: never; Returns: Json }
      list_internal_plan_catalog: { Args: never; Returns: Json }
      list_internal_protocol_agents: { Args: never; Returns: Json }
      list_internal_protocol_registry:
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_organization_id?: string
              p_search?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_organization_id?: string
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
      list_internal_protocol_series: { Args: never; Returns: Json }
      list_internal_risk_configs: { Args: never; Returns: Json }
      list_internal_staff_permission_overrides: {
        Args: never
        Returns: {
          effect: string
          permission: string
          staff_user_id: string
        }[]
      }
      list_internal_support_plan_options: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      list_internal_support_queue: {
        Args: {
          p_assignee_id?: string
          p_customer_id?: string
          p_limit?: number
          p_offset?: number
          p_plan_id?: string
          p_priority?: string
          p_search?: string
          p_sla?: string
          p_status?: string
        }
        Returns: Json
      }
      list_internal_technical_events: {
        Args: {
          p_category?: string
          p_customer_id?: string
          p_from?: string
          p_limit?: number
          p_platform?: string
          p_severity?: string
          p_to?: string
          p_version?: string
        }
        Returns: Json
      }
      list_internal_token_municipalities: {
        Args: never
        Returns: {
          nome: string
        }[]
      }
      list_mobile_form_catalog: {
        Args: never
        Returns: {
          ativo: boolean
          atualizado_em: string
          codigo_sistema: string
        }[]
      }
      list_notification_campaign_municipalities: {
        Args: never
        Returns: {
          nome: string
        }[]
      }
      list_notification_campaigns: {
        Args: never
        Returns: {
          category: string
          completed_at: string
          created_at: string
          failed_count: number
          failure_reason: string
          id: string
          municipio: string
          priority: string
          recipient_count: number
          scheduled_at: string
          sent_count: number
          skipped_count: number
          status: string
          target_platforms: string[]
          target_roles: string[]
          title: string
        }[]
      }
      list_operational_users: {
        Args: {
          p_include_unapproved?: boolean
          p_limit?: number
          p_municipio?: string
          p_offset?: number
          p_role?: string
        }
        Returns: {
          createdAt: string
          email: string
          isApproved: boolean
          municipio: string
          name: string
          role: string
          token_limit: number
          uid: string
        }[]
      }
      list_unlinked_agents_for_internal_link: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          email: string
          name: string
          user_id: string
        }[]
      }
      manage_internal_staff: {
        Args: {
          p_operation_id: string
          p_reason: string
          p_role: string
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      manage_internal_staff_permissions: {
        Args: {
          p_grants: string[]
          p_operation_id: string
          p_reason: string
          p_revokes: string[]
          p_user_id: string
        }
        Returns: Json
      }
      mark_all_inbox_messages_read: {
        Args: { p_workspace_kind: string }
        Returns: number
      }
      mark_inbox_message_read: {
        Args: { p_event_id: string; p_workspace_kind: string }
        Returns: boolean
      }
      mark_inspection_document_generated: {
        Args: { p_document_type: string; p_inspection_id: string }
        Returns: string
      }
      mark_token_used: {
        Args: {
          p_codigo: string
          p_ip?: string
          p_nome?: string
          p_uid?: string
        }
        Returns: boolean
      }
      mascarar_telefone: { Args: { p_telefone: string }; Returns: string }
      master_delete_user: {
        Args: { p_delete_vistorias?: boolean; p_target_uid: string }
        Returns: undefined
      }
      mutate_internal_agent_access: {
        Args: {
          p_action: string
          p_customer_id: string
          p_new_password: string
          p_operation_id: string
          p_reason: string
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      mutate_internal_form: {
        Args: {
          p_action: string
          p_form_id: string
          p_operation_id: string
          p_payload: Json
          p_reason: string
        }
        Returns: Json
      }
      mutate_internal_individual: {
        Args: {
          p_action: string
          p_customer_id: string
          p_operation_id: string
          p_payload: Json
          p_reason: string
        }
        Returns: Json
      }
      mutate_internal_organization: {
        Args: {
          p_action: string
          p_operation_id: string
          p_organization_id: string
          p_payload: Json
          p_reason: string
        }
        Returns: Json
      }
      mutate_internal_plan: {
        Args: {
          p_commercial: Json
          p_features: Json
          p_limits: Json
          p_operation_id: string
          p_plan: Json
          p_plan_id: string
          p_reason: string
          p_sla: Json
        }
        Returns: Json
      }
      mutate_internal_release: {
        Args: {
          p_action: string
          p_changelog: string
          p_operation_id: string
          p_reason: string
          p_version: string
        }
        Returns: Json
      }
      mutate_internal_risk_config: {
        Args: {
          p_action: string
          p_configuration: Json
          p_municipality: string
          p_operation_id: string
          p_reason: string
          p_target_version: number
        }
        Returns: Json
      }
      mutate_internal_subscription: {
        Args: {
          p_action: string
          p_customer_id: string
          p_operation_id: string
          p_payload: Json
          p_reason: string
          p_subscription_id: string
        }
        Returns: Json
      }
      mutate_internal_support_ticket: {
        Args: {
          p_action: string
          p_message: string
          p_operation_id: string
          p_ticket_id: string
          p_value: string
        }
        Returns: Json
      }
      my_billing_invoices: {
        Args: never
        Returns: {
          aprovado_por: string | null
          atualizado_em: string
          competencia: string
          comprovante_enviado_em: string | null
          comprovante_path: string | null
          criado_em: string
          id: string
          motivo_rejeicao: string | null
          organization_id: string
          pago_em: string | null
          status: string
          subscription_id: string
          valor_centavos: number
          vencimento: string
        }[]
        SetofOptions: {
          from: "*"
          to: "billing_invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_organization_ids: { Args: never; Returns: string[] }
      my_ticket_events: {
        Args: { p_ticket_id: string }
        Returns: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          ticket_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "support_ticket_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      open_support_ticket: {
        Args: {
          p_category: string
          p_description: string
          p_priority?: string
          p_subject: string
        }
        Returns: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          escalate_at: string | null
          id: string
          organization_id: string | null
          plan_id: string | null
          priority: string
          public_code: string
          requester_id: string
          resolution_due_at: string | null
          response_due_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      portal_accept_organization_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      portal_accept_organization_invite_with_history: {
        Args: { p_import_individual_inspections?: boolean; p_token: string }
        Returns: Json
      }
      portal_authorize_acknowledgement_document: {
        Args: { p_asset: string; p_event_id: string }
        Returns: Json
      }
      portal_bot_runtime_status: { Args: never; Returns: Json }
      portal_bot_session_pairing_metadata: { Args: never; Returns: Json }
      portal_create_appointment: {
        Args: {
          p_inspection_id?: string
          p_notes?: string
          p_scheduled_at?: string
          p_title?: string
        }
        Returns: Json
      }
      portal_create_document_acknowledgement_link: {
        Args: { p_document_id: string; p_expires_in_hours?: number }
        Returns: Json
      }
      portal_create_organization_invite: {
        Args: { p_email: string; p_expires_in_hours?: number; p_role: string }
        Returns: Json
      }
      portal_criar_sessao_bot: { Args: never; Returns: string }
      portal_definir_status_sessao_bot: {
        Args: { p_sessao_id: string; p_status: string }
        Returns: boolean
      }
      portal_delete_bairro: { Args: { p_bairro_id: string }; Returns: boolean }
      portal_delete_canal_externo: {
        Args: { p_canal_id: string }
        Returns: boolean
      }
      portal_delete_comunicado: {
        Args: { p_comunicado_id: string }
        Returns: boolean
      }
      portal_disparar_envio_bot: {
        Args: { p_canal_id?: string; p_comunicado_id: string }
        Returns: number
      }
      portal_end_own_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      portal_ensure_individual_profile: { Args: never; Returns: Json }
      portal_get_checkout_status: {
        Args: { p_checkout_id: string }
        Returns: Json
      }
      portal_get_dashboard: { Args: never; Returns: Json }
      portal_get_inspection: {
        Args: { p_inspection_id: string }
        Returns: Json
      }
      portal_get_invite_preview: { Args: { p_token: string }; Returns: Json }
      portal_get_map_workspace: { Args: never; Returns: Json }
      portal_get_workspace: { Args: { p_section: string }; Returns: Json }
      portal_get_workspace_unchecked: {
        Args: { p_section: string }
        Returns: Json
      }
      portal_link_commercial_order: {
        Args: { p_checkout_id: string; p_commercial_order_id: string }
        Returns: Json
      }
      portal_list_acknowledgements: { Args: never; Returns: Json }
      portal_list_bairros: { Args: never; Returns: Json }
      portal_list_bot_chats: { Args: never; Returns: Json }
      portal_list_canais_externos: { Args: never; Returns: Json }
      portal_list_comunicados: { Args: never; Returns: Json }
      portal_list_own_sessions: {
        Args: never
        Returns: {
          device_name: string
          id: string
          last_heartbeat_at: string
          last_ip_masked: string
          mac_masked: string
          platform: string
          started_at: string
          status: string
        }[]
      }
      portal_list_whatsapp_responsibles: { Args: never; Returns: Json }
      portal_listar_sessoes_bot: { Args: never; Returns: Json }
      portal_module_access_allowed: {
        Args: { p_module: string }
        Returns: boolean
      }
      portal_operar_sessao_bot: {
        Args: { p_acao: string; p_sessao_id: string }
        Returns: boolean
      }
      portal_publish_due_comunicados: { Args: never; Returns: number }
      portal_register_comunicado_leitura: {
        Args: { p_comunicado_id: string }
        Returns: boolean
      }
      portal_registrar_envio_canal: {
        Args: { p_canal_id: string; p_comunicado_id: string }
        Returns: boolean
      }
      portal_revoke_document_acknowledgement_link: {
        Args: { p_document_id: string }
        Returns: Json
      }
      portal_set_canal_ativo: {
        Args: { p_ativo: boolean; p_canal_id: string }
        Returns: boolean
      }
      portal_set_comunicado_status: {
        Args: {
          p_comunicado_id: string
          p_publicar_em?: string
          p_status: string
        }
        Returns: boolean
      }
      portal_set_whatsapp_responsible: {
        Args: {
          p_enabled: boolean
          p_operation_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: boolean
      }
      portal_update_organization_member: {
        Args: {
          p_confirmation: string
          p_member_id: string
          p_reason: string
          p_role: string
          p_status: string
        }
        Returns: Json
      }
      portal_update_organization_settings: {
        Args: {
          p_confirmation: string
          p_contact_email: string
          p_contact_name: string
          p_display_name: string
          p_reason: string
          p_session_timeout_minutes: number
        }
        Returns: Json
      }
      portal_upsert_bairro: {
        Args: { p_bairro_id?: string; p_nome: string }
        Returns: string
      }
      portal_upsert_canal_externo: {
        Args: { p_payload: Json }
        Returns: string
      }
      portal_upsert_comunicado: { Args: { p_payload: Json }; Returns: string }
      portal_vincular_canal_chat: {
        Args: { p_canal_id: string; p_chat_id: string }
        Returns: boolean
      }
      prepare_bot_session_pairing: {
        Args: {
          p_identification: string
          p_method: string
          p_phone: string
          p_session_id: string
        }
        Returns: Json
      }
      prepare_legacy_invite_signup: {
        Args: { p_codigo: string; p_email: string }
        Returns: Json
      }
      preview_individual_inspection_import: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      provision_organization_with_coordinator: {
        Args: {
          p_coordinator_email: string
          p_coordinator_password?: string
          p_org_data: Json
          p_reason?: string
          p_send_email_invite?: boolean
        }
        Returns: Json
      }
      publish_module_configuration: {
        Args: {
          p_modules: Json
          p_operation_id: string
          p_reason: string
          p_scope: Json
        }
        Returns: Json
      }
      qe_fila: {
        Args: never
        Returns: {
          agente_nome: string
          ciclo: number
          criado_em: string
          data_vistoria: string
          endereco: string
          nivel_risco: string
          revisao_id: string
          status: string
          vistoria_id: string
        }[]
      }
      qe_revisar: {
        Args: {
          p_aprovado: boolean
          p_checklist: Json
          p_nota: number
          p_parecer: string
          p_revisao_id: string
        }
        Returns: undefined
      }
      qe_status_vistoria: {
        Args: { p_vistoria_id: string }
        Returns: {
          ciclo: number
          nota: number
          parecer: string
          respondida_em: string
          status: string
        }[]
      }
      reconcile_customer_identity: { Args: never; Returns: Json }
      record_customer_onboarding_funnel: {
        Args: { p_event: string; p_request_id?: string; p_source?: string }
        Returns: boolean
      }
      record_denied_owner_access: { Args: never; Returns: undefined }
      record_google_identity_reconciled: { Args: never; Returns: boolean }
      record_internal_access_denied: {
        Args: {
          p_action: string
          p_reason?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: undefined
      }
      record_internal_session_review: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      record_password_recovery_completed: {
        Args: { p_other_sessions_revoked?: boolean }
        Returns: boolean
      }
      record_password_recovery_request: {
        Args: { p_email: string; p_ip?: string }
        Returns: undefined
      }
      redeem_commercial_token: {
        Args: { p_operation_id: string; p_token: string }
        Returns: Json
      }
      refresh_public_marketing_snapshot: { Args: never; Returns: undefined }
      register_active_session: {
        Args: {
          p_device_id: string
          p_device_name?: string
          p_mac_address?: string
          p_platform?: string
          p_replace?: boolean
        }
        Returns: Json
      }
      register_generated_document: { Args: { p_payload: Json }; Returns: Json }
      register_my_notification_endpoint: {
        Args: {
          p_endpoint: string
          p_platform: string
          p_provider: string
          p_subscription?: Json
        }
        Returns: Json
      }
      reject_invoice_receipt: {
        Args: { p_invoice_id: string; p_motivo: string }
        Returns: undefined
      }
      reply_support_ticket: {
        Args: { p_message: string; p_ticket_id: string }
        Returns: undefined
      }
      request_internal_build: {
        Args: {
          p_changelog: string
          p_environment: string
          p_operation_id: string
          p_profile: string
          p_provider: string
          p_reason: string
          p_version: string
        }
        Returns: Json
      }
      request_sensitive_support_access: {
        Args: { p_customer_key: string; p_reason: string; p_ticket_id: string }
        Returns: Json
      }
      reset_municipio_risk_config: { Args: never; Returns: undefined }
      retention_daily_engine: { Args: never; Returns: Json }
      reveal_console_invite_token: {
        Args: { p_management_id: string; p_operation_id: string }
        Returns: Json
      }
      review_plan_purchase_request: {
        Args: { p_action: string; p_request_id: string; p_review_note?: string }
        Returns: Json
      }
      revoke_commercial_activation_token: {
        Args: { p_operation_id: string; p_reason: string; p_token_id: string }
        Returns: Json
      }
      revoke_console_invite_token: {
        Args: {
          p_management_id: string
          p_operation_id: string
          p_reason: string
        }
        Returns: Json
      }
      rotate_internal_protocol_series: {
        Args: {
          p_code: string
          p_operation_id: string
          p_organization_id: string
          p_reason: string
        }
        Returns: Json
      }
      run_billing_engine_now: { Args: never; Returns: Json }
      save_dashboard_layout: {
        Args: { p_layout: Json; p_role: string }
        Returns: undefined
      }
      save_dashboard_layout_global: {
        Args: { p_layout: Json; p_role: string }
        Returns: undefined
      }
      save_municipio_risk_config: {
        Args: { p_configuracao: Json }
        Returns: undefined
      }
      search_internal_affiliation_candidates: {
        Args: { p_limit?: number; p_organization_id: string; p_query: string }
        Returns: Json
      }
      search_internal_protocol_registry: {
        Args: {
          p_agent_user_id?: string
          p_limit?: number
          p_municipio?: string
          p_offset?: number
          p_order?: string
          p_organization_id?: string
          p_search?: string
          p_status?: string
          p_uf?: string
        }
        Returns: Json
      }
      set_municipio_email_domains: {
        Args: { p_dominios: string[]; p_nome: string }
        Returns: string[]
      }
      set_operational_form_publication: {
        Args: { p_id: string; p_publicado: boolean }
        Returns: undefined
      }
      set_tutorial_preference: {
        Args: {
          p_completed: boolean
          p_organization_id: string
          p_suppressed: boolean
          p_tutorial_key: string
          p_tutorial_version: number
          p_workspace_kind: string
        }
        Returns: boolean
      }
      set_user_approval: {
        Args: { p_is_approved: boolean; p_target_uid: string }
        Returns: Json
      }
      simulate_internal_risk_config: {
        Args: { p_configuration: Json; p_score: number }
        Returns: Json
      }
      store_mercado_pago_connection: {
        Args: {
          p_access_token_expires_at: string
          p_actor_id: string
          p_credential_ciphertext: string
          p_provider_user_id: string
          p_refresh_ciphertext: string
          p_scopes: string[]
        }
        Returns: undefined
      }
      submit_invoice_receipt: {
        Args: { p_comprovante_path: string; p_invoice_id: string }
        Returns: undefined
      }
      submit_plan_purchase_request: {
        Args: {
          p_billing_cycle: string
          p_contact_email: string
          p_contact_name: string
          p_contact_phone?: string
          p_customer_message?: string
          p_municipality_name?: string
          p_organization_name?: string
          p_plan_code: string
        }
        Returns: Json
      }
      sync_finalized_inspection: { Args: { p_inspection: Json }; Returns: Json }
      training_class_cleanup: { Args: never; Returns: number }
      training_class_entry: {
        Args: { p_device_id: string; p_nome: string; p_token: string }
        Returns: Json
      }
      training_class_leave: {
        Args: { p_class_id: string; p_device_id: string }
        Returns: Json
      }
      training_expire_elapsed_classes: { Args: never; Returns: number }
      transition_operational_appointment: {
        Args: { p_id: string; p_inspection_id?: string; p_status: string }
        Returns: undefined
      }
      update_customer_onboarding_checklist: {
        Args: {
          p_completed?: boolean
          p_item: string
          p_request_id?: string
          p_source?: string
        }
        Returns: Json
      }
      update_inspection_media: {
        Args: {
          p_extra_photos?: string[]
          p_inspection_id: string
          p_primary_photo?: string
        }
        Returns: undefined
      }
      update_inspection_requester: {
        Args: { p_inspection_id: string; p_requester_name: string }
        Returns: undefined
      }
      update_internal_archive_configuration: {
        Args: {
          p_days_threshold: number
          p_enabled: boolean
          p_mode: string
          p_operation_id: string
          p_reason: string
        }
        Returns: Json
      }
      update_my_display_name: { Args: { p_name: string }; Returns: Json }
      update_my_phone: { Args: { p_phone: string }; Returns: Json }
      update_my_push_token: { Args: { p_token: string }; Returns: undefined }
      update_operational_form_questions: {
        Args: {
          p_classificacao?: Json
          p_id: string
          p_perguntas: Json
          p_tipo_calculo?: string
        }
        Returns: number
      }
      update_plan_commercial_configuration: {
        Args: {
          p_commercial: Json
          p_features: Json
          p_limits: Json
          p_plan: Json
          p_plan_id: string
          p_sla: Json
        }
        Returns: Json
      }
      upsert_operational_appointment: {
        Args: { p_payload: Json }
        Returns: string
      }
      validate_invite_token: {
        Args: { p_codigo: string }
        Returns: {
          codigo: string
          criadoPor: string
          expiraEm: string
          motivo: string
          municipio: string
          role: string
          valido: boolean
        }[]
      }
      whatsapp_session_revoke: { Args: { p_id: string }; Returns: undefined }
      whatsapp_sessions_list: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
