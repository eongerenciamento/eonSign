

## Ajustes Mobile na Pagina de Login

### Objetivo

1. Pagina fixa sem scroll vertical
2. Inputs sem autofocus ao entrar
3. Parte azul ocupando a safe area (estendendo ate o topo)

### Alteracoes

#### 1. `src/pages/Auth.tsx` - Layout Mobile

**Remover scroll e fixar altura:**
Mudar de `min-h-screen flex flex-col` para `h-screen flex flex-col overflow-hidden` no container mobile.

**Estender parte azul para ocupar safe area:**
Atualmente a parte azul tem `pt-[env(safe-area-inset-top)]` que adiciona padding. Para ocupar toda a safe area (como no screenshot), a parte azul deve:
- Remover o padding-top da safe area
- Adicionar padding interno para o conteudo nao ficar atras do notch

```typescript
// Container mobile - linha 105
<div className="md:hidden h-screen flex flex-col overflow-hidden" style={{
  backgroundColor: '#ffffff'
}}>

// Parte azul - linha 108
<div className="relative flex-shrink-0 px-6 pb-36" style={{
  background: "linear-gradient(to bottom, #273D60, #1a2847)",
  paddingTop: "calc(env(safe-area-inset-top) + 2rem)"
}}>
```

**Ajustar parte branca para nao ter scroll:**
```typescript
// Linha 117 - usar overflow-hidden
<div className="flex-1 rounded-t-3xl -mt-4 px-6 py-5 relative z-30 flex flex-col overflow-hidden" ...>
```

#### 2. `src/components/auth/LoginForm.tsx` - Remover Autofocus

Os inputs do react-hook-form nao tem autofocus por padrao, mas para garantir, podemos adicionar `autoFocus={false}` explicitamente ou usar `tabIndex={-1}` no primeiro input.

Adicionar ao input de email:
```typescript
<Input 
  {...field} 
  type="email" 
  placeholder="E-mail" 
  disabled={isSubmitting} 
  autoFocus={false}
  className={`${inputClassName} pl-10`} 
/>
```

### Resultado Visual Esperado

```text
┌──────────────────────────┐ <- Safe area (parte azul)
│       (notch/hora)       │
│                          │
│         LOGO             │
│        (azul)            │
├───────╮                  │
│       └──────────────────┤ <- Card branco sobrepoe
│         Login            │
│                          │
│    [ E-mail ]            │
│    [ Senha  ]            │
│                          │
│    [ Entrar ]            │
│    [ Google ]            │
│                          │
│ Esqueci · Criar · Instale│
│                          │
│ Powered by    Privacidade│
│ eonhub           · Termos│
└──────────────────────────┘
   (sem scroll, tela fixa)
```

### Secao Tecnica

**Arquivos modificados:**
- `src/pages/Auth.tsx` - layout mobile fixo
- `src/components/auth/LoginForm.tsx` - desabilitar autofocus

**Classes CSS:**
- `h-screen` - altura fixa da viewport
- `overflow-hidden` - impede scroll
- `paddingTop: calc(env(safe-area-inset-top) + 2rem)` - safe area + espaco para conteudo

**Propriedades HTML:**
- `autoFocus={false}` - previne foco automatico no input

