

## Cards com Fundo Branco

### Problema
Todos os `Card` components usam `bg-secondary` (cinza) em vez de `bg-card` (branco), fazendo com que nao haja contraste com o fundo cinza da pagina.

### Solucao
Substituir `bg-secondary` por `bg-card` em todos os Cards, em 6 arquivos:

#### 1. `src/pages/Dashboard.tsx` (2 cards)
- Linhas 166, 178: `bg-secondary` → `bg-card`

#### 2. `src/pages/Reports.tsx` (8 cards)
- Linhas 625, 637, 649, 661, 676, 708, 736, 857: `bg-secondary` → `bg-card`

#### 3. `src/pages/Settings.tsx` (1 card)
- Linha 457: `bg-secondary dark:bg-card` → `bg-card`

#### 4. `src/components/settings/ContactsTab.tsx` (1 card)
- Linha 126: `bg-secondary` → `bg-card`

#### 5. `src/components/settings/MembersTab.tsx` (1 card)
- Linha 163: `bg-secondary` → `bg-card`

#### 6. `src/components/settings/SubscriptionTab.tsx` (4 cards)
- Linhas 425, 439, 450, 464: `bg-secondary` → `bg-card`

### Resultado
Cards brancos sobre fundo cinza, criando o contraste visual do eonGerenciamento.

