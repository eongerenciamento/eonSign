

## Ajustes visuais no PDF — signatários, footer e QR code

### Alterações no `supabase/functions/generate-signature-report/index.ts`

**1. Centralizar "Signatário X" no badge cinza**
- O retângulo tem `width: 70, height: 25`. Calcular `x` e `y` do texto dinamicamente usando `widthOfTextAtSize` para centralizar horizontal e verticalmente.

**2. Mudar cor do badge para gray800**
- Substituir `gray300` por `gray800` (`rgb(31/255, 41/255, 55/255)`) no retângulo do badge.
- Texto do badge passa a ser branco para contraste.

**3. Adicionar ícone de check verde antes de "Assinado"**
- Desenhar um círculo verde claro (`rgb(187/255, 247/255, 208/255)`) com `drawCircle`.
- Dentro, desenhar checkmark com duas linhas (`drawLine`) em verde escuro (`rgb(22/255, 101/255, 52/255)`).
- Posicionar à esquerda do texto "Assinado".

**4. Mover QR code para dentro do footer**
- Atualmente o QR code fica flutuando acima do footer (y: 55, separado do bloco de texto do footer).
- Reorganizar: o footer será um bloco único com retângulo de fundo, textos à esquerda e QR code à direita, tudo integrado.
- O QR code (56x56) ficará alinhado à direita dentro do footer, verticalmente centrado.
- A linha separadora do footer será estendida até a largura total (sem recorte para o QR).
- Ajustar `footerY` e posições para que o bloco footer contenha tanto os textos quanto o QR code.

