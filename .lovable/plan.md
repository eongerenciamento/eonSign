

## Padronizar menus de guias (Tabs) em todas as páginas

### Problema
Cada página usa classes diferentes no `TabsList`, causando tamanhos e alinhamentos inconsistentes:
- **Documents**: `grid w-full grid-cols-3 h-10` — ocupa largura total, centralizado
- **Reports**: `h-10 mx-auto` — sem `w-full`, fica alinhado à esquerda (inline-flex)
- **Settings**: `grid w-full grid-cols-N` — sem `h-10`
- **CadastrosTab**: `grid w-full grid-cols-N` — sem `h-10`

### Solução
Padronizar todas as `TabsList` para usar `grid w-full h-10 rounded-full p-1` + `grid-cols-N` adequado, e todos os `TabsTrigger` com `rounded-full`. Isso garante mesma altura, largura total e alinhamento.

### Alterações

**1. `src/pages/Reports.tsx` (linha 584)**
- De: `className="h-10 items-center mx-auto"`
- Para: `className="grid w-full grid-cols-2 rounded-full p-1 h-10"`
- TabsTriggers: adicionar `className="rounded-full"` (remover py-1.5 e flex items-center gap-2 pois o grid já centraliza)

**2. `src/pages/Settings.tsx` (linha 437)**
- De: `` className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`} ``
- Para: `` className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} rounded-full p-1 h-10`} ``
- TabsTriggers: adicionar `rounded-full`

**3. `src/components/settings/CadastrosTab.tsx` (linha 15)**
- De: `` className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`} ``
- Para: `` className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} rounded-full p-1 h-10`} ``
- TabsTriggers: adicionar `rounded-full`

**4. `src/pages/Documents.tsx`** — Já está correto (`grid w-full grid-cols-3 rounded-full p-1 h-10`), sem alteração.

### Arquivos alterados
- `src/pages/Reports.tsx`
- `src/pages/Settings.tsx`
- `src/components/settings/CadastrosTab.tsx`

