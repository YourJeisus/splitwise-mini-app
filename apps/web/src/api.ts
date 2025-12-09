type RequestOptions = {
  method?: string;
  body?: unknown;
};

export type User = {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export type Friend = {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  inviteCode?: string;
  role: string;
};

export type GroupBalance = {
  group: { id: string; name: string; currency: string; inviteCode?: string };
  balances: Record<string, number>;
  userNames: Record<string, string>;
  expensesCount: number;
};

export const createApiClient = (initData: string) => {
  const baseUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json() as Promise<T>;
  };

  return {
    hasAuth: () => Boolean(initData),
    verify: () => request<User>('/auth/verify', { method: 'POST', body: { initData } }),
    listFriends: () => request<Friend[]>('/users/friends'),
    addFriend: (telegramId: string) => request<Friend>('/users/friends', { method: 'POST', body: { telegramId } }),
    listGroups: () => request<Group[]>('/groups'),
    createGroup: (payload: { name: string; currency?: string }) =>
      request<Group>('/groups', { method: 'POST', body: payload }),
    joinGroup: (inviteCode: string) =>
      request<Group>(`/groups/join/${inviteCode}`, { method: 'POST' }),
    getGroupBalance: (groupId: string) => request<GroupBalance>(`/groups/${groupId}/balance`),
    createExpense: (payload: { groupId: string; description: string; amount: number; currency: string; shares: { userId: string; paid: number; owed: number }[] }) =>
      request<{ id: string }>('/expenses', { method: 'POST', body: payload }),
    createSettlement: (payload: { toUserId: string; amount: number; currency?: string; note?: string }) =>
      request<{ id: string }>('/settlements', { method: 'POST', body: payload })
  };
};

