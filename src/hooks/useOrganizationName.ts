import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrganizationName() {
  return useQuery({
    queryKey: ["company-name"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("member_user_id", user.id)
        .eq("status", "active")
        .single();

      const organizationId = memberData?.organization_id || user.id;

      const { data } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", organizationId)
        .single();

      return data?.company_name || null;
    },
  });
}
