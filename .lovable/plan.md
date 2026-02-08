

## Ajustar Posicionamento do Rodape

### Objetivo

Alinhar os links legais na mesma altura do "Powered by eonhub" da secao azul, com layout diferente para web e mobile.

### Alteracoes

#### 1. `src/components/auth/LoginForm.tsx`

**Mobile (linhas 221-233):**
Mudar de texto centralizado para layout flexbox com:
- "Powered by eonhub" justificado a esquerda
- "Privacidade · Termos" justificado a direita
- Aumentar espacamento vertical (de `pt-6` para `pt-8`)

```typescript
{/* Mobile: Powered by a esquerda, links a direita, mais baixo */}
<div className="md:hidden pt-8 flex items-center justify-between text-xs text-gray-400">
  <span>
    Powered by{" "}
    <a href="https://eonhub.com.br" className="font-bold text-gray-600">eonhub</a>
  </span>
  <div className="flex gap-1">
    <a href="/privacidade">Privacidade</a>
    <span>·</span>
    <a href="/termos">Termos</a>
  </div>
</div>
```

**Desktop (linhas 235-240):**
Aumentar espacamento vertical para alinhar com o "Powered by" da secao azul:
- Mudar de `space-y-3` no container pai para espacamento individual maior
- Adicionar `pt-8` ou `mt-auto` para empurrar para baixo

Estrutura do container:

```typescript
<div className="pt-4 flex flex-col">
  {/* Links de acao */}
  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
    ...links...
  </div>
  
  {/* Mobile: ... */}
  
  {/* Desktop: Privacidade e Termos mais baixos */}
  <div className="hidden md:flex justify-center gap-2 text-xs text-gray-400 pt-8">
    <a href="/privacidade">Privacidade</a>
    <span>·</span>
    <a href="/termos">Termos</a>
  </div>
</div>
```

### Resultado Visual

**Desktop:**
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
│   Powered by       │                                        │
│   eonhub           │         Privacidade · Termos  <-- mesma linha
│                    │                                        │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:**
```text
┌──────────────────────────┐
│         LOGO             │
│        (azul)            │
├──────────────────────────┤
│         login            │
│                          │
│    [ E-mail ]            │
│    [ Senha  ]            │
│                          │
│    [ Entrar ]            │
│    [ Google ]            │
│                          │
│ Esqueci · Criar · Instale│
│                          │
│                          │
│        (espaco maior)    │
│                          │
│ Powered by    Privacidade│
│ eonhub              Termos│
│ (esquerda)        (direita)
└──────────────────────────┘
```

### Secao Tecnica

**Arquivo:** `src/components/auth/LoginForm.tsx`

**Classes CSS:**
- `pt-8` - padding-top maior para afastar do conteudo acima
- `justify-between` - distribui itens nas extremidades (mobile)
- `justify-center` - centraliza (desktop)

**Mudancas estruturais:**
- Remover `space-y-3` do container pai
- Adicionar espacamento individual em cada secao
- Mobile: mudar de `text-center` para `flex justify-between`

