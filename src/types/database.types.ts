export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "master" | "admin" | "user";
export type CompanyStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface Database {
  public: {
    Tables: {
      planos: {
        Row: {
          id: number;
          nome: string;
          preco_mensal: number;
          max_usuarios: number;
          max_agentes: number;
          limite_mensagens_mes: number;
          stripe_price_id: string | null;
          features: Json;
          is_active: boolean;
          cor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          nome: string;
          preco_mensal?: number;
          max_usuarios?: number;
          max_agentes?: number;
          limite_mensagens_mes?: number;
          stripe_price_id?: string | null;
          features?: Json;
          is_active?: boolean;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          nome?: string;
          preco_mensal?: number;
          max_usuarios?: number;
          max_agentes?: number;
          limite_mensagens_mes?: number;
          stripe_price_id?: string | null;
          features?: Json;
          is_active?: boolean;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      empresas: {
        Row: {
          id: number;
          nome: string;
          plano_id: number | null;
          chave_api_llm: string | null;
          chave_api_mascarada: string | null;
          contexto_ia: Json;
          stripe_customer_id: string | null;
          email: string | null;
          telefone: string | null;
          endereco: string | null;
          status: CompanyStatus;
          data_adesao: string | null;
          proxima_cobranca: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          nome: string;
          plano_id?: number | null;
          chave_api_llm?: string | null;
          chave_api_mascarada?: string | null;
          contexto_ia?: Json;
          stripe_customer_id?: string | null;
          email?: string | null;
          telefone?: string | null;
          endereco?: string | null;
          status?: CompanyStatus;
          data_adesao?: string | null;
          proxima_cobranca?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          nome?: string;
          plano_id?: number | null;
          chave_api_llm?: string | null;
          chave_api_mascarada?: string | null;
          contexto_ia?: Json;
          stripe_customer_id?: string | null;
          email?: string | null;
          telefone?: string | null;
          endereco?: string | null;
          status?: CompanyStatus;
          data_adesao?: string | null;
          proxima_cobranca?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      perfis: {
        Row: {
          id: string;
          empresa_id: number;
          role: UserRole;
          email: string;
          nome_completo: string;
          telefone: string | null;
          cargo: string | null;
          status: string;
          ultimo_acesso: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          empresa_id: number;
          role?: UserRole;
          email: string;
          nome_completo: string;
          telefone?: string | null;
          cargo?: string | null;
          status?: string;
          ultimo_acesso?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          empresa_id?: number;
          role?: UserRole;
          email?: string;
          nome_completo?: string;
          telefone?: string | null;
          cargo?: string | null;
          status?: string;
          ultimo_acesso?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      agentes_ia: {
        Row: {
          id: number;
          empresa_id: number;
          nome: string;
          instrucoes: string;
          icone_url: string | null;
          descricao: string | null;
          is_active: boolean;
          is_popular: boolean;
          cor: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          empresa_id: number;
          nome: string;
          instrucoes: string;
          icone_url?: string | null;
          descricao?: string | null;
          is_active?: boolean;
          is_popular?: boolean;
          cor?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          empresa_id?: number;
          nome?: string;
          instrucoes?: string;
          icone_url?: string | null;
          descricao?: string | null;
          is_active?: boolean;
          is_popular?: boolean;
          cor?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversas: {
        Row: {
          id: number;
          conversation_uuid: string;
          empresa_id: number;
          user_id: string;
          agente_id: number | null;
          mensagens: Json;
          titulo: string;
          tokens_usados: number;
          status: string;
          contexto_atual: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          conversation_uuid?: string;
          empresa_id: number;
          user_id: string;
          agente_id?: number | null;
          mensagens?: Json;
          titulo?: string;
          tokens_usados?: number;
          status?: string;
          contexto_atual?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          conversation_uuid?: string;
          empresa_id?: number;
          user_id?: string;
          agente_id?: number | null;
          mensagens?: Json;
          titulo?: string;
          tokens_usados?: number;
          status?: string;
          contexto_atual?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      uso_recursos: {
        Row: {
          id: number;
          empresa_id: number;
          mes_referencia: string;
          mensagens_enviadas: number;
          tokens_consumidos: number;
          agentes_ativos: number;
          usuarios_ativos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          empresa_id: number;
          mes_referencia: string;
          mensagens_enviadas?: number;
          tokens_consumidos?: number;
          agentes_ativos?: number;
          usuarios_ativos?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          empresa_id?: number;
          mes_referencia?: string;
          mensagens_enviadas?: number;
          tokens_consumidos?: number;
          agentes_ativos?: number;
          usuarios_ativos?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      auditoria: {
        Row: {
          id: number;
          user_id: string | null;
          empresa_id: number | null;
          acao: string;
          entidade_tipo: string;
          entidade_id: string | null;
          detalhes: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          empresa_id?: number | null;
          acao: string;
          entidade_tipo: string;
          entidade_id?: string | null;
          detalhes?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          empresa_id?: number | null;
          acao?: string;
          entidade_tipo?: string;
          entidade_id?: string | null;
          detalhes?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      get_auth_empresa_id: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      is_master: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      save_company_byok_key: {
        Args: {
          p_empresa_id: number;
          p_api_key: string;
        };
        Returns: Json;
      };
      get_company_byok_status: {
        Args: {
          p_empresa_id: number;
        };
        Returns: Json;
      };
      get_decrypted_byok_key: {
        Args: {
          p_empresa_id: number;
        };
        Returns: string;
      };
      log_audit_action: {
        Args: {
          p_acao: string;
          p_entidade_tipo: string;
          p_entidade_id: string;
          p_detalhes?: Json;
        };
        Returns: number;
      };
    };
  };
}
