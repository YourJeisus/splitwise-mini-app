import { useState, useEffect, useCallback } from "react";
import { adminApi, getAccessToken, setAccessToken } from "./adminApi";
import "./AdminApp.css";

type Tab = "dashboard" | "users" | "groups" | "sales" | "products" | "logs";

export function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [loginError, setLoginError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      adminApi
        .getMe()
        .then((me) => {
          setAdmin(me);
          setIsAuthenticated(true);
        })
        .catch(() => {
          setAccessToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await adminApi.login(email, password);
      setAccessToken(res.accessToken);
      setAdmin(res.admin);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || "Ошибка входа");
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setIsAuthenticated(false);
    setAdmin(null);
  };

  if (loading) {
    return <div className="admin-loading">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <h1>Админ-панель</h1>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {loginError && <div className="admin-error">{loginError}</div>}
            <button type="submit">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Админ-панель</h1>
        <div className="admin-header-right">
          <span>{admin?.email} ({admin?.role})</span>
          <button onClick={handleLogout}>Выйти</button>
        </div>
      </header>
      <nav className="admin-nav">
        {(["dashboard", "users", "groups", "sales", "products", "logs"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "dashboard" && "Dashboard"}
            {tab === "users" && "Пользователи"}
            {tab === "groups" && "Группы"}
            {tab === "sales" && "Продажи"}
            {tab === "products" && "Продукты"}
            {tab === "logs" && "Логи"}
          </button>
        ))}
      </nav>
      <main className="admin-main">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab role={admin?.role || ""} />}
        {activeTab === "groups" && <GroupsTab />}
        {activeTab === "sales" && <SalesTab role={admin?.role || ""} />}
        {activeTab === "products" && <ProductsTab role={admin?.role || ""} />}
        {activeTab === "logs" && <LogsTab />}
      </main>
    </div>
  );
}

function DashboardTab() {
  const [period, setPeriod] = useState("7d");
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getKPI(period).then(setKpi).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="dashboard-tab">
      <div className="period-selector">
        {["today", "7d", "30d"].map((p) => (
          <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
            {p === "today" ? "Сегодня" : p === "7d" ? "7 дней" : "30 дней"}
          </button>
        ))}
      </div>
      {kpi && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-value">{kpi.revenue?.stars || 0} ⭐</div>
            <div className="kpi-label">Выручка</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.purchases?.count || 0}</div>
            <div className="kpi-label">Покупок</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.tripPass?.activeCount || 0}</div>
            <div className="kpi-label">Активных Trip Pass</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.users?.total || 0}</div>
            <div className="kpi-label">Всего пользователей</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.users?.activeInPeriod || 0}</div>
            <div className="kpi-label">Активных за период</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.groups?.activeCount || 0}</div>
            <div className="kpi-label">Активных групп</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.conversion?.rate || "0%"}</div>
            <div className="kpi-label">Конверсия</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.purchases?.failed || 0}</div>
            <div className="kpi-label">Ошибок оплаты</div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab({ role }: { role: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(() => {
    setLoading(true);
    adminApi.listUsers({ page, search: search || undefined }).then((res) => {
      setUsers(res.items);
      setTotal(res.total);
      setLoading(false);
    });
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const canEdit = role === "OWNER" || role === "ADMIN";

  return (
    <div className="users-tab">
      <div className="search-bar">
        <input
          placeholder="Поиск по ID, телеграм, имени..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadUsers()}
        />
        <button onClick={loadUsers}>Искать</button>
      </div>
      {loading ? (
        <div>Загрузка...</div>
      ) : selectedUser ? (
        <UserCard
          user={selectedUser}
          canEdit={canEdit}
          onBack={() => {
            setSelectedUser(null);
            loadUsers();
          }}
        />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Telegram</th>
                <th>Имя</th>
                <th>GodMode</th>
                <th>Покупок</th>
                <th>Групп</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} onClick={() => adminApi.getUser(u.id).then(setSelectedUser)}>
                  <td>{u.id.slice(0, 8)}...</td>
                  <td>{u.telegramId}</td>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.godModeEnabled ? "✅" : ""}</td>
                  <td>{u._count?.purchases || 0}</td>
                  <td>{u._count?.groupMembers || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span>Страница {page} / {Math.ceil(total / 50)}</span>
            <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

function UserCard({ user, canEdit, onBack }: { user: any; canEdit: boolean; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [showModal, setShowModal] = useState<"godmode" | "grant" | null>(null);

  const handleGodMode = async (enabled: boolean) => {
    if (!reason.trim()) return alert("Укажите причину");
    await adminApi.toggleGodMode(user.id, enabled, reason);
    setShowModal(null);
    setReason("");
    onBack();
  };

  return (
    <div className="user-card">
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <h2>{user.firstName} {user.lastName} (@{user.username})</h2>
      <div className="user-info">
        <p><strong>ID:</strong> {user.id}</p>
        <p><strong>Telegram ID:</strong> {user.telegramId}</p>
        <p><strong>GodMode:</strong> {user.godModeEnabled ? "Включён ✅" : "Выключен"}</p>
        <p><strong>Последняя активность:</strong> {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "—"}</p>
      </div>

      {canEdit && (
        <div className="user-actions">
          <button onClick={() => setShowModal("godmode")}>
            {user.godModeEnabled ? "Выключить GodMode" : "Включить GodMode"}
          </button>
        </div>
      )}

      <h3>Активные entitlements</h3>
      {user.activeEntitlements?.length > 0 ? (
        <ul>
          {user.activeEntitlements.map((e: any) => (
            <li key={e.id}>
              {e.product?.title} — {e.group?.name} (до {new Date(e.endsAt).toLocaleDateString()})
            </li>
          ))}
        </ul>
      ) : (
        <p>Нет активных</p>
      )}

      {showModal === "godmode" && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{user.godModeEnabled ? "Выключить" : "Включить"} GodMode</h3>
            <textarea
              placeholder="Причина (обязательно)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowModal(null)}>Отмена</button>
              <button onClick={() => handleGodMode(!user.godModeEnabled)}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(() => {
    setLoading(true);
    adminApi.listGroups({ page, search: search || undefined }).then((res) => {
      setGroups(res.items);
      setTotal(res.total);
      setLoading(false);
    });
  }, [page, search]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <div className="groups-tab">
      <div className="search-bar">
        <input
          placeholder="Поиск по ID, названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadGroups()}
        />
        <button onClick={loadGroups}>Искать</button>
      </div>
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Валюта</th>
                <th>Участников</th>
                <th>Трат</th>
                <th>Trip Pass</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.id.slice(0, 8)}...</td>
                  <td>{g.name}</td>
                  <td>{g.settlementCurrency}</td>
                  <td>{g.membersCount}</td>
                  <td>{g.expensesCount}</td>
                  <td>{g.tripPassActive ? "✅" : ""}</td>
                  <td>{g.closedAt ? "Закрыта" : "Активна"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span>Страница {page} / {Math.ceil(total / 50)}</span>
            <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

function SalesTab({ role: _role }: { role: string }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadPurchases = useCallback(() => {
    setLoading(true);
    adminApi.listPurchases({ page }).then((res) => {
      setPurchases(res.items);
      setTotal(res.total);
      setLoading(false);
    });
  }, [page]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  return (
    <div className="sales-tab">
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Продукт</th>
                <th>Stars</th>
                <th>Статус</th>
                <th>Покупатель</th>
                <th>Группа</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>{p.product?.title || p.productCode}</td>
                  <td>{p.starsAmount} ⭐</td>
                  <td className={`status-${p.status.toLowerCase()}`}>{p.status}</td>
                  <td>{p.buyer?.firstName || p.buyerUserId?.slice(0, 8)}</td>
                  <td>{p.group?.name || p.groupId?.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span>Страница {page} / {Math.ceil(total / 50)}</span>
            <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

function ProductsTab({ role }: { role: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(() => {
    setLoading(true);
    adminApi.listProducts().then((res) => {
      setProducts(res);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const canEdit = role === "OWNER" || role === "ADMIN";

  if (loading) return <div>Загрузка...</div>;

  if (selectedProduct) {
    return (
      <ProductCard
        product={selectedProduct}
        canEdit={canEdit}
        onBack={() => {
          setSelectedProduct(null);
          loadProducts();
        }}
      />
    );
  }

  return (
    <div className="products-tab">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Цена (Stars)</th>
            <th>Длительность</th>
            <th>Активен</th>
            <th>Скидка</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.code} onClick={() => setSelectedProduct(p)}>
              <td>{p.code}</td>
              <td>{p.title}</td>
              <td>{p.starsPrice} ⭐</td>
              <td>{p.durationDays} дн.</td>
              <td>{p.active ? "✅" : "❌"}</td>
              <td>
                {p.pricing?.enabled
                  ? p.pricing.globalDiscountType === "PERCENT"
                    ? `-${p.pricing.percentOff}%`
                    : p.pricing.globalDiscountType === "FIXED_OVERRIDE"
                    ? `${p.pricing.starsPriceOverride} ⭐`
                    : "—"
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({ product, canEdit, onBack }: { product: any; canEdit: boolean; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    enabled: product.pricing?.enabled || false,
    globalDiscountType: product.pricing?.globalDiscountType || "NONE",
    percentOff: product.pricing?.percentOff || "",
    starsPriceOverride: product.pricing?.starsPriceOverride || "",
  });
  const [promoForm, setPromoForm] = useState({
    code: "",
    discountType: "PERCENT",
    percentOff: "",
    starsPriceOverride: "",
    maxRedemptions: "",
  });

  const handleUpdatePricing = async () => {
    if (!reason.trim()) return alert("Укажите причину");
    await adminApi.updatePricing(product.code, {
      ...pricingForm,
      percentOff: pricingForm.percentOff ? parseInt(pricingForm.percentOff as any) : null,
      starsPriceOverride: pricingForm.starsPriceOverride ? parseInt(pricingForm.starsPriceOverride as any) : null,
      reason,
    });
    setShowPricingModal(false);
    setReason("");
    onBack();
  };

  const handleCreatePromo = async () => {
    if (!reason.trim()) return alert("Укажите причину");
    if (!promoForm.code.trim()) return alert("Укажите код");
    await adminApi.createPromoCode(product.code, {
      ...promoForm,
      percentOff: promoForm.percentOff ? parseInt(promoForm.percentOff) : undefined,
      starsPriceOverride: promoForm.starsPriceOverride ? parseInt(promoForm.starsPriceOverride) : undefined,
      maxRedemptions: promoForm.maxRedemptions ? parseInt(promoForm.maxRedemptions) : undefined,
      reason,
    });
    setShowPromoModal(false);
    setReason("");
    setPromoForm({ code: "", discountType: "PERCENT", percentOff: "", starsPriceOverride: "", maxRedemptions: "" });
    onBack();
  };

  return (
    <div className="product-card">
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <h2>{product.title}</h2>
      <div className="product-info">
        <p><strong>Код:</strong> {product.code}</p>
        <p><strong>Цена:</strong> {product.starsPrice} ⭐</p>
        <p><strong>Длительность:</strong> {product.durationDays} дней</p>
        <p><strong>Активен:</strong> {product.active ? "Да" : "Нет"}</p>
      </div>

      <h3>Глобальная скидка</h3>
      <p>
        {product.pricing?.enabled
          ? product.pricing.globalDiscountType === "PERCENT"
            ? `Скидка ${product.pricing.percentOff}%`
            : product.pricing.globalDiscountType === "FIXED_OVERRIDE"
            ? `Фикс. цена ${product.pricing.starsPriceOverride} ⭐`
            : "Не задана"
          : "Не активна"}
      </p>
      {canEdit && <button onClick={() => setShowPricingModal(true)}>Настроить скидку</button>}

      <h3>Промокоды</h3>
      {product.promoCodes?.length > 0 ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Тип</th>
              <th>Скидка</th>
              <th>Использований</th>
              <th>Активен</th>
            </tr>
          </thead>
          <tbody>
            {product.promoCodes.map((promo: any) => (
              <tr key={promo.id}>
                <td>{promo.code}</td>
                <td>{promo.discountType}</td>
                <td>
                  {promo.discountType === "PERCENT" ? `${promo.percentOff}%` : `${promo.starsPriceOverride} ⭐`}
                </td>
                <td>{promo.redeemedCount}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}</td>
                <td>{promo.enabled ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Нет промокодов</p>
      )}
      {canEdit && <button onClick={() => setShowPromoModal(true)}>Добавить промокод</button>}

      {showPricingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Настройка глобальной скидки</h3>
            <label>
              <input
                type="checkbox"
                checked={pricingForm.enabled}
                onChange={(e) => setPricingForm({ ...pricingForm, enabled: e.target.checked })}
              />
              Скидка активна
            </label>
            <select
              value={pricingForm.globalDiscountType}
              onChange={(e) => setPricingForm({ ...pricingForm, globalDiscountType: e.target.value })}
            >
              <option value="NONE">Нет скидки</option>
              <option value="PERCENT">Процент</option>
              <option value="FIXED_OVERRIDE">Фикс. цена</option>
            </select>
            {pricingForm.globalDiscountType === "PERCENT" && (
              <input
                type="number"
                placeholder="Процент скидки"
                value={pricingForm.percentOff}
                onChange={(e) => setPricingForm({ ...pricingForm, percentOff: e.target.value })}
              />
            )}
            {pricingForm.globalDiscountType === "FIXED_OVERRIDE" && (
              <input
                type="number"
                placeholder="Фикс. цена (Stars)"
                value={pricingForm.starsPriceOverride}
                onChange={(e) => setPricingForm({ ...pricingForm, starsPriceOverride: e.target.value })}
              />
            )}
            <textarea
              placeholder="Причина (обязательно)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowPricingModal(false)}>Отмена</button>
              <button onClick={handleUpdatePricing}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showPromoModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Новый промокод</h3>
            <input
              type="text"
              placeholder="Код промокода"
              value={promoForm.code}
              onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
            />
            <select
              value={promoForm.discountType}
              onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
            >
              <option value="PERCENT">Процент</option>
              <option value="FIXED_OVERRIDE">Фикс. цена</option>
            </select>
            {promoForm.discountType === "PERCENT" && (
              <input
                type="number"
                placeholder="Процент скидки"
                value={promoForm.percentOff}
                onChange={(e) => setPromoForm({ ...promoForm, percentOff: e.target.value })}
              />
            )}
            {promoForm.discountType === "FIXED_OVERRIDE" && (
              <input
                type="number"
                placeholder="Фикс. цена (Stars)"
                value={promoForm.starsPriceOverride}
                onChange={(e) => setPromoForm({ ...promoForm, starsPriceOverride: e.target.value })}
              />
            )}
            <input
              type="number"
              placeholder="Макс. использований (опционально)"
              value={promoForm.maxRedemptions}
              onChange={(e) => setPromoForm({ ...promoForm, maxRedemptions: e.target.value })}
            />
            <textarea
              placeholder="Причина (обязательно)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowPromoModal(false)}>Отмена</button>
              <button onClick={handleCreatePromo}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(() => {
    setLoading(true);
    adminApi.listLogs({ page }).then((res) => {
      setLogs(res.items);
      setTotal(res.total);
      setLoading(false);
    });
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="logs-tab">
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Админ</th>
                <th>Действие</th>
                <th>Тип</th>
                <th>ID</th>
                <th>Причина</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.admin?.email || log.adminId.slice(0, 8)}</td>
                  <td>{log.action}</td>
                  <td>{log.targetType}</td>
                  <td>{log.targetId?.slice(0, 8) || "—"}</td>
                  <td title={log.reason}>{log.reason.slice(0, 30)}{log.reason.length > 30 ? "..." : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span>Страница {page} / {Math.ceil(total / 50)}</span>
            <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminApp;

