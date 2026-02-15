

## Corrigir Login Google no Dominio Customizado

### Problema

O app roda em `sign.eonhub.com.br` (dominio customizado). O `lovable.auth.signInWithOAuth` usa o auth-bridge do Lovable que so funciona em dominios `*.lovable.app`. Em dominios customizados, o fluxo OAuth precisa ser feito diretamente via cliente de autenticacao, contornando o auth-bridge.

### Solucao

Modificar o botao de login Google para detectar se esta rodando em dominio customizado. Se sim, usar o fluxo direto com `supabase.auth.signInWithOAuth` e `skipBrowserRedirect: true`. Se nao, manter o fluxo atual via `lovable.auth.signInWithOAuth`.

### Configuracao Google Cloud Console

A configuracao atual esta correta:
- Origem JavaScript: `https://sign.eonhub.com.br` -- OK
- URL de redirecionamento: `https://sign.eonhub.com.br/~oauth/callback` -- Precisa verificar se o callback correto do Lovable Cloud esta configurado tambem. Pode ser necessario adicionar a URL de callback do backend de autenticacao (visivel nas configuracoes de autenticacao do Lovable Cloud).

### Alteracao

#### `src/components/auth/LoginForm.tsx`

Substituir o bloco do botao Google para incluir logica de dominio customizado:

```typescript
onClick={async () => {
  const isCustomDomain =
    !window.location.hostname.includes("lovable.app") &&
    !window.location.hostname.includes("lovableproject.com");

  if (isCustomDomain) {
    // Custom domain: bypass auth-bridge, use direct OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login com Google",
        description: error.message || "Tente novamente em instantes.",
      });
      return;
    }

    if (data?.url) {
      // Validate OAuth URL before redirecting
      const oauthUrl = new URL(data.url);
      const allowedHosts = ["accounts.google.com"];
      if (!allowedHosts.some((host) => oauthUrl.hostname === host)) {
        toast({
          variant: "destructive",
          title: "Erro de seguranca",
          description: "URL de autenticacao invalida.",
        });
        return;
      }
      window.location.href = data.url;
    }
  } else {
    // Lovable domains: use managed auth-bridge
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login com Google",
        description: error.message || "Tente novamente em instantes.",
      });
    }
  }
}}
```

### Configuracao necessaria no Google Cloud Console

Voce precisa adicionar tambem a URL de callback do backend de autenticacao do Lovable Cloud nos URIs de redirecionamento autorizados. Alem de `https://sign.eonhub.com.br/~oauth/callback`, adicione:

`https://lbyoniuealghclfuahko.supabase.co/auth/v1/callback`

Essa URL e o endpoint real do backend que processa o retorno do Google e estabelece a sessao.

### Resumo das URLs no Google Cloud Console

**Origens JavaScript autorizadas:**
- `https://sign.eonhub.com.br`

**URIs de redirecionamento autorizados:**
- `https://sign.eonhub.com.br/~oauth/callback`
- `https://lbyoniuealghclfuahko.supabase.co/auth/v1/callback`

### Arquivo alterado
- `src/components/auth/LoginForm.tsx` (bloco do botao Google)

