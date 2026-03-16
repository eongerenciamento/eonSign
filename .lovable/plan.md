

## Aplicar layout com bordas arredondadas e degradê envolvente (como eonGerenciamento)

### Referência
No eonGerenciamento, o layout desktop funciona assim:
- O container externo usa `background: var(--gradient-sidebar)` (degradê azul escuro)
- O `<main>` tem `m-3 bg-gray-100 dark:bg-background rounded-2xl shadow-lg` — margem de 12px, bordas arredondadas, sombra

### Mudança

**Arquivo:** `src/components/Layout.tsx`

Alterar o layout desktop para que o wrapper flex tenha o degradê do sidebar como fundo, e o `<main>` tenha margem, bordas arredondadas e sombra:

```tsx
// De:
<div className="min-h-screen flex w-full">
  <div className="hidden md:block"><AppSidebar /></div>
  <div className="flex-1 flex flex-col w-full bg-gray-100 dark:bg-background">
    <main className="flex-1 overflow-auto md:p-4">{children}</main>
  </div>
</div>

// Para:
<div 
  className="flex flex-1 h-screen w-full overflow-hidden"
  style={{ background: "var(--gradient-sidebar)" }}
>
  <div className="hidden md:block"><AppSidebar /></div>
  <main className="flex-1 overflow-y-auto md:m-3 bg-gray-100 dark:bg-background md:rounded-2xl md:shadow-lg">
    {children}
  </main>
</div>
```

O degradê azul do sidebar envolve toda a área, e o conteúdo branco/cinza fica com bordas arredondadas sobre ele.

