

## Alinhar Links Legais com Powered By (Desktop)

### Problema Identificado

No desktop, o "Powered by eonhub" está posicionado com `absolute bottom-8` na seção azul. Os links "Privacidade" e "Termos" na seção branca precisam estar na mesma altura visual, não apenas com padding-top.

### Solução

Mudar a abordagem: ao invés de usar `pt-8` no container dos links, usar posicionamento absoluto com `bottom-8` para alinhar perfeitamente com o "Powered by" da seção azul.

### Alteracoes

#### 1. `src/pages/Auth.tsx`

Adicionar posição relativa ao container branco do desktop para permitir posicionamento absoluto dos links:

```typescript
// Linha 148-162: Adicionar relative ao container
<div className="w-[60%] flex flex-col items-center justify-center p-8 rounded-r-3xl relative" ...>
  <div className="w-full max-w-md">
    ...
  </div>
  
  {/* Links legais posicionados na mesma altura do Powered by */}
  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 text-xs text-gray-400">
    <a href="/privacidade">Privacidade</a>
    <span>·</span>
    <a href="/termos">Termos</a>
  </div>
</div>
```

#### 2. `src/components/auth/LoginForm.tsx`

Remover a seção desktop dos links (já que será movida para Auth.tsx):

```typescript
// Remover linhas 235-240 (seção hidden md:flex)
{/* Desktop: Privacidade e Termos mais baixos... */}
<div className="hidden md:flex justify-center gap-2 text-xs text-gray-400 pt-8">
  ...
</div>
```

### Resultado Visual

```text
┌─────────────────────────────────────────────────────────────┐
│                    │                                        │
│      LOGO          │            login                       │
│    (azul)          │                                        │
│                    │    [ E-mail ]                          │
│                    │    [ Senha  ]                          │
│                    │                                        │
│                    │    [ Entrar ]                          │
│                    │    [ Google ]                          │
│                    │                                        │
│   Certificado      │    Esqueci · Criar conta · Instale     │
│                    │                                        │
│   Powered by       │         Privacidade · Termos           │
│   eonhub           │   ← mesma linha (bottom-8)             │
└─────────────────────────────────────────────────────────────┘
```

### Secao Tecnica

**Arquivos modificados:**
- `src/pages/Auth.tsx` - adicionar links com posição absoluta
- `src/components/auth/LoginForm.tsx` - remover seção desktop duplicada

**Classes CSS:**
- `absolute bottom-8` - posiciona os links na mesma altura que o "Powered by"
- `relative` - necessário no container pai para o posicionamento absoluto funcionar

