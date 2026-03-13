

## Padronizar botões de confirmação no UserProfileSheet

### Problema
Os botões "Salvar" e "Confirmar Alteração" no painel de perfil (avatar) usam estilo cinza (`bg-gray-200 text-gray-600`) em vez do padrão azul do sistema.

### Alterações em `src/components/UserProfileSheet.tsx`

**1. Botão "Confirmar Alteração" (linha ~425-432):**
Trocar classes inline por `variant="sheet-primary"`.

**2. Botão "Salvar" (linha ~446-457):**
Trocar classes inline por `variant="sheet-primary"`.

**3. Botão "Sair" (linha ~437-445):**
Trocar para `variant="sheet-cancel"` para seguir o padrão de cancelamento.

### Arquivo alterado
- `src/components/UserProfileSheet.tsx` (3 botões)

