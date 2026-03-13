

## Alteracao de Design: Background Cinza + Cards Brancos + Botoes de Confirmacao Azuis

### Resumo

Alinhar o design do eonSign com o eonGerenciamento: paginas com fundo cinza (em vez do gradiente escuro atual), cards sempre com fundo branco, e criar variante de botao de confirmacao azul com fonte branca.

### Alteracoes

#### 1. `src/index.css` - Remover gradiente e ajustar background

- Remover a utility class `.bg-layout-gradient` (gradiente escuro)
- O `--background` ja e `210 20% 98%` (cinza claro) no light mode e `220 10% 25%` no dark mode, o que e correto
- O `--card` ja e `0 0% 100%` (branco) no light mode e `220 10% 28%` no dark mode, correto
- Remover as variaveis `--layout-gradient-from` e `--layout-gradient-to` que nao serao mais usadas

#### 2. `src/components/Layout.tsx` - Remover gradiente do layout

Substituir `bg-layout-gradient` por `bg-background` na div principal do conteudo. Isso faz o fundo das paginas ser cinza claro (light) ou cinza escuro (dark) em vez do gradiente azul escuro.

**De:**
```
<div className="flex-1 flex flex-col w-full bg-layout-gradient">
```
**Para:**
```
<div className="flex-1 flex flex-col w-full bg-background">
```

#### 3. `src/components/ui/button.tsx` - Adicionar variantes de botao

Adicionar duas variantes inspiradas no eonGerenciamento:

- `"sheet-primary"`: `"bg-blue-600 hover:bg-blue-700 text-white rounded-full border-none shadow-none"` - Botao de confirmacao azul com fonte branca
- `"sheet-cancel"`: `"bg-transparent hover:bg-transparent text-red-500 hover:text-red-500 border-none rounded-full shadow-none"` - Botao de cancelamento

Manter as variantes existentes (`cancel`, `confirm`) para compatibilidade.

### Arquivos alterados
- `src/index.css` (remover gradient utility e variaveis)
- `src/components/Layout.tsx` (1 linha)
- `src/components/ui/button.tsx` (adicionar 2 variantes)

