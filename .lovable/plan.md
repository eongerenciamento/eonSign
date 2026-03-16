

## Ajustes na assinatura lateral do documento original

### Alterações em `supabase/functions/apply-simple-signature/index.ts`

**1. Remover a frase "Verifique em: ..."**
- Linhas 291-307: Excluir todo o bloco que desenha `validationText` (incluindo a coluna `validationColumnX`).
- Remover a constante `validationColumnX = 25` (linha 184) já que não será mais usada.

**2. Nome do signatário em negrito, resto em fonte normal**
- Atualmente tudo é desenhado como uma única string em `helveticaBold`. Separar em duas chamadas `drawText`:
  - Primeiro: nome (`displayName`) em `helveticaBold`
  - Segundo: restante (` - CPF - data [indicadores]`) em `helveticaFont`
- Posicionar o segundo texto logo após o primeiro usando `widthOfTextAtSize` do nome para calcular o offset Y (já que está rotacionado 90°).

**3. Aumentar levemente a fonte**
- Aumentar os tamanhos base: de `6` para `7`, e ajustar os breakpoints proporcionalmente (ex: `>70 → 5.5`, `>55 → 6`, `>45 → 6.5`).

**4. Simplificar layout para coluna única**
- Com a remoção da validação, usar apenas `metadataColumnX = 12` como posição X para tudo (logo + assinaturas).

### Arquivo alterado
- `supabase/functions/apply-simple-signature/index.ts`

