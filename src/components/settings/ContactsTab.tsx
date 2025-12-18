import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, SquarePen, Trash2, X, Check, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)})${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)})${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (error) {
      toast.error("Erro ao carregar contatos");
      return;
    }
    setContacts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search.replace(/\D/g, ''))
  );

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setEditingId(null);
    setShowAddForm(false);
  };

  const startEdit = (contact: Contact) => {
    setFormName(contact.name);
    setFormEmail(contact.email || "");
    setFormPhone(contact.phone || "");
    setEditingId(contact.id);
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (!formName || !formEmail && !formPhone) {
      toast.error("Preencha o nome e pelo menos telefone ou e-mail");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase.from('contacts').update({
        name: formName,
        email: formEmail || null,
        phone: formPhone || null
      }).eq('id', editingId);
      if (error) {
        toast.error("Erro ao atualizar contato");
        return;
      }
      toast.success("Contato atualizado!");
    } else {
      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: formName,
        email: formEmail || null,
        phone: formPhone || null
      });
      if (error) {
        toast.error("Erro ao criar contato");
        return;
      }
      toast.success("Contato adicionado!");
    }
    resetForm();
    loadContacts();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('contacts').delete().eq('id', deleteId);
    if (error) {
      toast.error("Erro ao excluir contato");
      return;
    }
    toast.success("Contato excluído!");
    setDeleteId(null);
    loadContacts();
  };

  return (
    <div className="space-y-6 mt-6">
      <Card className="bg-secondary shadow-md border-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm">Contatos Salvos</CardTitle>
          <Button 
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }} 
            className="rounded-full bg-muted text-muted-foreground hover:bg-muted hover:text-foreground gap-2" 
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Novo Contato
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, e-mail ou telefone..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 border-0 bg-muted" 
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingId) && (
            <div className="p-4 border rounded-lg bg-accent/50 space-y-3">
              <div className="grid gap-2">
                <Label>Nome Completo / Razão Social</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Digite o nome" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input value={formPhone} onChange={e => setFormPhone(formatPhone(e.target.value))} placeholder="(00)00000-0000" maxLength={14} />
                </div>
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
                </div>
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

          {/* Contacts List */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "Nenhum contato encontrado" : "Nenhum contato salvo"}
            </div>
          ) : (
            <div className="divide-y-0 rounded-lg overflow-hidden">
              {filteredContacts.map((contact, index) => (
                <div 
                  key={contact.id} 
                  className={`flex items-center px-4 py-3 ${index % 2 === 0 ? 'bg-card' : 'bg-secondary/50'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredContacts.length - 1 ? 'rounded-b-lg' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate text-sm">{contact.name}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-muted-foreground text-xs">{contact.phone || '-'}</span>
                  </div>
                  <div className="flex-1 text-right">
                    <span className="text-muted-foreground text-xs">{contact.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent cursor-pointer" onClick={() => startEdit(contact)}>
                      <SquarePen className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent cursor-pointer" onClick={() => setDeleteId(contact.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.
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
