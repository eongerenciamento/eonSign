import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

export interface SignerSuggestion {
  name: string;
  email: string;
  phone: string;
}

interface SignerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectSigner: (signer: SignerSuggestion) => void;
  suggestions: SignerSuggestion[];
  placeholder?: string;
}

export function SignerAutocomplete({
  value,
  onChange,
  onSelectSigner,
  suggestions,
  placeholder = "Digite o nome ou razão social"
}: SignerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input value
  const filteredSuggestions = value.length >= 2
    ? suggestions.filter(s => 
        s.name.toLowerCase().includes(value.toLowerCase()) ||
        s.email.toLowerCase().includes(value.toLowerCase()) ||
        s.phone.includes(value.replace(/\D/g, ''))
      ).slice(0, 10)
    : [];

  // Open popover when typing and there are suggestions
  useEffect(() => {
    if (filteredSuggestions.length > 0 && value.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [filteredSuggestions.length, value]);

  const handleSelect = (signer: SignerSuggestion) => {
    onSelectSigner(signer);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
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
            <CommandEmpty>Nenhum signatário encontrado</CommandEmpty>
            <CommandGroup heading="Signatários recentes">
              {filteredSuggestions.map((signer, index) => (
                <CommandItem
                  key={`${signer.email}-${signer.phone}-${index}`}
                  onSelect={() => handleSelect(signer)}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
