

## Trocar fundo dos inputs de filtro de cinza para branco

### Problema
Os inputs, selects e botões de data nos filtros usam `bg-gray-100` ou `bg-secondary`, que resulta em fundo cinza. Devem ser brancos (`bg-white`).

### Alterações

**1. `src/pages/Documents.tsx`** — 3 tabs (signed, pending-internal, pending-external), cada uma com:
- Input de busca: `bg-secondary` → `bg-white` (tab signed, linha 319) / `bg-gray-100` → `bg-white` (tabs pending, linhas 417, 508)
- 2 botões de data (dateFrom/dateTo): `bg-gray-100 hover:bg-gray-100` → `bg-white hover:bg-white` (linhas 330, 353, 428, 451, 519, 542)
- 2 SelectTriggers (ordenar + modo assinatura): `bg-gray-100` → `bg-white` (linhas 374, 384, 472, 482, 563, 573)

Total: ~15 substituições de `bg-gray-100`/`bg-secondary` → `bg-white`.

**2. `src/pages/Drive.tsx`** — Filtros dentro de pasta (showFolderFilters):
- Input de busca: `bg-gray-100` → `bg-white` (linha 551)
- SelectTrigger: `bg-gray-100` → `bg-white` (linha 558)

**3. `src/pages/Reports.tsx`** — Filtros colapsáveis:
- Input de busca: `bg-secondary` → `bg-white` (linha 782)
- 3 SelectTriggers: `bg-secondary` → `bg-white` (linhas 816, 831, 844)

**4. `src/components/documents/AdvancedFiltersDialog.tsx`** — Sem alterações necessárias (usa componentes padrão do Dialog sem bg customizado).

### Arquivos alterados
- `src/pages/Documents.tsx` (~15 substituições)
- `src/pages/Drive.tsx` (2 substituições)
- `src/pages/Reports.tsx` (4 substituições)

