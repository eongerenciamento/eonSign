

## Ajustar Altura da Secao Azul no Mobile

### Problema

Na imagem, o conteudo do formulario de login (botoes e footer) esta sendo cortado pela barra de navegacao do Safari. Isso acontece porque:

1. A secao azul do header tem `pt-32` (8rem = 128px) de padding interno no container do logo
2. A secao azul tem `pb-36` (9rem = 144px) de padding bottom
3. Isso empurra o card branco muito para baixo, nao deixando espaco suficiente para todo o conteudo

### Solucao

Reduzir a altura da secao azul diminuindo:
- O `pt-32` para `pt-24` (de 8rem para 6rem) - logo fica um pouco mais alto
- O `pb-36` para `pb-28` (de 9rem para 7rem) - menos espaco entre logo e card branco

Isso faz o card branco comecar mais acima, dando mais espaco para o formulario e o footer.

### Alteracoes

#### `src/pages/Auth.tsx` - Layout Mobile

**Linha 118**: Mudar `pb-36` para `pb-28`
```typescript
<div className="relative flex-shrink-0 px-6 pb-28" style={{...}}>
```

**Linha 123**: Mudar `pt-32` para `pt-24`
```typescript
<div className="relative z-20 flex flex-col items-center pt-24">
```

### Resultado Visual Esperado

```text
┌──────────────────────────┐
│    13:53     ⟨⟩ 71%      │ <- Safe area azul
│  sign.eonhub.com.br      │
│                          │
│         ēon              │  <- Logo mais acima
│         sign             │
│                          │
├───────╮                  │  <- Card branco comeca mais cedo
│       └──────────────────┤
│         Login            │
│    [ E-mail ]            │
│    [ Senha  ]            │
│    [ Entrar ]            │
│    [ Google ]            │
│    [ Certificado ]       │
│                          │
│ Esqueci · Criar · Instale│
│                          │
│ Powered by    Privacidade│  <- Footer visivel acima da barra
│──────────────────────────│
│  <   >   ⬆  📖  📋       │  <- Barra Safari
└──────────────────────────┘
```

### Secao Tecnica

**Arquivo modificado:**
- `src/pages/Auth.tsx`

**Mudancas:**
- Linha 118: `pb-36` para `pb-28` (reduz padding bottom da secao azul)
- Linha 123: `pt-32` para `pt-24` (reduz padding top interno do container do logo)

A reducao total e de aproximadamente 4rem (64px), o que deve ser suficiente para que o footer apareca acima da barra de navegacao do Safari.

