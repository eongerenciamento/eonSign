

## Corrigir Login Google - Sessao nao detectada apos redirecionamento

### Causa Raiz

O problema tem duas partes:

1. **`redirect_uri` incorreto**: Mudamos para `/auth`, mas a infraestrutura do Lovable Cloud espera `window.location.origin` (raiz `/`). Os tokens OAuth sao passados na URL e o cliente Supabase os processa automaticamente, mas somente quando o `redirect_uri` e o padrao documentado.

2. **Race condition no `ProtectedRoute`**: O `getSession()` resolve com `null` ANTES do cliente Supabase processar os tokens da URL. Isso faz o `ProtectedRoute` redirecionar para `/auth` prematuramente, perdendo os tokens.

### Fluxo do Problema

```text
Google OAuth completa
       |
       v
Redireciona para /auth (redirect_uri atual)
       |
       v
Infra Lovable Cloud nao envia tokens corretamente para /auth
       |
       v
Auth.tsx nao encontra sessao -> fica na tela de login
```

### Fluxo Corrigido

```text
Google OAuth completa
       |
       v
Redireciona para / (redirect_uri padrao)
       |
       v
Supabase client processa tokens da URL automaticamente
       |
       v
ProtectedRoute aguarda onAuthStateChange (INITIAL_SESSION)
       |
       v
Sessao detectada -> mostra Dashboard
```

### Alteracoes

#### 1. `src/components/auth/LoginForm.tsx`

Reverter `redirect_uri` para o valor padrao documentado:

**De:**
```typescript
redirect_uri: `${window.location.origin}/auth`,
```

**Para:**
```typescript
redirect_uri: window.location.origin,
```

#### 2. `src/components/ProtectedRoute.tsx`

Remover a chamada separada a `getSession()` e usar apenas `onAuthStateChange`. O evento `INITIAL_SESSION` do Supabase so dispara APOS processar tokens da URL, eliminando a race condition.

**Codigo atual:**
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setIsLoading(false);
    }
  );
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setIsLoading(false);
  });
  return () => subscription.unsubscribe();
}, []);
```

**Codigo corrigido:**
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setIsLoading(false);
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

A diferenca e remover o bloco `getSession().then(...)` que causava a race condition. O `onAuthStateChange` com o evento `INITIAL_SESSION` ja fornece o estado inicial da autenticacao de forma segura e correta.

### Arquivos alterados
- `src/components/auth/LoginForm.tsx` (1 linha - reverter redirect_uri)
- `src/components/ProtectedRoute.tsx` (remover chamada getSession)
