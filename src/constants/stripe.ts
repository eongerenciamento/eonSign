// IDs de Produtos eonSign
export const EONSIGN_PRODUCT_ID = "prod_TTejAzPxAXvONB";

// Price IDs Mensais
export const PRICE_IDS_MENSAL = {
  START: "price_1SnWXYHRTD5WvpxjKl4TP1T8",
  PRO: "price_1SnWXtHRTD5Wvpxjtgr5tWKJ",
  EMPRESARIAL_I: "price_1SnWY9HRTD5Wvpxjyw5KH0cX",
  EMPRESARIAL_II: "price_1SnWYPHRTD5WvpxjyWw62Qe0",
  ULTRA: "price_1SnWYfHRTD5Wvpxjo3b98A4o",
};

// Price IDs Anuais
export const PRICE_IDS_ANUAL = {
  START: "price_1SnWZ7HRTD5WvpxjuboSevS5",
  PRO: "price_1SnWZOHRTD5Wvpxj8wRU9vHE",
  EMPRESARIAL_I: "price_1SnWZiHRTD5WvpxjVWZnxv0e",
  EMPRESARIAL_II: "price_1SnWa4HRTD5WvpxjLSyivW7p",
  ULTRA: "price_1SnWaTHRTD5WvpxjoAUEkP0P",
};

// Lista de todos os Price IDs válidos do eonSign (para validação)
export const ALL_EONSIGN_PRICE_IDS = [
  ...Object.values(PRICE_IDS_MENSAL),
  ...Object.values(PRICE_IDS_ANUAL),
];

// Mapeamento de limites por Price ID
export const PRICE_ID_TO_LIMIT: Record<string, number> = {
  // Mensais
  [PRICE_IDS_MENSAL.START]: 25,
  [PRICE_IDS_MENSAL.PRO]: 50,
  [PRICE_IDS_MENSAL.EMPRESARIAL_I]: 100,
  [PRICE_IDS_MENSAL.EMPRESARIAL_II]: 200,
  [PRICE_IDS_MENSAL.ULTRA]: -1, // -1 = ilimitado
  // Anuais
  [PRICE_IDS_ANUAL.START]: 25,
  [PRICE_IDS_ANUAL.PRO]: 50,
  [PRICE_IDS_ANUAL.EMPRESARIAL_I]: 100,
  [PRICE_IDS_ANUAL.EMPRESARIAL_II]: 200,
  [PRICE_IDS_ANUAL.ULTRA]: -1, // -1 = ilimitado
};

// Mapeamento de nomes por Price ID
export const PRICE_ID_TO_NAME: Record<string, string> = {
  // Mensais
  [PRICE_IDS_MENSAL.START]: "Start",
  [PRICE_IDS_MENSAL.PRO]: "Pro",
  [PRICE_IDS_MENSAL.EMPRESARIAL_I]: "Empresarial I",
  [PRICE_IDS_MENSAL.EMPRESARIAL_II]: "Empresarial II",
  [PRICE_IDS_MENSAL.ULTRA]: "Ultra",
  // Anuais
  [PRICE_IDS_ANUAL.START]: "Start",
  [PRICE_IDS_ANUAL.PRO]: "Pro",
  [PRICE_IDS_ANUAL.EMPRESARIAL_I]: "Empresarial I",
  [PRICE_IDS_ANUAL.EMPRESARIAL_II]: "Empresarial II",
  [PRICE_IDS_ANUAL.ULTRA]: "Ultra",
};
