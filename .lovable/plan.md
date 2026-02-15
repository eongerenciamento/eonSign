
## Corrigir erro "State verification failed" no login Google

### Problema

O erro "Authorization failed - State verification failed - Error code: invalid_request" acontece porque o **service worker do PWA** esta interceptando a rota de callback OAuth (`/~oauth`) e servindo uma versao cacheada em vez de deixar a requisicao ir para o servidor.

Quando o Google redireciona de volta para o app apos a autenticacao, o service worker captura essa navegacao e retorna o HTML cacheado do app, perdendo os parametros de estado OAuth. Isso causa a falha na verificacao de estado.

### Solucao

Adicionar `/~oauth` na `navigateFallbackDenylist` do Workbox no `vite.config.ts`. Isso garante que o service worker **nunca** intercepte rotas de OAuth, permitindo que o fluxo de autenticacao funcione corretamente.

### Alteracoes

#### `vite.config.ts`

Adicionar `navigateFallbackDenylist: [/^\/~oauth/]` dentro da configuracao do `workbox`:

```typescript
workbox: {
  navigateFallbackDenylist: [/^\/~oauth/],  // ADICIONAR esta linha
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  // ... resto da config existente
}
```

### Por que isso resolve

1. O Google OAuth redireciona para `oauth.lovable.app` apos a autenticacao
2. O Lovable Cloud redireciona de volta para o app na rota `/~oauth` com os tokens
3. Sem o `navigateFallbackDenylist`, o service worker intercepta `/~oauth` e serve o `index.html` cacheado
4. O `index.html` cacheado nao tem os parametros de estado, causando "State verification failed"
5. Com a correcao, o service worker ignora `/~oauth` e deixa a requisicao ir direto para o servidor

### Secao Tecnica

**Arquivo modificado:**
- `vite.config.ts` (linha 43, dentro do bloco `workbox`)

**Mudanca:**
- Adicionar `navigateFallbackDenylist: [/^\/~oauth/]` como primeira propriedade do objeto `workbox`

**Nota importante:** Apos a publicacao, os usuarios que ja tem o service worker antigo cacheado podem precisar limpar o cache do navegador ou aguardar a atualizacao automatica do service worker (configurado como `autoUpdate`).
