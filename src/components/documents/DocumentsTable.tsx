import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Download } from "lucide-react";

export interface Document {
  id: string;
  name: string;
  createdAt: string;
  status: "pending" | "signed" | "expired" | "in_progress";
  signers: number;
  signedBy: number;
  signerStatuses?: ("signed" | "pending" | "rejected")[];
  signerNames?: string[];
  folderId?: string | null;
}

interface Folder {
  id: string;
  name: string;
}

interface DocumentsTableProps {
  documents: Document[];
  showProgress?: boolean;
  folders?: Folder[];
}

const statusConfig = {
  pending: { label: "Pendente", variant: "secondary" as const },
  in_progress: { label: "Em Andamento", variant: "default" as const },
  signed: { label: "Assinado", variant: "default" as const },
  expired: { label: "Expirado", variant: "destructive" as const },
};

const getInitials = (name: string) => {
  const names = name.trim().split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const DocumentsTable = ({ documents, showProgress = true, folders = [] }: DocumentsTableProps) => {
  const handleMoveToFolder = async (documentId: string, folderId: string) => {
    // Logic to move document to folder will be implemented
    console.log(`Moving document ${documentId} to folder ${folderId}`);
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Documento</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assinaturas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const statusInfo = statusConfig[doc.status];
              return (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{doc.name}</span>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-transparent"
                          onClick={() => console.log("View document", doc.id)}
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-transparent"
                          onClick={() => console.log("Download document", doc.id)}
                        >
                          <Download className="w-4 h-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{doc.createdAt}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-4">
                      <span className={doc.signedBy === doc.signers ? "text-success font-medium" : ""}>
                        {doc.signedBy}/{doc.signers}
                      </span>
                      {folders && folders.length > 0 && (
                        <Select 
                          value={doc.folderId || ""}
                          onValueChange={(value) => handleMoveToFolder(doc.id, value)}
                        >
                          <SelectTrigger className="w-[180px] hover:bg-gray-50">
                            <SelectValue placeholder="Selecionar pasta" />
                          </SelectTrigger>
                          <SelectContent className="bg-white z-50">
                            {folders.map((folder) => (
                              <SelectItem 
                                key={folder.id} 
                                value={folder.id}
                                className="hover:bg-gray-50 focus:bg-gray-50 text-gray-700"
                              >
                                {folder.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {documents.map((doc) => {
          const statusInfo = statusConfig[doc.status];
          return (
            <div key={doc.id} className="border rounded-lg p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Nome do Documento</p>
                <p className="font-medium">{doc.name}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Data de Criação</p>
                <p>{doc.createdAt}</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Assinaturas</p>
                <div className="flex gap-1">
                  {doc.signerStatuses?.map((status, idx) => (
                    <div
                      key={idx}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                        status === "signed"
                          ? "bg-green-500"
                          : status === "pending"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    >
                      {doc.signerNames?.[idx] ? getInitials(doc.signerNames[idx]) : idx + 1}
                    </div>
                  ))}
                </div>
              </div>
              
              {showProgress && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          doc.status === "expired" ? "bg-red-500" : "bg-[#273d60]"
                        }`}
                        style={{ width: `${(doc.signedBy / doc.signers) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.signedBy}/{doc.signers}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-3 pt-2">
                {folders && folders.length > 0 && (
                  <Select 
                    value={doc.folderId || ""}
                    onValueChange={(value) => handleMoveToFolder(doc.id, value)}
                  >
                    <SelectTrigger className="w-full hover:bg-gray-50">
                      <SelectValue placeholder="Selecionar pasta" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {folders.map((folder) => (
                        <SelectItem 
                          key={folder.id} 
                          value={folder.id}
                          className="hover:bg-gray-50 focus:bg-gray-50 text-gray-700"
                        >
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent"
                    onClick={() => console.log("View document", doc.id)}
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hover:bg-transparent"
                    onClick={() => console.log("Download document", doc.id)}
                  >
                    <Download className="w-4 h-4 text-gray-500" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
