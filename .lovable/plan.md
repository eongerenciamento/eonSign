
## Corrigir Webhook do Stripe para Suportar Checkout da Landing Page Externa

### Problema Identificado

O checkout da Landing Page externa (`eonhub.com.br`) foi realizado com sucesso, porém o sistema não criou a conta do usuário nem enviou o email de boas-vindas porque:

1. **A LP externa NÃO envia `email` nos metadados** da sessão de checkout
2. O email do cliente está em `session.customer_details.email` = `"content@eonhub.com.br"`
3. O código atual verifica `session.metadata?.email` que vem **vazio**
4. A condição `if (email && organizationName && !userId)` falha e pula a criação do usuário

### Dados do Evento Recebido

```text
Evento: evt_1SyXIUHRTD5Wvpxjaqq35DHg
Email do cliente: content@eonhub.com.br (em customer_details.email)
Organização: FHR Emrpeendimentos (em metadata.organization_name)
metadata.email: NÃO EXISTE
```

### Solução

Modificar o `stripe-webhook` para:

1. Usar `session.customer_details?.email` como fallback quando `session.metadata?.email` não existir
2. Usar `session.customer_details?.name` como fallback para o nome

### Alteração no Código

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

**Linhas 91-97 (antes):**
```typescript
const email = session.metadata?.email;
const organizationName = session.metadata?.organization_name;
```

**Linhas 91-97 (depois):**
```typescript
const email = session.metadata?.email || session.customer_details?.email;
const organizationName = session.metadata?.organization_name || session.customer_details?.name;
```

### Fluxo Corrigido

```text
LP Externa                       eonSign App
┌─────────────┐                  ┌──────────────┐
│ Checkout    │                  │ Checkout     │
│ Stripe      │                  │ Stripe       │
│             │                  │              │
│ metadata:   │                  │ metadata:    │
│  org_name ✓ │                  │  email ✓     │
│  cnpj ✓     │                  │  org_name ✓  │
│             │                  │  tier_name ✓ │
│ customer_   │                  │              │
│ details:    │                  │              │
│  email ✓    │                  │              │
└──────┬──────┘                  └──────┬───────┘
       │                                │
       └───────────┬────────────────────┘
                   ▼
         ┌─────────────────┐
         │ stripe-webhook  │
         │                 │
         │ email =         │
         │  metadata.email │
         │  OU             │
         │  customer_      │
         │  details.email  │
         │                 │
         │ → Cria usuário  │
         │ → Envia email   │
         └─────────────────┘
```

### Recuperar Conta Pendente

Após a correção, será necessário executar manualmente a sincronização para a conta que não foi criada. Podemos usar a edge function `sync-stripe-subscription` existente passando o `customer_id`:

```
customer_id: cus_TwPy4Pv5v0zG5J
email: content@eonhub.com.br
organization: FHR Emrpeendimentos
```

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/stripe-webhook/index.ts` | Adicionar fallback para email/nome do customer_details |

### Impacto

- Checkouts da LP externa passarão a criar contas corretamente
- Checkouts do app eonSign continuarão funcionando (já passam email nos metadados)
- Compatibilidade retroativa mantida
