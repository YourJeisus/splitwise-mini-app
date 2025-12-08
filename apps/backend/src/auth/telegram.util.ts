import crypto from 'crypto';

export type TelegramInitData = Record<string, string>;

export function parseInitData(initData: string): TelegramInitData {
  const params = new URLSearchParams(initData);
  const result: TelegramInitData = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function isValidTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return computed === hash;
}

export function extractTelegramUser(initData: string): { id: string; first_name?: string; last_name?: string; username?: string; photo_url?: string } | null {
  const parsed = parseInitData(initData);
  if (!parsed.user) return null;
  try {
    return JSON.parse(parsed.user);
  } catch (e) {
    return null;
  }
}

