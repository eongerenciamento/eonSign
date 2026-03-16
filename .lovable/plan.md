
Objetivo: deixar o cabeçalho de Configurações exatamente na mesma referência vertical da página Documentos, tanto no título quanto no menu de guias.

Problema identificado:
- Em `src/pages/Settings.tsx`, o menu de guias já usa o padrão correto (`TabsList` com `grid w-full ... p-1 h-10`).
- A diferença visual está no bloco acima dele:
  1. o container raiz de Configurações não está igual ao de Documentos;
  2. o header de Configurações fica com altura menor, porque o lado direito usa apenas o switch de tema, enquanto em Documentos o lado direito tem controles com altura `h-10`.
- Resultado: o título e o menu em Configurações sobem ou descem alguns pixels em relação a Documentos.

Implementação:
1. Ajustar `src/pages/Settings.tsx` para copiar a estrutura-base do topo da página Documentos:
   - usar o mesmo container principal do topo (`p-8 space-y-6`);
   - manter header e `Tabs` no mesmo fluxo, sem wrappers extras interferindo no alinhamento.

2. Padronizar a altura do header de Configurações:
   - aplicar altura mínima/fixa equivalente à dos headers com botão (`min-h-10` ou `h-10`);
   - centralizar verticalmente o título dentro dessa mesma altura;
   - centralizar verticalmente o bloco do switch de tema dentro dessa mesma altura.

3. Manter o menu de guias como está:
   - o `TabsList` de Configurações já está no padrão correto;
   - não mexer no tamanho da fonte nem no estilo das tabs, apenas garantir que ele comece na mesma altura da página Documentos.

4. Se ainda for necessário espaço extra no final da tela:
   - mover `pb-20` para o conteúdo interno das tabs, não para o container que define o topo da página.
   - isso evita deslocar visualmente a área de cabeçalho.

Resultado esperado:
- “Configurações” ficará na mesma linha visual de “Documentos”.
- O menu de guias de Configurações começará na mesma altura do menu de Documentos.
- O espaçamento vertical entre título e tabs ficará idêntico entre as páginas.

Detalhe técnico:
- Arquivo: `src/pages/Settings.tsx`
- Ajustes principais:
  - container do topo igual ao de `src/pages/Documents.tsx`;
  - header com altura padronizada (`h-10`/`min-h-10`);
  - bloco do switch com alinhamento vertical explícito;
  - `TabsList` mantido no padrão já documentado.
