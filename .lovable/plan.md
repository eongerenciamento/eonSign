

## Ajustar Rodape da Pagina de Login (Web e Mobile)

### Alteracoes Solicitadas

**Web (Desktop):**
1. Remover o botao "Certificado Digital" abaixo do Google
2. Remover "Powered by eonhub" do rodape do formulario (ja existe na parte azul)
3. Manter apenas "Privacidade" e "Termos" centralizados na mesma altura do "Powered by" da parte azul

**Mobile:**
1. Afastar mais o "Powered by eonhub · Privacidade · Termos" dos links de acao
2. Manter a estrutura atual mas com mais espacamento

### Arquivos a Modificar

#### 1. `src/components/auth/LoginForm.tsx`

**Remover botao Certificado Digital (linhas 192-200):**
Excluir o bloco `<a>` do Certificado Digital que aparece abaixo do Google.

**Reestruturar o rodape (linhas 202-244):**

```typescript
<div className="pt-4 space-y-3">
  {/* Links de acao - mantidos */}
  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
    <button onClick={handleForgotPassword}>Esqueci a senha</button>
    <span>·</span>
    <button onClick={onRegisterClick}>Criar conta</button>
    <span>·</span>
    <button onClick={onInstallClick}>Instale o App</button>
  </div>
  
  {/* Mobile: Powered by + links legais com mais espacamento */}
  <div className="md:hidden pt-6 text-center text-xs text-gray-400">
    <span>
      Powered by <a href="https://eonhub.com.br" className="font-bold text-gray-600">eonhub</a>
    </span>
    <span className="mx-2">·</span>
    <a href="/privacidade">Privacidade</a>
    <span className="mx-1">·</span>
    <a href="/termos">Termos</a>
  </div>
  
  {/* Desktop: Apenas Privacidade e Termos centralizados */}
  <div className="hidden md:flex justify-center text-xs text-gray-400">
    <a href="/privacidade">Privacidade</a>
    <span className="mx-2">·</span>
    <a href="/termos">Termos</a>
  </div>
</div>
```

### Resultado Visual Esperado

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
│   Powered by       │                                        │
│   eonhub           │         Privacidade · Termos           │
│                    │           (centralizado)               │
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
│        (espaco)          │
│                          │
│ Powered by eonhub ·      │
│ Privacidade · Termos     │
└──────────────────────────┘
```

### Secao Tecnica

**Classes CSS utilizadas:**
- `md:hidden` - mostra apenas no mobile
- `hidden md:flex` - mostra apenas no desktop
- `pt-6` - padding-top maior no mobile para afastar do bloco anterior
- `justify-center` - centraliza horizontalmente no desktop
- `text-center` - centraliza texto no mobile

**Elementos removidos:**
- Botao "Certificado Digital R$109.90" do LoginForm (mantido apenas na parte azul do desktop)
- "Powered by eonhub" do desktop (ja existe na secao azul)

