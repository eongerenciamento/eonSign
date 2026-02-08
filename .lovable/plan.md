

## Criar Paginas de Politica de Privacidade e Termos de Uso

### Objetivo

Criar duas novas paginas seguindo o layout da imagem de referencia:
- `/privacidade` - Politica de Privacidade
- `/termos` - Termos e Condicoes de Uso

E adicionar links para elas na pagina de login.

### Layout das Paginas

Baseado na imagem de referencia:
- Header escuro (#273D60) com seta de voltar e logo eonhub
- Conteudo em card branco arredondado
- Texto bem formatado com titulos e listas

### Arquivos a Criar

#### 1. `src/pages/PrivacyPolicy.tsx`

Nova pagina com o conteudo da Politica de Privacidade:

- Header com navegacao de volta
- Secoes: Coleta de Dados, Uso das Informacoes, Compartilhamento, Direitos
- Data de atualizacao: 8 de fevereiro de 2026
- Empresa: eonhub Tecnologia LTDA

#### 2. `src/pages/TermsOfUse.tsx`

Nova pagina com os Termos de Uso:

- Header com navegacao de volta
- Secoes numeradas: Objeto, Validade Juridica, Responsabilidades, Limitacao, Foro
- Data de atualizacao: 8 de fevereiro de 2026

### Arquivos a Modificar

#### 3. `src/App.tsx`

Adicionar as novas rotas:

```typescript
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";

// Na lista de rotas:
<Route path="/privacidade" element={<PrivacyPolicy />} />
<Route path="/termos" element={<TermsOfUse />} />
```

#### 4. `src/components/auth/LoginForm.tsx`

Adicionar links no rodape do formulario, junto com os outros links existentes:

```typescript
// Adicionar apos o link "Instale o App":
<span className="text-gray-300">·</span>
<a
  href="/privacidade"
  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
>
  Privacidade
</a>
<span className="text-gray-300">·</span>
<a
  href="/termos"
  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
>
  Termos
</a>
```

### Estrutura Visual das Novas Paginas

```text
┌────────────────────────────────────────────┐
│  ←                    eonhub               │  <- Header escuro
├────────────────────────────────────────────┤
│                                            │
│   ┌────────────────────────────────────┐   │
│   │                                    │   │
│   │   Titulo Principal                 │   │
│   │                                    │   │
│   │   1. Secao                         │   │
│   │   Texto da secao...                │   │
│   │                                    │   │
│   │   2. Secao                         │   │
│   │   • Item 1                         │   │
│   │   • Item 2                         │   │
│   │                                    │   │
│   └────────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

### Conteudo das Paginas

**Politica de Privacidade:**
- Coleta de Dados (conta, assinatura, documentos)
- Uso das Informacoes
- Compartilhamento de Dados
- Seus Direitos

**Termos de Uso:**
1. Objeto do Servico
2. Validade Juridica
3. Responsabilidades do Usuario
4. Limitacao de Responsabilidade
5. Foro (Belem, Para)

### Resultado Final

- Duas paginas publicas acessiveis sem login
- Links visiveis na tela de login
- URLs amigaveis para configurar no Google Cloud Console

