

## Restaurar cor original do menu mobile com glassmorphism

O problema: a opacidade foi reduzida para 40%, o que esbranquiçou/esmaeceu o menu. A solução é aumentar a opacidade do fundo para ~85-90% mantendo o `backdrop-blur-xl` para o efeito de conteúdo rolando por trás.

### Mudança em `src/components/MobileNav.tsx` (linhas 53-55)

Aumentar opacidade de `0.40` para `0.85`:

```tsx
const navBackground = resolvedTheme === 'dark' 
  ? 'hsla(220, 10%, 18%, 0.85)' 
  : 'linear-gradient(to right, rgba(15, 30, 65, 0.85) 0%, rgba(30, 58, 110, 0.85) 100%)';
```

Isso mantém a cor original escura/azulada praticamente intacta, mas com transparência suficiente para o `backdrop-blur-xl` criar o efeito sutil de conteúdo passando por trás.

