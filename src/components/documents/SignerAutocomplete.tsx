import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

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

  // Filter suggestions based on input value - use startsWith for name
  const filteredSuggestions = value.length >= 2
    ? suggestions.filter(s => 
        s.name.toLowerCase().startsWith(value.toLowerCase()) ||
        s.email.toLowerCase().startsWith(value.toLowerCase()) ||
        s.phone.includes(value.replace(/\D/g, ''))
      ).slice(0, 10)
    : [];

  // Filter groups based on input value - use startsWith for name
  const filteredGroups = value.length >= 2
    ? groups.filter(g => 
        g.name.toLowerCase().startsWith(value.toLowerCase())
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
        <Command>
          <CommandList>
            {!hasResults && <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>}
            
            {filteredSuggestions.length > 0 && (
              <CommandGroup heading="Contatos recentes">
                {filteredSuggestions.map((signer, index) => (
                  <CommandItem
                    key={`signer-${signer.email}-${signer.phone}-${index}`}
                    onSelect={() => handleSelectSigner(signer)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer bg-gray-50 hover:bg-gray-100 data-[selected=true]:bg-gray-100"
                  >
                    <span className="font-medium text-gray-700">{signer.name}</span>
                    <div className="flex flex-col text-xs">
                      {signer.phone && <span className="text-gray-600">{signer.phone}</span>}
                      {signer.email && <span className="text-gray-500">{signer.email}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredGroups.length > 0 && onSelectGroup && (
              <CommandGroup heading="Grupos">
                {filteredGroups.map((group) => (
                  <CommandItem
                    key={`group-${group.id}`}
                    onSelect={() => handleSelectGroup(group)}
                    className="flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 data-[selected=true]:bg-gray-100"
                  >
                    <span className="font-medium text-gray-700">{group.name}</span>
                    <span className="text-xs text-gray-500">({group.members.length} membros)</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
