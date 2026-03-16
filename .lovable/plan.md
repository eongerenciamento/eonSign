

## Padronizar altura dos títulos em todas as páginas

### Problema
Na página **Documentos**, o título fica mais baixo porque o lado direito do header tem dois botões empilhados verticalmente (`flex-col`: UploadDialog + botão de filtro), o que aumenta a altura da linha e desloca o centro vertical do título. Nas páginas Drive e Relatórios, há apenas um botão, então o título fica mais alto.

Na página **Configurações**, o container tem `pb-20` extra e o título não está dentro de um `<div>` wrapper como nas outras páginas (diferença menor).

### Mudanças

**1. `src/pages/Documents.tsx` (linhas 280-295)**
- Remover o wrapper `flex-col` que empilha UploadDialog + filtro
- Colocar o UploadDialog e o botão de filtro lado a lado (`flex items-center gap-2`) para que a altura do header fique igual às outras páginas
- Remover o `-mb-4` do botão de filtro (não será mais necessário)

```tsx
// De:
<div className="flex flex-col items-end gap-0">
  <UploadDialog />
  <Button ... className="... -mb-4">
    <SlidersHorizontal />
  </Button>
</div>

// Para:
<div className="flex items-center gap-2">
  <Button variant="ghost" size="icon" onClick={...} className="w-10 h-10 rounded-full ...">
    <SlidersHorizontal />
  </Button>
  <UploadDialog />
</div>
```

**2. `src/pages/Settings.tsx` (linhas 416-418)**
- Nenhuma mudança estrutural necessária — o header já está correto. A diferença visual vem do `pb-20` que não afeta o título.

Resultado: todas as 4 páginas terão o título na mesma altura, com botões alinhados horizontalmente no header.

