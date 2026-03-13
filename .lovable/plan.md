

## Popovers com Glassmorphism

### Objetivo
Aplicar estilo glassmorphism (fundo cinza claro semi-transparente, backdrop-blur ultra, sem borda) em todos os componentes de popover/overlay do sistema.

### Estilo alvo
```
bg-white/70 dark:bg-[#2a2a2a]/70 backdrop-blur-xl border-none shadow-lg
```

### Arquivos a alterar

#### 1. `src/components/ui/popover.tsx` (linha 20)
Trocar `border border-border/50 bg-card dark:bg-[#2a2a2a]` por `bg-white/70 dark:bg-[#2a2a2a]/70 backdrop-blur-xl border-none`

#### 2. `src/components/ui/dropdown-menu.tsx` (linhas 47, 64)
- **DropdownMenuSubContent** (linha 47): mesmo estilo glassmorphism
- **DropdownMenuContent** (linha 64): mesmo estilo glassmorphism

#### 3. `src/components/ui/select.tsx` (linha 69)
**SelectContent**: mesmo estilo glassmorphism

#### 4. `src/components/ui/context-menu.tsx` (linhas 47, 63)
- **ContextMenuSubContent** (linha 47): mesmo estilo glassmorphism
- **ContextMenuContent** (linha 63): mesmo estilo glassmorphism

### Arquivos alterados
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/context-menu.tsx`

