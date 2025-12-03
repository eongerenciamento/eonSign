import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  id: string;
  member_email: string;
  member_user_id: string | null;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

export function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail.trim()) {
      toast.error("Por favor, insira um e-mail válido");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail)) {
      toast.error("E-mail inválido");
      return;
    }

    setIsInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if member already exists
      const existingMember = members.find(m => m.member_email.toLowerCase() === newMemberEmail.toLowerCase());
      if (existingMember) {
        toast.error("Este e-mail já foi convidado");
        return;
      }

      // Call edge function to send invitation
      const { data, error } = await supabase.functions.invoke("send-member-invitation", {
        body: {
          memberEmail: newMemberEmail,
          organizationId: user.id
        }
      });

      if (error) throw error;

      toast.success("Convite enviado com sucesso!");
      setIsDialogOpen(false);
      setNewMemberEmail("");
      loadMembers();
    } catch (error: any) {
      console.error("Error inviting member:", error);
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberToDelete.id);

      if (error) throw error;

      toast.success("Membro removido com sucesso");
      setMemberToDelete(null);
      loadMembers();
    } catch (error: any) {
      console.error("Error deleting member:", error);
      toast.error(error.message || "Erro ao remover membro");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      active: { variant: "default", label: "Ativo" },
      inactive: { variant: "destructive", label: "Inativo" }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-600 text-base">Membros da Organização</CardTitle>
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="icon"
            className="h-8 w-8 rounded-full bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Nenhum membro convidado ainda.</p>
              <p className="text-xs text-gray-400 mt-1">
                Clique no botão + para convidar membros da sua equipe.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{member.member_email}</p>
                    <p className="text-xs text-gray-500">
                      Convidado em {new Date(member.invited_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(member.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500"
                      onClick={() => setMemberToDelete(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Invite Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Insira o e-mail do novo membro. Ele receberá um convite para fazer parte da organização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">E-mail do membro</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="membro@empresa.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInviteMember()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={isInviting}
              className="bg-gradient-to-r from-[#273d60] to-[#001f3f] text-white"
            >
              {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {memberToDelete?.member_email} da organização? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
