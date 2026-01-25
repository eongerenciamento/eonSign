
## Implementar Formulário de Cadastro Local na Página de Login

### Situação Atual
- O link "Criar nova conta" redireciona para `https://eonhub.com.br/sign` (página externa)
- Já existe a edge function `create-free-account` que cria conta gratuita com:
  - Email e nome da organização como entrada
  - Cria usuário no auth
  - Cria `company_settings` com dados básicos
  - Cria `user_subscriptions` com plano Gratuito (5 documentos/mês)
  - Envia email de boas-vindas com senha temporária

### Solução

Modificar a página `Auth.tsx` para:

1. Adicionar estado para alternar entre Login e Cadastro
2. Criar formulário de cadastro com campos:
   - Email
   - Nome da organização
3. Ao submeter, chamar a edge function `create-free-account`
4. Exibir mensagem de sucesso informando que a senha foi enviada por email

### Fluxo do Usuário

```text
┌─────────────────────────────────────────────┐
│         Página de Login                     │
│  ┌─────────────────────────────────────┐    │
│  │  Email: [________________]          │    │
│  │  Senha: [________________]          │    │
│  │                                     │    │
│  │  [    Entrar    ]                   │    │
│  │                                     │    │
│  │  Esqueci a senha · Criar nova conta │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
              │
              │ Clica em "Criar nova conta"
              ▼
┌─────────────────────────────────────────────┐
│         Formulário de Cadastro              │
│  ┌─────────────────────────────────────┐    │
│  │  Email: [________________]          │    │
│  │  Nome da Organização: [__________]  │    │
│  │                                     │    │
│  │  [    Criar Conta    ]              │    │
│  │                                     │    │
│  │  Já tenho conta · Voltar ao login   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
              │
              │ Submete formulário
              ▼
┌─────────────────────────────────────────────┐
│  ✓ Conta criada com sucesso!                │
│                                             │
│  Enviamos sua senha temporária para o       │
│  email informado. Verifique sua caixa       │
│  de entrada.                                │
│                                             │
│  [    Fazer Login    ]                      │
└─────────────────────────────────────────────┘
```

### Detalhes Técnicos

**Arquivo:** `src/pages/Auth.tsx`

**Alterações:**

1. Adicionar estado para controlar o modo (login/cadastro):
```typescript
const [mode, setMode] = useState<'login' | 'register' | 'success'>('login');
const [isCreatingAccount, setIsCreatingAccount] = useState(false);
```

2. Criar schema de validação para cadastro:
```typescript
const registerSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  organizationName: z.string().min(2, "Nome da organização é obrigatório")
});
```

3. Criar formulário de registro usando react-hook-form

4. Handler para criar conta:
```typescript
const handleRegister = async (values) => {
  setIsCreatingAccount(true);
  try {
    const { data, error } = await supabase.functions.invoke("create-free-account", {
      body: {
        email: values.email,
        organizationName: values.organizationName
      }
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message);
    }
    setMode('success'); // Mostra tela de sucesso
  } catch (error) {
    toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
  } finally {
    setIsCreatingAccount(false);
  }
};
```

5. Alterar o link "Criar nova conta" de `<a href>` para `<button onClick={() => setMode('register')}>`:
```typescript
<button type="button" onClick={() => setMode('register')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
  Criar nova conta
</button>
```

6. Renderização condicional baseada no `mode`:
   - `login`: Formulário de login atual
   - `register`: Formulário de cadastro
   - `success`: Mensagem de sucesso com botão para voltar ao login

### Visual

- Manter o mesmo design (cores, fontes, layout) do formulário de login
- Apenas trocar os campos e textos conforme o modo
- Header muda de "Login" para "Criar Conta"
- Subtítulo muda de "Bem-vindo de volta!" para "Comece grátis!"
