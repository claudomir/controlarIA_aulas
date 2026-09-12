-- ==============================================================================
-- Migration: 20260911000002_rls_and_policies.sql
-- Description: Implementação de RLS (Row Level Security) e Políticas de Multi-tenancy
-- Author: ControlAI Architect
-- ==============================================================================

-- 1. Helper Functions de Contexto de Segurança (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_empresa_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'master' FROM public.perfis WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role IN ('admin', 'master') FROM public.perfis WHERE id = auth.uid()), false);
$$;

-- 2. Habilitar RLS em Todas as Tabelas
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. Políticas RLS: planos
-- ==============================================================================
CREATE POLICY "planos_select_public"
  ON public.planos FOR SELECT
  TO authenticated, anon
  USING (is_active = true OR public.is_master());

CREATE POLICY "planos_all_master"
  ON public.planos FOR ALL
  TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

-- ==============================================================================
-- 4. Políticas RLS: empresas (Isolamento Multi-tenant)
-- ==============================================================================
CREATE POLICY "empresas_select_tenant"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (id = public.get_auth_empresa_id() OR public.is_master());

CREATE POLICY "empresas_insert_authenticated"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permitido no onboarding / registro de nova empresa

CREATE POLICY "empresas_update_admin"
  ON public.empresas FOR UPDATE
  TO authenticated
  USING ((id = public.get_auth_empresa_id() AND public.is_admin()) OR public.is_master())
  WITH CHECK ((id = public.get_auth_empresa_id() AND public.is_admin()) OR public.is_master());

CREATE POLICY "empresas_delete_master"
  ON public.empresas FOR DELETE
  TO authenticated
  USING (public.is_master());

-- ==============================================================================
-- 5. Políticas RLS: perfis
-- ==============================================================================
CREATE POLICY "perfis_select_tenant"
  ON public.perfis FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_auth_empresa_id() OR public.is_master());

CREATE POLICY "perfis_insert_tenant_or_self"
  ON public.perfis FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() 
    OR (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "perfis_update_tenant"
  ON public.perfis FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() 
    OR (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  )
  WITH CHECK (
    id = auth.uid() 
    OR (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "perfis_delete_admin"
  ON public.perfis FOR DELETE
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin() AND id <> auth.uid())
    OR public.is_master()
  );

-- ==============================================================================
-- 6. Políticas RLS: agentes_ia
-- ==============================================================================
CREATE POLICY "agentes_select_tenant"
  ON public.agentes_ia FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_auth_empresa_id() OR public.is_master());

CREATE POLICY "agentes_insert_admin"
  ON public.agentes_ia FOR INSERT
  TO authenticated
  WITH CHECK (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "agentes_update_admin"
  ON public.agentes_ia FOR UPDATE
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  )
  WITH CHECK (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "agentes_delete_admin"
  ON public.agentes_ia FOR DELETE
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

-- ==============================================================================
-- 7. Políticas RLS: conversas
-- ==============================================================================
CREATE POLICY "conversas_select_owner_or_admin"
  ON public.conversas FOR SELECT
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND user_id = auth.uid())
    OR (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "conversas_insert_owner"
  ON public.conversas FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id() 
    AND user_id = auth.uid()
  );

CREATE POLICY "conversas_update_owner"
  ON public.conversas FOR UPDATE
  TO authenticated
  USING (
    empresa_id = public.get_auth_empresa_id() 
    AND user_id = auth.uid()
  )
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id() 
    AND user_id = auth.uid()
  );

CREATE POLICY "conversas_delete_owner_or_admin"
  ON public.conversas FOR DELETE
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND user_id = auth.uid())
    OR (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

-- ==============================================================================
-- 8. Políticas RLS: uso_recursos
-- ==============================================================================
CREATE POLICY "uso_recursos_select_tenant"
  ON public.uso_recursos FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_auth_empresa_id() OR public.is_master());

CREATE POLICY "uso_recursos_all_master_or_service"
  ON public.uso_recursos FOR ALL
  TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

-- ==============================================================================
-- 9. Políticas RLS: auditoria
-- ==============================================================================
CREATE POLICY "auditoria_select_admin"
  ON public.auditoria FOR SELECT
  TO authenticated
  USING (
    (empresa_id = public.get_auth_empresa_id() AND public.is_admin())
    OR public.is_master()
  );

CREATE POLICY "auditoria_insert_authenticated"
  ON public.auditoria FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id = public.get_auth_empresa_id()
    OR public.is_master()
  );
