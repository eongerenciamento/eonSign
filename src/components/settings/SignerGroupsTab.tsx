import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, SquarePen, Trash2, X, Check, Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

export function SignerGroupsTab() {
  const [groups, setGroups] = useState<SignerGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Form state
  const [formName, setFormName] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    
    setContacts(contactsData || []);

    // Load groups with members
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

  useEffect(() => {
    loadData();
  }, []);

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormName("");
    setSelectedContacts(new Set());
    setEditingId(null);
    setShowAddForm(false);
  };

  const startEdit = (group: SignerGroup) => {
    setFormName(group.name);
    setSelectedContacts(new Set(group.members.map(m => m.id)));
    setEditingId(group.id);
    setShowAddForm(false);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!formName) {
      toast.error("Digite um nome para o grupo");
      return;
    }

    if (selectedContacts.size === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      // Update group name
      const { error: updateError } = await supabase
        .from('signer_groups')
        .update({ name: formName })
        .eq('id', editingId);

      if (updateError) {
        toast.error("Erro ao atualizar grupo");
        return;
      }

      // Delete existing members and re-add
      await supabase
        .from('signer_group_members')
        .delete()
        .eq('group_id', editingId);

      const members = Array.from(selectedContacts).map(contactId => ({
        group_id: editingId,
        contact_id: contactId
      }));

      const { error: membersError } = await supabase
        .from('signer_group_members')
        .insert(members);

      if (membersError) {
        toast.error("Erro ao atualizar membros");
        return;
      }

      toast.success("Grupo atualizado!");
    } else {
      // Create new group
      const { data: groupData, error: groupError } = await supabase
        .from('signer_groups')
        .insert({ user_id: user.id, name: formName })
        .select()
        .single();

      if (groupError) {
        toast.error("Erro ao criar grupo");
        return;
      }

      const members = Array.from(selectedContacts).map(contactId => ({
        group_id: groupData.id,
        contact_id: contactId
      }));

      const { error: membersError } = await supabase
        .from('signer_group_members')
        .insert(members);

      if (membersError) {
        toast.error("Erro ao adicionar membros");
        return;
      }

      toast.success("Grupo criado!");
    }

    resetForm();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('signer_groups')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast.error("Erro ao excluir grupo");
      return;
    }

    toast.success("Grupo excluído!");
    setDeleteId(null);
    loadData();
  };

  return (
    <div className="space-y-6 mt-6">
      <Card className="bg-gray-100 shadow-md border-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-600 text-sm">Grupos de Signatários</CardTitle>
          <Button 
            onClick={() => { resetForm(); setShowAddForm(true); }}
            className="rounded-full bg-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-500 gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Novo Grupo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-0 bg-gray-200"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingId) && (
            <div className="p-4 border rounded-lg bg-orange-50 space-y-4">
              <div className="grid gap-2">
                <Label>Nome do Grupo</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Equipe Comercial"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Selecionar Contatos</Label>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum contato salvo. Adicione contatos primeiro na aba "Contatos".
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-lg bg-white p-2 space-y-1">
                    {contacts.map(contact => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.email || contact.phone}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-[#273d60] hover:bg-[#273d60]/90">
                  <Check className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Groups List */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "Nenhum grupo encontrado" : "Nenhum grupo criado"}
            </div>
          ) : (
            <div className="divide-y-0 rounded-lg overflow-hidden">
              {filteredGroups.map((group, index) => (
                <Collapsible 
                  key={group.id}
                  open={expandedGroups.has(group.id)}
                  onOpenChange={() => toggleExpanded(group.id)}
                >
                  <div className="overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-3 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredGroups.length - 1 && !expandedGroups.has(group.id) ? 'rounded-b-lg' : ''}`}>
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                        <Users className="w-4 h-4 text-gray-500" />
                        <div className="flex-1 text-left">
                          <p className="text-gray-600 text-sm">{group.name}</p>
                        </div>
                        <div className="flex-1 text-center">
                          <p className="text-sm text-muted-foreground">
                            {group.members.length} {group.members.length === 1 ? 'membro' : 'membros'}
                          </p>
                        </div>
                        {expandedGroups.has(group.id) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-transparent cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); startEdit(group); }}
                        >
                          <SquarePen className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:bg-transparent cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(group.id); }}
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className={`px-4 py-2 bg-muted/30 ${index === filteredGroups.length - 1 ? 'rounded-b-lg' : ''}`}>
                        {group.members.map((member, memberIndex) => (
                          <div 
                            key={member.id} 
                            className={`flex items-center px-4 py-2 ${memberIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                          >
                            <span className="flex-1 text-gray-600 text-sm">{member.name}</span>
                            <span className="flex-1 text-center text-muted-foreground text-sm">{member.phone || '-'}</span>
                            <span className="flex-1 text-right text-muted-foreground text-sm">{member.email || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este grupo? Os contatos não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
