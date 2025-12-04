import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface SignerGroup {
  id: string;
  name: string;
  members: Contact[];
}

interface GroupSelectorProps {
  onSelectGroup: (members: { name: string; email: string; phone: string }[]) => void;
}

export function GroupSelector({ onSelectGroup }: GroupSelectorProps) {
  const [groups, setGroups] = useState<SignerGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: groupsData } = await supabase
        .from('signer_groups')
        .select(`
          id,
          name,
          signer_group_members (
            contact_id,
            contacts (id, name, email, phone)
          )
        `)
        .eq('user_id', user.id)
        .order('name');

      if (groupsData) {
        const formattedGroups: SignerGroup[] = groupsData.map(g => ({
          id: g.id,
          name: g.name,
          members: g.signer_group_members
            ?.map((m: any) => m.contacts)
            .filter(Boolean) || []
        }));
        setGroups(formattedGroups);
      }

      setLoading(false);
    };

    loadGroups();
  }, []);

  const handleSelectGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      const members = group.members.map(m => ({
        name: m.name,
        email: m.email || "",
        phone: m.phone || ""
      }));
      onSelectGroup(members);
    }
  };

  if (loading || groups.length === 0) {
    return null;
  }

  return (
    <Select onValueChange={handleSelectGroup}>
      <SelectTrigger className="w-full md:w-[200px]">
        <Users className="w-4 h-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Usar grupo" />
      </SelectTrigger>
      <SelectContent>
        {groups.map(group => (
          <SelectItem key={group.id} value={group.id}>
            {group.name} ({group.members.length})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
