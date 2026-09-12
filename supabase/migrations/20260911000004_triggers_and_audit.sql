-- ==============================================================================
-- Migration: 20260911000004_triggers_and_audit.sql
-- Description: Triggers de automação, onboarding de novos tenants e auditoria
-- Author: ControlAI Architect
-- ==============================================================================

-- 1. Função genérica para atualização do campo updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Triggers de updated_at para todas as tabelas pertinentes
DROP TRIGGER IF EXISTS trigger_planos_updated_at ON public.planos;
CREATE TRIGGER trigger_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_empresas_updated_at ON public.empresas;
CREATE TRIGGER trigger_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_perfis_updated_at ON public.perfis;
CREATE TRIGGER trigger_perfis_updated_at
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_agentes_updated_at ON public.agentes_ia;
CREATE TRIGGER trigger_agentes_updated_at
  BEFORE UPDATE ON public.agentes_ia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_conversas_updated_at ON public.conversas;
CREATE TRIGGER trigger_conversas_updated_at
  BEFORE UPDATE ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_uso_recursos_updated_at ON public.uso_recursos;
CREATE TRIGGER trigger_uso_recursos_updated_at
  BEFORE UPDATE ON public.uso_recursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 2. Trigger de Onboarding Automático em auth.users
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
  v_empresa_id BIGINT;
  v_full_name TEXT;
  v_role public.user_role;
  v_free_plan_id BIGINT;
  v_current_month DATE;
BEGIN
  -- Extrair metadados passados no signUp do Supabase Auth
  v_company_name := NULLIF(NEW.raw_user_meta_data->>'company_name', '');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Verificar se foi informado empresa_id pré-existente (convite de colaborador)
  IF (NEW.raw_user_meta_data->>'empresa_id') IS NOT NULL THEN
    v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::BIGINT;
    v_role := 'user'::public.user_role;
  ELSE
    -- Obter plano Free padrão
    SELECT id INTO v_free_plan_id FROM public.planos WHERE nome = 'Free' LIMIT 1;

    -- Criar novo Tenant (Empresa)
    INSERT INTO public.empresas (
      nome,
      plano_id,
      email,
      status,
      is_active
    )
    VALUES (
      COALESCE(v_company_name, 'Empresa de ' || v_full_name),
      v_free_plan_id,
      NEW.email,
      'active',
      true
    )
    RETURNING id INTO v_empresa_id;

    -- Criar agente padrão inicial para a nova empresa
    INSERT INTO public.agentes_ia (
      empresa_id,
      nome,
      descricao,
      instrucoes,
      icone_url,
      is_popular
    )
    VALUES (
      v_empresa_id,
      'Assistente Geral',
      'Assistente inteligente para suporte diário e produtividade.',
      'Você é um assistente corporativo prestativo, profissional e seguro. Responda com clareza e precisão.',
      'Bot',
      true
    );

    -- Inicializar registro de uso de recursos do mês atual
    v_current_month := date_trunc('month', now())::date;
    INSERT INTO public.uso_recursos (
      empresa_id,
      mes_referencia,
      mensagens_enviadas,
      tokens_consumidos,
      agentes_ativos,
      usuarios_ativos
    )
    VALUES (
      v_empresa_id,
      v_current_month,
      0,
      0,
      1,
      1
    )
    ON CONFLICT (empresa_id, mes_referencia) DO NOTHING;

    -- Primeiro usuário do tenant se torna Admin (ou Master se for email master do sistema)
    IF NEW.email = 'master@controlai.io' OR NEW.raw_user_meta_data->>'role' = 'master' THEN
      v_role := 'master'::public.user_role;
    ELSE
      v_role := 'admin'::public.user_role;
    END IF;
  END IF;

  -- Inserir Perfil do Usuário
  INSERT INTO public.perfis (
    id,
    empresa_id,
    role,
    email,
    nome_completo,
    status
  )
  VALUES (
    NEW.id,
    v_empresa_id,
    v_role,
    NEW.email,
    v_full_name,
    'ativo'
  );

  -- Registrar log de auditoria
  INSERT INTO public.auditoria (
    user_id,
    empresa_id,
    acao,
    entidade_tipo,
    entidade_id,
    detalhes
  )
  VALUES (
    NEW.id,
    v_empresa_id,
    'USUARIO_REGISTRADO',
    'perfis',
    NEW.id::text,
    jsonb_build_object(
      'email', NEW.email,
      'role', v_role::text,
      'empresa_id', v_empresa_id
    )
  );

  RETURN NEW;
END;
$$;

-- Associar trigger à tabela auth.users do Supabase
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_onboarding();

-- ==============================================================================
-- 3. RPC Helper para Registro de Auditoria
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_acao VARCHAR(100),
  p_entidade_tipo VARCHAR(100),
  p_entidade_id VARCHAR(100),
  p_detalhes JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id BIGINT;
  v_audit_id BIGINT;
BEGIN
  v_empresa_id := public.get_auth_empresa_id();

  INSERT INTO public.auditoria (
    user_id,
    empresa_id,
    acao,
    entidade_tipo,
    entidade_id,
    detalhes
  )
  VALUES (
    auth.uid(),
    v_empresa_id,
    p_acao,
    p_entidade_tipo,
    p_entidade_id,
    p_detalhes
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;
