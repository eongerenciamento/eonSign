

## Adicionar Botao Certificado Digital no Mobile

### Problema

O botao "Certificado Digital R$109.90" existe no desktop dentro do componente `PoweredBy` (linha 145), mas nao foi incluido no layout mobile.

### Solucao

Adicionar o botao "Certificado Digital" na secao azul do mobile, abaixo do logo, mantendo a mesma estilizacao do desktop.

### Alteracoes

#### `src/pages/Auth.tsx` - Layout Mobile

Adicionar o botao na secao azul do mobile, logo abaixo do logo (apos linha 115):

```typescript
// Secao azul mobile - linha 108-116
<div className="relative flex-shrink-0 px-6 pb-36" style={{
  background: "linear-gradient(to bottom, #273D60, #1a2847)",
  paddingTop: "calc(env(safe-area-inset-top) + 2rem)"
}}>
  <RadialGlow />
  <div className="relative z-20 flex flex-col items-center pt-32">
    <img src={LOGO_URL} alt="Logo" className="h-20 w-auto" />
    
    {/* Botao Certificado Digital para mobile */}
    <a 
      href="https://certifica.eonhub.com.br" 
      target="_blank" 
      rel="noopener noreferrer" 
      style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
      className="mt-6 inline-block px-4 py-2 text-white text-sm transition-all hover:opacity-90 font-normal rounded-full"
    >
      Certificado Digital <span className="text-xs">R$</span>109.90
    </a>
  </div>
</div>
```

### Resultado Visual

```text
┌──────────────────────────┐
│    12:51     ⟨⟩ 81%      │ <- Safe area azul
│                          │
│         ēon              │
│         sign             │
│                          │
│  [Certificado R$109.90]  │ <- Botao adicionado
│                          │
├───────╮                  │
│       └──────────────────┤
│         Login            │
│    [ E-mail ]            │
│    [ Senha  ]            │
│    [ Entrar ]            │
│    [ Google ]            │
│                          │
│ Esqueci · Criar · Instale│
│ Powered by    Privacidade│
└──────────────────────────┘
```

### Secao Tecnica

**Arquivo modificado:**
- `src/pages/Auth.tsx`

**Mudancas:**
- Linha 113: Mudar `flex justify-center` para `flex flex-col items-center` para empilhar logo + botao
- Adicionar link do Certificado Digital apos o logo com `mt-6` para espacamento

