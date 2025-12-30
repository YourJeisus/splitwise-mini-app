import { useState, useEffect, useCallback } from "react";
import { adminApi, getAccessToken, setAccessToken } from "./adminApi";
import { DashboardTab } from "./tabs/DashboardTab";
import { UsersTab } from "./tabs/UsersTab";
import { SupportTab } from "./tabs/SupportTab";
import { SupportAdminsTab } from "./tabs/SupportAdminsTab";
import "./AdminApp.css";

type Tab =
  | "dashboard"
  | "users"
  | "groups"
  | "sales"
  | "products"
  | "tracking"
  | "support"
  | "support-admins"
  | "logs";

export function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState<{ id: string; email: string; role: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);
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

  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = () => {
      adminApi.getSupportNotifications(true).then((res) => {
        setUnreadNotifications(res);
      });
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
          <span>
            {admin?.email} ({admin?.role})
          </span>
          <button onClick={handleLogout}>Выйти</button>
        </div>
      </header>
      <nav className="admin-nav">
        {(
          [
            "dashboard",
            "users",
            "groups",
            "sales",
            "products",
            "tracking",
            "support",
            "support-admins",
            "logs",
          ] as Tab[]
        ).map((tab) => (
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
            {tab === "tracking" && "Ссылки"}
            {tab === "support" && (
              <>
                Поддержка
                {unreadNotifications.length > 0 && (
                  <span className="badge">{unreadNotifications.length}</span>
                )}
              </>
            )}
            {tab === "support-admins" && "Саппорт Админы"}
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
        {activeTab === "tracking" && <TrackingTab role={admin?.role || ""} />}
        {activeTab === "support" && (
          <SupportTab
            currentAdminId={admin?.id || ""}
            onMessagesRead={(ticketId) => {
              adminApi.markNotificationsRead({ ticketId }).then(() => {
                setUnreadNotifications((prev) =>
                  prev.filter((n) => n.data.ticketId !== ticketId)
                );
              });
            }}
          />
        )}
        {activeTab === "support-admins" && <SupportAdminsTab />}
        {activeTab === "logs" && <LogsTab />}
      </main>
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

  const handleGrantTripPass = async (groupId: string) => {
    const daysStr = prompt("Количество дней Trip Pass (по умолчанию 30):");
    const days = daysStr ? parseInt(daysStr) : undefined;
    try {
      const res = await adminApi.grantTripPass(groupId, days);
      alert(
        res.extended
          ? `Trip Pass продлён до ${new Date(res.endsAt).toLocaleString()}`
          : `Trip Pass выдан до ${new Date(res.endsAt).toLocaleString()}`
      );
      loadGroups();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  const handleReopenGroup = async (groupId: string) => {
    if (!confirm("Открыть эту группу?")) return;
    try {
      await adminApi.reopenGroup(groupId);
      alert("Группа открыта");
      loadGroups();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

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
                <th>Действия</th>
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
                  <td>
                    {g.tripPassActive ? (
                      <span
                        title={`До ${new Date(g.tripPassEndsAt).toLocaleString()}`}
                      >
                        ✅
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>{g.closedAt ? "Закрыта" : "Активна"}</td>
                  <td className="actions-cell">
                    <button
                      className="action-btn"
                      onClick={() => handleGrantTripPass(g.id)}
                      title="Выдать Trip Pass"
                    >
                      ✨
                    </button>
                    {g.closedAt && (
                      <button
                        className="action-btn"
                        onClick={() => handleReopenGroup(g.id)}
                        title="Открыть группу"
                      >
                        🔓
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span>
              Страница {page} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
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
                  <td className={`status-${p.status.toLowerCase()}`}>
                    {p.status}
                  </td>
                  <td>{p.buyer?.firstName || p.buyerUserId?.slice(0, 8)}</td>
                  <td>{p.group?.name || p.groupId?.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span>
              Страница {page} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
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

function ProductCard({
  product,
  canEdit,
  onBack,
}: {
  product: any;
  canEdit: boolean;
  onBack: () => void;
}) {
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
    try {
      await adminApi.updatePricing(product.code, {
        ...pricingForm,
        percentOff: pricingForm.percentOff
          ? parseInt(pricingForm.percentOff as any)
          : null,
        starsPriceOverride: pricingForm.starsPriceOverride
          ? parseInt(pricingForm.starsPriceOverride as any)
          : null,
        reason,
      });
      setShowPricingModal(false);
      setReason("");
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  const handleCreatePromo = async () => {
    if (!reason.trim()) return alert("Укажите причину");
    if (!promoForm.code.trim()) return alert("Укажите код");
    try {
      await adminApi.createPromoCode(product.code, {
        ...promoForm,
        percentOff: promoForm.percentOff
          ? parseInt(promoForm.percentOff)
          : undefined,
        starsPriceOverride: promoForm.starsPriceOverride
          ? parseInt(promoForm.starsPriceOverride)
          : undefined,
        maxRedemptions: promoForm.maxRedemptions
          ? parseInt(promoForm.maxRedemptions)
          : undefined,
        reason,
      });
      setShowPromoModal(false);
      setReason("");
      setPromoForm({
        code: "",
        discountType: "PERCENT",
        percentOff: "",
        starsPriceOverride: "",
        maxRedemptions: "",
      });
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  return (
    <div className="product-card">
      <button className="back-btn" onClick={onBack}>
        ← Назад
      </button>
      <h2>{product.title}</h2>
      <div className="product-info">
        <p>
          <strong>Код:</strong> {product.code}
        </p>
        <p>
          <strong>Цена:</strong> {product.starsPrice} ⭐
        </p>
        <p>
          <strong>Длительность:</strong> {product.durationDays} дней
        </p>
        <p>
          <strong>Активен:</strong> {product.active ? "Да" : "Нет"}
        </p>
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
      {canEdit && (
        <button onClick={() => setShowPricingModal(true)}>
          Настроить скидку
        </button>
      )}

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
                  {promo.discountType === "PERCENT"
                    ? `${promo.percentOff}%`
                    : `${promo.starsPriceOverride} ⭐`}
                </td>
                <td>
                  {promo.redeemedCount}
                  {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
                </td>
                <td>{promo.enabled ? "✅" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Нет промокодов</p>
      )}
      {canEdit && (
        <button onClick={() => setShowPromoModal(true)}>
          Добавить промокод
        </button>
      )}

      {showPricingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Настройка глобальной скидки</h3>
            <label>
              <input
                type="checkbox"
                checked={pricingForm.enabled}
                onChange={(e) =>
                  setPricingForm({ ...pricingForm, enabled: e.target.checked })
                }
              />
              Скидка активна
            </label>
            <select
              value={pricingForm.globalDiscountType}
              onChange={(e) =>
                setPricingForm({
                  ...pricingForm,
                  globalDiscountType: e.target.value,
                })
              }
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
                onChange={(e) =>
                  setPricingForm({ ...pricingForm, percentOff: e.target.value })
                }
              />
            )}
            {pricingForm.globalDiscountType === "FIXED_OVERRIDE" && (
              <input
                type="number"
                placeholder="Фикс. цена (Stars)"
                value={pricingForm.starsPriceOverride}
                onChange={(e) =>
                  setPricingForm({
                    ...pricingForm,
                    starsPriceOverride: e.target.value,
                  })
                }
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
              onChange={(e) =>
                setPromoForm({
                  ...promoForm,
                  code: e.target.value.toUpperCase(),
                })
              }
            />
            <select
              value={promoForm.discountType}
              onChange={(e) =>
                setPromoForm({ ...promoForm, discountType: e.target.value })
              }
            >
              <option value="PERCENT">Процент</option>
              <option value="FIXED_OVERRIDE">Фикс. цена</option>
            </select>
            {promoForm.discountType === "PERCENT" && (
              <input
                type="number"
                placeholder="Процент скидки"
                value={promoForm.percentOff}
                onChange={(e) =>
                  setPromoForm({ ...promoForm, percentOff: e.target.value })
                }
              />
            )}
            {promoForm.discountType === "FIXED_OVERRIDE" && (
              <input
                type="number"
                placeholder="Фикс. цена (Stars)"
                value={promoForm.starsPriceOverride}
                onChange={(e) =>
                  setPromoForm({
                    ...promoForm,
                    starsPriceOverride: e.target.value,
                  })
                }
              />
            )}
            <input
              type="number"
              placeholder="Макс. использований (опционально)"
              value={promoForm.maxRedemptions}
              onChange={(e) =>
                setPromoForm({ ...promoForm, maxRedemptions: e.target.value })
              }
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

function TrackingTab({ role }: { role: string }) {
  const [links, setLinks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    description: "",
    reason: "",
  });

  const canEdit = role === "OWNER" || role === "ADMIN";

  const loadLinks = useCallback(() => {
    setLoading(true);
    adminApi
      .listTrackingLinks({ page, search: search || undefined })
      .then((res) => {
        setLinks(res.items);
        setTotal(res.total);
        setLoading(false);
      });
  }, [page, search]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleCreate = async () => {
    if (
      !createForm.code.trim() ||
      !createForm.name.trim() ||
      !createForm.reason.trim()
    ) {
      return alert("Заполните все обязательные поля");
    }
    try {
      await adminApi.createTrackingLink(createForm);
      setShowCreateModal(false);
      setCreateForm({ code: "", name: "", description: "", reason: "" });
      loadLinks();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  if (selectedLink) {
    return (
      <TrackingLinkCard
        link={selectedLink}
        canEdit={canEdit}
        onBack={() => {
          setSelectedLink(null);
          loadLinks();
        }}
      />
    );
  }

  return (
    <div className="tracking-tab">
      <div className="search-bar">
        <input
          placeholder="Поиск по коду, названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadLinks()}
        />
        <button onClick={loadLinks}>Искать</button>
        {canEdit && (
          <button onClick={() => setShowCreateModal(true)}>
            + Создать ссылку
          </button>
        )}
      </div>
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Название</th>
                <th>Переходов</th>
                <th>Активна</th>
                <th>Создана</th>
                <th>Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelectedLink(l)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{l.code}</td>
                  <td>{l.name}</td>
                  <td>{l.clickCount}</td>
                  <td>{l.enabled ? "✅" : "❌"}</td>
                  <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `https://t.me/PopolamAppBot?start=${l.code}`
                        );
                        alert("Ссылка скопирована!");
                      }}
                    >
                      📋
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span>
              Страница {page} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Новая tracking-ссылка</h3>
            <input
              type="text"
              placeholder="Код (латиница, цифры, -, _)"
              value={createForm.code}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  code: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""),
                })
              }
            />
            <input
              type="text"
              placeholder="Название"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
            />
            <textarea
              placeholder="Описание (опционально)"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm({ ...createForm, description: e.target.value })
              }
            />
            <textarea
              placeholder="Причина создания (обязательно)"
              value={createForm.reason}
              onChange={(e) =>
                setCreateForm({ ...createForm, reason: e.target.value })
              }
            />
            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)}>Отмена</button>
              <button onClick={handleCreate}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingLinkCard({
  link,
  canEdit,
  onBack,
}: {
  link: any;
  canEdit: boolean;
  onBack: () => void;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: link.name,
    description: link.description || "",
    enabled: link.enabled,
    reason: "",
  });

  useEffect(() => {
    adminApi.getTrackingLinkStats(link.id).then((res) => {
      setStats(res);
      setLoading(false);
    });
  }, [link.id]);

  const handleUpdate = async () => {
    if (!editForm.reason.trim()) return alert("Укажите причину");
    try {
      await adminApi.updateTrackingLink(link.id, editForm);
      setShowEditModal(false);
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  const handleDelete = async () => {
    const reason = prompt("Причина удаления:");
    if (!reason) return;
    try {
      await adminApi.deleteTrackingLink(link.id, reason);
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  const botLink = `https://t.me/PopolamAppBot?start=${link.code}`;

  return (
    <div className="tracking-card">
      <button className="back-btn" onClick={onBack}>
        ← Назад
      </button>
      <h2>{link.name}</h2>
      <div className="tracking-info">
        <p>
          <strong>Код:</strong> {link.code}
        </p>
        <p>
          <strong>Ссылка:</strong>{" "}
          <a href={botLink} target="_blank" rel="noopener noreferrer">
            {botLink}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(botLink);
              alert("Скопировано!");
            }}
            style={{ marginLeft: 8 }}
          >
            📋
          </button>
        </p>
        <p>
          <strong>Описание:</strong> {link.description || "—"}
        </p>
        <p>
          <strong>Активна:</strong> {link.enabled ? "Да" : "Нет"}
        </p>
        <p>
          <strong>Создана:</strong> {new Date(link.createdAt).toLocaleString()}
        </p>
      </div>

      <h3>Статистика</h3>
      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div className="tracking-stats">
          <p>
            <strong>Всего переходов:</strong> {stats?.totalClicks || 0}
          </p>
          <p>
            <strong>Уникальных пользователей:</strong>{" "}
            {stats?.uniqueUsersCount || 0}
          </p>
          {stats?.recentClicks?.length > 0 && (
            <>
              <h4>Последние переходы</h4>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Telegram ID</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentClicks.slice(0, 20).map((c: any) => (
                    <tr key={c.id}>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                      <td>{c.telegramUserId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {canEdit && (
        <div className="tracking-actions">
          <button onClick={() => setShowEditModal(true)}>Редактировать</button>
          <button onClick={handleDelete} style={{ background: "#dc3545" }}>
            Удалить
          </button>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Редактирование ссылки</h3>
            <input
              type="text"
              placeholder="Название"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            <textarea
              placeholder="Описание"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
            />
            <label>
              <input
                type="checkbox"
                checked={editForm.enabled}
                onChange={(e) =>
                  setEditForm({ ...editForm, enabled: e.target.checked })
                }
              />
              Активна
            </label>
            <textarea
              placeholder="Причина изменения (обязательно)"
              value={editForm.reason}
              onChange={(e) =>
                setEditForm({ ...editForm, reason: e.target.value })
              }
            />
            <div className="modal-actions">
              <button onClick={() => setShowEditModal(false)}>Отмена</button>
              <button onClick={handleUpdate}>Сохранить</button>
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
                  <td title={log.reason}>
                    {log.reason.slice(0, 30)}
                    {log.reason.length > 30 ? "..." : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span>
              Страница {page} / {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminApp;
