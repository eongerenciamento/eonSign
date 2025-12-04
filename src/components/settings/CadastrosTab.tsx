import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "./MembersTab";
import { ContactsTab } from "./ContactsTab";
import { SignerGroupsTab } from "./SignerGroupsTab";
import { Users, BookUser, UsersRound } from "lucide-react";

interface CadastrosTabProps {
  isAdmin: boolean;
}

export const CadastrosTab = ({ isAdmin }: CadastrosTabProps) => {
  return (
    <div className="space-y-6 mt-6">
      <Tabs defaultValue={isAdmin ? "members" : "contacts"} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {isAdmin && (
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span>Membros</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="contacts" className="gap-2">
            <BookUser className="h-4 w-4" />
            <span>Signatários</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <UsersRound className="h-4 w-4" />
            <span>Grupos</span>
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="members" className="mt-6">
            <MembersTab />
          </TabsContent>
        )}

        <TabsContent value="contacts" className="mt-6">
          <ContactsTab />
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          <SignerGroupsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
