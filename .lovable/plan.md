

## Adicionar Validação de Product ID no Webhook do Stripe

### Problema Atual

Quando a conta Stripe recebe eventos de pagamento, ela envia webhooks para **TODOS** os endpoints cadastrados, independentemente do produto. Isso significa que:

1. Se existirem outros produtos na mesma conta Stripe, o webhook do eonSign tentaria processar eventos de outros produtos
2. Pode criar contas/subscriptions indevidas para produtos que não são do eonSign
3. Conflito de dados e confusão no sistema

### Solução Proposta

Validar o `product_id` antes de processar qualquer evento. Somente processar se o produto for `prod_TTejAzPxAXvONB` (eonSign).

### Desafio Técnico

O evento `checkout.session.completed` **NÃO inclui** o `product_id` diretamente no payload. É necessário:

1. Para **checkout sessions**: Fazer uma chamada adicional para recuperar a session com `expand: ['line_items']` e verificar o `product` de cada item
2. Para **subscriptions**: O `subscription.items.data[].price.product` contém o `product_id`

### Fluxo de Validação

```text
┌─────────────────────────────────────────────────┐
│              Webhook Recebe Evento              │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│      Extrair Product ID do evento               │
│  - checkout.session → expand line_items         │
│  - subscription → items.data[].price.product    │
└─────────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ Product ID = eonSign? │
         │  prod_TTejAzPxAXvONB  │
         └────────────────────────┘
               │            │
          SIM  │            │ NÃO
               ▼            ▼
    ┌─────────────┐   ┌─────────────────────┐
    │ Processar   │   │ Ignorar evento      │
    │ evento      │   │ (log + return 200)  │
    └─────────────┘   └─────────────────────┘
```

### Alterações Necessárias

#### 1. Adicionar constante do Product ID no webhook

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

```typescript
// Product ID do eonSign - apenas processar eventos deste produto
const EONSIGN_PRODUCT_ID = "prod_TTejAzPxAXvONB";
```

#### 2. Criar função helper para extrair product_id

```typescript
// Helper para extrair product_id de uma checkout session
const getProductIdFromSession = async (
  stripe: Stripe, 
  sessionId: string
): Promise<string | null> => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product']
    });
    
    const firstItem = session.line_items?.data?.[0];
    if (!firstItem?.price?.product) return null;
    
    // product pode ser string (ID) ou objeto expandido
    const product = firstItem.price.product;
    return typeof product === 'string' ? product : product.id;
  } catch (error) {
    logStep("Error getting product from session", { error: String(error) });
    return null;
  }
};

// Helper para extrair product_id de uma subscription
const getProductIdFromSubscription = (
  subscription: Stripe.Subscription
): string | null => {
  const firstItem = subscription.items.data?.[0];
  if (!firstItem?.price?.product) return null;
  
  const product = firstItem.price.product;
  return typeof product === 'string' ? product : (product as any).id;
};
```

#### 3. Adicionar validação em cada case do switch

**checkout.session.completed:**
```typescript
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  
  // Validar se é produto eonSign
  const productId = await getProductIdFromSession(stripe, session.id);
  if (productId !== EONSIGN_PRODUCT_ID) {
    logStep("Ignoring checkout - not eonSign product", { productId, expected: EONSIGN_PRODUCT_ID });
    break; // Ignora silenciosamente
  }
  
  // ... resto do processamento
}
```

**customer.subscription.created:**
```typescript
case "customer.subscription.created": {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Validar se é produto eonSign
  const productId = getProductIdFromSubscription(subscription);
  if (productId !== EONSIGN_PRODUCT_ID) {
    logStep("Ignoring subscription created - not eonSign product", { productId, expected: EONSIGN_PRODUCT_ID });
    break;
  }
  
  // ... resto do processamento
}
```

**customer.subscription.updated e customer.subscription.deleted:**
- Para estes eventos, podemos verificar via `stripe_price_id` já existente no banco, ou fazer lookup do subscription para obter o product

### Atualização da constante no frontend

**Arquivo:** `src/constants/stripe.ts`

O arquivo já tem o `EONSIGN_PRODUCT_ID` definido, mas também deve incluir o `PRICE_ID_FREE` na lista de validação:

```typescript
export const ALL_EONSIGN_PRICE_IDS = [
  PRICE_ID_FREE, // Adicionar o plano gratuito
  ...Object.values(PRICE_IDS_MENSAL),
  ...Object.values(PRICE_IDS_ANUAL),
];
```

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/stripe-webhook/index.ts` | Adicionar `EONSIGN_PRODUCT_ID`, funções helper, e validação em cada evento |
| `src/constants/stripe.ts` | Incluir `PRICE_ID_FREE` em `ALL_EONSIGN_PRICE_IDS` |

### Benefícios

1. **Segurança**: Webhook só processa eventos do produto correto
2. **Isolamento**: Outros produtos na mesma conta Stripe não interferem
3. **Logs claros**: Eventos ignorados são logados para auditoria
4. **Compatibilidade**: Retorna 200 OK mesmo para eventos ignorados (boa prática Stripe)

### Considerações

- A chamada adicional `stripe.checkout.sessions.retrieve` com expand adiciona uma pequena latência (~100ms), mas é necessária pois o evento não traz o product_id
- Para subscriptions, o product_id já vem no payload, então não há chamada extra

