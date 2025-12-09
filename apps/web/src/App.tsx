import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { createApiClient } from "./api";
import type { User, Group, GroupBalance, Expense } from "./api";

const CURRENCIES = [
  { code: "RUB", name: "Российский рубль", symbol: "₽" },
  { code: "USD", name: "Доллар США", symbol: "$" },
  { code: "EUR", name: "Евро", symbol: "€" },
  { code: "GBP", name: "Фунт стерлингов", symbol: "£" },
  { code: "UAH", name: "Украинская гривна", symbol: "₴" },
  { code: "KZT", name: "Казахстанский тенге", symbol: "₸" },
  { code: "BYN", name: "Белорусский рубль", symbol: "Br" },
  { code: "TRY", name: "Турецкая лира", symbol: "₺" },
  { code: "CNY", name: "Китайский юань", symbol: "¥" },
  { code: "JPY", name: "Японская иена", symbol: "¥" },
  { code: "GEL", name: "Грузинский лари", symbol: "₾" },
  { code: "AMD", name: "Армянский драм", symbol: "֏" },
  { code: "AZN", name: "Азербайджанский манат", symbol: "₼" },
  { code: "THB", name: "Тайский бат", symbol: "฿" },
  { code: "AED", name: "Дирхам ОАЭ", symbol: "د.إ" },
];

type Tab = "balance" | "expenses";
type Screen = "home" | "groups" | "activity" | "profile";

type InviteInfo = {
  id: string;
  name: string;
  currency: string;
  membersCount: number;
  inviteCode: string;
};

const GROUP_COLORS = ["yellow", "blue", "pink", "green", "purple", "orange"];
const GROUP_ICONS = ["👥", "🏠", "✈️", "🎉", "💼", "🍕", "🎮", "🛒"];

function App() {
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");

  // Создание группы
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCurrency, setNewGroupCurrency] = useState("RUB");
  const [currencySearch, setCurrencySearch] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  // Приглашение в группу
  const [pendingInvite, setPendingInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Выбранная группа
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupBalance, setGroupBalance] = useState<GroupBalance | null>(null);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("balance");

  // Расходы
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    []
  );
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Погашение
  const [settleToUser, setSettleToUser] = useState("");
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [showSettle, setShowSettle] = useState(false);

  // Редактирование группы
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupCurrency, setEditGroupCurrency] = useState("");
  const [showEditCurrencyDropdown, setShowEditCurrencyDropdown] =
    useState(false);

  // Подтверждение удаления
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<
    "group" | "expense" | null
  >(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null
  );

  const api = useMemo(
    () => createApiClient(initData || import.meta.env.VITE_TG_INIT_DATA || ""),
    [initData]
  );

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch) return CURRENCIES;
    const search = currencySearch.toLowerCase();
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(search) ||
        c.name.toLowerCase().includes(search)
    );
  }, [currencySearch]);

  const currentGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroup);
  }, [groups, selectedGroup]);

  const getGroupColor = (index: number) =>
    GROUP_COLORS[index % GROUP_COLORS.length];
  const getGroupIcon = (index: number) =>
    GROUP_ICONS[index % GROUP_ICONS.length];

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };

  const checkInviteCode = useCallback(
    async (code: string) => {
      if (!code) return;

      setInviteLoading(true);
      setInviteError(null);

      try {
        const groupInfo = await api.getGroupByInvite(code);
        const userGroups = await api.listGroups();
        const alreadyMember = userGroups.some((g) => g.id === groupInfo.id);

        if (alreadyMember) {
          setInviteError("Вы уже состоите в этой группе");
          setGroups(userGroups);
          await handleSelectGroup(groupInfo.id);
        } else {
          setPendingInvite({ ...groupInfo, inviteCode: code });
        }
      } catch (error) {
        setInviteError((error as Error).message || "Группа не найдена");
      } finally {
        setInviteLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData) {
      webApp.ready?.();
      webApp.expand?.();
      setInitData(webApp.initData);

      const startParam = webApp.initDataUnsafe?.start_param;
      if (startParam) {
        sessionStorage.setItem("pendingInviteCode", startParam);
      }
    }
  }, []);

  useEffect(() => {
    if (!api.hasAuth()) return;
    void bootstrap();
  }, [api]);

  const bootstrap = async () => {
    try {
      const me = await api.verify();
      setUser(me);
      const groupList = await api.listGroups();
      setGroups(groupList);

      const pendingCode = sessionStorage.getItem("pendingInviteCode");
      if (pendingCode) {
        sessionStorage.removeItem("pendingInviteCode");
        await checkInviteCode(pendingCode);
      } else if (groupList[0]) {
        await handleSelectGroup(groupList[0].id);
      }
    } catch (error) {
      console.error("Bootstrap error:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      await api.createGroup({ name: newGroupName, currency: newGroupCurrency });
      setNewGroupName("");
      setShowCreateGroup(false);
      const updated = await api.listGroups();
      setGroups(updated);
      if (updated[0]) {
        await handleSelectGroup(updated[0].id);
      }
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;

    setInviteLoading(true);
    try {
      const group = await api.joinGroup(pendingInvite.inviteCode);
      setPendingInvite(null);
      const updated = await api.listGroups();
      setGroups(updated);
      await handleSelectGroup(group.id);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("уже в этой группе")) {
        setPendingInvite(null);
        setInviteError("Вы уже состоите в этой группе");
      } else {
        alert(`Ошибка: ${message}`);
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeclineInvite = () => {
    setPendingInvite(null);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroup(groupId);
    setShowAddExpense(false);
    setShowSettle(false);
    setShowEditGroup(false);
    const [balance, expenses] = await Promise.all([
      api.getGroupBalance(groupId),
      api.getGroupExpenses(groupId),
    ]);
    setGroupBalance(balance);
    setGroupExpenses(expenses);
    setSelectedParticipants(Object.keys(balance.balances));
  };

  const handleCopyInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = "JeisusSplitBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    navigator.clipboard.writeText(link);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  };

  const handleShareInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = "JeisusSplitBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    const text = `Присоединяйся к группе "${groupBalance.group.name}" в Splitwise!`;
    window.Telegram?.WebApp?.openTelegramLink?.(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    );
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddExpense = async () => {
    if (
      !selectedGroup ||
      !user ||
      !expenseAmount ||
      selectedParticipants.length === 0
    )
      return;

    const owed = expenseAmount / selectedParticipants.length;
    const shares = selectedParticipants.map((id) => ({
      userId: id,
      paid: id === user.id ? expenseAmount : 0,
      owed,
    }));

    try {
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, {
          description: expenseTitle || "Расход",
          amount: expenseAmount,
          shares,
        });
      } else {
        await api.createExpense({
          groupId: selectedGroup,
          description: expenseTitle || "Расход",
          amount: expenseAmount,
          currency: groupBalance?.group.currency ?? "RUB",
          shares,
        });
      }

      setExpenseTitle("");
      setExpenseAmount(0);
      setShowAddExpense(false);
      setEditingExpense(null);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, expenses, updatedGroups] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.getGroupExpenses(selectedGroup),
        api.listGroups(),
      ]);
      setGroupBalance(balance);
      setGroupExpenses(expenses);
      setGroups(updatedGroups);
      setActiveTab("expenses");
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseTitle(expense.description);
    setExpenseAmount(Number(expense.amount));
    setSelectedParticipants(expense.shares.map((s) => s.userId));
    setShowAddExpense(true);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId || !selectedGroup) return;

    try {
      await api.deleteExpense(deletingExpenseId);
      setShowDeleteConfirm(null);
      setDeletingExpenseId(null);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, expenses, updatedGroups] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.getGroupExpenses(selectedGroup),
        api.listGroups(),
      ]);
      setGroupBalance(balance);
      setGroupExpenses(expenses);
      setGroups(updatedGroups);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleSettle = async () => {
    if (!settleToUser || !settleAmount) return;
    try {
      await api.createSettlement({
        toUserId: settleToUser,
        amount: settleAmount,
        currency: groupBalance?.group.currency,
      });
      setSettleAmount(0);
      setSettleToUser("");
      setShowSettle(false);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      if (selectedGroup) {
        const [balance, updatedGroups] = await Promise.all([
          api.getGroupBalance(selectedGroup),
          api.listGroups(),
        ]);
        setGroupBalance(balance);
        setGroups(updatedGroups);
      }
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const openEditGroup = () => {
    if (!currentGroup) return;
    setEditGroupName(currentGroup.name);
    setEditGroupCurrency(currentGroup.currency);
    setShowEditGroup(true);
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup || !editGroupName) return;

    try {
      await api.updateGroup(selectedGroup, {
        name: editGroupName,
        currency: editGroupCurrency,
      });
      setShowEditGroup(false);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, updatedGroups] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.listGroups(),
      ]);
      setGroupBalance(balance);
      setGroups(updatedGroups);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    try {
      await api.deleteGroup(selectedGroup);
      setShowDeleteConfirm(null);
      setSelectedGroup("");
      setGroupBalance(null);
      setGroupExpenses([]);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const updatedGroups = await api.listGroups();
      setGroups(updatedGroups);
      if (updatedGroups[0]) {
        await handleSelectGroup(updatedGroups[0].id);
      }
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  const formatExpenseDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Сегодня";
    if (days === 1) return "Вчера";
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const getUserName = (
    userObj: { firstName?: string; username?: string } | undefined
  ) => {
    if (!userObj) return "Участник";
    return userObj.firstName || userObj.username || "Участник";
  };

  const getUserInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getTotalBalance = () => {
    return groups.reduce((sum, g) => sum + (g.userBalance || 0), 0);
  };

  // Быстрое открытие модалки добавления расхода
  const openQuickExpense = () => {
    if (!selectedGroup && groups[0]) {
      handleSelectGroup(groups[0].id).then(() => {
        setEditingExpense(null);
        setExpenseTitle("");
        setExpenseAmount(0);
        setShowAddExpense(true);
      });
    } else if (groupBalance) {
      setEditingExpense(null);
      setExpenseTitle("");
      setExpenseAmount(0);
      setSelectedParticipants(Object.keys(groupBalance.balances));
      setShowAddExpense(true);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="avatar">{user?.firstName?.charAt(0) || "👤"}</div>
          <div className="greeting">
            <span className="greeting-text">
              Привет, {user?.firstName || "Друг"}!
            </span>
            <span className="date-text">Сегодня {formatDate()}</span>
          </div>
        </div>
        <button className="search-btn" onClick={() => setShowCreateGroup(true)}>
          ➕
        </button>
      </header>

      {inviteError && (
        <div className="invite-error">
          <span>{inviteError}</span>
          <button onClick={() => setInviteError(null)}>✕</button>
        </div>
      )}

      {/* Hero Card - общий баланс */}
      <div className="hero-card">
        <div className="hero-content">
          <div className="hero-title">
            {getTotalBalance() >= 0 ? "Вам должны" : "Вы должны"}
          </div>
          <div
            className="hero-subtitle"
            style={{ fontSize: "32px", fontWeight: 700 }}
          >
            {Math.abs(getTotalBalance()).toFixed(0)}{" "}
            {getCurrencySymbol(groups[0]?.currency || "RUB")}
          </div>
          {groups.length > 0 && (
            <div className="hero-avatars">
              {groups.slice(0, 3).map((_, i) => (
                <div key={i} className="hero-avatar">
                  {getGroupIcon(i)}
                </div>
              ))}
              {groups.length > 3 && (
                <div className="hero-avatar more">+{groups.length - 3}</div>
              )}
            </div>
          )}
        </div>
        <div className="hero-decoration">💰</div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action" onClick={openQuickExpense}>
          <div className="quick-action-icon yellow">➕</div>
          <div className="quick-action-title">Расход</div>
          <div className="quick-action-desc">Добавить трату</div>
        </button>
        <button
          className="quick-action"
          onClick={() => setShowSettle(true)}
          disabled={!selectedGroup}
        >
          <div className="quick-action-icon green">💸</div>
          <div className="quick-action-title">Перевод</div>
          <div className="quick-action-desc">Погасить долг</div>
        </button>
        <button
          className="quick-action"
          onClick={() => setShowCreateGroup(true)}
        >
          <div className="quick-action-icon blue">👥</div>
          <div className="quick-action-title">Группа</div>
          <div className="quick-action-desc">Создать новую</div>
        </button>
        <button
          className="quick-action"
          onClick={handleShareInviteLink}
          disabled={!groupBalance}
        >
          <div className="quick-action-icon pink">📤</div>
          <div className="quick-action-title">Пригласить</div>
          <div className="quick-action-desc">В группу</div>
        </button>
      </div>

      {/* Groups Section */}
      {groups.length > 0 && (
        <section className="groups-section">
          <div className="section-title">Мои группы</div>
          <div className="group-list">
            {groups.map((g, index) => (
              <button
                key={g.id}
                className={`group-item ${selectedGroup === g.id ? "active" : ""}`}
                onClick={() => handleSelectGroup(g.id)}
              >
                <div className={`group-item-icon ${getGroupColor(index)}`}>
                  {getGroupIcon(index)}
                </div>
                <div className="group-item-content">
                  <div className="group-item-name">{g.name}</div>
                  <div className="group-item-meta">
                    {getCurrencySymbol(g.currency)}
                  </div>
                </div>
                {g.userBalance !== undefined && g.userBalance !== 0 && (
                  <div
                    className={`group-item-balance ${g.userBalance >= 0 ? "positive" : "negative"}`}
                  >
                    {g.userBalance >= 0 ? "+" : ""}
                    {g.userBalance.toFixed(0)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Selected Group Details */}
      {selectedGroup && groupBalance && (
        <>
          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "balance" ? "active" : ""}`}
              onClick={() => setActiveTab("balance")}
            >
              ⚖️ Баланс
            </button>
            <button
              className={`tab ${activeTab === "expenses" ? "active" : ""}`}
              onClick={() => setActiveTab("expenses")}
            >
              🧾 Траты ({groupExpenses.length})
            </button>
          </div>

          {/* Balance Tab */}
          {activeTab === "balance" && (
            <section className="balance-section">
              <div className="balance-header">
                <span className="section-title" style={{ marginBottom: 0 }}>
                  {groupBalance.group.name}
                </span>
                <div className="invite-actions">
                  {currentGroup?.createdById === user?.id && (
                    <button className="icon-btn" onClick={openEditGroup}>
                      ✏️
                    </button>
                  )}
                  <button className="icon-btn" onClick={handleCopyInviteLink}>
                    📋
                  </button>
                  <button className="icon-btn" onClick={handleShareInviteLink}>
                    📤
                  </button>
                </div>
              </div>

              <div className="balance-list">
                {Object.entries(groupBalance.balances).map(([uid, balance]) => (
                  <div className="balance-row" key={uid}>
                    <div className="balance-user-avatar">
                      {getUserInitials(groupBalance.userNames?.[uid] || "U")}
                    </div>
                    <span className="balance-user-name">
                      {groupBalance.userNames?.[uid] || "Участник"}
                      {uid === user?.id && " (вы)"}
                    </span>
                    <span
                      className={`balance-user-amount ${balance >= 0 ? "positive" : "negative"}`}
                    >
                      {balance >= 0 ? "+" : ""}
                      {balance.toFixed(0)}{" "}
                      {getCurrencySymbol(groupBalance.group.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {Object.keys(groupBalance.balances).length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <p className="empty-state-text">Пока нет участников</p>
                </div>
              )}
            </section>
          )}

          {/* Expenses Tab */}
          {activeTab === "expenses" && (
            <section className="expenses-section">
              <div className="expenses-header">
                <span className="section-title" style={{ marginBottom: 0 }}>
                  Последние траты
                </span>
              </div>

              {groupExpenses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🧾</div>
                  <p className="empty-state-text">Пока нет расходов</p>
                </div>
              ) : (
                <div className="expenses-list">
                  {groupExpenses.map((expense) => (
                    <div className="expense-item" key={expense.id}>
                      <div className="expense-icon">🧾</div>
                      <div className="expense-details">
                        <div className="expense-title">
                          {expense.description}
                        </div>
                        <div className="expense-meta">
                          {getUserName(expense.createdBy)} •{" "}
                          {formatExpenseDate(expense.createdAt)}
                        </div>
                      </div>
                      <div className="expense-right">
                        <div className="expense-amount">
                          {Number(expense.amount).toFixed(0)}{" "}
                          {getCurrencySymbol(expense.currency)}
                        </div>
                        {expense.createdBy.id === user?.id && (
                          <div className="expense-actions">
                            <button
                              className="expense-action-btn"
                              onClick={() => handleEditExpense(expense)}
                            >
                              ✏️
                            </button>
                            <button
                              className="expense-action-btn danger"
                              onClick={() => {
                                setDeletingExpenseId(expense.id);
                                setShowDeleteConfirm("expense");
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Action Row */}
          <div className="action-row">
            <button className="action-btn primary" onClick={openQuickExpense}>
              ➕ Добавить расход
            </button>
            <button
              className="action-btn secondary"
              onClick={() => setShowSettle(true)}
            >
              💸 Погасить
            </button>
          </div>
        </>
      )}

      {/* Empty State */}
      {groups.length === 0 && (
        <div className="empty-state" style={{ padding: "60px 20px" }}>
          <div className="empty-state-icon">👥</div>
          <p className="empty-state-text">
            Создайте первую группу для отслеживания расходов
          </p>
          <button
            className="primary-btn"
            style={{ marginTop: 20, width: "auto", padding: "14px 32px" }}
            onClick={() => setShowCreateGroup(true)}
          >
            Создать группу
          </button>
        </div>
      )}

      {/* FAB */}
      {groups.length > 0 && (
        <button className="fab" onClick={openQuickExpense}>
          +
        </button>
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${currentScreen === "home" ? "active" : ""}`}
          onClick={() => setCurrentScreen("home")}
        >
          🏠
        </button>
        <button
          className={`nav-item ${currentScreen === "groups" ? "active" : ""}`}
          onClick={() => setCurrentScreen("groups")}
        >
          📊
        </button>
        <button
          className={`nav-item ${currentScreen === "activity" ? "active" : ""}`}
          onClick={() => setCurrentScreen("activity")}
        >
          🔔
        </button>
        <button
          className={`nav-item ${currentScreen === "profile" ? "active" : ""}`}
          onClick={() => setCurrentScreen("profile")}
        >
          👤
        </button>
      </nav>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateGroup(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новая группа</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateGroup(false)}
              >
                ✕
              </button>
            </div>

            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Название группы"
              autoFocus
            />

            <div className="currency-select">
              <div
                className="currency-input"
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
              >
                <span>
                  {getCurrencySymbol(newGroupCurrency)} {newGroupCurrency}
                </span>
                <span className="arrow">▼</span>
              </div>

              {showCurrencyDropdown && (
                <div className="currency-dropdown">
                  <input
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    placeholder="Поиск валюты..."
                    className="currency-search"
                  />
                  <div className="currency-list">
                    {filteredCurrencies.map((c) => (
                      <div
                        key={c.code}
                        className={`currency-option ${newGroupCurrency === c.code ? "selected" : ""}`}
                        onClick={() => {
                          setNewGroupCurrency(c.code);
                          setShowCurrencyDropdown(false);
                          setCurrencySearch("");
                        }}
                      >
                        <span className="currency-symbol">{c.symbol}</span>
                        <span className="currency-code">{c.code}</span>
                        <span className="currency-name">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName}
              className="primary-btn"
            >
              Создать группу
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {pendingInvite && (
        <div className="modal-overlay">
          <div className="modal invite-modal">
            <div className="invite-icon">👥</div>
            <h3>Приглашение в группу</h3>
            <div className="invite-group-name">{pendingInvite.name}</div>
            <div className="invite-details">
              <span>{pendingInvite.membersCount} участник(ов)</span>
              <span>•</span>
              <span>
                {getCurrencySymbol(pendingInvite.currency)}{" "}
                {pendingInvite.currency}
              </span>
            </div>
            <p className="invite-question">Хотите присоединиться?</p>
            <div className="invite-buttons">
              <button
                className="decline-btn"
                onClick={handleDeclineInvite}
                disabled={inviteLoading}
              >
                Нет
              </button>
              <button
                className="accept-btn"
                onClick={handleAcceptInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? "..." : "Да"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      {showAddExpense && groupBalance && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowAddExpense(false);
            setEditingExpense(null);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingExpense ? "Редактировать" : "Новый расход"}</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowAddExpense(false);
                  setEditingExpense(null);
                }}
              >
                ✕
              </button>
            </div>

            <input
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              placeholder="Описание (например: Ужин)"
              autoFocus
            />
            <input
              type="number"
              value={expenseAmount || ""}
              onChange={(e) => setExpenseAmount(Number(e.target.value))}
              placeholder={`Сумма в ${getCurrencySymbol(groupBalance.group.currency)}`}
            />

            <span className="label">Разделить между:</span>
            <div className="participants-list">
              {Object.entries(groupBalance.balances).map(([uid]) => (
                <button
                  key={uid}
                  className={`participant-chip ${selectedParticipants.includes(uid) ? "selected" : ""}`}
                  onClick={() => toggleParticipant(uid)}
                >
                  {groupBalance.userNames?.[uid] || "Участник"}
                  {uid === user?.id && " (вы)"}
                </button>
              ))}
            </div>

            {selectedParticipants.length > 0 && expenseAmount > 0 && (
              <p className="split-info">
                По {(expenseAmount / selectedParticipants.length).toFixed(0)}{" "}
                {getCurrencySymbol(groupBalance.group.currency)} на человека
              </p>
            )}

            <button
              onClick={handleAddExpense}
              disabled={!expenseAmount || selectedParticipants.length === 0}
              className="primary-btn"
            >
              {editingExpense ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {showSettle && groupBalance && (
        <div className="modal-overlay" onClick={() => setShowSettle(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Погасить долг</h3>
              <button
                className="close-btn"
                onClick={() => setShowSettle(false)}
              >
                ✕
              </button>
            </div>

            <span className="label">Кому вы перевели:</span>
            <div className="participants-list">
              {Object.entries(groupBalance.balances)
                .filter(([uid]) => uid !== user?.id)
                .map(([uid]) => (
                  <button
                    key={uid}
                    className={`participant-chip ${settleToUser === uid ? "selected" : ""}`}
                    onClick={() => setSettleToUser(uid)}
                  >
                    {groupBalance.userNames?.[uid] || "Участник"}
                  </button>
                ))}
            </div>

            <input
              type="number"
              value={settleAmount || ""}
              onChange={(e) => setSettleAmount(Number(e.target.value))}
              placeholder={`Сумма в ${getCurrencySymbol(groupBalance.group.currency)}`}
            />

            <button
              onClick={handleSettle}
              disabled={!settleToUser || !settleAmount}
              className="primary-btn"
            >
              Отметить перевод
            </button>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && currentGroup && (
        <div className="modal-overlay" onClick={() => setShowEditGroup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать группу</h3>
              <button
                className="close-btn"
                onClick={() => setShowEditGroup(false)}
              >
                ✕
              </button>
            </div>

            <input
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              placeholder="Название группы"
            />

            <div className="currency-select">
              <div
                className="currency-input"
                onClick={() =>
                  setShowEditCurrencyDropdown(!showEditCurrencyDropdown)
                }
              >
                <span>
                  {getCurrencySymbol(editGroupCurrency)} {editGroupCurrency}
                </span>
                <span className="arrow">▼</span>
              </div>

              {showEditCurrencyDropdown && (
                <div className="currency-dropdown">
                  <div className="currency-list">
                    {CURRENCIES.map((c) => (
                      <div
                        key={c.code}
                        className={`currency-option ${editGroupCurrency === c.code ? "selected" : ""}`}
                        onClick={() => {
                          setEditGroupCurrency(c.code);
                          setShowEditCurrencyDropdown(false);
                        }}
                      >
                        <span className="currency-symbol">{c.symbol}</span>
                        <span className="currency-code">{c.code}</span>
                        <span className="currency-name">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleUpdateGroup}
              disabled={!editGroupName}
              className="primary-btn"
            >
              Сохранить
            </button>

            <button
              onClick={() => setShowDeleteConfirm("group")}
              className="danger-btn"
            >
              🗑️ Удалить группу
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="confirm-icon">⚠️</div>
            <h3>Подтверждение</h3>
            <p>
              {showDeleteConfirm === "group"
                ? "Удалить группу и все её траты?"
                : "Удалить этот расход?"}
            </p>
            <div className="confirm-buttons">
              <button
                className="decline-btn"
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeletingExpenseId(null);
                }}
              >
                Отмена
              </button>
              <button
                className="danger-btn"
                onClick={
                  showDeleteConfirm === "group"
                    ? handleDeleteGroup
                    : handleDeleteExpense
                }
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
