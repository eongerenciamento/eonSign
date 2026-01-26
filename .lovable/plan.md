
## Integrar Stripe Checkout no Fluxo de Cadastro

### Situação Atual
- O formulário de cadastro (`RegisterForm`) coleta email e nome da organização
- Ao submeter, chama diretamente a edge function `create-free-account` que cria a conta imediatamente
- O plano Free (`price_1SnWX9HRTD5WvpxjEZHPikV1`) é um plano de R$ 0,00/mês no Stripe

### Novo Fluxo Proposto

```text
┌─────────────────────────────────────────────┐
│         Formulário de Cadastro              │
│  ┌─────────────────────────────────────┐    │
│  │  E-mail: [________________]         │    │
│  │  Nome: [____________________]       │    │
│  │  Organização: [_____________]       │    │
│  │                                     │    │
│  │  [    Criar Conta    ]              │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
              │
              │ Submete formulário
              ▼
┌─────────────────────────────────────────────┐
│  Chama create-stripe-checkout com:          │
│  - priceId: price_1SnWX9HRTD5WvpxjEZHPikV1 │
│  - email, organizationName                  │
│  - tierName: "Gratuito"                     │
│  - documentLimit: 5                         │
└─────────────────────────────────────────────┘
              │
              │ Redireciona para Stripe
              ▼
┌─────────────────────────────────────────────┐
│         Stripe Checkout (R$ 0,00)           │
│  - Coleta dados de cartão (para futuro)     │
│  - Confirma assinatura gratuita             │
└─────────────────────────────────────────────┘
              │
              │ Webhook processa
              ▼
┌─────────────────────────────────────────────┐
│  stripe-webhook cria:                       │
│  - Usuário no Supabase Auth                 │
│  - company_settings                         │
│  - user_subscriptions                       │
│  - Envia email de boas-vindas               │
└─────────────────────────────────────────────┘
```

### Alterações Necessárias

#### 1. Adicionar campo "Nome" ao formulário de cadastro

**Arquivo:** `src/components/auth/RegisterForm.tsx`

Adicionar campo para nome do usuário além do email e organização:

```typescript
const registerSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255, "E-mail muito longo"),
  name: z.string().trim().min(2, "Nome é obrigatório").max(100, "Nome muito longo"),
  organizationName: z.string().trim().min(2, "Nome da organização é obrigatório").max(100, "Nome muito longo")
});
```

#### 2. Modificar o handler de submit

Substituir a chamada para `create-free-account` por `create-stripe-checkout`:

```typescript
const PRICE_ID_FREE = "price_1SnWX9HRTD5WvpxjEZHPikV1";

const handleSubmit = async (values: RegisterFormValues) => {
  setIsCreating(true);
  try {
    const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
      body: {
        priceId: PRICE_ID_FREE,
        email: values.email,
        organizationName: values.organizationName,
        tierName: "Gratuito",
        documentLimit: 5,
      }
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Erro ao criar checkout");
    }

    // Redireciona para o Stripe Checkout
    if (data?.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Erro ao criar conta",
      description: error.message
    });
  } finally {
    setIsCreating(false);
  }
};
```

#### 3. Atualizar o mapeamento no stripe-webhook

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

Adicionar o price_id do plano Free ao mapeamento `PRICE_ID_TO_PLAN`:

```typescript
const PRICE_ID_TO_PLAN: Record<string, { limit: number; name: string }> = {
  // Free/Gratuito
  "price_1SnWX9HRTD5WvpxjEZHPikV1": { limit: 5, name: "Gratuito" },
  // Mensais
  "price_1SnWXYHRTD5WvpxjKl4TP1T8": { limit: 25, name: "Start" },
  // ... resto dos planos
};
```

#### 4. Atualizar constantes de Stripe

**Arquivo:** `src/constants/stripe.ts`

Adicionar o price_id do plano gratuito:

```typescript
export const PRICE_ID_FREE = "price_1SnWX9HRTD5WvpxjEZHPikV1";

export const PRICE_ID_TO_LIMIT: Record<string, number> = {
  [PRICE_ID_FREE]: 5,
  // ... resto
};

export const PRICE_ID_TO_NAME: Record<string, string> = {
  [PRICE_ID_FREE]: "Gratuito",
  // ... resto
};
```

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/auth/RegisterForm.tsx` | Adicionar campo "Nome", trocar para `create-stripe-checkout` |
| `src/constants/stripe.ts` | Adicionar price_id do plano Free |
| `supabase/functions/stripe-webhook/index.ts` | Adicionar mapeamento do plano Free |

### Benefícios desta Abordagem

1. **Centralização**: Toda criação de conta passa pelo Stripe
2. **Consistência**: Mesmo fluxo para planos pagos e gratuitos
3. **Rastreabilidade**: Todas as contas têm um customer_id no Stripe desde o início
4. **Facilidade de upgrade**: Usuários já têm dados de pagamento cadastrados (opcional no plano gratuito)
