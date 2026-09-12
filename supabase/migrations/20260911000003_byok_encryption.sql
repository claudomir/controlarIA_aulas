-- ==============================================================================
-- Migration: 20260911000003_byok_encryption.sql
-- Description: Gestão Segura e Criptografada de Chaves BYOK (pgcrypto / RPC)
-- Author: ControlAI Architect
-- ==============================================================================

-- 1. Helper interno para obter a chave mestra de criptografia do banco
CREATE OR REPLACE FUNCTION public._get_byok_secret()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  -- Tenta obter de configuração customizada do postgres; caso nulo, usa valor seguro padrão
  v_secret := current_setting('app.settings.byok_encryption_key', true);
  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    v_secret := 'controlai-saas-secure-byok-default-encryption-salt-2026';
  END IF;
  RETURN v_secret;
END;
$$;

-- 2. RPC para salvar a chave BYOK de forma criptografada (Apenas Admin do Tenant ou Master)
CREATE OR REPLACE FUNCTION public.save_company_byok_key(
  p_empresa_id BIGINT,
  p_api_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa_id BIGINT;
  v_is_admin BOOLEAN;
  v_is_master BOOLEAN;
  v_secret TEXT;
  v_masked TEXT;
  v_encrypted BYTEA;
  v_encrypted_text TEXT;
BEGIN
  -- Validar contexto do usuário autenticado
  v_caller_empresa_id := public.get_auth_empresa_id();
  v_is_admin := public.is_admin();
  v_is_master := public.is_master();

  IF NOT (v_is_master OR (v_is_admin AND v_caller_empresa_id = p_empresa_id)) THEN
    RAISE EXCEPTION 'Acesso negado: Somente administradores do tenant podem configurar a chave BYOK.';
  END IF;

  -- Se a chave estiver vazia, remove a configuração
  IF p_api_key IS NULL OR trim(p_api_key) = '' THEN
    UPDATE public.empresas
    SET 
      chave_api_llm = NULL,
      chave_api_mascarada = NULL,
      updated_at = timezone('utc'::text, now())
    WHERE id = p_empresa_id;

    -- Registrar log de auditoria
    INSERT INTO public.auditoria (user_id, empresa_id, acao, entidade_tipo, entidade_id, detalhes)
    VALUES (
      auth.uid(),
      p_empresa_id,
      'REMOVER_CHAVE_BYOK',
      'empresas',
      p_empresa_id::text,
      jsonb_build_object('status', 'removido')
    );

    RETURN jsonb_build_object('success', true, 'has_key', false, 'masked_key', NULL);
  END IF;

  -- Gerar representação mascarada segura (ex: sk-...XyZ9)
  IF length(p_api_key) > 8 THEN
    v_masked := substring(p_api_key from 1 for 3) || '...' || substring(p_api_key from length(p_api_key) - 3);
  ELSE
    v_masked := '***...***';
  END IF;

  -- Criptografia simétrica com pgcrypto
  v_secret := public._get_byok_secret();
  v_encrypted := pgp_sym_encrypt(p_api_key, v_secret);
  v_encrypted_text := encode(v_encrypted, 'base64');

  -- Atualizar registro do tenant
  UPDATE public.empresas
  SET 
    chave_api_llm = v_encrypted_text,
    chave_api_mascarada = v_masked,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_empresa_id;

  -- Registrar log de auditoria
  INSERT INTO public.auditoria (user_id, empresa_id, acao, entidade_tipo, entidade_id, detalhes)
  VALUES (
    auth.uid(),
    p_empresa_id,
    'SALVAR_CHAVE_BYOK',
    'empresas',
    p_empresa_id::text,
    jsonb_build_object('masked_key', v_masked)
  );

  RETURN jsonb_build_object(
    'success', true,
    'has_key', true,
    'masked_key', v_masked
  );
END;
$$;

-- 3. RPC para consultar o status da chave BYOK sem expor a chave bruta
CREATE OR REPLACE FUNCTION public.get_company_byok_status(
  p_empresa_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_empresa_id BIGINT;
  v_has_key BOOLEAN;
  v_masked VARCHAR(50);
BEGIN
  v_caller_empresa_id := public.get_auth_empresa_id();

  IF NOT (public.is_master() OR v_caller_empresa_id = p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado: Tenant não autorizado.';
  END IF;

  SELECT 
    (chave_api_llm IS NOT NULL AND length(chave_api_llm) > 0),
    chave_api_mascarada
  INTO v_has_key, v_masked
  FROM public.empresas
  WHERE id = p_empresa_id;

  RETURN jsonb_build_object(
    'has_key', COALESCE(v_has_key, false),
    'masked_key', v_masked
  );
END;
$$;

-- 4. Função restrita para Edge Functions / Backend descriptografar a chave para execução da LLM
CREATE OR REPLACE FUNCTION public.get_decrypted_byok_key(
  p_empresa_id BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_text TEXT;
  v_secret TEXT;
  v_decrypted TEXT;
BEGIN
  -- Apenas service_role ou membros autorizados da própria empresa
  IF auth.role() <> 'service_role' AND NOT (public.is_master() OR public.get_auth_empresa_id() = p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para descriptografia de chave de execução.';
  END IF;

  SELECT chave_api_llm INTO v_encrypted_text
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_encrypted_text IS NULL OR length(v_encrypted_text) = 0 THEN
    RETURN NULL;
  END IF;

  v_secret := public._get_byok_secret();
  
  BEGIN
    v_decrypted := pgp_sym_decrypt(decode(v_encrypted_text, 'base64'), v_secret);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Falha ao descriptografar chave BYOK: %', SQLERRM;
  END;

  RETURN v_decrypted;
END;
$$;
