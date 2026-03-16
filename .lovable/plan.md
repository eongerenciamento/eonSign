

## Resolver Login Google Definitivamente

### Problema Atual

O fluxo OAuth Google no dominio customizado (`sign.eonhub.com.br`) falha porque:

1. O Google Cloud Console so tem `sign.eonhub.com.br/~oauth/callback` como URL de redirecionamento, mas o fluxo direto (que usamos para dominios customizados) redireciona via backend, exigindo uma URL diferente
2. O `redirectTo` aponta para `/dashboard` (rota protegida), o que pode causar problemas de timing no processamento dos tokens

### Fluxo OAuth Direto (dominio customizado)

```text
App chama supabase.auth.signInWithOAuth
       |
       v
Redireciona para backend: lbyoniuealghclfuahko.supabase.co/auth/v1/authorize
       |
       v
Backend redireciona para Google
       |
       v
Usuario autoriza no Google
       |
       v
Google redireciona para: lbyoniuealghclfuahko.supabase.co/auth/v1/callback  <-- PRECISA ESTAR NO GOOGLE CONSOLE
       |
       v
Backend processa tokens e redireciona para: sign.eonhub.com.br/#access_token=...
       |
       v
Supabase client no frontend processa os tokens da URL
       |
       v
onAuthStateChange detecta sessao -> Dashboard
```

### Alteracoes Necessarias

#### 1. Configuracao no Google Cloud Console (acao do usuario)

Adicionar esta URL nos **URIs de redirecionamento autorizados** do Google Cloud Console:

```
https://lbyoniuealghclfuahko.supabase.co/auth/v1/callback
```

Manter tambem a URL existente (`https://sign.eonhub.com.br/~oauth/callback`) para compatibilidade.

#### 2. `src/components/auth/LoginForm.tsx`

Alterar o `redirectTo` de `/dashboard` para a raiz `/`:

**De:**
```typescript
redirectTo: `${window.location.origin}/dashboard`,
```

**Para:**
```typescript
redirectTo: window.location.origin,
```

Motivo: Redirecionar para `/` (que e uma rota protegida via ProtectedRoute) garante que o Supabase client processe os tokens do hash ANTES do ProtectedRoute avaliar a sessao. O Auth.tsx ja tem listener de `onAuthStateChange` que envia para `/dashboard` quando detecta sessao. Se o usuario ja esta autenticado, o ProtectedRoute renderiza o Dashboard diretamente.

#### 3. Nenhuma outra alteracao de codigo necessaria

O `allowedHosts` ja foi corrigido na edicao anterior para incluir `lbyoniuealghclfuahko.supabase.co`. O `ProtectedRoute` ja usa apenas `onAuthStateChange` (sem `getSession`). O PWA ja tem o `navigateFallbackDenylist` para `/~oauth`.

### Resumo

| Item | Status |
|------|--------|
| allowedHosts inclui backend | Ja corrigido |
| ProtectedRoute sem getSession | Ja corrigido |
| PWA denylist para /~oauth | Ja configurado |
| redirectTo para raiz (/) | Precisa alterar |
| Google Console com callback do backend | Precisa adicionar (acao do usuario) |

### Arquivo alterado
- `src/components/auth/LoginForm.tsx` (1 linha - redirectTo)

### Acao do usuario (obrigatoria)
- Adicionar `https://lbyoniuealghclfuahko.supabase.co/auth/v1/callback` nos URIs de redirecionamento autorizados no Google Cloud Console

