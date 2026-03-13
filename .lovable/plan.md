

## Ajustes na tela de Login

### Alterações

**1. Remover título "Login"** — Em `src/pages/Auth.tsx`, não exibir o título quando `mode === 'login'` (tanto mobile quanto desktop).

**2. Remover borda dos inputs** — Em `src/components/auth/LoginForm.tsx`, adicionar `border-0` ao `inputClassName`.

**3. Remover link "Instale o App"** — Remover o botão "Instale o App" e o separador `·` antes dele. Remover a prop `onInstallClick` do componente.

**4. Adicionar "(5 assinaturas grátis)" ao lado de "Criar conta"** — No botão "Criar conta", alterar o texto para `Criar conta (5 assinaturas grátis)`.

### Arquivos alterados
- `src/pages/Auth.tsx` — Condição do título para não mostrar no login
- `src/components/auth/LoginForm.tsx` — Border dos inputs, remoção do link app, texto do criar conta

