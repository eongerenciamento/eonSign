

## Escurecer nomes dos arquivos no mobile

O nome dos documentos na listagem mobile (`DocumentsTable.tsx`, linha 1509) ainda usa `text-muted-foreground/70` (cinza claro). Precisa mudar para `text-foreground` para ficar mais escuro, igual ao desktop (linha 1020).

### Mudança

**`src/components/documents/DocumentsTable.tsx`** linha 1509:
- De: `text-muted-foreground/70`
- Para: `text-foreground`

