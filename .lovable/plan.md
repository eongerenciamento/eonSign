

## Centralizar verticalmente as 3 frases do footer com o QR code

### Alteração em `supabase/functions/generate-signature-report/index.ts`

O QR code tem 52px de altura e está centralizado verticalmente no footer de 80px. O centro vertical do footer é `footerY + footerHeight / 2` = 55.

As 3 linhas de texto (alturas 9, 9, 8) com espaçamento de 13px ocupam ~28px de altura total. Para centralizar verticalmente, calcular `textStartY` a partir do centro do footer:

- Centro do footer: `footerY + footerHeight / 2` = 55
- Metade da altura do bloco de texto (~28/2 = 14): `textStartY = 55 + 14 - 9` ≈ 60
- Linha 1: y = centerY + ~9
- Linha 2: y = centerY - 4
- Linha 3: y = centerY - 19

**Linhas 662-708**: Substituir o cálculo fixo `textStartY = footerTopY - 16` por um cálculo centralizado baseado no centro vertical do footer (`footerY + footerHeight / 2`).

### Arquivo alterado
- `supabase/functions/generate-signature-report/index.ts`

