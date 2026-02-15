

## Corrigir erro "URL de autenticacao invalida" no login Google

### Causa

O codigo atual valida a URL OAuth retornada pelo backend verificando se o hostname e `accounts.google.com`. Porem, a URL retornada e do proprio backend de autenticacao (`lbyoniuealghclfuahko.supabase.co/auth/v1/authorize`), que internamente redireciona para o Google. A validacao rejeita essa URL legitima e exibe "Erro de seguranca - URL de autenticacao invalida".

### Solucao

Adicionar o hostname do backend de autenticacao na lista de hosts permitidos.

### Alteracao

#### `src/components/auth/LoginForm.tsx`

Atualizar a lista `allowedHosts` para incluir o backend:

**De:**
```typescript
const allowedHosts = ["accounts.google.com"];
```

**Para:**
```typescript
const allowedHosts = [
  "accounts.google.com",
  "lbyoniuealghclfuahko.supabase.co",
];
```

### Arquivo alterado
- `src/components/auth/LoginForm.tsx` (1 linha)

