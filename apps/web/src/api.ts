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
  imageUrl?: string;
  currency: string;
  settlementCurrency?: string;
  homeCurrency?: string;
  inviteCode?: string;
  createdById?: string;
  role: string;
  userBalance?: number;
  closedAt?: string | null;
  lastActivityAt?: string | null;
  hasTripPass?: boolean;
};

export type GroupBalance = {
  group: {
    id: string;
    name: string;
    imageUrl?: string;
    currency: string;
    settlementCurrency?: string;
    homeCurrency?: string;
    inviteCode?: string;
    closedAt?: string | null;
    lastActivityAt?: string | null;
    homeFxRate?: number;
    homeFxDate?: string;
    homeFxSource?: string;
  };
  balances: Record<string, number>;
  userNames: Record<string, string>;
  userAvatars?: Record<string, string | null>;
  inactiveMembers?: Record<string, boolean>;
  debts: { fromUserId: string; toUserId: string; amount: number }[];
  expensesCount: number;
};

export type Expense = {
  id: string;
  type: "expense";
  description: string;
  amount: number;
  currency: string;
  isSystem?: boolean;
  systemType?: string | null;
  purchaseId?: string | null;
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

export type TripSummary = {
  header: {
    yourTripTotal: number;
    tripCurrency: string;
    homeCurrency?: string;
    homeApprox?: number;
    homeFxRate?: number;
  };
  spendingStats: {
    groupTotalSpent: number;
    avgPerPerson: number;
    avgPerDay: number;
    mostExpensiveDay: { date: string; amount: number } | null;
    expensesCount: number;
  };
  roles: {
    topPayer: { userId: string; name: string; amount: number } | null;
    mostFrequentParticipant: {
      userId: string;
      name: string;
      count: number;
    } | null;
    topDebtor: { userId: string; name: string; amount: number } | null;
    topCreditor: { userId: string; name: string; amount: number } | null;
  };
  finalPlan: Array<{
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    amount: number;
  }>;
  charts: {
    dailySpending: Array<{ date: string; amount: number }>;
    spendingByMember: Array<{ userId: string; name: string; paid: number }>;
  };
  meta: {
    members: Array<{ id: string; name: string; avatarUrl: string | null }>;
    closedAt: string | null;
    canClose: boolean;
  };
};

export type ScanReceiptResult = {
  amount?: number;
  currency?: string;
  date?: string;
  items?: Array<{ name: string; qty?: number; totalPrice?: number }>;
  warnings?: string[];
};

export type ReceiptItemClaim = {
  id: string;
  userId: string;
  quantity: number;
  user: {
    id: string;
    firstName?: string;
    username?: string;
    avatarUrl?: string;
  };
};

export type ReceiptItem = {
  id: string;
  name: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number | null;
  sortOrder: number;
  claims: ReceiptItemClaim[];
  claimedQuantity: number;
  remainingQuantity: number;
  isFullyClaimed: boolean;
};

export type ReceiptMember = {
  id: string;
  firstName?: string;
  username?: string;
  avatarUrl?: string;
};

export type Receipt = {
  id: string;
  expenseId: string;
  totalAmount: number;
  currency: string;
  date: string | null;
  status: "PENDING" | "DISTRIBUTED" | "FINALIZED";
  createdAt: string;
  expense: {
    id: string;
    description: string;
    createdBy: ReceiptMember;
    group: {
      id: string;
      name: string;
      settlementCurrency: string;
    } | null;
  };
  items: ReceiptItem[];
  stats: {
    totalClaimed: number;
    totalRemaining: number;
    isFullyDistributed: boolean;
    owedByUser: Record<string, number>;
    paidByUser: Record<string, number>;
    claimedUserIds: string[];
    isPreliminary: boolean;
  };
  members: ReceiptMember[];
};

export type CreateReceiptPayload = {
  groupId: string;
  description: string;
  totalAmount: number;
  currency: string;
  date?: string;
  paidByUserId: string;
  items: Array<{
    name: string;
    quantity: number;
    totalPrice: number;
    unitPrice?: number;
  }>;
  myClaims?: Array<{
    itemIndex: number;
    quantity: number;
  }>;
};

export type ClaimReceiptItemsPayload = {
  receiptId: string;
  claims: Array<{
    itemId: string;
    quantity: number;
  }>;
  forUserId?: string; // Для распределения за другого пользователя (только создатель чека)
};

export const createApiClient = (initData: string) => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  const isDev = import.meta.env.DEV;

  // В dev всегда используем VITE_API_URL если задан
  // В prod (Telegram WebApp) используем origin
  const rawUrl = isDev && envUrl ? envUrl : envUrl || window.location.origin;
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
      let extracted: string | null = null;
      if (text) {
        try {
          const parsed = JSON.parse(text) as any;
          const msg = parsed?.message;
          if (msg) {
            extracted = Array.isArray(msg) ? msg.join(", ") : String(msg);
          }
        } catch {
          // ignore
        }
      }
      throw new Error(extracted || text || res.statusText);
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
    createGroup: async (payload: {
      name: string;
      settlementCurrency?: string;
      homeCurrency?: string;
      image?: File;
    }) => {
      if (payload.image) {
        const formData = new FormData();
        formData.append("name", payload.name);
        if (payload.settlementCurrency)
          formData.append("settlementCurrency", payload.settlementCurrency);
        if (payload.homeCurrency)
          formData.append("homeCurrency", payload.homeCurrency);
        formData.append("image", payload.image);
        const res = await fetch(`${baseUrl}/groups`, {
          method: "POST",
          headers: { "x-telegram-init-data": initData },
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<Group>;
      }
      return request<Group>("/groups", { method: "POST", body: payload });
    },
    getGroupByInvite: (inviteCode: string) =>
      request<{
        id: string;
        name: string;
        currency: string;
        settlementCurrency?: string;
        homeCurrency?: string;
        membersCount: number;
      }>(`/groups/invite/${inviteCode}`),
    joinGroup: (inviteCode: string) =>
      request<Group>(`/groups/join/${inviteCode}`, { method: "POST" }),
    getGroupBalance: (groupId: string) =>
      request<GroupBalance>(`/groups/${groupId}/balance`),
    updateGroup: async (
      groupId: string,
      payload: {
        name?: string;
        settlementCurrency?: string;
        homeCurrency?: string;
        fxMode?: string;
        fixedFxRates?: any;
        fixedFxDate?: string;
        fixedFxSource?: string;
        image?: File;
      }
    ) => {
      if (payload.image) {
        const formData = new FormData();
        if (payload.name) formData.append("name", payload.name);
        if (payload.settlementCurrency)
          formData.append("settlementCurrency", payload.settlementCurrency);
        if (payload.homeCurrency)
          formData.append("homeCurrency", payload.homeCurrency);
        formData.append("image", payload.image);
        const res = await fetch(`${baseUrl}/groups/${groupId}`, {
          method: "PATCH",
          headers: { "x-telegram-init-data": initData },
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<Group>;
      }
      return request<Group>(`/groups/${groupId}`, {
        method: "PATCH",
        body: payload,
      });
    },
    deleteGroup: (groupId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}`, { method: "DELETE" }),
    leaveGroup: (groupId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}/leave`, {
        method: "POST",
      }),
    closeGroup: (groupId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}/close`, {
        method: "POST",
      }),
    reopenGroup: (groupId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}/reopen`, {
        method: "POST",
      }),
    getGroupExpenses: (groupId: string) =>
      request<GroupTransaction[]>(`/expenses/group/${groupId}`),
    createExpense: (payload: {
      groupId: string;
      description: string;
      amount: number;
      currency: string;
      originalAmount?: number;
      originalCurrency?: string;
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

    createTripPassInvoice: (payload: { groupId: string; splitCost: boolean }) =>
      request<{ invoiceLink: string; purchaseId: string }>(
        "/monetization/trip-pass/invoice",
        { method: "POST", body: payload }
      ),
    enableTripPassSplit: (purchaseId: string) =>
      request<{ success: boolean }>("/monetization/trip-pass/enable-split", {
        method: "POST",
        body: { purchaseId },
      }),
    getTripPassStatus: (groupId: string) =>
      request<{ active: boolean; endsAt?: string }>(
        `/monetization/trip-pass/status?groupId=${encodeURIComponent(groupId)}`
      ),
    devConfirmTripPass: (purchaseId: string) =>
      request<{ active: boolean; endsAt?: string }>(
        "/monetization/trip-pass/dev/confirm",
        { method: "POST", body: { purchaseId } }
      ),
    devToggleTripPass: (groupId: string, active: boolean) =>
      request<{ active: boolean; endsAt?: string }>(
        "/monetization/trip-pass/dev/toggle",
        { method: "POST", body: { groupId, active } }
      ),
    getTripSummary: (groupId: string) =>
      request<TripSummary>(`/groups/${groupId}/trip-summary`),
    scanReceipt: async (groupId: string, image: File) => {
      const formData = new FormData();
      formData.append("groupId", groupId);
      formData.append("image", image);
      const res = await fetch(`${baseUrl}/expenses/receipt/scan`, {
        method: "POST",
        headers: { "x-telegram-init-data": initData },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        let extracted: string | null = null;
        if (text) {
          try {
            const parsed = JSON.parse(text) as any;
            const msg = parsed?.message;
            if (msg) {
              extracted = Array.isArray(msg) ? msg.join(", ") : String(msg);
            }
          } catch {
            // ignore
          }
        }
        throw new Error(extracted || text || res.statusText);
      }
      return res.json() as Promise<ScanReceiptResult>;
    },

    // ========== RECEIPT API ==========
    createReceipt: (payload: CreateReceiptPayload) =>
      request<Receipt>("/expenses/receipt", { method: "POST", body: payload }),

    getReceipt: (receiptId: string) =>
      request<Receipt>(`/expenses/receipt/${receiptId}`),

    getReceiptByExpense: (expenseId: string) =>
      request<Receipt | null>(`/expenses/receipt/by-expense/${expenseId}`),

    listGroupReceipts: (groupId: string) =>
      request<
        Array<{
          id: string;
          expenseId: string;
          totalAmount: number;
          currency: string;
          status: "PENDING" | "DISTRIBUTED" | "FINALIZED";
          createdAt: string;
          expense: {
            id: string;
            description: string;
            createdById: string;
            createdBy: ReceiptMember;
          };
          stats: {
            totalClaimed: number;
            totalRemaining: number;
            itemsCount: number;
          };
        }>
      >(`/expenses/receipts/group/${groupId}`),

    claimReceiptItems: (payload: ClaimReceiptItemsPayload) =>
      request<Receipt>("/expenses/receipt/claim", {
        method: "POST",
        body: payload,
      }),

    finalizeReceipt: (receiptId: string) =>
      request<Receipt>(`/expenses/receipt/${receiptId}/finalize`, {
        method: "POST",
      }),
  };
};
