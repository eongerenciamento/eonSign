import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PatientSuggestion {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  phone?: string;
  email?: string;
}

interface PatientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPatient: (patient: PatientSuggestion) => void;
  suggestions: PatientSuggestion[];
  placeholder?: string;
  className?: string;
}

export function PatientAutocomplete({
  value,
  onChange,
  onSelectPatient,
  suggestions,
  placeholder = "Nome do paciente",
  className
}: PatientAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<PatientSuggestion[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length >= 2) {
      const filtered = suggestions.filter(patient =>
        patient.name.toLowerCase().startsWith(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setIsOpen(false);
    }
  }, [value, suggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (patient: PatientSuggestion) => {
    onSelectPatient(patient);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("placeholder:text-xs", className)}
        onFocus={() => {
          if (value.length >= 2 && filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
      />
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="py-1">
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">
              Pacientes anteriores
            </div>
            {filteredSuggestions.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                onClick={() => handleSelect(patient)}
              >
                <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                  {patient.cpf && <span>CPF: {patient.cpf}</span>}
                  {patient.birthDate && <span>Nasc: {patient.birthDate}</span>}
                  {patient.phone && <span>Tel: {patient.phone}</span>}
                  {patient.email && <span>E-mail: {patient.email}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
