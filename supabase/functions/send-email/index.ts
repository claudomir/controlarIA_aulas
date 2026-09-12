// ==============================================================================
// Supabase Edge Function: send-email
// Description: Disparo de E-mails Transacionais via Brevo API (v3 SMTP)
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject?: string;
  template?: "welcome" | "invite" | "billing_alert" | "custom";
  variables?: Record<string, string>;
  htmlContent?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "contato@controlai.io";
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "ControlAI";

    if (!brevoApiKey) {
      console.error("[send-email] BREVO_API_KEY não configurada nas secrets do Supabase.");
      return new Response(
        JSON.stringify({ error: "Configuração do provedor de e-mail ausente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: EmailPayload = await req.json();
    const { to, subject, template = "welcome", variables = {}, htmlContent } = payload;

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Destinatário 'to' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalSubject = subject || "Notificação ControlAI";
    let finalHtml = htmlContent || "";

    if (!htmlContent) {
      if (template === "welcome") {
        finalSubject = subject || "Bem-vindo ao ControlAI!";
        finalHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #eaeaea;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #10b981; margin: 0; font-size: 28px;">ControlAI.io</h1>
              <p style="color: #666666; font-size: 14px; margin-top: 4px;">SaaS de Inteligência Artificial Privada & BYOK</p>
            </div>
            <p style="font-size: 16px; color: #111111;">Olá, <strong>${variables.name || "Usuário"}</strong>!</p>
            <p style="font-size: 15px; color: #444444; line-height: 1.6;">
              Sua conta e o tenant da empresa <strong>${variables.company || "sua empresa"}</strong> foram criados com sucesso.
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="https://controlai.io/dashboard" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                Acessar meu Dashboard
              </a>
            </div>
            <p style="font-size: 13px; color: #777777; line-height: 1.5; border-top: 1px solid #f0f0f0; padding-top: 16px;">
              Próximo passo: Configure sua chave de API (OpenAI ou Claude) no painel administrativo para liberar o assistente para seus colaboradores.
            </p>
          </div>
        `;
      } else if (template === "invite") {
        finalSubject = subject || "Você foi convidado para o ControlAI";
        finalHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #10b981;">Convite de Colaborador</h2>
            <p style="color: #333333; font-size: 15px;">
              Você foi convidado por <strong>${variables.invitedBy || "sua empresa"}</strong> para colaborar no ControlAI.
            </p>
            <div style="margin: 24px 0;">
              <a href="${variables.inviteUrl || "https://controlai.io/auth/register"}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Aceitar Convite e Acessar
              </a>
            </div>
          </div>
        `;
      } else if (template === "billing_alert") {
        finalSubject = subject || "Aviso sobre sua assinatura ControlAI";
        finalHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #ef4444;">Aviso de Faturamento</h2>
            <p style="color: #333333; font-size: 15px;">${variables.message || "Houve uma atualização no status da sua assinatura."}</p>
          </div>
        `;
      }
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: finalSubject,
        htmlContent: finalHtml,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      console.error("[send-email] Resposta de erro do Brevo:", errorText);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail pelo Brevo", details: errorText }),
        { status: brevoResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await brevoResponse.json();
    return new Response(
      JSON.stringify({ success: true, messageId: data.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-email] Erro interno:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
