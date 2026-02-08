

## Ajustar Estilo dos Botoes de Login e Remover Textos

### Alteracoes Solicitadas

1. Botao Google logo abaixo do botao "Entrar"
2. Ambos os botoes identicos em tamanho
3. Botoes totalmente redondos (rounded-full) e sem bordas
4. Manter cores do Google
5. Remover divisor "ou continue com"
6. Remover subtitulo "Bem-vindo de volta"

### Arquivos a Modificar

#### 1. `src/pages/Auth.tsx`

Remover o subtitulo "Bem-vindo de volta!" da funcao `getHeaderText()`:

```typescript
// Linha 80-84 - Alterar de:
default:
  return {
    title: "Login",
    subtitle: "Bem-vindo de volta!"
  };

// Para:
default:
  return {
    title: "Login",
    subtitle: ""
  };
```

#### 2. `src/components/auth/LoginForm.tsx`

Remover o divisor "ou continue com" e ajustar os estilos dos botoes:

- Remover o bloco do divisor (linhas 149-156)
- Botao "Entrar": adicionar `rounded-full` e remover bordas
- Botao Google: usar mesmo estilo do "Entrar" mas com cores diferentes (fundo cinza claro, texto escuro)

```typescript
// Botao Entrar - alterar className para:
className="w-full bg-[#273D60] hover:bg-[#1a2847] text-white rounded-full"

// Botao Google - alterar className para:
className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-0"
```

### Resultado Visual Esperado

```
+----------------------------------+
|             Login                |
|                                  |
|  [       E-mail input        ]   |
|  [       Senha input         ]   |
|                                  |
|  [         Entrar           ]    |  <- rounded-full, azul
|  [  G  Continuar com Google ]    |  <- rounded-full, cinza claro
|                                  |
|  Esqueci a senha · Criar conta   |
+----------------------------------+
```

