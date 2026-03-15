

## Centralizar verticalmente o conteúdo das Tabs

### Problema
Os itens dentro das tabs (ícone + texto) não estão perfeitamente centralizados verticalmente dentro do `TabsList`.

### Alteração em `src/pages/Reports.tsx`

Adicionar `items-center` explícito no `TabsList` para garantir centralização vertical:

```tsx
<TabsList className="items-center">
```

Se o problema for que o `TabsList` em si precisa de centralização, adicionar `flex items-center` no container das tabs ou ajustar o `h-12` e `py` do `TabsTrigger` para garantir alinhamento.

### Arquivo alterado
- `src/pages/Reports.tsx` (1 linha — className do TabsList)

