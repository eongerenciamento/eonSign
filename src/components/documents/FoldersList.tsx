import { Folder, MoreVertical, PenSquare, Trash2, Move } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Document } from "./DocumentsTable";
import { useEffect, useRef, useState } from "react";

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  parent_folder_id?: string | null;
}

interface FoldersListProps {
  folders: Folder[];
  documents?: Document[];
  viewMode?: "grid" | "list";
  onFolderClick: (folderId: string) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  editingFolderId?: string | null;
  onSaveFolderName?: (folderId: string, name: string) => void;
  onCancelEdit?: (folderId: string) => void;
  onMoveFolder?: (folderId: string, targetFolderId: string | null) => void;
  onDropDocument?: (documentId: string, folderId: string) => void;
  allFolders?: Folder[];
  currentFolderId?: string | null;
}

export const FoldersList = ({
  folders,
  documents = [],
  viewMode = "grid",
  onFolderClick,
  onRenameFolder,
  onDeleteFolder,
  editingFolderId,
  onSaveFolderName,
  onCancelEdit,
  onMoveFolder,
  onDropDocument,
  allFolders = [],
  currentFolderId = null,
}: FoldersListProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (editingFolderId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingFolderId]);

  const getDocumentCount = (folderId: string) => {
    return documents.filter((doc) => doc.folderId === folderId).length;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, folderId: string) => {
    if (e.key === "Enter" && onSaveFolderName) {
      onSaveFolderName(folderId, e.currentTarget.value);
    } else if (e.key === "Escape" && onCancelEdit) {
      onCancelEdit(folderId);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>, folderId: string) => {
    if (onSaveFolderName) {
      onSaveFolderName(folderId, e.currentTarget.value);
    }
  };

  const handleDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.setData("folderId", folderId);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);

    const draggedFolderId = e.dataTransfer.getData("folderId");
    const draggedDocumentId = e.dataTransfer.getData("documentId");

    if (draggedFolderId && draggedFolderId !== targetFolderId && onMoveFolder) {
      onMoveFolder(draggedFolderId, targetFolderId);
    } else if (draggedDocumentId && onDropDocument) {
      onDropDocument(draggedDocumentId, targetFolderId);
    }
  };

  const availableFolders = allFolders.filter(f => 
    f.id !== currentFolderId && 
    (!currentFolderId || f.parent_folder_id !== currentFolderId)
  );

  if (viewMode === "list") {
    return (
      <div className="rounded-lg overflow-hidden">
        {folders.map((folder, index) => (
          <div
            key={folder.id}
            draggable={!editingFolderId}
            onDragStart={(e) => handleDragStart(e, folder.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 transition-colors group ${
              index % 2 === 0 ? "bg-white" : "bg-gray-50"
            } ${dragOverId === folder.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""}`}
            onClick={() => onFolderClick(folder.id)}
          >
            <div className="flex items-center justify-between gap-3 flex-1">
              <div className="flex items-center gap-3">
                <Folder className="w-5 h-5 text-gray-500" />
                {editingFolderId === folder.id ? (
                  <Input
                    ref={inputRef}
                    defaultValue={folder.name}
                    onKeyDown={(e) => handleKeyDown(e, folder.id)}
                    onBlur={(e) => handleBlur(e, folder.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-gray-600 h-8 w-64"
                  />
                ) : (
                  <span className="text-sm text-gray-600">{folder.name}</span>
                )}
              </div>
              {!editingFolderId && (
                <span className="text-xs text-gray-500">
                  {getDocumentCount(folder.id)} docs
                </span>
              )}
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
                  <PenSquare className="w-4 h-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                {onMoveFolder && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Move className="w-4 h-4 mr-2" />
                      Mover
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-white z-50">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveFolder(folder.id, null);
                        }}
                      >
                        📁 Raiz
                      </DropdownMenuItem>
                      {availableFolders.map((targetFolder) => (
                        <DropdownMenuItem
                          key={targetFolder.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveFolder(folder.id, targetFolder.id);
                          }}
                        >
                          📁 {targetFolder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
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
          draggable={!editingFolderId}
          onDragStart={(e) => handleDragStart(e, folder.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          className={`p-4 hover:bg-accent cursor-pointer transition-colors group relative ${
            dragOverId === folder.id ? "border-2 border-dashed border-[#273d60] bg-[#273d60]/10" : ""
          }`}
          onClick={() => onFolderClick(folder.id)}
        >
          <div className="flex flex-col items-center space-y-2">
            <Folder className="w-12 h-12 text-primary" />
            {editingFolderId === folder.id ? (
              <Input
                ref={inputRef}
                defaultValue={folder.name}
                onKeyDown={(e) => handleKeyDown(e, folder.id)}
                onBlur={(e) => handleBlur(e, folder.id)}
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-center w-full"
              />
            ) : (
              <p className="text-sm font-medium text-center truncate w-full">
                {folder.name}
              </p>
            )}
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <PenSquare className="w-4 h-4 mr-2" />
                  Renomear
                </DropdownMenuItem>
                {onMoveFolder && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Move className="w-4 h-4 mr-2" />
                      Mover
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-white z-50">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveFolder(folder.id, null);
                        }}
                      >
                        📁 Raiz
                      </DropdownMenuItem>
                      {availableFolders.map((targetFolder) => (
                        <DropdownMenuItem
                          key={targetFolder.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveFolder(folder.id, targetFolder.id);
                          }}
                        >
                          📁 {targetFolder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
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
