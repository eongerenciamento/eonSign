

## Ajustar largura do popover "Selecionar pasta"

### Problema
O popover que abre ao clicar em "Selecionar pasta" tem largura fixa de `w-[200px]`, menor que o botão trigger. Deve ter a mesma largura do input/botão.

### Alterações em `src/components/documents/DocumentsTable.tsx`

**1. Mobile (linha ~1499):** Trocar `w-[200px]` por `w-[var(--radix-popover-trigger-width)]` para que o popover acompanhe a largura do trigger (que é `w-full`).

**2. Desktop (linha ~1097):** Trocar `w-[200px]` por `w-[var(--radix-popover-trigger-width)]` para acompanhar o trigger de `w-[180px]`.

A CSS variable `--radix-popover-trigger-width` é fornecida automaticamente pelo Radix Popover e garante que o conteúdo tenha exatamente a mesma largura do trigger.

### Arquivo alterado
- `src/components/documents/DocumentsTable.tsx` (2 linhas)

