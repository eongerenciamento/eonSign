

## Mover botão de filtro abaixo do botão "Novo Documento"

### Mudança

**Arquivo:** `src/pages/Documents.tsx` (linhas 280-295)

Separar o botão de filtro do header e colocá-lo em uma nova linha abaixo, justificado à direita. O botão "Novo Documento" permanece no header ao lado do título.

**De:**
```
<div flex items-center justify-between>
  <h1>Documentos</h1>
  <div flex items-center gap-2>
    [Botão Filtro] [Botão Novo Documento]
  </div>
</div>
```

**Para:**
```
<div flex items-center justify-between>
  <h1>Documentos</h1>
  <UploadDialog />
</div>
<div flex justify-end>
  [Botão Filtro]
</div>
```

O botão de filtro fica sozinho na linha abaixo, alinhado à direita.

