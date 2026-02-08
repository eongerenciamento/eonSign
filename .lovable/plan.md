

## Reorganizar Pagina de Login

### Alteracoes Solicitadas

1. **Titulo "Login"**: Diminuir tamanho e mudar cor para gray-600
2. **Labels dos inputs**: Remover "E-mail" e "Senha", adicionar icones dentro dos inputs
3. **Botoes uniformes**: Entrar, Google e Certificado Digital com mesmo tamanho e icones a esquerda
4. **Rodape**: "Powered by eonhub" a esquerda na mesma linha que Privacidade e Termos

### Arquivos a Modificar

#### 1. `src/pages/Auth.tsx`

Alterar o titulo para texto menor e cor gray-600:

```typescript
// Mobile - linha 121-124:
<h1 style={{ color: '#4b5563' }} className="text-lg font-semibold">
  {title}
</h1>

// Desktop - linha 171-174:
<h1 style={{ color: '#4b5563' }} className="text-lg font-semibold">
  {title}
</h1>
```

Remover o botao "Certificado Digital" separado do mobile (linhas 135-142), pois sera movido para dentro do LoginForm.

#### 2. `src/components/auth/LoginForm.tsx`

**Imports**: Adicionar icones `Mail`, `Lock`, `LogIn`, `Award`

**Inputs com icones**:
- Remover `<FormLabel>` do email e senha
- Adicionar icone dentro do input com padding-left

```typescript
// Email input:
<div className="relative">
  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
  <Input 
    {...field} 
    type="email" 
    placeholder="E-mail"
    disabled={isSubmitting} 
    className={`${inputClassName} pl-10`} 
  />
</div>

// Password input:
<div className="relative">
  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
  <Input 
    {...field} 
    type={showPassword ? "text" : "password"} 
    placeholder="Senha"
    disabled={isSubmitting} 
    className={`${inputClassName} pl-10 pr-10`} 
  />
  // botao eye/eyeoff permanece
</div>
```

**Botoes com icones uniformes**:

```typescript
// Botao Entrar com icone:
<Button type="submit" disabled={isSubmitting} className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white rounded-full border-0">
  <LogIn className="mr-2 h-4 w-4" />
  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Entrar
</Button>

// Botao Google (ja tem icone SVG):
// Manter como esta

// Novo botao Certificado Digital abaixo do Google:
<a
  href="https://certifica.eonhub.com.br"
  target="_blank"
  rel="noopener noreferrer"
  className="w-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full h-10 text-sm font-medium"
>
  <Award className="mr-2 h-4 w-4" />
  Certificado Digital R$109.90
</a>
```

**Rodape reorganizado**:

Criar nova estrutura com duas linhas:
- Linha 1: Links de acao (Esqueci senha, Criar conta, Instale App)
- Linha 2: "Powered by eonhub" a esquerda e "Privacidade · Termos" a direita

```typescript
<div className="pt-4 space-y-3">
  {/* Links de acao */}
  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
    <button onClick={handleForgotPassword}>Esqueci a senha</button>
    <span>·</span>
    <button onClick={onRegisterClick}>Criar conta</button>
    <span>·</span>
    <button onClick={onInstallClick}>Instale o App</button>
  </div>
  
  {/* Powered by + links legais */}
  <div className="flex items-center justify-between text-xs text-gray-400">
    <span>
      Powered by <a href="https://eonhub.com.br" className="font-bold text-gray-600">eonhub</a>
    </span>
    <div className="flex gap-2">
      <a href="/privacidade">Privacidade</a>
      <span>·</span>
      <a href="/termos">Termos</a>
    </div>
  </div>
</div>
```

### Resultado Visual Esperado

```text
          login            <- menor, gray-600

  [  @  E-mail             ]  <- icone dentro
  [  🔒  Senha          👁 ]  <- icone dentro

  [  →  Entrar             ]  <- icone a esquerda
  [  G  Continuar com Google]
  [  🏆  Certificado Digital]  <- novo, mesmo tamanho

  Esqueci a senha · Criar conta · Instale o App

  Powered by eonhub        Privacidade · Termos
```

### Secao Tecnica

**Icones Lucide utilizados:**
- `Mail` - icone de carta para email
- `Lock` - icone de cadeado para senha
- `LogIn` - icone de seta para botao entrar
- `Award` - icone de certificado/medalha

**Classes CSS importantes:**
- `pl-10` - padding left para inputs com icone
- `text-xs` - texto menor para rodape
- `justify-between` - powered by a esquerda, links a direita

