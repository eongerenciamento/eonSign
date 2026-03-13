

## Corrigir Background Cinza Visivel + Cards Brancos

### Problema

O `--background` atual e `210 20% 98%` (quase branco), praticamente igual ao `--card: 0 0% 100%`. Por isso nao ha contraste visivel entre fundo e cards. No eonGerenciamento, o layout usa `bg-gray-100` (um cinza mais visivel) em vez da variavel CSS.

### Solucao

Replicar exatamente o padrao do eonGerenciamento:

#### 1. `src/components/Layout.tsx`

Trocar `bg-background` por `bg-gray-100 dark:bg-background` no container principal e na div de conteudo, e remover o wrapper `bg-card` dos children (os cards individuais dentro das paginas ja usam `bg-card`):

```tsx
// Mobile wrapper
<div className="min-h-screen bg-gray-100 dark:bg-background">

// Desktop main content div
<div className="flex-1 flex flex-col w-full bg-gray-100 dark:bg-background">

// Main content area - remover bg-card wrapper
<main className="flex-1 overflow-auto md:p-4">
  {children}
</main>
```

Isso faz o fundo ser cinza visivel (gray-100 = `#f3f4f6`) no light mode e manter o dark mode com a variavel escura. Os cards (`bg-card`) dentro das paginas aparecerao brancos sobre o fundo cinza.

#### 2. Verificar paginas que dependem do wrapper `bg-card`

As paginas que nao usam `<Card>` internamente podem precisar de ajuste para que seu conteudo fique dentro de cards brancos. Vou verificar as principais paginas para garantir consistencia.

### Arquivos alterados
- `src/components/Layout.tsx`

