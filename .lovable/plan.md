

## Centralizar ícones no menu mobile

### Problema
Os 5 ícones de navegação usam `flex-1` e ficam ao lado do avatar (que é `flex-shrink-0`). Como o avatar ocupa espaço à direita, o bloco `flex-1` dos ícones não fica visualmente centrado na barra — fica deslocado para a esquerda.

### Solução
Usar posicionamento absoluto para o avatar, tirando-o do fluxo flex. Assim os ícones ocupam todo o espaço e ficam verdadeiramente centrados.

### Mudança em `src/components/MobileNav.tsx` (linhas 72-104)

Trocar o layout do container interno:
- Container pai: `relative flex items-center justify-center`
- Bloco dos ícones: remover `flex-1`, manter `flex items-center justify-center gap-1.5`
- Avatar: adicionar `absolute right-2` para posicioná-lo à direita sem afetar o centro dos ícones

