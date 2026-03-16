

## Remover ícone Eye e tornar nome do documento clicável (mobile)

### Mudanças em `src/components/documents/DocumentsTable.tsx`

1. **Remover o botão Eye** (linhas 1364-1372) da seção de botões de ação no card mobile
2. **Tornar o nome do documento clicável** (linha 1509): adicionar `onClick` para chamar `handleViewDocument` (ou `handleViewEnvelopeDocuments` para envelopes) e estilizar como link (cor azul, cursor pointer)

Mudança na linha ~1499-1509:
```tsx
<div
  className="space-y-2 cursor-pointer"
  onClick={() => doc.isEnvelope ? handleViewEnvelopeDocuments(doc) : handleViewDocument(doc.id)}>
  ...
  <p className="font-medium text-blue-600 dark:text-blue-400">{doc.name}</p>
```

