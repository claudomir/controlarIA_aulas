import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types/database.types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Key, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireSubscription?: boolean;
  requireByok?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireSubscription = false,
  requireByok = false,
}) => {
  const { user, role, loading, isSubscribed, hasByokKey, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // 1. Validar autenticação
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 2. Validar RBAC (Roles)
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Se não tiver permissão para a rota atual, redireciona para a rota padrão do seu perfil
    if (role === "user") {
      return <Navigate to="/dashboard/colaborador" replace />;
    }
    if (role === "admin") {
      return <Navigate to="/dashboard/admin" replace />;
    }
    if (role === "master") {
      return <Navigate to="/dashboard/master" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Validar Assinatura Ativa (caso exigido pela rota)
  if (requireSubscription && !isSubscribed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-lg border-destructive/50 bg-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <CreditCard className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Assinatura Necessária</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              A assinatura da sua empresa está inativa ou expirada. Para continuar utilizando os recursos da plataforma, atualize seu plano.
            </p>
            {isAdmin ? (
              <Button asChild className="w-full">
                <Link to="/dashboard/admin">Gerenciar Assinatura</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Entre em contato com o administrador da sua empresa para regularizar a assinatura.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Validar Chave BYOK (caso exigido para o Chat LLM)
  if (requireByok && !hasByokKey) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-lg border-amber-500/50 bg-amber-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-2">
              <Key className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Chave API BYOK Pendente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Para liberar o chat corporativo de IA, é necessário cadastrar a chave de API da sua empresa (OpenAI ou Claude).
            </p>
            {isAdmin ? (
              <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                <Link to="/dashboard/admin">Configurar Chave API</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Solicite ao administrador da sua empresa para cadastrar a chave API nas configurações do tenant.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
