export const formatDate = (): string => {
  const now = new Date();
  return now.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

export const getUserInitials = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

export const isDevSession = (initData: string): boolean => {
  return initData.startsWith("dev_");
};

export const extractInviteCode = (link: string): string | null => {
  const match = link.match(/startapp=([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
};

