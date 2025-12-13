export const GROUP_COLORS = ["yellow", "blue", "pink", "green", "purple", "orange"];
export const GROUP_ICONS = ["👥", "🏠", "✈️", "🎉", "💼", "🍕", "🎮", "🛒"];

export const DEV_USERS = [
  { id: "dev_111", name: "Алекс", emoji: "👨‍💻" },
  { id: "dev_222", name: "Мария", emoji: "👩‍💼" },
  { id: "dev_333", name: "Иван", emoji: "👨‍🔧" },
];

export const getGroupColor = (index: number): string =>
  GROUP_COLORS[index % GROUP_COLORS.length];

export const getGroupIcon = (index: number): string =>
  GROUP_ICONS[index % GROUP_ICONS.length];

