

## Corrigir redirecionamento apos login Google

### Problema

Apos o login com Google, o usuario e redirecionado de volta para a pagina de autenticacao em vez de entrar no sistema. Isso acontece porque:

1. O `redirect_uri` esta configurado como `window.location.origin` (ou seja, a raiz `/`)
2. A rota `/` e protegida pelo `ProtectedRoute`, que verifica a sessao imediatamente
3. A sessao ainda nao foi estabelecida nesse momento, entao o `ProtectedRoute` redireciona para `/auth`
4. Quando a sessao finalmente e detectada em `/auth`, o listener `onAuthStateChange` deveria redirecionar para `/dashboard`, mas o timing pode falhar

### Solucao

Alterar o `redirect_uri` no botao de Google para `${window.location.origin}/auth` em vez de `window.location.origin`. Assim, apos o OAuth, o usuario volta para `/auth`, onde o listener `onAuthStateChange` ja esta configurado e vai detectar a nova sessao e redirecionar para `/dashboard`.

### Alteracao

#### `src/components/auth/LoginForm.tsx`

Mudar a linha do `redirect_uri`:

**De:**
```typescript
redirect_uri: window.location.origin,
```

**Para:**
```typescript
redirect_uri: `${window.location.origin}/auth`,
```

### Por que isso resolve

```text
Fluxo atual (quebrado):
Google -> /~oauth -> / (ProtectedRoute) -> sem sessao -> /auth -> sessao chega tarde

Fluxo corrigido:
Google -> /~oauth -> /auth -> onAuthStateChange detecta sessao -> /dashboard
```

A pagina `/auth` ja tem o codigo que monitora mudancas de autenticacao e redireciona automaticamente para `/dashboard` quando uma sessao e detectada. Ao redirecionar para la apos o OAuth, garantimos que o fluxo funcione de forma consistente.

### Arquivo alterado
- `src/components/auth/LoginForm.tsx` (1 linha)

