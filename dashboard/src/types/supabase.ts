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
    PostgrestVersion: "14.4"
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
          criado_em: string | null
          criado_por_nome: string | null
          criado_por_uid: string | null
          data_agendada: string
          endereco: string | null
          id: string
          inspection_id: string | null
          lat: number | null
          lng: number | null
          municipio: string
          observacoes: string | null
          organization_id: string | null
          status: string | null
          titulo: string
        }
        Insert: {
          agente_nome?: string | null
          agente_uid?: string | null
          criado_em?: string | null
          criado_por_nome?: string | null
          criado_por_uid?: string | null
          data_agendada: string
          endereco?: string | null
          id?: string
          inspection_id?: string | null
          lat?: number | null
          lng?: number | null
          municipio: string
          observacoes?: string | null
          organization_id?: string | null
          status?: string | null
          titulo: string
        }
        Update: {
          agente_nome?: string | null
          agente_uid?: string | null
          criado_em?: string | null
          criado_por_nome?: string | null
          criado_por_uid?: string | null
          data_agendada?: string
          endereco?: string | null
          id?: string
          inspection_id?: string | null
          lat?: number | null
          lng?: number | null
          municipio?: string
          observacoes?: string | null
          organization_id?: string | null
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
            foreignKeyName: "agendamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
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
          prioridade?: string
          status?: string
          supervisor_nome?: string
          supervisor_uid?: string
        }
        Relationships: []
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
        }
        Relationships: []
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
          criadoEm: string | null
          criadoPorNome: string
          criadoPorUid: string | null
          descricao: string | null
          fases: Json | null
          id: string
          municipio: string | null
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
          criadoEm?: string | null
          criadoPorNome?: string
          criadoPorUid?: string | null
          descricao?: string | null
          fases?: Json | null
          id?: string
          municipio?: string | null
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
          criadoEm?: string | null
          criadoPorNome?: string
          criadoPorUid?: string | null
          descricao?: string | null
          fases?: Json | null
          id?: string
          municipio?: string | null
          perguntas?: Json | null
          publicadoEm?: string | null
          status?: string
          tipoCalculo?: string | null
          titulo?: string
          versao?: number
        }
        Relationships: []
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
      invite_tokens: {
        Row: {
          codigo: string
          criadoEm: string
          criadoPor: string | null
          criadoPorNome: string
          email_destinatario: string | null
          expiraEm: string | null
          municipio: string | null
          notificadoExpirando: boolean
          organization_id: string | null
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
          municipio?: string | null
          notificadoExpirando?: boolean
          organization_id?: string | null
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
          municipio?: string | null
          notificadoExpirando?: boolean
          organization_id?: string | null
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
      public_marketing_snapshot: {
        Row: {
          agentes: number
          id: boolean
          latest_protocols: Json
          pendencias: number
          total_vistorias: number
          updated_at: string
        }
        Insert: {
          agentes?: number
          id?: boolean
          latest_protocols?: Json
          pendencias?: number
          total_vistorias?: number
          updated_at?: string
        }
        Update: {
          agentes?: number
          id?: boolean
          latest_protocols?: Json
          pendencias?: number
          total_vistorias?: number
          updated_at?: string
        }
        Relationships: []
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
      bootstrap_individual_customer: {
        Args: { p_idempotency_key: string; p_terms_version: string }
        Returns: Json
      }
      bootstrap_municipal_customer: {
        Args: { p_idempotency_key: string; p_payload: Json }
        Returns: Json
      }
      claim_internal_archive_restore: {
        Args: { p_request_id: string }
        Returns: Json
      }
      decide_internal_archive_restore: {
        Args: { p_approve: boolean; p_reason: string; p_request_id: string }
        Returns: Json
      }
      list_internal_archive_lifecycle: {
        Args: { p_limit?: number }
        Returns: Json
      }
      request_internal_archive_restore: {
        Args: {
          p_inspection_ids: string[]
          p_operation_id: string
          p_reason: string
        }
        Returns: Json
      }
      accept_organization_invite: { Args: { p_token: string }; Returns: Json }
      get_customer_entry_context: { Args: never; Returns: Json }
      get_customer_onboarding_timeline: { Args: never; Returns: Json }
      get_public_auth_capabilities: { Args: never; Returns: Json }
      get_portal_access_context: { Args: never; Returns: Json }
      prepare_legacy_invite_signup: {
        Args: { p_codigo: string; p_email: string }
        Returns: Json
      }
      portal_ensure_individual_profile: { Args: never; Returns: Json }
      portal_get_dashboard: { Args: never; Returns: Json }
      portal_get_workspace: { Args: { p_section: string }; Returns: Json }
      reconcile_customer_identity: { Args: never; Returns: Json }
      record_google_identity_reconciled: { Args: never; Returns: boolean }
      record_password_recovery_completed: {
        Args: { p_other_sessions_revoked?: boolean }
        Returns: boolean
      }
      record_customer_onboarding_funnel: {
        Args: { p_event: string; p_request_id?: string; p_source?: string }
        Returns: boolean
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
      portal_create_appointment: {
        Args: {
          p_inspection_id: string | null
          p_notes?: string | null
          p_scheduled_at: string
          p_title: string
        }
        Returns: Json
      }
      portal_get_inspection: { Args: { p_inspection_id: string }; Returns: Json }
      portal_list_own_sessions: { Args: never; Returns: Json }
      portal_end_own_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      portal_authorize_inspection_document: {
        Args: { p_inspection_id: string }
        Returns: Json
      }
      portal_get_invite_preview: { Args: { p_token: string }; Returns: Json }
      portal_create_organization_invite: {
        Args: { p_email: string; p_expires_in_hours?: number; p_role: string }
        Returns: Json
      }
      portal_accept_organization_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      portal_revoke_organization_invite: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      portal_create_checkout: {
        Args: {
          p_idempotency_key: string
          p_periodicity: string
          p_plan_code: string
        }
        Returns: Json
      }
      portal_get_checkout_status: {
        Args: { p_checkout_id: string }
        Returns: Json
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
      portal_process_payment_event: {
        Args: {
          p_event_type: string
          p_payload_hash: string
          p_provider: string
          p_provider_event_id: string
          p_provider_event_time: string
          p_provider_session_id: string
          p_provider_subscription_id?: string | null
          p_subscription_status: string
        }
        Returns: Json
      }
      admin_reset_password: {
        Args: { p_new_password: string; p_uid: string }
        Returns: undefined
      }
      check_email_domain: {
        Args: { p_email: string; p_municipio: string }
        Returns: boolean
      }
      check_email_registered: { Args: { p_email: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count: number
          p_uid: string
          p_window_seconds: number
        }
        Returns: boolean
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
      create_organization_invite: {
        Args: { p_email?: string; p_expires_in_hours?: number; p_role: string }
        Returns: Json
      }
      decide_internal_build: {
        Args: { p_approve: boolean; p_reason: string; p_request_id: string }
        Returns: Json
      }
      end_active_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: boolean
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
      get_dashboard_kpis_admin: { Args: { p_municipio: string }; Returns: Json }
      get_dashboard_kpis_master: { Args: never; Returns: Json }
      get_internal_customer_detail: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_internal_customer_operations: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_internal_agent_summary: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_from?: string | null
          p_to?: string | null
          p_risks?: string[] | null
          p_status?: string | null
          p_form_id?: string | null
          p_search?: string | null
        }
        Returns: Json
      }
      list_internal_agent_inspections: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_from?: string | null
          p_to?: string | null
          p_risks?: string[] | null
          p_status?: string | null
          p_form_id?: string | null
          p_search?: string | null
          p_cursor_at?: string | null
          p_cursor_id?: string | null
          p_page_size?: number
        }
        Returns: Json
      }
      get_internal_agent_map: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_from?: string | null
          p_to?: string | null
          p_risks?: string[] | null
          p_status?: string | null
          p_form_id?: string | null
          p_search?: string | null
          p_west?: number | null
          p_south?: number | null
          p_east?: number | null
          p_north?: number | null
          p_zoom?: number
        }
        Returns: Json
      }
      get_internal_agent_operations: {
        Args: { p_customer_id: string; p_user_id: string }
        Returns: Json
      }
      create_internal_customer_appointment: {
        Args: {
          p_customer_id: string
          p_title: string
          p_scheduled_at: string
          p_address?: string | null
          p_agent_id?: string | null
          p_notes?: string | null
          p_operation_id?: string
        }
        Returns: Json
      }
      authorize_internal_customer_document: {
        Args: {
          p_customer_id: string
          p_inspection_id: string
          p_kind: string
        }
        Returns: Json
      }
      authorize_inspection_laudo_generation: {
        Args: {
          p_inspection_id: string
          p_customer_id?: string | null
        }
        Returns: Json
      }
      authorize_internal_agent_document: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_inspection_id: string
          p_kind: string
        }
        Returns: Json
      }
      mutate_internal_agent_access: {
        Args: {
          p_customer_id: string
          p_user_id: string
          p_action: string
          p_session_id: string | null
          p_new_password: string | null
          p_reason: string
          p_operation_id: string
        }
        Returns: Json
      }
      get_internal_dashboard: { Args: never; Returns: Json }
      get_internal_staff_profile: { Args: never; Returns: Json }
      get_municipios_stats: {
        Args: never
        Returns: {
          alto_risco: number
          municipio: string
          total_agentes: number
          total_vistorias: number
        }[]
      }
      get_my_municipio: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
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
      is_approved: { Args: never; Returns: boolean }
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
      list_internal_risk_configs: { Args: never; Returns: Json }
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
      mark_token_used: {
        Args: {
          p_codigo: string
          p_ip?: string
          p_nome?: string
          p_uid?: string
        }
        Returns: boolean
      }
      master_delete_user: {
        Args: { p_delete_vistorias?: boolean; p_target_uid: string }
        Returns: undefined
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
      record_denied_owner_access: { Args: never; Returns: undefined }
      record_internal_access_denied: {
        Args: {
          p_action: string
          p_reason?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: undefined
      }
      register_active_session: {
        Args: {
          p_device_id: string
          p_device_name?: string
          p_platform?: string
          p_replace?: boolean
        }
        Returns: Json
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
      simulate_internal_risk_config: {
        Args: { p_configuration: Json; p_score: number }
        Returns: Json
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
