export const CURRENCIES = [
  { code: "RUB", name: "Российский рубль", symbol: "₽" },
  { code: "USD", name: "Доллар США", symbol: "$" },
  { code: "EUR", name: "Евро", symbol: "€" },
  { code: "GBP", name: "Фунт стерлингов", symbol: "£" },
  { code: "UAH", name: "Украинская гривна", symbol: "₴" },
  { code: "KZT", name: "Казахстанский тенге", symbol: "₸" },
  { code: "BYN", name: "Белорусский рубль", symbol: "Br" },
  { code: "TRY", name: "Турецкая лира", symbol: "₺" },
  { code: "CNY", name: "Китайский юань", symbol: "¥" },
  { code: "JPY", name: "Японская иена", symbol: "¥" },
  { code: "GEL", name: "Грузинский лари", symbol: "₾" },
  { code: "AMD", name: "Армянский драм", symbol: "֏" },
  { code: "AZN", name: "Азербайджанский манат", symbol: "₼" },
  { code: "THB", name: "Тайский бат", symbol: "฿" },
  { code: "AED", name: "Дирхам ОАЭ", symbol: "د.إ" },
];

export const getCurrencySymbol = (code: string): string => {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
};

