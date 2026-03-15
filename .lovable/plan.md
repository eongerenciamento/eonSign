

## Corrigir botão de filtro na página Drive (visão raiz)

### Problema
O botão de filtro (ícone `SlidersHorizontal`) na visão raiz do Drive (sem pasta selecionada) alterna o estado `showFilters`, mas **não existe nenhum bloco de UI condicional** que renderize os filtros quando `showFilters` é `true`. O bloco de filtros só existe para `showFolderFilters` (dentro de uma pasta selecionada).

### Solução
Adicionar o bloco de filtros condicional `{showFilters && (...)}` entre a barra de botões (linha 484) e a lista de pastas (linha 485), replicando a mesma estrutura já usada em `showFolderFilters` (linhas 545-568): input de busca + select de ordenação.

### Alteração em `src/pages/Drive.tsx`
Inserir após a linha 484 (`</div>` que fecha a barra de botões) e antes da linha 485 (`{folders.length > 0 ...}`):

```tsx
{showFilters && (
  <div className="flex flex-col gap-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Buscar pastas..."
        className="pl-10 border-none bg-white dark:bg-white/10"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
    <div className="flex gap-4">
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="flex-1 border-none bg-white dark:bg-white/10">
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Mais Recentes</SelectItem>
          <SelectItem value="oldest">Mais Antigos</SelectItem>
          <SelectItem value="name">Nome A-Z</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
)}
```

Também será necessário verificar se `searchQuery` e `sortBy` já filtram a lista de pastas na visão raiz — se não, aplicar a filtragem no array `folders` renderizado.

### Arquivo alterado
- `src/pages/Drive.tsx` (inserção de ~20 linhas)

