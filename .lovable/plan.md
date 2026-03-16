

## Problema

A transparência não funciona porque o conteúdo da página rola **dentro** do `<main>` (com `overflow-y-auto`), e não atrás da nav. A nav fixa está sobre o `bg-gray-100` estático do container externo — nunca há conteúdo passando por trás dela para o `backdrop-blur` atuar.

## Solução

Mudar a estrutura mobile para que o scroll aconteça no nível da página inteira, não dentro do `<main>`:

### 1. `src/components/Layout.tsx`
- No mobile, o `<main>` não deve ter `overflow-y-auto` — o scroll deve ser do body/container externo
- Adicionar `padding-top` no mobile para compensar a nav fixa (em vez do spacer separado)

### 2. `src/components/MobileNav.tsx`  
- Remover o spacer div (linhas 108-115) — o padding será aplicado no Layout

### 3. `src/index.css` ou Layout
- Garantir que no mobile o container permita scroll no nível correto para o conteúdo passar por trás da nav fixa

**Mudanças concretas:**

**Layout.tsx** — No mobile, trocar a estrutura para scroll no nível do container externo:
```tsx
<main className="flex-1 overflow-y-auto md:m-3 bg-gray-100 dark:bg-background md:rounded-2xl md:shadow-lg pt-[calc(env(safe-area-inset-top,0px)+60px)] md:pt-0">
```

**MobileNav.tsx** — Remover o spacer (linhas 108-115).

Resultado: o conteúdo rola por baixo da nav, o `backdrop-blur-xl` captura esse movimento e cria o efeito glassmorphism real.

