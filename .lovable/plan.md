

## Ajustar estilo global das Tabs: fundo mais escuro + aba ativa branca

### Problema
O `TabsList` atualmente usa `bg-secondary/80` (light) / `bg-secondary` (dark), que é quase igual ao background. O tab ativo usa `bg-card` / `bg-accent`, não branco.

### Solução
Alterar **apenas** `src/components/ui/tabs.tsx` — isso corrige todas as páginas de uma vez (Documents, Reports, Settings, CadastrosTab).

**TabsList** — fundo 1 tom mais escuro que o background:
- Light: `bg-gray-200` (mais escuro que `bg-gray-100` do background)
- Dark: `bg-[hsl(220,10%,20%)]` (background é 25%, sidebar é 18%)

**TabsTrigger ativo** — branco:
- Light: `data-[state=active]:bg-white`
- Dark: `data-[state=active]:bg-white/15` (branco translúcido para manter coerência dark)

### Arquivo alterado
- `src/components/ui/tabs.tsx` (2 linhas — className do TabsList e TabsTrigger)

