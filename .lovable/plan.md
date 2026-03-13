

## Botão Enviar com padrão sheet-primary

### Problema
O botão "Enviar" na página NewDocument usa a variante `confirm` (fundo cinza, texto cinza). Deve usar a variante `sheet-primary` (fundo azul, texto branco, rounded-full) conforme o padrão do sistema.

### Alteração
**`src/pages/NewDocument.tsx`** (linha 1725): trocar `variant="confirm"` por `variant="sheet-primary"`.

```tsx
// De:
<Button variant="confirm" className="flex-1 gap-2" ...>

// Para:
<Button variant="sheet-primary" className="flex-1 gap-2" ...>
```

A variante `sheet-primary` já existe em `button.tsx` com o estilo correto:
`bg-primary hover:bg-primary/90 text-primary-foreground rounded-full border-none shadow-none`

### Arquivo alterado
- `src/pages/NewDocument.tsx` (1 linha)

