

## Corrigir Cores dos Cards de Documentos Recentes

### Problema
No mobile, cada card de documento usa `bg-secondary` (cinza) e o espaço entre eles mostra o `bg-card` (branco) do wrapper Card. Está invertido — os cards dos documentos deveriam ser brancos e o fundo entre eles cinza.

### Solução

#### 1. `src/components/documents/DocumentsTable.tsx`

**Mobile cards (linha 1279):** Trocar `bg-secondary` por `bg-card` no fallback dos cards mobile:
```
'bg-secondary' → 'bg-card'
```

**Desktop table rows (linha 996):** Trocar `bg-secondary/50` por `bg-gray-50 dark:bg-muted/50` nas linhas alternadas para manter contraste sutil sem usar cinza escuro.

#### 2. `src/pages/Dashboard.tsx` (linha 198)

Remover o wrapper `<Card className="bg-card">` e deixar o `DocumentsTable` diretamente no fundo cinza, ou manter o Card mas com fundo transparente (`bg-transparent`) para que os cards individuais dos documentos (agora brancos) se destaquem sobre o fundo cinza.

**De:**
```tsx
<Card className="bg-card border-none rounded-lg">
  <DocumentsTable ... />
</Card>
```
**Para:**
```tsx
<DocumentsTable ... />
```

### Arquivos alterados
- `src/components/documents/DocumentsTable.tsx` (2 linhas)
- `src/pages/Dashboard.tsx` (remover wrapper Card)

