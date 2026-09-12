import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Database, UserRole } from "@/types/database.types";

type Perfil = Database["public"]["Tables"]["perfis"]["Row"];
type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
type Plano = Database["public"]["Tables"]["planos"]["Row"];

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  empresaId?: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  perfil: Perfil | null;
  empresa: Empresa | null;
  plano: Plano | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isMaster: boolean;
  isAdmin: boolean;
  isUser: boolean;
  isSubscribed: boolean;
  hasByokKey: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // 1. Buscar Perfil
      const { data: perfilData, error: perfilError } = await supabase
        .from("perfis")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (perfilError) {
        console.error("Erro ao buscar perfil:", perfilError);
        return;
      }

      if (perfilData) {
        setPerfil(perfilData as Perfil);

        // 2. Buscar Empresa vinculada ao perfil
        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select("*")
          .eq("id", (perfilData as Perfil).empresa_id)
          .maybeSingle();

        if (empresaError) {
          console.error("Erro ao buscar empresa:", empresaError);
        } else if (empresaData) {
          setEmpresa(empresaData as Empresa);

          // 3. Buscar Plano da empresa se houver plano_id
          if ((empresaData as Empresa).plano_id) {
            const { data: planoData } = await supabase
              .from("planos")
              .select("*")
              .eq("id", (empresaData as Empresa).plano_id!)
              .maybeSingle();

            if (planoData) {
              setPlano(planoData as Plano);
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar dados do usuário:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchUserData(currentSession.user.id).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Ouvir mudanças de estado de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setLoading(true);
        await fetchUserData(newSession.user.id);
        if (isMounted) setLoading(false);
      } else {
        setPerfil(null);
        setEmpresa(null);
        setPlano(null);
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (data.user) {
        await fetchUserData(data.user.id);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async ({ email, password, fullName, companyName, empresaId }: SignUpParams) => {
    try {
      const metadata: Record<string, any> = {
        full_name: fullName,
      };

      if (companyName) {
        metadata.company_name = companyName;
      }
      if (empresaId) {
        metadata.empresa_id = empresaId;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) return { error };

      if (data.user) {
        // Enviar email transacional de boas-vindas via Edge Function (assíncrono)
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: email,
              subject: "Bem-vindo ao ControlAI!",
              template: "welcome",
              variables: {
                name: fullName,
                company: companyName || "Sua Empresa",
              },
            },
          });
        } catch (mailErr) {
          console.warn("[Brevo] Notificação de e-mail disparada com aviso:", mailErr);
        }

        await fetchUserData(data.user.id);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPerfil(null);
    setEmpresa(null);
    setPlano(null);
  };

  const role = perfil?.role ?? null;
  const isMaster = role === "master";
  const isAdmin = role === "admin" || role === "master";
  const isUser = role === "user";
  const isSubscribed = empresa?.status === "active" || empresa?.status === "trialing";
  const hasByokKey = !!(empresa?.chave_api_mascarada || empresa?.chave_api_llm);

  const value: AuthContextType = {
    user,
    session,
    perfil,
    empresa,
    plano,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    isMaster,
    isAdmin,
    isUser,
    isSubscribed,
    hasByokKey,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
};
