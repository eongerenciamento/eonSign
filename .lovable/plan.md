

## Corrigir Safe Area para Ficar Azul no Mobile

### Problema

O container mobile principal tem fundo branco (`backgroundColor: '#ffffff'`). A seção azul usa `paddingTop` para respeitar a safe area, mas o padding não preenche a safe area com a cor azul - ele apenas cria espaço interno. Isso faz com que a área do status bar (horário, sinal, bateria) fique branca.

### Solucao

Mudar a abordagem: ao invés de usar padding na seção azul, vamos:
1. Mudar o fundo do container mobile para azul (cor do topo do gradiente)
2. Manter a seção azul preenchendo até a safe area

### Alteracoes

#### `src/pages/Auth.tsx` - Layout Mobile

**Mudar o container mobile (linha 105-107):**

De:
```typescript
<div className="md:hidden h-screen flex flex-col overflow-hidden" style={{
  backgroundColor: '#ffffff'
}}>
```

Para:
```typescript
<div className="md:hidden h-screen flex flex-col overflow-hidden" style={{
  backgroundColor: '#273D60'
}}>
```

Isso garante que a safe area (que fica fora do conteudo renderizado) terá a cor azul como fundo.

### Resultado Visual Esperado

```text
┌──────────────────────────┐
│    12:51     ⟨⟩ 81%      │ <- Safe area AZUL (mesmo tom do header)
│  sign.eonhub.com.br      │
│                          │
│         ēon              │
│         sign             │
│                          │
│        (azul)            │
├───────╮                  │
│       └──────────────────┤ <- Card branco sobrepoe
│         Login            │
│    ...                   │
└──────────────────────────┘
```

### Secao Tecnica

**Arquivo modificado:**
- `src/pages/Auth.tsx` - mudar backgroundColor do container mobile

**Mudanca:**
- Linha 106: `backgroundColor: '#ffffff'` → `backgroundColor: '#273D60'`

A cor `#273D60` é a mesma cor do topo do gradiente da seção azul, garantindo uma transição visual perfeita.

