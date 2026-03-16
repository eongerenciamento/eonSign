

## Ajustes visuais no PDF — cores, footer, ícone check

### Alterações no `supabase/functions/generate-signature-report/index.ts`

**1. Badge "Signatário X" → gray700**
- Mudar cor do badge de `gray800` para `gray700` = `rgb(55/255, 65/255, 81/255)`.

**2. Header do PDF → gray700**
- Mudar fundo do header para `gray700` = `rgb(55/255, 65/255, 81/255)`.

**3. Footer — remover retângulo, manter só linha divisória**
- Substituir `drawRectangle` do footer por `drawLine` horizontal (cor `borderGray`).
- QR code e textos ficam sobre fundo branco.

**4. Ícone check — maior, sem negrito, branco, mais à esquerda**
- Aumentar `checkCircleRadius` de `5` para `6`.
- Linhas do checkmark: `thickness: 1` (sem negrito), cor `white` (em vez de `darkGreen`).
- Deslocar ícone + texto "Assinado" mais à esquerda.

**5. Texto "Assinado" — sem negrito**
- Mudar fonte de `helveticaBold` para `helveticaFont` (regular).

**6. Remover texto "Validação" abaixo do QR code**
- Excluir o `drawText` que escreve "Validação" (ou similar) abaixo do QR code no footer.

### Arquivo alterado
- `supabase/functions/generate-signature-report/index.ts`

