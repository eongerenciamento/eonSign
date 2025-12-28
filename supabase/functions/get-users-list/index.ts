import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const EXPECTED_API_KEY = Deno.env.get("EONSIGN_WEBHOOK_API_KEY") || "wh-eonsign-1a34-994d-eb07-46c9";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== EXPECTED_API_KEY) {
      console.error("[GET-USERS-LIST] Invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GET-USERS-LIST] API key validated, fetching users list...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all organization members
    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("id, organization_id, member_user_id, member_email, role");

    if (membersError) {
      console.error("[GET-USERS-LIST] Error fetching members:", membersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch members" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GET-USERS-LIST] Found ${members?.length || 0} members`);

    // Get unique user IDs to fetch profile names
    const userIds = members?.filter(m => m.member_user_id).map(m => m.member_user_id) || [];
    
    // Fetch profiles for names
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome_completo")
      .in("id", userIds);

    if (profilesError) {
      console.error("[GET-USERS-LIST] Error fetching profiles:", profilesError);
    }

    // Create a map of user_id -> profile
    const profileMap = new Map(
      profiles?.map(p => [p.id, p]) || []
    );

    // Format the response according to expected format:
    // { users: [{ id, name, email, role?, organization_id? }] }
    const users = members?.map(member => {
      const profile = member.member_user_id ? profileMap.get(member.member_user_id) : null;

      return {
        id: member.id,
        name: profile?.nome_completo || member.member_email.split("@")[0],
        email: member.member_email,
        role: member.role === "admin" ? "Administrador" : "Usuário",
        organization_id: member.organization_id
      };
    }) || [];

    console.log(`[GET-USERS-LIST] Returning ${users.length} users`);

    return new Response(
      JSON.stringify({ users }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GET-USERS-LIST] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
