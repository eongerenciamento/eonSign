import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


export interface SignerSuggestion {
  name: string;
  email: string;
  phone: string;
}

export interface SignerGroup {
  id: string;
  name: string;
  members: SignerSuggestion[];
}

interface SignerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSigner: (signer: SignerSuggestion) => void;
  onSelectGroup?: (members: SignerSuggestion[]) => void;
  suggestions: SignerSuggestion[];
  groups?: SignerGroup[];
  placeholder?: string;
}

export function SignerAutocomplete({
  value,
  onChange,
  onSelectSigner,
  onSelectGroup,
  suggestions,
  groups = [],
  placeholder = "Digite o nome ou razão social"
}: SignerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input value - use includes for flexible search
  const phoneSearchValue = value.replace(/\D/g, '');
  const filteredSuggestions = value.length >= 2
    ? suggestions.filter(s => 
        s.name.toLowerCase().includes(value.toLowerCase()) ||
        s.email.toLowerCase().includes(value.toLowerCase()) ||
        (phoneSearchValue.length > 0 && s.phone.includes(phoneSearchValue))
      ).slice(0, 10)
    : [];

  // Filter groups based on input value - use includes for flexible search
  const filteredGroups = value.length >= 2
    ? groups.filter(g => 
        g.name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5)
    : [];

  // Open popover when typing and there are suggestions or groups
  useEffect(() => {
    if ((filteredSuggestions.length > 0 || filteredGroups.length > 0) && value.length >= 2) {
      setOpen(true);
    } else if (filteredGroups.length > 0 && value.length === 0) {
      // Keep closed when empty, groups show only when typing
      setOpen(false);
    } else {
      setOpen(false);
    }
  }, [filteredSuggestions.length, filteredGroups.length, value]);

  const handleSelectSigner = (signer: SignerSuggestion) => {
    onSelectSigner(signer);
    setOpen(false);
  };

  const handleSelectGroup = (group: SignerGroup) => {
    if (onSelectGroup) {
      onSelectGroup(group.members);
    }
    setOpen(false);
  };

  const hasResults = filteredSuggestions.length > 0 || filteredGroups.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="placeholder:text-xs placeholder:font-normal"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-64 overflow-auto">
          {!hasResults && (
            <p className="p-3 text-sm text-muted-foreground text-center">Nenhum resultado encontrado</p>
          )}
          
          {filteredSuggestions.length > 0 && (
            <div className="p-1">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Contatos recentes</p>
              {filteredSuggestions.map((signer, index) => (
                <div
                  key={`signer-${signer.email}-${signer.phone}-${index}`}
                  onClick={() => handleSelectSigner(signer)}
                  className="flex flex-col items-start gap-0.5 cursor-pointer px-2 py-2 rounded bg-muted/50 hover:bg-muted mb-1"
                >
                  <span className="text-xs font-medium text-foreground">{signer.name}</span>
                  <div className="flex flex-col text-xs">
                    {signer.phone && <span className="text-muted-foreground">{signer.phone}</span>}
                    {signer.email && <span className="text-muted-foreground/70">{signer.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredGroups.length > 0 && onSelectGroup && (
            <div className="p-1">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Grupos</p>
              {filteredGroups.map((group) => (
                <div
                  key={`group-${group.id}`}
                  onClick={() => handleSelectGroup(group)}
                  className="flex items-center justify-between cursor-pointer px-2 py-2 rounded bg-muted/50 hover:bg-muted mb-1"
                >
                  <span className="font-medium text-foreground">{group.name}</span>
                  <span className="text-xs text-muted-foreground">({group.members.length} membros)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
