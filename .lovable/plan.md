

## Restaurar degradê do sidebar idêntico ao eonGerenciamento

### Problema
O sidebar usa a classe `bg-layout-gradient` que não está definida no CSS. Resultado: fundo branco/transparente.

### Referência do eonGerenciamento
O outro projeto usa uma variável CSS `--gradient-sidebar` aplicada via `style={{ background: "var(--gradient-sidebar)" }}` e também via CSS com `!important` no seletor `[data-sidebar="sidebar"]`.

**Light mode:** `linear-gradient(to top, hsl(218 50% 12%) 0%, hsl(216 48% 30%) 70%)` — azul marinho escuro embaixo, azul marinho mais claro em cima.

**Dark mode:** `linear-gradient(to top, hsl(220 15% 6%), hsl(220 10% 18%))` — mais escuro ainda.

### Alterações

**1. `src/index.css`** — Adicionar variável `--gradient-sidebar` e regra CSS para aplicar no sidebar:

- No `:root`, adicionar após as variáveis de sidebar:
  ```css
  --gradient-sidebar: linear-gradient(to top, hsl(218 50% 12%) 0%, hsl(216 48% 30%) 70%);
  ```

- No `.dark`, adicionar:
  ```css
  --gradient-sidebar: linear-gradient(to top, hsl(220 15% 6%), hsl(220 10% 18%));
  ```

- Adicionar regra global para forçar o gradiente no sidebar (igual ao eonGerenciamento):
  ```css
  [data-sidebar="sidebar"] {
    background: var(--gradient-sidebar) !important;
  }
  ```

**2. `src/components/AppSidebar.tsx`** — Remover a classe `bg-layout-gradient` do componente `<Sidebar>`, pois o CSS global já cuida do fundo via seletor `[data-sidebar="sidebar"]`.

Isso replica exatamente o padrão do eonGerenciamento.

