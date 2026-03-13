

## Quebra de linha no nome do arquivo

### Problema
O nome do arquivo exibido após upload usa `truncate` (corta com reticências) ou não tem controle de overflow, fazendo o texto extrapolar a área visível no mobile e desktop.

### Solução
Trocar `truncate` por `break-all` para permitir quebra de linha no nome do arquivo, em dois locais:

#### 1. Single file view (linha 1531)
```
<p className="font-medium text-sm text-gray-600">{files[0].name}</p>
```
Adicionar `break-all` para quebrar nomes longos.

#### 2. Multiple files view (linha 1560)
```
<p className="font-medium text-sm md:text-base text-gray-600 truncate">{file.name}</p>
```
Trocar `truncate` por `break-all`.

### Arquivo alterado
- `src/pages/NewDocument.tsx` (2 linhas)

