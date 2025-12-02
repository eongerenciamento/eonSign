import { FileText, MoreVertical, Eye, Download, Move, FolderMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Document } from "./DocumentsTable";
import { useState } from "react";

export interface Folder {
  id: string;
  name: string;
  parent_folder_id?: string | null;
}

interface DocumentsListProps {
  documents: Document[];
  viewMode?: "grid" | "list";
  onViewDocument: (documentId: string) => void;
  onDownloadDocument: (documentId: string) => void;
  onMoveToFolder: (documentId: string, folderId: string) => void;
  onRemoveFromFolder: (documentId: string) => void;
  allFolders: Folder[];
}

export const DocumentsList = ({
  documents,
  viewMode = "list",
  onViewDocument,
  onDownloadDocument,
  onMoveToFolder,
  onRemoveFromFolder,
  allFolders,
}: DocumentsListProps) => {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, documentId: string) => {
    e.dataTransfer.setData("documentId", documentId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
    setDragOverId(null);
  };

  if (viewMode === "list") {
    return (
      <div className="space-y-0">
        {documents.map((document, index) => (
          <div
            key={document.id}
            draggable
            onDragStart={(e) => handleDragStart(e, document.id)}
            onDragEnd={handleDragEnd}
            className={`grid grid-cols-12 gap-3 items-center p-3 group ${
              index % 2 === 0 ? "bg-white" : "bg-gray-50"
            } ${dragOverId === document.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""}`}
          >
            <div 
              className="col-span-5 flex items-center gap-3 cursor-pointer"
              onClick={() => onViewDocument(document.id)}
            >
              <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-600 truncate">{document.name}</span>
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {new Date(document.createdAt).toLocaleDateString('pt-BR')}
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {document.signedBy}/{document.signers}
            </div>
            <div className="col-span-3 flex items-center gap-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onViewDocument(document.id)}
                className="h-8 w-8 hover:bg-transparent active:bg-transparent"
                title="Visualizar"
              >
                <Eye className="w-4 h-4 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDownloadDocument(document.id)}
                className="h-8 w-8 hover:bg-transparent active:bg-transparent"
                title="Baixar"
              >
                <Download className="w-4 h-4 text-gray-500" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent active:bg-transparent">
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white z-50">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Move className="w-4 h-4 mr-2" />
                      Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-white z-50">
                      {allFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onMoveToFolder(document.id, folder.id)}
                        >
                          📁 {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onClick={() => onRemoveFromFolder(document.id)}
                    className="text-destructive"
                  >
                    <FolderMinus className="w-4 h-4 mr-2" />
                    Remover da pasta
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {documents.map((document) => (
        <Card
          key={document.id}
          draggable
          onDragStart={(e) => handleDragStart(e, document.id)}
          onDragEnd={handleDragEnd}
          onClick={() => onViewDocument(document.id)}
          className={`p-4 hover:bg-accent cursor-pointer transition-colors group relative ${
            dragOverId === document.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""
          }`}
        >
          <div className="flex flex-col items-center space-y-2">
            <FileText className="w-12 h-12 text-primary" />
            <p className="text-sm font-medium text-center truncate w-full">
              {document.name}
            </p>
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white z-50">
                <DropdownMenuItem onClick={() => onViewDocument(document.id)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadDocument(document.id)}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Move className="w-4 h-4 mr-2" />
                    Mover para
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-white z-50">
                    {allFolders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => onMoveToFolder(document.id, folder.id)}
                      >
                        📁 {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemoveFromFolder(document.id)}
                >
                  <FolderMinus className="w-4 h-4 mr-2" />
                  Remover da pasta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}
    </div>
  );
};
