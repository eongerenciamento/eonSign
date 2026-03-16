

## Corrigir glassmorphism do menu mobile

O problema tem duas partes:

1. **Safe-area div** (linha 63): usa `bg-background` sólido, criando uma barra opaca acima da nav
2. **Nav background** (linhas 53-55): usa 65% de opacidade que pode parecer sólido demais

### Mudanças em `src/components/MobileNav.tsx`

1. **Linha 63**: Trocar `bg-background` da safe-area div para `bg-transparent` — o blur da nav já cobre essa área
2. **Linhas 53-55**: Reduzir opacidade do fundo para ~40%, mantendo a cor escura sem esbranquiçar:
   - Light: `rgba(15, 30, 65, 0.40)` → `rgba(30, 58, 110, 0.40)`
   - Dark: `hsla(220, 10%, 18%, 0.40)`
3. **Linha 69**: Garantir que `backdrop-blur-xl` está aplicado e adicionar `backdrop-saturate-150` para manter cores vivas sem esmaecer

Resultado: nav com blur ultra visível, sem fundo sólido, sem esbranquiçar.

