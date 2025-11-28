import { Folder, MoreVertical, Pencil, Trash2, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Document } from "./DocumentsTable";

export interface Folder {
  id: string;
  name: string;
  created_at: string;
}

interface FoldersListProps {
  folders: Folder[];
  documents?: Document[];
  viewMode?: "grid" | "list";
  onFolderClick: (folderId: string) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
}

export const FoldersList = ({
  folders,
  documents = [],
  viewMode = "grid",
  onFolderClick,
  onRenameFolder,
  onDeleteFolder,
}: FoldersListProps) => {
  const getDocumentCount = (folderId: string) => {
    return documents.filter((doc) => doc.folderId === folderId).length;
  };

  if (viewMode === "list") {
    return (
      <div className="space-y-0">
        {folders.map((folder, index) => (
          <div
            key={folder.id}
            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 transition-colors group ${
              index % 2 === 0 ? "bg-white" : "bg-gray-50"
            }`}
            onClick={() => onFolderClick(folder.id)}
          >
            <div className="flex items-center gap-3 flex-1">
              <Folder className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-600">{folder.name}</span>
              <span className="text-sm text-gray-500">
                {getDocumentCount(folder.id)} documentos
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-transparent active:bg-transparent">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white z-50">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameFolder(folder);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {folders.map((folder) => (
        <Card
          key={folder.id}
          className="p-4 hover:bg-accent cursor-pointer transition-colors group relative"
          onClick={() => onFolderClick(folder.id)}
        >
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-transparent h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                console.log("View folder", folder.id);
              }}
            >
              <Eye className="w-4 h-4 text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-transparent h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                console.log("Download folder", folder.id);
              }}
            >
              <Download className="w-4 h-4 text-gray-500" />
            </Button>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <Folder className="w-12 h-12 text-primary" />
            <p className="text-sm font-medium text-center truncate w-full">
              {folder.name}
            </p>
          </div>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white z-50">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameFolder(folder);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}
    </div>
  );
};
