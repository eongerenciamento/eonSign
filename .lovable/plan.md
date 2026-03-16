

## Problema

Os documentos "Recibo de Rescisão - Manoel" e "Recibo de Rescisão - Francinei" foram criados antes do sistema incluir automaticamente o signatário interno (company signer) na tabela `document_signers`. Ambos têm `signers: 2` e `signed_by: 2`, mas apenas 1 registro de signatário (o externo). Por isso, o círculo do signatário interno não aparece.

## Solução

Duas ações complementares:

### 1. Correção de dados (migração SQL)
Inserir os registros de company signer ausentes para os 2 documentos, usando os dados do `company_settings` (Marcus Vinicius Sousa dos Santos, marcus@mav.eng.br, (91)98898-1359, CPF 875.327.602-78), com `is_company_signer: true` e `status: signed`.

### 2. Proteção no código (Dashboard.tsx)
No `loadDocuments`, após carregar os signers, verificar se `signerStatuses.length < item.signers`. Se houver diferença, consultar `company_settings` para preencher o signatário interno faltante no array, garantindo que o círculo apareça mesmo para documentos antigos com dados incompletos.

**Arquivos alterados:**
- Nova migração SQL (inserção de 2 registros em `document_signers`)
- `src/pages/Dashboard.tsx` (fallback para signatário interno ausente)

