import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Download, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Document {
  id: string;
  name: string;
  createdAt: string;
  status: "pending" | "signed" | "expired" | "in_progress";
  signers: number;
  signedBy: number;
  signerStatuses?: ("signed" | "pending" | "rejected")[];
  signerNames?: string[];
}

interface DocumentsTableProps {
  documents: Document[];
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

export const DocumentsTable = ({ documents }: DocumentsTableProps) => {
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
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const statusInfo = statusConfig[doc.status];
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>{doc.createdAt}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={doc.signedBy === doc.signers ? "text-success font-medium" : ""}>
                      {doc.signedBy}/{doc.signers}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Baixar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
