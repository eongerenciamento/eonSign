

## Padronizar títulos e botões "Novo Documento" em todas as páginas

### Situação Atual

| Página | Título | Botão "Documento" | Observações |
|--------|--------|-------------------|-------------|
| Dashboard | `text-sm font-bold` | Inline `<Button>` com `font-normal` | OK |
| Documentos | `text-sm font-bold` | `<UploadDialog />` (sem `font-normal`) | Falta `font-normal` no UploadDialog |
| Drive | `text-sm font-bold` | Inline `<Button>` com `font-normal` | OK |
| Relatórios | `text-sm font-bold` | Inline `<Button>` com `font-normal` | OK |
| Configurações | `text-sm font-bold` | Sem botão documento | Header tem `mb-6` extra e está dentro de `max-w-5xl` |

**Problemas identificados:**
1. **UploadDialog** (usado na página Documentos) não tem `font-normal`, ficando com peso diferente dos outros botões
2. **Configurações** tem o header dentro de um wrapper `max-w-5xl` com `mb-6`, o que pode desalinhar o título verticalmente em relação às outras páginas

### Mudanças

**1. `src/components/documents/UploadDialog.tsx`**
- Adicionar `font-normal` ao className do Button para igualar aos demais

**2. `src/pages/Settings.tsx`** (~linha 417-418)
- Remover o wrapper `max-w-5xl` do header e mover para o conteúdo abaixo
- Trocar `mb-6` por nada (o `space-y-6` do pai já controla o espaço)
- Manter o header no nível raiz como nas outras páginas, com estrutura `flex items-center justify-between`

Resultado: todas as 4 páginas terão título `text-sm font-bold text-muted-foreground` na mesma posição (dentro de `p-8 space-y-6`) e botões com o mesmo estilo.

