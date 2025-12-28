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
      console.error("Invalid or missing API key");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("API key validated, fetching users list...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all organization members
    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("id, organization_id, member_user_id, member_email, role, status, created_at");

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch members" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${members?.length || 0} members`);

    // Get unique organization IDs to fetch organization names
    const organizationIds = [...new Set(members?.map(m => m.organization_id) || [])];
    
    // Fetch organization settings (company names)
    const { data: organizations, error: orgsError } = await supabase
      .from("company_settings")
      .select("user_id, company_name")
      .in("user_id", organizationIds);

    if (orgsError) {
      console.error("Error fetching organizations:", orgsError);
    }

    // Create a map of organization_id -> company_name
    const orgMap = new Map(
      organizations?.map(org => [org.user_id, org.company_name]) || []
    );

    // Get unique user IDs to fetch profile names
    const userIds = members?.filter(m => m.member_user_id).map(m => m.member_user_id) || [];
    
    // Fetch profiles for names
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome_completo, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Create a map of user_id -> profile
    const profileMap = new Map(
      profiles?.map(p => [p.id, p]) || []
    );

    // Format the response
    const users = members?.map(member => {
      const profile = member.member_user_id ? profileMap.get(member.member_user_id) : null;
      const organizationName = orgMap.get(member.organization_id) || "Unknown Organization";

      return {
        external_id: member.id,
        name: profile?.nome_completo || member.member_email.split("@")[0],
        email: member.member_email,
        role: member.role === "admin" ? "admin" : "user",
        status: member.status === "active" ? "active" : "pending",
        organization_name: organizationName,
        created_at: member.created_at
      };
    }) || [];

    console.log(`Returning ${users.length} users`);

    return new Response(
      JSON.stringify({
        success: true,
        system_name: "eonsign",
        users
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
