type RequestOptions = {
  method?: string;
  body?: any;
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
    verify: () => request('/auth/verify', { method: 'POST', body: { initData } }),
    listFriends: () => request('/users/friends'),
    addFriend: (telegramId: string) => request('/users/friends', { method: 'POST', body: { telegramId } }),
    listGroups: () => request('/groups'),
    createGroup: (payload: { name: string; currency?: string; memberIds?: string[] }) =>
      request('/groups', { method: 'POST', body: payload }),
    getGroupBalance: (groupId: string) => request(`/groups/${groupId}/balance`),
    createExpense: (payload: any) => request('/expenses', { method: 'POST', body: payload }),
    createSettlement: (payload: { toUserId: string; amount: number; currency?: string; note?: string }) =>
      request('/settlements', { method: 'POST', body: payload })
  };
};

