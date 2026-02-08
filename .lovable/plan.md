
## Objetivo (mobile)
1) O botão **“Certificado Digital”** deve ficar **embaixo do botão Google** (não mais no header azul).
2) Ele deve ter **as mesmas características visuais de botão** (mesmo estilo do botão Google).
3) O **fundo da safe area** (status bar/notch) deve ficar **azul** (não branco).

---

## Diagnóstico rápido do que está acontecendo hoje
- O “Certificado Digital” está atualmente sendo renderizado **no header azul** do mobile em `src/pages/Auth.tsx` (linhas ~113–123). Por isso ele não está relacionado ao layout do formulário.
- O “Google” é um `<Button>` dentro de `src/components/auth/LoginForm.tsx`.
- A safe area continuar branca, mesmo com o container mobile (`md:hidden ...`) com `backgroundColor: '#273D60'`, normalmente acontece porque **a área “atrás” da safe area está herdando o background do `body/html`**, não do container interno.

---

## Implementação proposta (passo a passo)

### 1) Mover “Certificado Digital” para baixo do Google (mobile)
**Arquivos:**  
- `src/pages/Auth.tsx`  
- `src/components/auth/LoginForm.tsx`

**Mudanças:**
1. **Remover** o `<a href="https://certifica.eonhub.com.br"...>` do header mobile em `src/pages/Auth.tsx` (o link que está logo abaixo do logo).
2. **Adicionar** um novo botão “Certificado Digital” **dentro do `LoginForm`**, imediatamente **abaixo** do botão “Continuar com Google”.
3. Esse botão deve aparecer **somente no mobile**, então usar `className="md:hidden ..."`.

**Como garantir “mesmas características” do botão Google:**
- Usar o mesmo componente `<Button>` com as mesmas classes do Google:
  - `w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-0`
- Para ser link (abrir `certifica.eonhub.com.br`), usar `Button` com `asChild` e renderizar um `<a>` por dentro:
  - `target="_blank" rel="noopener noreferrer"`

Resultado esperado: na tela de login mobile, a ordem fica:
1) Entrar  
2) Continuar com Google  
3) Certificado Digital (mesmo visual do Google)

Observação: isso afeta **apenas o modo login**, porque o Google button só existe no `LoginForm`. No modo “Criar conta”, não aparece.

---

### 2) Corrigir safe area ainda branca no iOS/mobile
**Arquivos:**  
- `src/pages/Auth.tsx` (mesmo arquivo)

**Mudanças:**
1. Manter o `backgroundColor: '#273D60'` do container mobile (já está).
2. Adicionar um ajuste explícito para o background do `html`/`body` enquanto a rota `/auth` estiver montada:
   - No `useEffect` do `Auth`, salvar os backgrounds atuais (`document.documentElement.style.backgroundColor` e `document.body.style.backgroundColor`)
   - Setar ambos para `#273D60` ao montar
   - No cleanup (return do useEffect), restaurar os valores anteriores

Isso costuma ser o que resolve quando a safe area/status bar “mostra” o background global, e não o do container interno.

---

## Checklist de validação (após implementar)
1. Abrir `/auth` no iPhone/Safari (ou simulação iOS):
   - Safe area (topo/status bar) deve estar azul.
2. Verificar login no mobile:
   - “Certificado Digital” aparece logo abaixo do Google, com o mesmo estilo.
   - Tocar no botão abre `certifica.eonhub.com.br` em nova aba.
3. Verificar desktop:
   - Desktop continua com “Certificado Digital” no PoweredBy da sidebar (não muda).
4. Verificar register/success:
   - Não aparece botão extra indevido no fluxo de cadastro.

---

## Arquivos que serão alterados
- `src/pages/Auth.tsx`
  - Remover link “Certificado Digital” do header mobile
  - Setar background do `html/body` enquanto estiver em `/auth`
- `src/components/auth/LoginForm.tsx`
  - Adicionar botão “Certificado Digital” (mobile-only) abaixo do Google, como `<Button asChild><a /></Button>`
