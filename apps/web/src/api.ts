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
  avatarUrl?: string;
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
  createdById?: string;
  role: string;
  userBalance?: number;
};

export type GroupBalance = {
  group: { id: string; name: string; currency: string; inviteCode?: string };
  balances: Record<string, number>;
  userNames: Record<string, string>;
  userAvatars?: Record<string, string | null>;
  debts: { fromUserId: string; toUserId: string; amount: number }[];
  expensesCount: number;
};

export type Expense = {
  id: string;
  type: "expense";
  description: string;
  amount: number;
  currency: string;
  category?: string;
  createdAt: string;
  createdBy: {
    id: string;
    firstName?: string;
    username?: string;
  };
  shares: Array<{
    userId: string;
    paid: number;
    owed: number;
    user: {
      id: string;
      firstName?: string;
      username?: string;
    };
  }>;
};

export type Settlement = {
  id: string;
  type: "settlement";
  amount: number;
  currency: string;
  note?: string;
  createdAt: string;
  fromUser: {
    id: string;
    firstName?: string;
    username?: string;
  };
  toUser: {
    id: string;
    firstName?: string;
    username?: string;
  };
};

export type GroupTransaction = Expense | Settlement;

export const createApiClient = (initData: string) => {
  const rawUrl =
    (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const baseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;

  const request = async <T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json() as Promise<T>;
  };

  return {
    hasAuth: () => Boolean(initData),
    verify: () =>
      request<User>("/auth/verify", { method: "POST", body: { initData } }),
    listFriends: () => request<Friend[]>("/users/friends"),
    addFriend: (telegramId: string) =>
      request<Friend>("/users/friends", {
        method: "POST",
        body: { telegramId },
      }),
    listGroups: () => request<Group[]>("/groups"),
    createGroup: (payload: { name: string; currency?: string }) =>
      request<Group>("/groups", { method: "POST", body: payload }),
    getGroupByInvite: (inviteCode: string) =>
      request<{
        id: string;
        name: string;
        currency: string;
        membersCount: number;
      }>(`/groups/invite/${inviteCode}`),
    joinGroup: (inviteCode: string) =>
      request<Group>(`/groups/join/${inviteCode}`, { method: "POST" }),
    getGroupBalance: (groupId: string) =>
      request<GroupBalance>(`/groups/${groupId}/balance`),
    updateGroup: (
      groupId: string,
      payload: { name?: string; currency?: string }
    ) =>
      request<Group>(`/groups/${groupId}`, { method: "PATCH", body: payload }),
    deleteGroup: (groupId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}`, { method: "DELETE" }),
    getGroupExpenses: (groupId: string) =>
      request<GroupTransaction[]>(`/expenses/group/${groupId}`),
    createExpense: (payload: {
      groupId: string;
      description: string;
      amount: number;
      currency: string;
      shares: { userId: string; paid: number; owed: number }[];
    }) =>
      request<{ id: string }>("/expenses", { method: "POST", body: payload }),
    updateExpense: (
      expenseId: string,
      payload: {
        description?: string;
        amount?: number;
        shares?: { userId: string; paid: number; owed: number }[];
      }
    ) =>
      request<Expense>(`/expenses/${expenseId}`, {
        method: "PATCH",
        body: payload,
      }),
    deleteExpense: (expenseId: string) =>
      request<{ success: boolean }>(`/expenses/${expenseId}`, {
        method: "DELETE",
      }),
    createSettlement: (payload: {
      toUserId: string;
      groupId: string;
      amount: number;
      currency?: string;
      note?: string;
    }) =>
      request<{ id: string }>("/settlements", {
        method: "POST",
        body: payload,
      }),
  };
};
