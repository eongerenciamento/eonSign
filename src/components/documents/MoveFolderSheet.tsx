import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FolderItem {
  id: string;
  name: string;
  parent_folder_id?: string | null;
}

interface MoveFolderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderItem[];
  currentFolderId: string;
  onMove: (targetFolderId: string | null) => void;
}

interface FolderNode extends FolderItem {
  children: FolderNode[];
}

export const MoveFolderSheet = ({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onMove,
}: MoveFolderSheetProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Build folder tree structure
  const folderTree = useMemo(() => {
    const folderMap = new Map<string, FolderNode>();
    const rootFolders: FolderNode[] = [];

    // Filter out the folder being moved and its descendants
    const getDescendantIds = (folderId: string): Set<string> => {
      const descendants = new Set<string>();
      const queue = [folderId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        descendants.add(current);
        folders.forEach(f => {
          if (f.parent_folder_id === current && !descendants.has(f.id)) {
            queue.push(f.id);
          }
        });
      }
      return descendants;
    };

    const excludedIds = getDescendantIds(currentFolderId);
    const availableFolders = folders.filter(f => !excludedIds.has(f.id));

    // Create nodes
    availableFolders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build tree
    availableFolders.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parent_folder_id && folderMap.has(folder.parent_folder_id)) {
        folderMap.get(folder.parent_folder_id)!.children.push(node);
      } else {
        rootFolders.push(node);
      }
    });

    return rootFolders;
  }, [folders, currentFolderId]);

  const toggleExpanded = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleMove = (folderId: string | null) => {
    onMove(folderId);
    onOpenChange(false);
  };

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const hasChildren = folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors"
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => handleMove(folder.id)}
        >
          <button
            onClick={(e) => {
              if (hasChildren) toggleExpanded(folder.id, e);
            }}
            className="w-5 h-5 flex items-center justify-center"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )
            ) : (
              <span className="w-4" />
            )}
          </button>
          
          <Folder className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
          <span className="text-sm text-gray-700 flex-1">{folder.name}</span>
          <Check className="w-4 h-4 text-gray-400" />
        </div>

        {hasChildren && isExpanded && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="text-gray-700">Mover para</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {/* Root option - eonDrive */}
          <div
            className="flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => handleMove(null)}
          >
            <span className="w-5" />
            <Folder className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
            <span className="text-sm text-gray-700 flex-1">eonDrive</span>
            <Check className="w-4 h-4 text-gray-400" />
          </div>

          {/* Folder tree */}
          {folderTree.map(folder => renderFolder(folder))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
