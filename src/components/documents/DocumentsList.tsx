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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

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
    // Layout mobile diferente
    if (isMobile) {
      return (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          {documents.map((document, index) => (
            <div
              key={document.id}
              draggable
              onDragStart={(e) => handleDragStart(e, document.id)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3 group ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              } ${dragOverId === document.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""}`}
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div 
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => onViewDocument(document.id)}
                >
                  <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm text-gray-600 truncate">{document.name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(document.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-2">
                <div className="flex flex-col gap-0.5">
                  {document.signerNames && document.signerNames.length > 0 ? (
                    document.signerNames.map((name, idx) => (
                      <span key={idx} className="text-[10px] text-gray-600 whitespace-nowrap">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-gray-600">-</span>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent active:bg-transparent flex-shrink-0">
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white z-50">
                    <DropdownMenuItem onClick={() => onViewDocument(document.id)} className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                      <Eye className="w-4 h-4 mr-2 text-gray-500" />
                      Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownloadDocument(document.id)} className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                      <Download className="w-4 h-4 mr-2 text-gray-500" />
                      Baixar
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                        <Move className="w-4 h-4 mr-2 text-gray-500" />
                        Mover para
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="bg-white z-50">
                        {allFolders.map((folder) => (
                          <DropdownMenuItem
                            key={folder.id}
                            onClick={() => onMoveToFolder(document.id, folder.id)}
                            className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700"
                          >
                            📁 {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                      onClick={() => onRemoveFromFolder(document.id)}
                      className="text-destructive focus:bg-transparent focus:text-destructive hover:bg-transparent hover:text-destructive"
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

    // Layout desktop
    return (
      <div className="rounded-xl overflow-hidden border border-gray-200">
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
              <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm text-gray-600 truncate">{document.name}</span>
            </div>
            <div className="col-span-2 text-sm text-gray-600">
              {new Date(document.createdAt).toLocaleDateString('pt-BR')}
            </div>
            <div className="col-span-2 text-[10px] text-gray-600 leading-tight">
              {document.signerNames && document.signerNames.length > 0 
                ? document.signerNames.join(", ")
                : "-"}
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
                    <DropdownMenuSubTrigger className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                      <Move className="w-4 h-4 mr-2 text-gray-500" />
                      Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-white z-50">
                      {allFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onMoveToFolder(document.id, folder.id)}
                          className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700"
                        >
                          📁 {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onClick={() => onRemoveFromFolder(document.id)}
                    className="text-destructive focus:bg-transparent focus:text-destructive hover:bg-transparent hover:text-destructive"
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
          className={`p-4 hover:bg-accent cursor-pointer transition-colors group relative border-none ${
            dragOverId === document.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""
          }`}
        >
          <div className="flex flex-col items-center space-y-2">
            <FileText className="w-12 h-12 text-primary" strokeWidth={1.5} />
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
                <DropdownMenuItem onClick={() => onViewDocument(document.id)} className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                  <Eye className="w-4 h-4 mr-2 text-gray-500" />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownloadDocument(document.id)} className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                  <Download className="w-4 h-4 mr-2 text-gray-500" />
                  Baixar
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700">
                    <Move className="w-4 h-4 mr-2 text-gray-500" />
                    Mover para
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-white z-50">
                    {allFolders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => onMoveToFolder(document.id, folder.id)}
                        className="text-gray-700 focus:bg-transparent focus:text-gray-700 hover:bg-transparent hover:text-gray-700"
                      >
                        📁 {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  className="text-destructive focus:bg-transparent focus:text-destructive hover:bg-transparent hover:text-destructive"
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
