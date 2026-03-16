

## Substituir texto "eonSign" por logo no PDF e remover botão de visualizar documento

### Alterações

**1. Copiar a logo enviada para o projeto**
- Copiar `user-uploads://logobranca-6.png` para `public/email-assets/logobranca-6.png` (logo branca no fundo transparente, ideal para header escuro do PDF).

**2. `supabase/functions/generate-signature-report/index.ts`** — Substituir texto "eonSign" por imagem da logo
- Buscar a logo PNG de uma URL pública (ex: `${supabaseUrl}/storage/v1/object/public/email-assets/logobranca-6.png` ou diretamente do domínio público do app).
- Embutir a imagem PNG no PDF usando `pdfDoc.embedPng()` e `page.drawImage()` no lugar do `page.drawText("eonSign", ...)` (linhas 221-228).
- A logo será posicionada no mesmo local (header, canto esquerdo), dimensionada para ~120x30px para manter proporção.

**3. `src/pages/ValidateDocument.tsx`** — Substituir texto "eonSign" por imagem da logo no PDF gerado no frontend
- Carregar a logo como imagem base64 e usar `doc.addImage()` do jsPDF no lugar de `doc.text("eonSign", ...)` (linha 222).
- A logo substituirá o texto no header do certificado de validação.

**4. `src/components/documents/DocumentsTable.tsx`** — Remover botão de visualizar documento (ícone Eye)
- Remover o `<Button>` com `<Eye>` que aparece nas duas views (desktop ~linhas 1147-1155 e mobile ~linhas 1297-1305).
- Remover `Eye` do import de lucide-react (se não for usado em nenhum outro lugar do arquivo).

### Notas
- A logo precisa estar acessível via URL pública para a edge function poder baixá-la. Será hospedada no bucket `email-assets` do storage ou referenciada diretamente do domínio público.
- O `EnvelopeDocumentsDialog.tsx` também tem botão Eye para visualizar documentos individuais do envelope — esse será mantido, pois a solicitação refere-se à listagem principal de documentos.

