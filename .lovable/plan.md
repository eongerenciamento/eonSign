

## Ajustes na assinatura lateral do PDF original

### Diagnóstico

O código atual em `apply-simple-signature/index.ts` já **não contém** a frase "Verifique em:..." — ela foi removida na edição anterior. O PDF que você está vendo provavelmente foi gerado antes dessa alteração. A função precisa ser re-deployada para que novos PDFs reflitam a mudança.

Da mesma forma, o nome já está em negrito (`helveticaBold`) e o restante (CPF, data, indicadores) já usa fonte regular (`helveticaFont`). Isso está correto.

### Alteração necessária

**Arquivo:** `supabase/functions/apply-simple-signature/index.ts`

**Aumentar fonte** — Linha 264: mudar base de `7` para `8`, e ajustar breakpoints proporcionalmente:
- `> 70 chars` → de `5.5` para `6.5`
- `> 55 chars` → de `6` para `7`
- `> 45 chars` → de `6.5` para `7.5`

Isso torna todas as informações (nome + metadados) levemente maiores conforme solicitado.

### Resultado esperado
- "Verifique em:..." não aparece em novos PDFs (já removido no código)
- Nome do signatário em negrito, CPF/data/indicadores em fonte normal (já implementado)
- Fonte levemente maior para melhor legibilidade

