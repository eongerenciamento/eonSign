import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getToken(): Promise<string> {
  const BRY_AR_CLIENT_ID = Deno.env.get("BRY_AR_CLIENT_ID");
  const BRY_AR_CLIENT_SECRET = Deno.env.get("BRY_AR_CLIENT_SECRET");
  const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

  const baseUrl = BRY_ENVIRONMENT === "production"
    ? "https://ar-universal.bry.com.br"
    : "https://ar-universal.hom.bry.com.br";

  const response = await fetch(`${baseUrl}/api/auth/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: BRY_AR_CLIENT_ID,
      client_secret: BRY_AR_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf } = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    if (!cpf) {
      throw new Error("CPF is required");
    }

    // Clean CPF
    const cleanCpf = cpf.replace(/\D/g, "");

    console.log("Checking PSBIO for CPF:", cleanCpf);

    const accessToken = await getToken();

    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    const response = await fetch(
      `${baseUrl}/api/videoconference-issue-enabled/${cleanCpf}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log("PSBIO check response:", response.status, responseText);

    if (!response.ok) {
      // Check for specific error about invalid CPF
      if (response.status === 422) {
        return new Response(
          JSON.stringify({
            can_issue: false,
            reason: "CPF inválido",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`PSBIO check failed: ${response.status}`);
    }

    let canIssue = false;
    try {
      const result = JSON.parse(responseText);
      canIssue = result === true || result.enabled === true;
    } catch {
      canIssue = responseText.toLowerCase() === "true";
    }

    return new Response(
      JSON.stringify({
        can_issue: canIssue,
        reason: canIssue
          ? "Cliente cadastrado no PSBIO, pode ser atendido via videoconferência"
          : "Cliente não cadastrado no PSBIO. Necessário CNH emitida/renovada a partir de 2018",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("PSBIO check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
