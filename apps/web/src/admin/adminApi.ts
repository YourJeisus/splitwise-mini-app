const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  const isDev = import.meta.env.DEV;
  const rawUrl = isDev && envUrl ? envUrl : envUrl || window.location.origin;
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("admin_token", token);
  } else {
    localStorage.removeItem("admin_token");
  }
};

export const getAccessToken = () => {
  if (!accessToken) {
    accessToken = localStorage.getItem("admin_token");
  }
  return accessToken;
};

const request = async <T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> => {
  const token = getAccessToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    setAccessToken(null);
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || text;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
};

export const adminApi = {
  // Auth
  login: (email: string, password: string) =>
    request<{
      accessToken: string;
      admin: { id: string; email: string; role: string };
    }>("/admin/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  getMe: () =>
    request<{ id: string; email: string; role: string }>("/admin/auth/me"),

  // Dashboard
  getKPI: (period: string) =>
    request<any>(`/admin/dashboard/kpi?period=${period}`),

  // Users
  listUsers: (params: {
    page?: number;
    search?: string;
    godMode?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    if (params.godMode !== undefined) qs.set("godMode", String(params.godMode));
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/users?${qs}`);
  },
  getUser: (id: string) => request<any>(`/admin/users/${id}`),
  toggleGodMode: (id: string, enabled: boolean, reason: string) =>
    request<any>(`/admin/users/${id}/god-mode`, {
      method: "PATCH",
      body: { enabled, reason },
    }),
  grantEntitlement: (
    userId: string,
    data: {
      groupId: string;
      productCode: string;
      durationDays: number;
      reason: string;
    }
  ) =>
    request<any>(`/admin/users/${userId}/entitlements`, {
      method: "POST",
      body: data,
    }),
  revokeEntitlement: (entitlementId: string, reason: string) =>
    request<any>(`/admin/users/entitlements/${entitlementId}/revoke`, {
      method: "PATCH",
      body: { reason },
    }),
  extendEntitlement: (
    entitlementId: string,
    extraDays: number,
    reason: string
  ) =>
    request<any>(`/admin/users/entitlements/${entitlementId}/extend`, {
      method: "PATCH",
      body: { extraDays, reason },
    }),

  // Sales
  listPurchases: (params: {
    page?: number;
    status?: string;
    from?: string;
    to?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.status) qs.set("status", params.status);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/sales?${qs}`);
  },
  getPurchase: (id: string) => request<any>(`/admin/sales/${id}`),
  markReviewed: (id: string, note: string) =>
    request<any>(`/admin/sales/${id}/reviewed`, {
      method: "PATCH",
      body: { note },
    }),

  // Groups
  listGroups: (params: {
    page?: number;
    search?: string;
    closed?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    if (params.closed !== undefined) qs.set("closed", String(params.closed));
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/groups?${qs}`);
  },
  getGroup: (id: string) => request<any>(`/admin/groups/${id}`),
  grantTripPass: (groupId: string, durationDays?: number) =>
    request<{ success: boolean; endsAt: string; extended: boolean }>(
      `/admin/groups/${groupId}/grant-trip-pass`,
      { method: "POST", body: { durationDays } }
    ),
  reopenGroup: (groupId: string) =>
    request<{ success: boolean }>(`/admin/groups/${groupId}/reopen`, {
      method: "POST",
    }),

  // Products
  listProducts: () => request<any[]>("/admin/products"),
  getProduct: (code: string) => request<any>(`/admin/products/${code}`),
  updateProduct: (code: string, data: any) =>
    request<any>(`/admin/products/${code}`, { method: "PATCH", body: data }),
  updatePricing: (code: string, data: any) =>
    request<any>(`/admin/products/${code}/pricing`, {
      method: "PATCH",
      body: data,
    }),
  createPromoCode: (productCode: string, data: any) =>
    request<any>(`/admin/products/${productCode}/promo-codes`, {
      method: "POST",
      body: data,
    }),
  updatePromoCode: (id: string, data: any) =>
    request<any>(`/admin/promo-codes/${id}`, { method: "PATCH", body: data }),
  deletePromoCode: (id: string, reason: string) =>
    request<any>(`/admin/promo-codes/${id}`, {
      method: "DELETE",
      body: { reason },
    }),

  // Logs
  listLogs: (params: { page?: number; targetType?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.targetType) qs.set("targetType", params.targetType);
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/logs?${qs}`);
  },

  // Tracking Links
  listTrackingLinks: (params: {
    page?: number;
    search?: string;
    enabled?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    if (params.enabled !== undefined) qs.set("enabled", String(params.enabled));
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/tracking?${qs}`);
  },
  getTrackingLink: (id: string) => request<any>(`/admin/tracking/${id}`),
  getTrackingLinkStats: (
    id: string,
    params: { from?: string; to?: string } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    return request<any>(`/admin/tracking/${id}/stats?${qs}`);
  },
  createTrackingLink: (data: {
    code: string;
    name: string;
    description?: string;
    enabled?: boolean;
    reason: string;
  }) => request<any>("/admin/tracking", { method: "POST", body: data }),
  updateTrackingLink: (
    id: string,
    data: {
      name?: string;
      description?: string;
      enabled?: boolean;
      reason: string;
    }
  ) => request<any>(`/admin/tracking/${id}`, { method: "PATCH", body: data }),
  deleteTrackingLink: (id: string, reason: string) =>
    request<any>(`/admin/tracking/${id}`, {
      method: "DELETE",
      body: { reason },
    }),

  // Support
  listTickets: (params: {
    status?: string;
    assigned?: string;
    search?: string;
    page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.assigned) qs.set("assigned", params.assigned);
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/support/tickets?${qs}`);
  },
  getTicket: (id: string) => request<any>(`/admin/support/tickets/${id}`),
  getTicketMessages: (id: string) =>
    request<any[]>(`/admin/support/tickets/${id}/messages`),
  replyToTicket: (id: string, text: string) =>
    request<any>(`/admin/support/tickets/${id}/messages`, {
      method: "POST",
      body: { text },
    }),
  assignTicket: (id: string, adminId: string | null) =>
    request<any>(`/admin/support/tickets/${id}/assign`, {
      method: "PATCH",
      body: { adminId },
    }),
  setTicketStatus: (id: string, status: string) =>
    request<any>(`/admin/support/tickets/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  getSupportNotifications: (unread?: boolean) =>
    request<any[]>(
      `/admin/support/notifications${unread ? "?unread=true" : ""}`
    ),
  markNotificationsRead: (payload: { ids?: string[]; ticketId?: string }) =>
    request<any>("/admin/support/notifications/mark-read", {
      method: "POST",
      body: payload,
    }),
  listSupportAdmins: () => request<any[]>("/admin/support/admins"),
  generateAdminLinkToken: (adminId: string) =>
    request<any>(`/admin/support/admins/${adminId}/link-token`, {
      method: "POST",
    }),
  toggleAdminSupportNotifications: (adminId: string, enabled: boolean) =>
    request<any>(`/admin/support/admins/${adminId}/notifications`, {
      method: "PATCH",
      body: { enabled },
    }),
};


