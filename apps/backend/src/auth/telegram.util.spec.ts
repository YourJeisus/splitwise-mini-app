import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { isValidTelegramInitData, parseInitData } from './telegram.util';

const botToken = '123456:TEST';

const buildInitData = () => {
  const data = {
    auth_date: '1717171717',
    query_id: 'AAEAAAE',
    user: JSON.stringify({ id: 1, first_name: 'Alice', username: 'alice' })
  };

  const dataCheckString = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams({ ...data, hash });
  return params.toString();
};

describe('telegram.util', () => {
  it('validates initData signature', () => {
    const initData = buildInitData();
    expect(isValidTelegramInitData(initData, botToken)).toBe(true);
  });

  it('parses initData into object', () => {
    const initData = buildInitData();
    const parsed = parseInitData(initData);
    expect(parsed.user).toContain('Alice');
    expect(parsed.auth_date).toBeDefined();
  });
});

