import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./App.css";
import { createApiClient } from "./api";
import type { User, Group, GroupBalance, Expense } from "./api";

// Swipeable Expense Component
const SwipeableExpense = ({
  isOwner,
  onEdit,
  onDelete,
  children,
}: {
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isOwner) return;
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || !isOwner) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (diff > 0) {
      setSwipeX(Math.min(diff, 120));
    } else {
      setSwipeX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isOwner) return;
    setIsSwiping(false);
    if (swipeX > 60) {
      setSwipeX(120);
    } else {
      setSwipeX(0);
    }
  };

  const handleClose = () => {
    setSwipeX(0);
  };

  return (
    <div className="swipeable-expense-wrapper">
      <div
        className="expense-item"
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping ? "none" : "transform 0.3s ease",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={swipeX > 0 ? handleClose : undefined}
      >
        {children}
      </div>
      {isOwner && (
        <div
          className="swipe-actions"
          style={{
            width: `${swipeX}px`,
            opacity: swipeX > 30 ? 1 : 0,
          }}
        >
          <button className="swipe-action-btn edit" onClick={onEdit}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M4.5 17.207V19a.5.5 0 0 0 .5.5h1.793a.5.5 0 0 0 .353-.146l8.5-8.5l-2.5-2.5l-8.5 8.5a.5.5 0 0 0-.146.353Z" />
              <path d="M15.09 6.41l2.5 2.5l1.203-1.203a1 1 0 0 0 0-1.414l-1.086-1.086a1 1 0 0 0-1.414 0z" />
            </svg>
          </button>
          <button className="swipe-action-btn delete" onClick={onDelete}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

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

type InviteInfo = {
  id: string;
  name: string;
  currency: string;
  membersCount: number;
  inviteCode: string;
};

const GROUP_COLORS = ["yellow", "blue", "pink", "green", "purple", "orange"];
const GROUP_ICONS = ["👥", "🏠", "✈️", "🎉", "💼", "🍕", "🎮", "🛒"];

const DEV_USERS = [
  { id: "dev_111", name: "Алекс", emoji: "👨‍💻" },
  { id: "dev_222", name: "Мария", emoji: "👩‍💼" },
  { id: "dev_333", name: "Иван", emoji: "👨‍🔧" },
];

const isDevMode = () => {
  const initData = import.meta.env.VITE_TG_INIT_DATA as string;
  return initData?.startsWith("dev_") && !window.Telegram?.WebApp?.initData;
};

// SVG Icons
const Icons = {
  plus: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  // Monefy - для погашения долга
  money: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M39.523 23.115v-4.4a1.003 1.003 0 0 0-1.004-1.003H9.553" />
      <path d="M12.705 14.2h-4.95A2.254 2.254 0 0 0 5.5 16.454h0v24.022a1.93 1.93 0 0 0 1.93 1.93h30.162a1.93 1.93 0 0 0 1.93-1.93v-4.44m2.978 3.93V16.98a2.78 2.78 0 0 0-2.78-2.78h-1.65" />
      <path d="M35.512 33.423a3.843 3.843 0 0 1 0-7.687m0 7.687h4l2.955-1.817m-6.955-5.87h4l2.955-1.816m-5.285-6.39l-2.377-6.134l-15.424 6.226m12.882-5.46l-4.984-6.568l-16.076 11.902" />
      <circle cx="35.161" cy="29.579" r=".634" fill="currentColor" />
    </svg>
  ),
  // EditOutline - редактирование
  edit: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path d="M4.5 17.207V19a.5.5 0 0 0 .5.5h1.793a.5.5 0 0 0 .353-.146l8.5-8.5l-2.5-2.5l-8.5 8.5a.5.5 0 0 0-.146.353Z" />
      <path d="M15.09 6.41l2.5 2.5l1.203-1.203a1 1 0 0 0 0-1.414l-1.086-1.086a1 1 0 0 0-1.414 0z" />
    </svg>
  ),
  // CopyLink - копирование ссылки
  copy: (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor">
      <path d="M11.947 19a4.948 4.948 0 0 1-3.499-8.446l5.106-5.105a4.948 4.948 0 0 1 6.998 6.998l-.553.552l-1.415-1.413l.557-.557a2.95 2.95 0 0 0-.004-4.166a3.02 3.02 0 0 0-4.17 0l-5.104 5.104a2.947 2.947 0 0 0 0 4.17a3.02 3.02 0 0 0 4.17 0l1.414 1.414a4.918 4.918 0 0 1-3.5 1.449" />
      <path d="M19.947 17a4.948 4.948 0 0 1-3.499-8.446L17.001 8l1.414 1.415l-.552.552a2.948 2.948 0 0 0 0 4.169a3.02 3.02 0 0 0 4.17 0l5.105-5.105a2.951 2.951 0 0 0 0-4.168a3.02 3.02 0 0 0-4.17 0l-1.414-1.415a4.948 4.948 0 0 1 6.998 6.998l-5.104 5.103a4.92 4.92 0 0 1-3.5 1.45" />
      <path d="M24 30H4a2.002 2.002 0 0 1-2-2V8a2.002 2.002 0 0 1 2-2h4v2H4v20h20V18h2v10a2.002 2.002 0 0 1-2 2" />
    </svg>
  ),
  // ShareBox - поделиться
  share: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 3v12m0-12L8 7m4-4l4 4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
    </svg>
  ),
  // AccountBalanceWalletOutline - баланс
  balance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 17v2V5zm.615 3q-.67 0-1.143-.472Q4 19.056 4 18.385V5.615q0-.67.472-1.143Q4.944 4 5.615 4h12.77q.67 0 1.143.472q.472.472.472 1.143v2.943h-1V5.615q0-.269-.173-.442T18.385 5H5.615q-.269 0-.442.173T5 5.615v12.77q0 .269.173.442t.442.173h12.77q.269 0 .442-.173t.173-.442v-2.943h1v2.943q0 .67-.472 1.143q-.472.472-1.143.472zm8-4q-.67 0-1.143-.472Q12 15.056 12 14.385v-4.77q0-.67.472-1.143Q12.944 8 13.615 8h5.77q.67 0 1.143.472q.472.472.472 1.143v4.77q0 .67-.472 1.143q-.472.472-1.143.472zm5.77-1q.269 0 .442-.173t.173-.442v-4.77q0-.269-.173-.442T19.385 9h-5.77q-.269 0-.442.173T13 9.615v4.77q0 .269.173.442t.442.173zM16 13.5q.625 0 1.063-.437T17.5 12t-.437-1.062T16 10.5t-1.062.438T14.5 12t.438 1.063T16 13.5" />
    </svg>
  ),
  receipt: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <path d="M8 10h8M8 14h8" />
    </svg>
  ),
  chevronDown: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevronUp: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  ),
  archive: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
    </svg>
  ),
  trash: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  // AccountBalanceWalletOutline - для hero decoration (большой кошелёк)
  wallet: (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 17v2V5zm.615 3q-.67 0-1.143-.472Q4 19.056 4 18.385V5.615q0-.67.472-1.143Q4.944 4 5.615 4h12.77q.67 0 1.143.472q.472.472.472 1.143v2.943h-1V5.615q0-.269-.173-.442T18.385 5H5.615q-.269 0-.442.173T5 5.615v12.77q0 .269.173.442t.442.173h12.77q.269 0 .442-.173t.173-.442v-2.943h1v2.943q0 .67-.472 1.143q-.472.472-1.143.472zm8-4q-.67 0-1.143-.472Q12 15.056 12 14.385v-4.77q0-.67.472-1.143Q12.944 8 13.615 8h5.77q.67 0 1.143.472q.472.472.472 1.143v4.77q0 .67-.472 1.143q-.472.472-1.143.472zm5.77-1q.269 0 .442-.173t.173-.442v-4.77q0-.269-.173-.442T19.385 9h-5.77q-.269 0-.442.173T13 9.615v4.77q0 .269.173.442t.442.173zM16 13.5q.625 0 1.063-.437T17.5 12t-.437-1.062T16 10.5t-1.062.438T14.5 12t.438 1.063T16 13.5" />
    </svg>
  ),
};

function App() {
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);

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

      // Fullscreen mode только для мобильных устройств
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = webApp as any;
      const platform = wa.platform || "";
      const isMobilePlatform =
        platform === "android" ||
        platform === "android_x" ||
        platform === "ios";
      const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (
        (isMobilePlatform || isMobileUA) &&
        !/Windows|Macintosh|Linux/.test(navigator.userAgent) &&
        wa.requestFullscreen
      ) {
        wa.requestFullscreen();
      }

      // Safe area insets - установка CSS переменных
      const setSafeAreaVars = () => {
        const safeArea = wa.safeAreaInset || {};
        const contentSafeArea = wa.contentSafeAreaInset || {};
        document.documentElement.style.setProperty(
          "--tg-safe-area-top",
          `${safeArea.top || 0}px`
        );
        document.documentElement.style.setProperty(
          "--tg-safe-area-bottom",
          `${safeArea.bottom || 0}px`
        );
        document.documentElement.style.setProperty(
          "--tg-content-safe-area-top",
          `${contentSafeArea.top || 0}px`
        );
      };
      setSafeAreaVars();

      // Слушаем изменения viewport
      if (wa.onEvent) {
        wa.onEvent("viewportChanged", setSafeAreaVars);
      }

      setInitData(webApp.initData);

      const startParam = webApp.initDataUnsafe?.start_param;
      if (startParam) {
        sessionStorage.setItem("pendingInviteCode", startParam);
      }
    } else {
      // Dev mode: используем VITE_TG_INIT_DATA из .env
      const devInitData = import.meta.env.VITE_TG_INIT_DATA as string;
      if (devInitData) {
        setInitData(devInitData);
      }
    }
  }, []);

  useEffect(() => {
    if (!api.hasAuth()) return;
    void bootstrap();
  }, [api]);

  const switchDevUser = (devId: string) => {
    setInitData(devId);
    setUser(null);
    setGroups([]);
    setSelectedGroup("");
    setGroupBalance(null);
    setGroupExpenses([]);
  };

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
    const botUsername = "PopolamAppBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    navigator.clipboard.writeText(link);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  };

  const handleShareInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = "PopolamAppBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    const text = `Присоединяйся к группе "${groupBalance.group.name}" в JeisusSplit!`;
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

    // Если плательщик не в списке участников, добавляем его с paid и owed=0
    if (!selectedParticipants.includes(user.id)) {
      shares.push({ userId: user.id, paid: expenseAmount, owed: 0 });
    }

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
    // Берём только участников с owed > 0 (те, между кем делится расход)
    setSelectedParticipants(
      expense.shares.filter((s) => Number(s.owed) > 0).map((s) => s.userId)
    );
    setShowAddExpense(true);
  };

  const handleDeleteExpense = async (expenseId?: string) => {
    const idToDelete = expenseId || deletingExpenseId;
    if (!idToDelete || !selectedGroup) return;

    // Если вызван со свайпа - показать подтверждение
    if (expenseId && !showDeleteConfirm) {
      setDeletingExpenseId(expenseId);
      setShowDeleteConfirm("expense");
      return;
    }

    try {
      await api.deleteExpense(idToDelete);
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
        groupId: selectedGroup,
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

  const getUserInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Общая сумма: мне должны (положительные балансы)
  const getTotalOwedToMeAll = () => {
    return groups.reduce((sum, g) => sum + Math.max(0, g.userBalance || 0), 0);
  };

  // Общая сумма: я должен (отрицательные балансы)
  const getTotalIOweAll = () => {
    return groups.reduce(
      (sum, g) => sum + Math.abs(Math.min(0, g.userBalance || 0)),
      0
    );
  };

  // Расчёт что я должен/мне должны по конкретному расходу
  const getMyExpenseShare = (expense: Expense) => {
    if (!user) return { type: "none" as const, amount: 0, payer: "" };

    const myShare = expense.shares.find((s) => s.userId === user.id);
    const payerShare = expense.shares.find((s) => Number(s.paid) > 0);
    const payerName =
      payerShare?.user?.firstName || payerShare?.user?.username || "Кто-то";
    const isPayer = payerShare?.userId === user.id;

    if (isPayer) {
      // Я заплатил — мне должны (сумма owed других участников)
      const lent = expense.shares
        .filter((s) => s.userId !== user.id)
        .reduce((sum, s) => sum + Number(s.owed), 0);
      return { type: "lent" as const, amount: lent, payer: "Вы заплатили" };
    } else if (myShare) {
      // Я не платил, но участвую — я должен
      return {
        type: "borrowed" as const,
        amount: Number(myShare.owed),
        payer: `${payerName} заплатил(а)`,
      };
    }
    return { type: "none" as const, amount: 0, payer: "" };
  };

  // Расчёт кто кому должен в группе (из данных бэкенда)
  const getDebtsBreakdown = () => {
    if (!groupBalance || !user) return { iOwe: [], owedToMe: [] };

    const iOwe: { name: string; amount: number }[] = [];
    const owedToMe: { name: string; amount: number }[] = [];

    groupBalance.debts?.forEach((debt) => {
      if (debt.fromUserId === user.id) {
        // Я должен кому-то
        iOwe.push({
          name: groupBalance.userNames[debt.toUserId] || "Участник",
          amount: debt.amount,
        });
      } else if (debt.toUserId === user.id) {
        // Мне должны
        owedToMe.push({
          name: groupBalance.userNames[debt.fromUserId] || "Участник",
          amount: debt.amount,
        });
      }
    });

    return { iOwe, owedToMe };
  };

  // Общая сумма которую я должен
  const getTotalIOwe = () => {
    const { iOwe } = getDebtsBreakdown();
    return iOwe.reduce((sum, d) => sum + d.amount, 0);
  };

  // Общая сумма которую мне должны
  const getTotalOwedToMe = () => {
    const { owedToMe } = getDebtsBreakdown();
    return owedToMe.reduce((sum, d) => sum + d.amount, 0);
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
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="avatar-img" />
          ) : (
            <div className="avatar">{user?.firstName?.charAt(0) || "?"}</div>
          )}
          <div className="greeting">
            <span className="greeting-text">
              Привет, {user?.firstName || "Друг"}!
            </span>
            <span className="date-text">Сегодня {formatDate()}</span>
          </div>
        </div>
      </header>

      {inviteError && (
        <div className="invite-error">
          <span>{inviteError}</span>
          <button onClick={() => setInviteError(null)}>✕</button>
        </div>
      )}

      {/* Dev User Switcher */}
      {isDevMode() && (
        <div className="dev-switcher">
          <span className="dev-label">DEV:</span>
          {DEV_USERS.map((devUser) => (
            <button
              key={devUser.id}
              className={`dev-user-btn ${initData === devUser.id ? "active" : ""}`}
              onClick={() => switchDevUser(devUser.id)}
            >
              {devUser.emoji} {devUser.name}
            </button>
          ))}
        </div>
      )}

      {/* Hero Card - общий баланс */}
      <div className="hero-card compact">
        <div className="hero-row">
          <div className="hero-stat">
            <span className="hero-stat-label">Вам должны</span>
            <span className="hero-stat-value positive">
              {getTotalOwedToMeAll().toFixed(0)}{" "}
              {getCurrencySymbol(groups[0]?.currency || "RUB")}
            </span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Вы должны</span>
            <span className="hero-stat-value negative">
              {getTotalIOweAll().toFixed(0)}{" "}
              {getCurrencySymbol(groups[0]?.currency || "RUB")}
            </span>
          </div>
        </div>
        {groups.length > 0 && (
          <div className="hero-groups">
            {groups.slice(0, 4).map((_, i) => (
              <div key={i} className="hero-group-icon">
                {getGroupIcon(i)}
              </div>
            ))}
            {groups.length > 4 && (
              <div className="hero-group-icon more">+{groups.length - 4}</div>
            )}
          </div>
        )}
      </div>

      {/* Groups Section */}
      {groups.length > 0 && (
        <section className="groups-section">
          <div className="groups-header">
            <span className="section-title">Текущая группа</span>
            <button
              className="add-group-btn"
              onClick={() => setShowCreateGroup(true)}
            >
              {Icons.plus}
            </button>
          </div>

          {/* Текущая (выбранная) группа */}
          {currentGroup && (
            <button
              className="group-item active"
              onClick={() => handleSelectGroup(currentGroup.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (currentGroup.createdById === user?.id) {
                  openEditGroup();
                }
              }}
            >
              <div
                className={`group-item-icon ${getGroupColor(groups.findIndex((g) => g.id === currentGroup.id))}`}
              >
                {getGroupIcon(
                  groups.findIndex((g) => g.id === currentGroup.id)
                )}
              </div>
              <div className="group-item-content">
                <div className="group-item-name">{currentGroup.name}</div>
                <div className="group-item-meta">
                  {getCurrencySymbol(currentGroup.currency)}
                </div>
              </div>
              {currentGroup.userBalance !== undefined &&
                currentGroup.userBalance !== 0 && (
                  <div
                    className={`group-item-balance ${currentGroup.userBalance >= 0 ? "positive" : "negative"}`}
                  >
                    {currentGroup.userBalance >= 0 ? "+" : ""}
                    {currentGroup.userBalance.toFixed(0)}
                  </div>
                )}
            </button>
          )}

          {/* Архивные группы */}
          {groups.length > 1 && (
            <>
              <button
                className="archived-toggle"
                onClick={() => setShowArchivedGroups(!showArchivedGroups)}
              >
                {Icons.archive}
                <span>Другие группы ({groups.length - 1})</span>
                {showArchivedGroups ? Icons.chevronUp : Icons.chevronDown}
              </button>

              {showArchivedGroups && (
                <div className="group-list archived">
                  {groups
                    .filter((g) => g.id !== selectedGroup)
                    .map((g) => (
                      <button
                        key={g.id}
                        className="group-item"
                        onClick={() => {
                          handleSelectGroup(g.id);
                          setShowArchivedGroups(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (g.createdById === user?.id) {
                            handleSelectGroup(g.id).then(() => openEditGroup());
                          }
                        }}
                      >
                        <div
                          className={`group-item-icon ${getGroupColor(groups.indexOf(g))}`}
                        >
                          {getGroupIcon(groups.indexOf(g))}
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
              )}
            </>
          )}
        </section>
      )}

      {/* Selected Group Details */}
      {selectedGroup && groupBalance && (
        <>
          {/* Tabs + Actions */}
          <div className="tabs-row">
            <div className="tabs">
              <button
                className={`tab ${activeTab === "balance" ? "active" : ""}`}
                onClick={() => setActiveTab("balance")}
              >
                {Icons.balance} Баланс
              </button>
              <button
                className={`tab ${activeTab === "expenses" ? "active" : ""}`}
                onClick={() => setActiveTab("expenses")}
              >
                {Icons.receipt} Траты ({groupExpenses.length})
              </button>
            </div>
            <div className="tabs-actions">
              <button
                className="tab-action-btn primary"
                onClick={openQuickExpense}
                title="Добавить расход"
              >
                {Icons.plus}
              </button>
              <button
                className="tab-action-btn secondary"
                onClick={() => setShowSettle(true)}
                title="Погасить долг"
              >
                {Icons.money}
              </button>
            </div>
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
                    <button
                      className="icon-btn"
                      onClick={openEditGroup}
                      title="Редактировать"
                    >
                      {Icons.edit}
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    onClick={handleCopyInviteLink}
                    title="Копировать ссылку"
                  >
                    {Icons.copy}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={handleShareInviteLink}
                    title="Поделиться"
                  >
                    {Icons.share}
                  </button>
                </div>
              </div>

              {/* Итоги: вам должны / вы должны */}
              <div className="balance-totals">
                {getTotalOwedToMe() > 0 && (
                  <div className="balance-total-row">
                    <span className="balance-total-label">Вам должны</span>
                    <span className="balance-total-amount positive">
                      {getTotalOwedToMe().toFixed(0)}{" "}
                      {getCurrencySymbol(groupBalance.group.currency)}
                    </span>
                  </div>
                )}
                {getTotalIOwe() > 0 && (
                  <div className="balance-total-row">
                    <span className="balance-total-label">Вы должны</span>
                    <span className="balance-total-amount negative">
                      {getTotalIOwe().toFixed(0)}{" "}
                      {getCurrencySymbol(groupBalance.group.currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Детализация: кто кому должен */}
              {(getDebtsBreakdown().owedToMe.length > 0 ||
                getDebtsBreakdown().iOwe.length > 0) && (
                <div className="debts-breakdown">
                  {getDebtsBreakdown().owedToMe.map((debt, i) => (
                    <div key={`owed-${i}`} className="debt-row">
                      <span className="debt-text positive">
                        {debt.name} должен вам
                      </span>
                      <span className="debt-amount positive">
                        {debt.amount.toFixed(0)}{" "}
                        {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                    </div>
                  ))}
                  {getDebtsBreakdown().iOwe.map((debt, i) => (
                    <div key={`iowe-${i}`} className="debt-row">
                      <span className="debt-text negative">
                        Вы должны {debt.name}
                      </span>
                      <span className="debt-amount negative">
                        {debt.amount.toFixed(0)}{" "}
                        {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Все балансы участников */}
              <div className="balance-list">
                {Object.entries(groupBalance.balances).map(([uid, balance]) => (
                  <div className="balance-row" key={uid}>
                    {groupBalance.userAvatars?.[uid] ? (
                      <img
                        src={groupBalance.userAvatars[uid]!}
                        alt=""
                        className="balance-user-avatar-img"
                      />
                    ) : (
                      <div className="balance-user-avatar">
                        {getUserInitials(groupBalance.userNames?.[uid] || "U")}
                      </div>
                    )}
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
                    <SwipeableExpense
                      key={expense.id}
                      isOwner={expense.createdBy.id === user?.id}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id)}
                    >
                      <div className="expense-icon">{Icons.receipt}</div>
                      <div className="expense-details">
                        <div className="expense-title">
                          {expense.description}
                        </div>
                        <div className="expense-meta">
                          {getMyExpenseShare(expense).payer}{" "}
                          {Number(expense.amount).toFixed(0)}{" "}
                          {getCurrencySymbol(expense.currency)}
                        </div>
                      </div>
                      <div className="expense-right">
                        {(() => {
                          const share = getMyExpenseShare(expense);
                          if (share.type === "lent" && share.amount > 0) {
                            return (
                              <>
                                <div className="expense-share-label">
                                  вам должны
                                </div>
                                <div className="expense-share-amount positive">
                                  {share.amount.toFixed(0)}{" "}
                                  {getCurrencySymbol(expense.currency)}
                                </div>
                              </>
                            );
                          } else if (
                            share.type === "borrowed" &&
                            share.amount > 0
                          ) {
                            return (
                              <>
                                <div className="expense-share-label">
                                  вы должны
                                </div>
                                <div className="expense-share-amount negative">
                                  {share.amount.toFixed(0)}{" "}
                                  {getCurrencySymbol(expense.currency)}
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="expense-share-amount muted">
                              не участвуете
                            </div>
                          );
                        })()}
                      </div>
                    </SwipeableExpense>
                  ))}
                </div>
              )}
            </section>
          )}
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
                    : () => handleDeleteExpense()
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
