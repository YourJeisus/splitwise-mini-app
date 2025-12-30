import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { createApiClient } from "./api";
import type {
  User,
  Group,
  GroupBalance,
  Expense,
  GroupTransaction,
  TripSummary,
  Receipt,
} from "./api";
import { AdminApp } from "./admin/AdminApp";
import {
  Icons,
  SwipeableExpense,
  SwipeableGroup,
  OnboardingProvider,
  CoachmarkOverlay,
} from "./components";
import { markTipSeen } from "./utils/onboarding";
import {
  CURRENCIES,
  getCurrencySymbol,
  DEV_USERS,
  getGroupColor,
  getGroupIcon,
} from "./constants";
import { formatDate } from "./utils";
import type { Tab, InviteInfo } from "./types";

function App() {
  const isAdminPath = window.location.pathname.startsWith("/admin");

  // Render admin panel if on /admin path (before any hooks for clean early return)
  if (isAdminPath) {
    return <AdminApp />;
  }

  return <MainApp />;
}

function MainApp() {
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);

  // Создание группы
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCurrency, setNewGroupCurrency] = useState("RUB");
  const [newGroupHomeCurrency, setNewGroupHomeCurrency] = useState("");
  const [newGroupImage, setNewGroupImage] = useState<File | null>(null);
  const [newGroupImagePreview, setNewGroupImagePreview] = useState<string>("");
  const [currencySearch, setCurrencySearch] = useState("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showHomeCurrencyDropdown, setShowHomeCurrencyDropdown] =
    useState(false);

  // Приглашение в группу
  const [pendingInvite, setPendingInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Выбранная группа
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupBalance, setGroupBalance] = useState<GroupBalance | null>(null);
  const [groupExpenses, setGroupExpenses] = useState<GroupTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("balance");

  // Trip Pass
  const [tripPassStatus, setTripPassStatus] = useState<{
    active: boolean;
    endsAt?: string;
  } | null>(null);
  const [tripPassBuying, setTripPassBuying] = useState(false);
  const [tripPassUpsell, setTripPassUpsell] = useState<null | {
    reason: "scan" | "fx" | "close" | "soft";
  }>(null);
  const [tripPassComingSoon, setTripPassComingSoon] = useState<null | {
    title: string;
  }>(null);
  const [, setTripPassSplitCost] = useState(false);
  const [showTripPassSplitModal, setShowTripPassSplitModal] = useState(false);
  const [lastPurchaseId, setLastPurchaseId] = useState<string | null>(null);

  // Receipt scanning flow
  type ScanStep = "select" | "processing" | "edit" | "distribute" | "confirm";
  const [scanStep, setScanStep] = useState<ScanStep | null>(null);
  const [, setScanImage] = useState<File | null>(null);
  interface ScanItem {
    id: string;
    name: string;
    quantity: number; // количество
    totalPrice: number; // итого за все единицы (источник истины)
    unitPrice?: number; // цена за единицу (опционально, вычисляемое)
    distribution: Record<string, number>; // userId -> qty (распределение по количеству)
    needsReview?: boolean; // подсветка сомнительных
  }
  const [scanResult, setScanResult] = useState<{
    amount?: number;
    currency?: string;
    date?: string;
    description?: string;
    items: ScanItem[];
    warnings?: string[];
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPaidBy, setScanPaidBy] = useState<string | null>(null); // userId who paid
  const [showScanPaidByDropdown, setShowScanPaidByDropdown] = useState(false);
  const [scanSplitParticipants, setScanSplitParticipants] = useState<string[]>(
    []
  ); // для деления поровну
  const [scanPrevDistribution, setScanPrevDistribution] = useState<
    Record<string, number>[] | null
  >(null); // для toggle "взять всё"
  const [scanProcessingMsgIndex, setScanProcessingMsgIndex] = useState(0);
  const scanProcessingMessages = [
    "Смотрим, что тут вкусного и за сколько",
    "Разбираемся, кто ел больше всех",
    "Считаем, чтобы потом не спорить",
    "Ищем, где тут кофе за 700",
    "Пытаемся понять этот чек",
    "Переводим чек с ресторанного",
    "Сводим дебет с обедом",
    "Чек думает, мы помогаем",
    "Почти готово, деньги уже считаются",
    "Сейчас всё аккуратно разложим",
    "Немного магии, немного математики",
    "Делаем из бумажки порядок",
    "Превращаем чек в справедливость",
  ];

  // Receipt claim modal (для просмотра и claim позиций участниками)
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [receiptClaimLoading, setReceiptClaimLoading] = useState(false);
  // Шаг проверки перед финализацией
  const [showFinalizeReview, setShowFinalizeReview] = useState(false);
  // Ручное распределение: { itemId: { userId: quantity } }
  const [manualDistribution, setManualDistribution] = useState<
    Record<string, Record<string, number>>
  >({});

  // Trip Summary (Итоги поездки)
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [tripSummary, setTripSummary] = useState<TripSummary | null>(null);
  const [tripSummaryLoading, setTripSummaryLoading] = useState(false);

  // Dev invite link
  const [devInviteLink, setDevInviteLink] = useState("");

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
  const [editGroupHomeCurrency, setEditGroupHomeCurrency] = useState("");
  const [editGroupImage, setEditGroupImage] = useState<File | null>(null);
  const [editGroupImagePreview, setEditGroupImagePreview] =
    useState<string>("");
  const [showEditCurrencyDropdown, setShowEditCurrencyDropdown] =
    useState(false);
  const [showEditHomeCurrencyDropdown, setShowEditHomeCurrencyDropdown] =
    useState(false);

  // Подтверждение удаления
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<
    "group" | "expense" | null
  >(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null
  );
  const [showCloseGroupConfirm, setShowCloseGroupConfirm] = useState(false);

  // Подтверждение выхода из группы
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<string | null>(null);

  // Статусы загрузки фото и сохранения
  const [imageUploadStatus, setImageUploadStatus] = useState<
    "idle" | "uploading" | "done"
  >("idle");
  const [_savingSettings, setSavingSettings] = useState(false);

  // Тост подсказка для добавления на главный экран
  const [showHomeScreenTip, setShowHomeScreenTip] = useState(false);
  const [showActiveGroupsLimit, setShowActiveGroupsLimit] = useState(false);
  const [showAboutProduct, setShowAboutProduct] = useState(false);

  // Admin Grant Banner
  const [adminGrantBanner, setAdminGrantBanner] = useState<{
    durationDays: number;
  } | null>(null);

  const api = useMemo(
    () => createApiClient(initData || import.meta.env.VITE_TG_INIT_DATA || ""),
    [initData]
  );

  const devSwitcherEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("dev") === "1";
    } catch {
      return false;
    }
  }, []);

  const devSwitcherAutoEnabled = useMemo(() => {
    try {
      // Only auto-enable on localhost
      const hostname = window.location.hostname;
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }, []);

  const isDevSession = useCallback(() => {
    const data =
      initData || (import.meta.env.VITE_TG_INIT_DATA as string) || "";
    return data.startsWith("dev_");
  }, [initData]);

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

  const activeGroups = useMemo(() => {
    return groups.filter((g) => !g.closedAt);
  }, [groups]);

  const archivedGroups = useMemo(() => {
    return groups.filter((g) => Boolean(g.closedAt));
  }, [groups]);

  // Флаг: показывать второе отображение в домашней валюте
  const showHomeAmount = useMemo(() => {
    if (!tripPassStatus?.active) return false;
    if (!groupBalance?.group.homeCurrency) return false;
    if (!groupBalance?.group.homeFxRate) return false;
    if (
      groupBalance.group.homeCurrency === groupBalance.group.settlementCurrency
    )
      return false;
    return true;
  }, [tripPassStatus, groupBalance]);

  // Конвертация суммы из валюты поездки в домашнюю
  const toHomeAmount = useCallback(
    (settlementAmount: number): number | null => {
      if (!showHomeAmount || !groupBalance?.group.homeFxRate) return null;
      // homeFxRate = сколько homeCurrency за 1 settlementCurrency
      // homeApprox = settlementAmount * homeFxRate
      return settlementAmount * groupBalance.group.homeFxRate;
    },
    [showHomeAmount, groupBalance]
  );

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

  const handleDevInviteLink = useCallback(async () => {
    if (!devInviteLink.trim()) return;
    // Extract invite code from link like https://t.me/PopolamAppBot?startapp=CODE
    const match = devInviteLink.match(/startapp=([a-zA-Z0-9-]+)/);
    const code = match ? match[1] : devInviteLink.trim();
    if (code) {
      await checkInviteCode(code);
      setDevInviteLink("");
    }
  }, [devInviteLink, checkInviteCode]);

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
          "--safe-area-top",
          `${safeArea.top || 0}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-bottom",
          `${safeArea.bottom || 0}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-left",
          `${safeArea.left || 0}px`
        );
        document.documentElement.style.setProperty(
          "--safe-area-right",
          `${safeArea.right || 0}px`
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
    
    // Reset onboarding via URL parameter for testing
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset_onboarding') === '1') {
      Object.keys(localStorage)
        .filter(key => key.startsWith('onboarding:v1'))
        .forEach(key => localStorage.removeItem(key));
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }
  }, [api]);

  // Смена сообщений при сканировании чека
  useEffect(() => {
    if (scanStep !== "processing") {
      setScanProcessingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setScanProcessingMsgIndex(
        (prev) => (prev + 1) % scanProcessingMessages.length
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [scanStep]);

  const switchDevUser = (devId: string) => {
    setInitData(devId);
    setUser(null);
    setGroups([]);
    setSelectedGroup("");
    setGroupBalance(null);
    setGroupExpenses([]);
    setTripPassStatus(null);
    setTripPassSplitCost(false);
  };

  const bootstrap = async () => {
    try {
      const me = await api.verify();
      setUser(me);
      const groupList = await api.listGroups();
      setGroups(groupList);

      // Trigger first group creation tip if no groups
      if (groupList.length === 0) {
        // Condition is already in Provider, but we make sure context is fresh
      }

      // Проверяем наличие баннера от админа
      const banner = await api.getAdminGrantBanner();
      if (banner) {
        setAdminGrantBanner({ durationDays: banner.durationDays });
      }

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
    const isFirstGroup = groups.length === 0;
    try {
      await api.createGroup({
        name: newGroupName,
        settlementCurrency: newGroupCurrency,
        homeCurrency: newGroupHomeCurrency || undefined,
        image: newGroupImage || undefined,
      });
      setNewGroupName("");
      setNewGroupHomeCurrency("");
      setNewGroupImage(null);
      setNewGroupImagePreview("");
      setShowCreateGroup(false);
      setImageUploadStatus("idle");
      const updated = await api.listGroups();
      setGroups(updated);
      if (updated[0]) {
        await handleSelectGroup(updated[0].id);
      }
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      markTipSeen("create-group-empty");
      markTipSeen("create-group-plus");

      // Показываем подсказку после создания первой группы
      if (isFirstGroup) {
        setShowHomeScreenTip(true);
        setTimeout(() => setShowHomeScreenTip(false), 8000);
      }
    } catch (error) {
      const message = (error as Error).message;
      if (
        message.includes(
          "Для нескольких поездок одновременно удобнее Trip Pass или подписка"
        )
      ) {
        setShowCreateGroup(false);
        setShowActiveGroupsLimit(true);
        return;
      }
      alert(`Ошибка: ${message}`);
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
      } else if (
        message.includes(
          "Для нескольких поездок одновременно удобнее Trip Pass или подписка"
        )
      ) {
        setPendingInvite(null);
        setShowActiveGroupsLimit(true);
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
    setTripPassUpsell(null);
    setTripPassComingSoon(null);
    const [balance, expenses, tpStatus] = await Promise.all([
      api.getGroupBalance(groupId),
      api.getGroupExpenses(groupId),
      api.getTripPassStatus(groupId),
    ]);
    setGroupBalance(balance);
    setGroupExpenses(expenses);
    setTripPassStatus(tpStatus);
    setTripPassSplitCost(false);
    setSelectedParticipants(Object.keys(balance.balances));
  };

  const handleCopyInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = "PopolamAppBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    navigator.clipboard.writeText(link);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

    markTipSeen("invite-copy");

    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 3000);
  };

  const handleShareInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = "PopolamAppBot";
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    const text = `Присоединяйся к группе "${groupBalance.group.name}" в JeisusSplit!`;
    window.Telegram?.WebApp?.openTelegramLink?.(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    );
    markTipSeen("invite-share");
  };

  const openTripPassUpsellModal = (
    reason: "scan" | "fx" | "close" | "soft"
  ) => {
    setTripPassComingSoon(null);
    setTripPassUpsell({ reason });
  };

  const _openTripPassComingSoonModal = (title: string) => {
    setTripPassUpsell(null);
    setTripPassComingSoon({ title });
  };
  void _openTripPassComingSoonModal;

  const handleBuyTripPass = async (openSummaryAfter = false) => {
    if (!selectedGroup) return;
    try {
      setTripPassBuying(true);
      const { invoiceLink, purchaseId } = await api.createTripPassInvoice({
        groupId: selectedGroup,
        splitCost: false,
      });

      const afterPurchase = async () => {
        const [status, balance] = await Promise.all([
          api.getTripPassStatus(selectedGroup),
          api.getGroupBalance(selectedGroup),
        ]);
        setTripPassStatus(status);
        setGroupBalance(balance);
        setTripPassUpsell(null);
        setTripPassBuying(false);
        if (status.active) {
          setLastPurchaseId(purchaseId);
          setShowTripPassSplitModal(true);
        }
        if (openSummaryAfter && status.active) {
          const summary = await api.getTripSummary(selectedGroup);
          setTripSummary(summary);
          setShowTripSummary(true);
        }
      };

      if (!invoiceLink) {
        await api.devConfirmTripPass(purchaseId);
        await afterPurchase();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = window.Telegram?.WebApp as any;
      if (wa?.openInvoice && invoiceLink) {
        setTripPassBuying(false);
        wa.openInvoice(invoiceLink, async (status: string) => {
          if (status !== "paid") return;
          try {
            await afterPurchase();
          } finally {
            setTripPassBuying(false);
          }
        });
        return;
      }

      if (isDevSession()) {
        await api.devConfirmTripPass(purchaseId);
        await afterPurchase();
        return;
      }

      throw new Error("openInvoice недоступен");
    } catch (error) {
      setTripPassBuying(false);
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const openTripSummary = async () => {
    if (!selectedGroup) return;
    setTripSummaryLoading(true);
    try {
      const summary = await api.getTripSummary(selectedGroup);
      setTripSummary(summary);
      setShowTripSummary(true);
      setTripPassUpsell(null);
      setTripPassComingSoon(null);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    } finally {
      setTripSummaryLoading(false);
    }
  };

  const handleCloseTripFromSummary = async () => {
    if (!selectedGroup) return;
    try {
      await api.closeGroup(selectedGroup);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      // Перезагружаем данные
      const [summary, balance, tpStatus, updatedGroups] = await Promise.all([
        api.getTripSummary(selectedGroup),
        api.getGroupBalance(selectedGroup),
        api.getTripPassStatus(selectedGroup),
        api.listGroups(),
      ]);
      setTripSummary(summary);
      setGroupBalance(balance);
      setTripPassStatus(tpStatus);
      setGroups(updatedGroups);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
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
        // Для чеков обновляем только название
        if (editingExpense.category === "receipt") {
          await api.updateExpense(editingExpense.id, {
            description: expenseTitle || "Чек",
          });
        } else if (editingExpense.systemType === "TRIP_PASS_FEE") {
          // Для Trip Pass Fee обновляем только shares
          await api.updateExpense(editingExpense.id, { shares });
        } else {
          await api.updateExpense(editingExpense.id, {
            description: expenseTitle || "Расход",
            amount: expenseAmount,
            shares,
          });
        }
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
    setEditGroupHomeCurrency(groupBalance?.group.homeCurrency || "");
    setEditGroupImage(null);
    setEditGroupImagePreview("");
    setShowEditGroup(true);
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup || !editGroupName) return;

    try {
      setSavingSettings(true);
      await api.updateGroup(selectedGroup, {
        name: editGroupName,
        settlementCurrency: editGroupCurrency,
        homeCurrency: editGroupHomeCurrency || undefined,
        image: editGroupImage || undefined,
      });

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, updatedGroups, tpStatus] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.listGroups(),
        api.getTripPassStatus(selectedGroup),
      ]);
      setGroupBalance(balance);
      setGroups(updatedGroups);
      setTripPassStatus(tpStatus);

      alert("Настройки сохранены");
      setShowEditGroup(false);
      setEditGroupImage(null);
      setEditGroupImagePreview("");
      setImageUploadStatus("idle");
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCloseGroup = async () => {
    if (!selectedGroup) return;
    try {
      await api.closeGroup(selectedGroup);
      setShowCloseGroupConfirm(false);
      setShowEditGroup(false);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, expenses, tpStatus, updatedGroups] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.getGroupExpenses(selectedGroup),
        api.getTripPassStatus(selectedGroup),
        api.listGroups(),
      ]);
      setGroupBalance(balance);
      setGroupExpenses(expenses);
      setTripPassStatus(tpStatus);
      setGroups(updatedGroups);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleReopenGroup = async () => {
    if (!selectedGroup) return;
    try {
      await api.reopenGroup(selectedGroup);
      setShowEditGroup(false);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const [balance, expenses, tpStatus, updatedGroups] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.getGroupExpenses(selectedGroup),
        api.getTripPassStatus(selectedGroup),
        api.listGroups(),
      ]);
      setGroupBalance(balance);
      setGroupExpenses(expenses);
      setTripPassStatus(tpStatus);
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

  const handleLeaveGroup = async (groupId: string) => {
    try {
      await api.leaveGroup(groupId);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");

      const updatedGroups = await api.listGroups();
      setGroups(updatedGroups);

      if (selectedGroup === groupId) {
        setSelectedGroup("");
        setGroupBalance(null);
        setGroupExpenses([]);
        if (updatedGroups[0]) {
          await handleSelectGroup(updatedGroups[0].id);
        }
      }
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const getUserInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Общая сумма по валютам: мне должны (положительные балансы)
  const getTotalOwedToMeByCurrency = () => {
    const byCurrency: Record<string, number> = {};
    groups.forEach((g) => {
      const currency = g.settlementCurrency || g.currency || "RUB";
      const positive = Math.max(0, g.userBalance || 0);
      if (positive > 0) {
        byCurrency[currency] = (byCurrency[currency] || 0) + positive;
      }
    });
    return byCurrency;
  };

  // Общая сумма по валютам: я должен (отрицательные балансы)
  const getTotalIOweByCurrency = () => {
    const byCurrency: Record<string, number> = {};
    groups.forEach((g) => {
      const currency = g.settlementCurrency || g.currency || "RUB";
      const negative = Math.abs(Math.min(0, g.userBalance || 0));
      if (negative > 0) {
        byCurrency[currency] = (byCurrency[currency] || 0) + negative;
      }
    });
    return byCurrency;
  };

  // Форматирование сумм по валютам в массив для рендера
  const formatByCurrencyLines = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency);
    if (entries.length === 0) return [{ amount: 0, symbol: "₽" }];
    return entries.map(([cur, amount]) => ({
      amount: Math.round(amount),
      symbol: getCurrencySymbol(cur),
    }));
  };

  // Расчёт что я должен/мне должны по конкретному расходу
  const getMyExpenseShare = (expense: Expense) => {
    if (!user) return { type: "none" as const, amount: 0, payer: "" };

    const myShare = expense.shares.find((s) => s.userId === user.id);
    const isPayer = myShare && Number(myShare.paid) > 0;

    if (isPayer) {
      // Я заплатил — мне должны (сумма owed других участников)
      const lent = expense.shares
        .filter((s) => s.userId !== user.id)
        .reduce((sum, s) => sum + Number(s.owed), 0);
      return { type: "lent" as const, amount: lent, payer: "Вы заплатили" };
    } else if (myShare) {
      // Я не платил, но участвую — я должен
      const payerShare = expense.shares.find((s) => Number(s.paid) > 0);
      const payerName =
        payerShare?.user?.firstName || payerShare?.user?.username || "Кто-то";
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

  const handleDismissAdminGrantBanner = async () => {
    try {
      await api.dismissAdminGrantBanner();
      setAdminGrantBanner(null);
    } catch (error) {
      console.error("Error dismissing banner:", error);
    }
  };

  const isModalOpen = useMemo(() => {
    return (
      showCreateGroup ||
      showAddExpense ||
      showSettle ||
      showEditGroup ||
      showTripSummary ||
      !!viewingReceipt ||
      !!pendingInvite ||
      showLeaveConfirm !== null ||
      showActiveGroupsLimit ||
      showAboutProduct ||
      !!tripPassUpsell ||
      showTripPassSplitModal
    );
  }, [
    showCreateGroup,
    showAddExpense,
    showSettle,
    showEditGroup,
    showTripSummary,
    viewingReceipt,
    pendingInvite,
    showLeaveConfirm,
    showActiveGroupsLimit,
    showAboutProduct,
    tripPassUpsell,
    showTripPassSplitModal,
  ]);

  const onboardingContext = useMemo(
    () => ({
      userId: user?.id,
      groupsCount: groups.length,
      selectedGroupId: selectedGroup,
      activeTab,
      hasEditableExpenses: groupExpenses.some(
        (e) => e.type === "expense" && e.createdBy.id === user?.id
      ),
      hasReceiptExpenses: groupExpenses.some(
        (e) => e.type === "expense" && e.category === "receipt"
      ),
      isModalOpen,
    }),
    [user, groups.length, selectedGroup, activeTab, groupExpenses, isModalOpen]
  );

  return (
    <OnboardingProvider context={onboardingContext}>
      <div className="app">
        <CoachmarkOverlay />
      {/* Dev Tools */}
      {import.meta.env.DEV && (
        <div className="dev-panel">
          <details>
            <summary style={{ cursor: 'pointer', padding: '8px', background: '#333', color: '#fff', borderRadius: '4px', marginBottom: '8px' }}>
              🛠️ Dev Tools
            </summary>
            <div style={{ padding: '12px', background: '#2a2a2a', borderRadius: '4px', marginBottom: '8px' }}>
              <button
                onClick={() => {
                  Object.keys(localStorage)
                    .filter(key => key.startsWith('onboarding:v1'))
                    .forEach(key => localStorage.removeItem(key));
                  alert('Онбординг сброшен. Перезагрузите страницу.');
                }}
                style={{ padding: '8px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%' }}
              >
                🔄 Сбросить онбординг
              </button>
            </div>
          </details>
        </div>
      )}

      {showCopyToast && (
        <div className="copy-toast">
          Ссылка на группу скопирована
        </div>
      )}
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
        <button
          className="header-about-btn"
          onClick={() => setShowAboutProduct(true)}
        >
          О продукте
        </button>
      </header>

      {/* Admin Grant Banner */}
      {adminGrantBanner && (
        <div className="admin-grant-banner">
          <div className="admin-grant-banner-content">
            <div className="admin-grant-banner-text">
              Мы ценим, что вы с нами с самого начала.<br />
              В знак благодарности дарим вам <strong>Trip Pass на {adminGrantBanner.durationDays} дней</strong>, он даёт полный доступ ко всем функциям приложения.<br /><br />
              Если появятся вопросы или идеи, пишите в бота поддержки. Ссылка в описании профиля.
            </div>
            <button
              className="admin-grant-banner-btn"
              onClick={handleDismissAdminGrantBanner}
            >
              Спасибо
            </button>
          </div>
        </div>
      )}

      {inviteError && (
        <div className="invite-error">
          <span>{inviteError}</span>
          <button onClick={() => setInviteError(null)}>✕</button>
        </div>
      )}

      {/* Dev User Switcher */}
      {(devSwitcherEnabled || devSwitcherAutoEnabled || isDevSession()) && (
        <div className="dev-panel">
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
          <div className="dev-invite-row">
            <input
              value={devInviteLink}
              onChange={(e) => setDevInviteLink(e.target.value)}
              placeholder="Вставьте invite ссылку или код"
              className="dev-invite-input"
              onKeyDown={(e) => e.key === "Enter" && handleDevInviteLink()}
            />
            <button
              className="dev-invite-btn"
              onClick={handleDevInviteLink}
              disabled={!devInviteLink.trim()}
            >
              →
            </button>
          </div>
          {selectedGroup && (
            <label className="dev-checkbox-row">
              <input
                type="checkbox"
                checked={tripPassStatus?.active ?? false}
                onChange={async (e) => {
                  try {
                    const status = await api.devToggleTripPass(
                      selectedGroup,
                      e.target.checked
                    );
                    setTripPassStatus(status);
                    const updatedGroups = await api.listGroups();
                    setGroups(updatedGroups);
                  } catch (err) {
                    alert(`Ошибка: ${(err as Error).message}`);
                  }
                }}
              />
              <span>Trip Pass активен</span>
            </label>
          )}
        </div>
      )}

      {/* Hero Card - общий баланс */}
      <div className="hero-card compact">
        <div className="hero-row">
          <div className="hero-stat">
            <span className="hero-stat-label">Всего вам должны</span>
            <div className="hero-stat-values">
              {formatByCurrencyLines(getTotalOwedToMeByCurrency()).map(
                (line, i) => (
                  <span key={i} className="hero-stat-value positive">
                    {line.amount} {line.symbol}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">Всего вы должны</span>
            <div className="hero-stat-values">
              {formatByCurrencyLines(getTotalIOweByCurrency()).map(
                (line, i) => (
                  <span key={i} className="hero-stat-value negative">
                    {line.amount} {line.symbol}
                  </span>
                )
              )}
            </div>
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
              data-onb="create-group-plus"
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
              {currentGroup.imageUrl ? (
                <img
                  src={currentGroup.imageUrl}
                  alt={currentGroup.name}
                  className="group-item-image"
                />
              ) : (
                <div
                  className={`group-item-icon ${getGroupColor(groups.findIndex((g) => g.id === currentGroup.id))}`}
                >
                  {getGroupIcon(
                    groups.findIndex((g) => g.id === currentGroup.id)
                  )}
                </div>
              )}
              <div className="group-item-content">
                <div className="group-item-name">{currentGroup.name}</div>
                <div className="group-item-meta">
                  {getCurrencySymbol(currentGroup.currency)}
                  {currentGroup.hasTripPass && !currentGroup.closedAt && (
                    <span className="group-trip-pass-badge">Trip Pass</span>
                  )}
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

          {/* Другие активные группы */}
          {activeGroups.some((g) => g.id !== selectedGroup) && (
            <div className="group-list">
              {activeGroups
                .filter((g) => g.id !== selectedGroup)
                .map((g) => (
                  <SwipeableGroup
                    key={g.id}
                    canLeave={g.createdById !== user?.id}
                    onLeave={() => setShowLeaveConfirm(g.id)}
                    onClick={() => handleSelectGroup(g.id)}
                  >
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt={g.name}
                        className="group-item-image"
                      />
                    ) : (
                      <div
                        className={`group-item-icon ${getGroupColor(groups.indexOf(g))}`}
                      >
                        {getGroupIcon(groups.indexOf(g))}
                      </div>
                    )}
                    <div className="group-item-content">
                      <div className="group-item-name">{g.name}</div>
                      <div className="group-item-meta">
                        {getCurrencySymbol(g.currency)}
                        {g.hasTripPass && !g.closedAt && (
                          <span className="group-trip-pass-badge">
                            Trip Pass
                          </span>
                        )}
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
                  </SwipeableGroup>
                ))}
            </div>
          )}

          {/* Архивные группы */}
          {archivedGroups.some((g) => g.id !== selectedGroup) && (
            <>
              <button
                className="archived-toggle"
                onClick={() => setShowArchivedGroups(!showArchivedGroups)}
              >
                {Icons.archive}
                <span>
                  Архивные группы (
                  {archivedGroups.filter((g) => g.id !== selectedGroup).length})
                </span>
                {showArchivedGroups ? Icons.chevronUp : Icons.chevronDown}
              </button>

              {showArchivedGroups && (
                <div className="group-list archived">
                  {archivedGroups
                    .filter((g) => g.id !== selectedGroup)
                    .map((g) => (
                      <SwipeableGroup
                        key={g.id}
                        canLeave={g.createdById !== user?.id}
                        onLeave={() => setShowLeaveConfirm(g.id)}
                        onClick={() => {
                          handleSelectGroup(g.id);
                          setShowArchivedGroups(false);
                        }}
                      >
                        {g.imageUrl ? (
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            className="group-item-image"
                          />
                        ) : (
                          <div
                            className={`group-item-icon ${getGroupColor(groups.indexOf(g))}`}
                          >
                            {getGroupIcon(groups.indexOf(g))}
                          </div>
                        )}
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
                      </SwipeableGroup>
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
                    data-onb="invite-copy"
                    onClick={handleCopyInviteLink}
                    title="Копировать ссылку"
                  >
                    {Icons.copy}
                  </button>
                  <button
                    className="icon-btn"
                    data-onb="invite-share"
                    onClick={handleShareInviteLink}
                    title="Поделиться"
                  >
                    {Icons.share}
                  </button>
                </div>
              </div>

              {groupBalance.expensesCount > 0 && (
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={openTripSummary}
                  disabled={tripSummaryLoading}
                >
                  {tripSummaryLoading ? "Загрузка..." : "Посчитать итоги"}
                </button>
              )}

              {/* Итоги: вам должны / вы должны */}
              <div className="balance-totals">
                {getTotalOwedToMe() > 0 && (
                  <div className="balance-total-row">
                    <span className="balance-total-label">Вам должны</span>
                    <div>
                      <span className="balance-total-amount positive">
                        {getTotalOwedToMe().toFixed(0)}{" "}
                        {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                      {showHomeAmount &&
                        toHomeAmount(getTotalOwedToMe()) !== null && (
                          <div className="approx-amount">
                            ≈ {toHomeAmount(getTotalOwedToMe())!.toFixed(0)}{" "}
                            {getCurrencySymbol(
                              groupBalance.group.homeCurrency!
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}
                {getTotalIOwe() > 0 && (
                  <div className="balance-total-row">
                    <span className="balance-total-label">Вы должны</span>
                    <div>
                      <span className="balance-total-amount negative">
                        {getTotalIOwe().toFixed(0)}{" "}
                        {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                      {showHomeAmount &&
                        toHomeAmount(getTotalIOwe()) !== null && (
                          <div className="approx-amount">
                            ≈ {toHomeAmount(getTotalIOwe())!.toFixed(0)}{" "}
                            {getCurrencySymbol(
                              groupBalance.group.homeCurrency!
                            )}
                          </div>
                        )}
                    </div>
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
                      <div style={{ textAlign: "right" }}>
                        <span className="debt-amount positive">
                          {debt.amount.toFixed(0)}{" "}
                          {getCurrencySymbol(groupBalance.group.currency)}
                        </span>
                        {showHomeAmount &&
                          toHomeAmount(debt.amount) !== null && (
                            <div className="approx-amount">
                              ≈ {toHomeAmount(debt.amount)!.toFixed(0)}{" "}
                              {getCurrencySymbol(
                                groupBalance.group.homeCurrency!
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                  {getDebtsBreakdown().iOwe.map((debt, i) => (
                    <div key={`iowe-${i}`} className="debt-row">
                      <span className="debt-text negative">
                        Вы должны {debt.name}
                      </span>
                      <div style={{ textAlign: "right" }}>
                        <span className="debt-amount negative">
                          {debt.amount.toFixed(0)}{" "}
                          {getCurrencySymbol(groupBalance.group.currency)}
                        </span>
                        {showHomeAmount &&
                          toHomeAmount(debt.amount) !== null && (
                            <div className="approx-amount">
                              ≈ {toHomeAmount(debt.amount)!.toFixed(0)}{" "}
                              {getCurrencySymbol(
                                groupBalance.group.homeCurrency!
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Все балансы участников */}
              <div className="balance-list">
                {Object.entries(groupBalance.balances).map(([uid, balance]) => (
                  <div
                    className={`balance-row ${groupBalance.inactiveMembers?.[uid] ? "inactive" : ""}`}
                    key={uid}
                  >
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
                      {groupBalance.inactiveMembers?.[uid] && (
                        <span className="inactive-badge">вышел</span>
                      )}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span
                        className={`balance-user-amount ${balance >= 0 ? "positive" : "negative"}`}
                      >
                        {balance >= 0 ? "+" : ""}
                        {balance.toFixed(0)}{" "}
                        {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                      {showHomeAmount && toHomeAmount(balance) !== null && (
                        <div className="approx-amount">
                          ≈ {balance >= 0 ? "+" : ""}
                          {toHomeAmount(balance)!.toFixed(0)}{" "}
                          {getCurrencySymbol(groupBalance.group.homeCurrency!)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(groupBalance.balances).length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <p className="empty-state-text">Пока нет участников</p>
                </div>
              )}

              {/* Upsell banner for home currency display */}
              {!tripPassStatus?.active && groupBalance.expensesCount > 0 && (
                <div
                  className="home-currency-upsell"
                  onClick={() => openTripPassUpsellModal("soft")}
                >
                  💱 Показывать суммы в домашней валюте — доступно в Trip Pass
                </div>
              )}

              {/* Hint if Trip Pass active but homeCurrency not set */}
              {tripPassStatus?.active &&
                !groupBalance.group.homeCurrency &&
                groupBalance.expensesCount > 0 && (
                  <div className="home-currency-upsell" onClick={openEditGroup}>
                    ⚙️ Выберите домашнюю валюту в настройках группы
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
                  {groupExpenses.map((item, index) => {
                    const isFirstEditable =
                      item.type === "expense" &&
                      item.createdBy.id === user?.id &&
                      (!item.isSystem || item.systemType === "TRIP_PASS_FEE") &&
                      index === groupExpenses.findIndex(
                        (e) =>
                          e.type === "expense" &&
                          e.createdBy.id === user?.id &&
                          (!e.isSystem || e.systemType === "TRIP_PASS_FEE")
                      );

                    const isFirstReceipt =
                      item.type === "expense" &&
                      item.category === "receipt" &&
                      index === groupExpenses.findIndex(
                        (e) => e.type === "expense" && e.category === "receipt"
                      );

                    return item.type === "settlement" ? (
                      <div
                        key={item.id}
                        className="expense-item settlement-item"
                      >
                        <div className="expense-icon">{Icons.money}</div>
                        <div className="expense-details">
                          <div className="expense-title">Перевод</div>
                          <div className="expense-meta">
                            {item.fromUser.firstName || item.fromUser.username}{" "}
                            → {item.toUser.firstName || item.toUser.username}
                          </div>
                        </div>
                        <div className="expense-right">
                          <div
                            className={`expense-share-amount ${item.fromUser.id === user?.id ? "negative" : item.toUser.id === user?.id ? "positive" : "muted"}`}
                          >
                            {item.fromUser.id === user?.id
                              ? "-"
                              : item.toUser.id === user?.id
                                ? "+"
                                : ""}
                            {Number(item.amount).toFixed(0)}{" "}
                            {getCurrencySymbol(item.currency)}
                          </div>
                          {showHomeAmount &&
                            toHomeAmount(Number(item.amount)) !== null && (
                              <div className="expense-home-amount">
                                ≈{" "}
                                {Number(item.amount) > 0 &&
                                  (item.fromUser.id === user?.id
                                    ? "-"
                                    : item.toUser.id === user?.id
                                      ? "+"
                                      : "")}
                                {toHomeAmount(Number(item.amount))!.toFixed(0)}{" "}
                                {getCurrencySymbol(
                                  groupBalance!.group.homeCurrency!
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ) : (
                      <SwipeableExpense
                        key={item.id}
                        dataOnbId={
                          isFirstEditable
                            ? "expense-swipe"
                            : isFirstReceipt
                              ? "expense-receipt"
                              : undefined
                        }
                        isOwner={
                          item.createdBy.id === user?.id &&
                          (!item.isSystem ||
                            item.systemType === "TRIP_PASS_FEE")
                        }
                        onEdit={() => handleEditExpense(item)}
                        onDelete={() => handleDeleteExpense(item.id)}
                        onSwipeOpen={() => markTipSeen("expense-swipe")}
                        hasReceipt={item.category === "receipt"}
                        onLongPress={async () => {
                          // Открыть модалку для claim позиций чека
                          markTipSeen("receipt-hold");
                          try {
                            const receipt = await api.getReceiptByExpense(
                              item.id
                            );
                            if (receipt) {
                              window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(
                                "medium"
                              );
                              setViewingReceipt(receipt);
                            }
                          } catch (err) {
                            console.error("Failed to load receipt:", err);
                          }
                        }}
                      >
                        <div className="expense-icon">{Icons.receipt}</div>
                        <div className="expense-details">
                          <div className="expense-title">
                            {item.isSystem
                              ? `Сервис: ${item.description}`
                              : item.description}
                          </div>
                          <div className="expense-meta">
                            {getMyExpenseShare(item).payer}{" "}
                            {Number(item.amount).toFixed(0)}{" "}
                            {getCurrencySymbol(item.currency)}
                            {showHomeAmount &&
                              toHomeAmount(Number(item.amount)) !== null && (
                                <span className="expense-meta-home">
                                  {" "}
                                  ≈{" "}
                                  {toHomeAmount(Number(item.amount))!.toFixed(
                                    0
                                  )}{" "}
                                  {getCurrencySymbol(
                                    groupBalance!.group.homeCurrency!
                                  )}
                                </span>
                              )}
                          </div>
                          {item.category === "receipt" && (
                            <div className="expense-hint">
                              Зажмите, чтобы выбрать свои позиции
                            </div>
                          )}
                        </div>
                        <div className="expense-right">
                          {(() => {
                            const share = getMyExpenseShare(item);
                            if (share.type === "lent" && share.amount > 0) {
                              return (
                                <>
                                  <div className="expense-share-label">
                                    вам должны
                                  </div>
                                  <div className="expense-share-amount positive">
                                    {share.amount.toFixed(0)}{" "}
                                    {getCurrencySymbol(item.currency)}
                                  </div>
                                  {showHomeAmount &&
                                    toHomeAmount(share.amount) !== null && (
                                      <div className="expense-home-amount">
                                        ≈ +
                                        {toHomeAmount(share.amount)!.toFixed(0)}{" "}
                                        {getCurrencySymbol(
                                          groupBalance!.group.homeCurrency!
                                        )}
                                      </div>
                                    )}
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
                                    {getCurrencySymbol(item.currency)}
                                  </div>
                                  {showHomeAmount &&
                                    toHomeAmount(share.amount) !== null && (
                                      <div className="expense-home-amount">
                                        ≈ -
                                        {toHomeAmount(share.amount)!.toFixed(0)}{" "}
                                        {getCurrencySymbol(
                                          groupBalance!.group.homeCurrency!
                                        )}
                                      </div>
                                    )}
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
                    );
                  })}
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
            data-onb="create-group-empty"
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
          onClick={() => {
            setShowCreateGroup(false);
            setNewGroupImage(null);
            setNewGroupImagePreview("");
            setImageUploadStatus("idle");
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новая группа</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupImage(null);
                  setNewGroupImagePreview("");
                  setImageUploadStatus("idle");
                }}
              >
                ✕
              </button>
            </div>

            <div className="group-image-upload">
              <input
                type="file"
                id="new-group-image"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageUploadStatus("uploading");
                    setNewGroupImage(file);
                    setNewGroupImagePreview(URL.createObjectURL(file));
                    setTimeout(() => setImageUploadStatus("done"), 500);
                  }
                }}
              />
              <label htmlFor="new-group-image" className="image-upload-label">
                {newGroupImagePreview ? (
                  <img
                    src={newGroupImagePreview}
                    alt="Preview"
                    className="image-preview"
                  />
                ) : (
                  <div className="image-placeholder">
                    <span>📷</span>
                    <span>Добавить фото</span>
                  </div>
                )}
              </label>
              {imageUploadStatus === "uploading" && (
                <div className="image-status">Фото загружается...</div>
              )}
              {imageUploadStatus === "done" && (
                <div className="image-status success">Фото обновлено</div>
              )}
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

            <span className="label">Домашняя валюта (необязательно)</span>
            <div className="currency-select">
              <div
                className="currency-input"
                onClick={() =>
                  setShowHomeCurrencyDropdown(!showHomeCurrencyDropdown)
                }
              >
                <span>
                  {newGroupHomeCurrency
                    ? `${getCurrencySymbol(newGroupHomeCurrency)} ${newGroupHomeCurrency}`
                    : "Не выбрана"}
                </span>
                <span className="arrow">▼</span>
              </div>

              {showHomeCurrencyDropdown && (
                <div className="currency-dropdown">
                  <input
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    placeholder="Поиск валюты..."
                    className="currency-search"
                  />
                  <div className="currency-list">
                    <div
                      className={`currency-option ${!newGroupHomeCurrency ? "selected" : ""}`}
                      onClick={() => {
                        setNewGroupHomeCurrency("");
                        setShowHomeCurrencyDropdown(false);
                        setCurrencySearch("");
                      }}
                    >
                      <span className="currency-symbol">—</span>
                      <span className="currency-code">Нет</span>
                      <span className="currency-name">Не выбрана</span>
                    </div>
                    {filteredCurrencies.map((c) => (
                      <div
                        key={c.code}
                        className={`currency-option ${newGroupHomeCurrency === c.code ? "selected" : ""}`}
                        onClick={() => {
                          setNewGroupHomeCurrency(c.code);
                          setShowHomeCurrencyDropdown(false);
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

            {/* Для Trip Pass Fee скрываем название и сумму */}
            {editingExpense?.systemType !== "TRIP_PASS_FEE" && (
              <input
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Описание (например: Ужин)"
                autoFocus
              />
            )}

            {/* Для чеков и Trip Pass Fee скрываем редактирование суммы */}
            {editingExpense?.category !== "receipt" &&
              editingExpense?.systemType !== "TRIP_PASS_FEE" && (
                <>
                  <input
                    type="number"
                    value={expenseAmount || ""}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    placeholder={`Сумма в ${getCurrencySymbol(groupBalance.group.currency)}`}
                  />

                  <button
                    type="button"
                    className="secondary-btn scan-receipt-btn"
                    onClick={() => {
                      if (tripPassStatus?.active) {
                        setScanStep("select");
                        setScanImage(null);
                        setScanResult(null);
                        setScanError(null);
                      } else {
                        openTripPassUpsellModal("scan");
                      }
                    }}
                  >
                    📷 Сканировать чек{" "}
                    {!tripPassStatus?.active && (
                      <span className="trip-pass-badge">Trip Pass</span>
                    )}
                  </button>
                </>
              )}

            {/* Выбор участников - показываем для обычных расходов и Trip Pass Fee */}
            {editingExpense?.category !== "receipt" && (
              <>
                <span className="label">Разделить между:</span>
                <div className="participants-list">
                  {Object.entries(groupBalance.balances)
                    .filter(([uid]) => !groupBalance.inactiveMembers?.[uid])
                    .map(([uid]) => (
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
                    По{" "}
                    {(expenseAmount / selectedParticipants.length).toFixed(0)}{" "}
                    {getCurrencySymbol(groupBalance.group.currency)} на человека
                  </p>
                )}
              </>
            )}

            {editingExpense?.category === "receipt" && (
              <p className="receipt-edit-hint">
                Для чека можно изменить только название. Распределение позиций
                доступно в самом чеке.
              </p>
            )}

            {editingExpense?.systemType === "TRIP_PASS_FEE" && (
              <p className="receipt-edit-hint">
                Выберите участников, между которыми разделить стоимость Trip
                Pass
              </p>
            )}

            <button
              onClick={handleAddExpense}
              disabled={
                editingExpense?.category === "receipt"
                  ? false
                  : editingExpense?.systemType === "TRIP_PASS_FEE"
                    ? selectedParticipants.length === 0
                    : !expenseAmount || selectedParticipants.length === 0
              }
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
                .filter(
                  ([uid]) =>
                    uid !== user?.id && !groupBalance.inactiveMembers?.[uid]
                )
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
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEditGroup(false);
            setEditGroupImage(null);
            setEditGroupImagePreview("");
            setImageUploadStatus("idle");
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать группу</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowEditGroup(false);
                  setEditGroupImage(null);
                  setEditGroupImagePreview("");
                  setImageUploadStatus("idle");
                }}
              >
                ✕
              </button>
            </div>

            <div className="group-image-upload">
              <input
                type="file"
                id="edit-group-image"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageUploadStatus("uploading");
                    setEditGroupImage(file);
                    setEditGroupImagePreview(URL.createObjectURL(file));
                    setTimeout(() => setImageUploadStatus("done"), 500);
                  }
                }}
              />
              <label htmlFor="edit-group-image" className="image-upload-label">
                {editGroupImagePreview || currentGroup?.imageUrl ? (
                  <img
                    src={editGroupImagePreview || currentGroup?.imageUrl}
                    alt="Preview"
                    className="image-preview"
                  />
                ) : (
                  <div className="image-placeholder">
                    <span>📷</span>
                    <span>Добавить фото</span>
                  </div>
                )}
              </label>
              {imageUploadStatus === "uploading" && (
                <div className="image-status">Фото загружается...</div>
              )}
              {imageUploadStatus === "done" && (
                <div className="image-status success">Фото обновлено</div>
              )}
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

            {/* Trip Pass status */}
            {tripPassStatus?.active && tripPassStatus.endsAt && (
              <div className="trip-pass-status">
                ✨ Trip Pass активен до{" "}
                {new Date(tripPassStatus.endsAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
              </div>
            )}

            {/* Home currency selector (only when Trip Pass is active) */}
            {tripPassStatus?.active && (
              <>
                <span className="label">Домашняя валюта</span>
                <div className="currency-select">
                  <div
                    className="currency-input"
                    onClick={() =>
                      setShowEditHomeCurrencyDropdown(
                        !showEditHomeCurrencyDropdown
                      )
                    }
                  >
                    <span>
                      {editGroupHomeCurrency
                        ? `${getCurrencySymbol(editGroupHomeCurrency)} ${editGroupHomeCurrency}`
                        : "Не выбрана"}
                    </span>
                    <span className="arrow">▼</span>
                  </div>

                  {showEditHomeCurrencyDropdown && (
                    <div className="currency-dropdown">
                      <div className="currency-list">
                        <div
                          className={`currency-option ${!editGroupHomeCurrency ? "selected" : ""}`}
                          onClick={() => {
                            setEditGroupHomeCurrency("");
                            setShowEditHomeCurrencyDropdown(false);
                          }}
                        >
                          <span className="currency-symbol">—</span>
                          <span className="currency-code">Нет</span>
                          <span className="currency-name">Не выбрана</span>
                        </div>
                        {CURRENCIES.map((c) => (
                          <div
                            key={c.code}
                            className={`currency-option ${editGroupHomeCurrency === c.code ? "selected" : ""}`}
                            onClick={() => {
                              setEditGroupHomeCurrency(c.code);
                              setShowEditHomeCurrencyDropdown(false);
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
              </>
            )}

            <button
              onClick={handleUpdateGroup}
              disabled={!editGroupName}
              className="primary-btn"
            >
              Сохранить
            </button>

            {currentGroup?.closedAt ? (
              <button
                type="button"
                onClick={handleReopenGroup}
                className="secondary-btn"
              >
                🔓 Открыть поездку
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCloseGroupConfirm(true)}
                className="primary-btn"
              >
                Закрыть поездку
              </button>
            )}

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

      {/* Close Group Confirmation Modal */}
      {showCloseGroupConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="confirm-icon">✅</div>
            <h3>Закрыть поездку</h3>
            <p>
              Закрыть поездку вручную? Trip Pass для этой группы завершится.
            </p>
            <div className="confirm-buttons">
              <button
                className="decline-btn"
                onClick={() => setShowCloseGroupConfirm(false)}
              >
                Отмена
              </button>
              <button className="accept-btn" onClick={handleCloseGroup}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="confirm-icon">🚪</div>
            <h3>Выход из группы</h3>
            <p>Вы уверены, что хотите выйти из этой группы?</p>
            <div className="confirm-buttons">
              <button
                className="decline-btn"
                onClick={() => setShowLeaveConfirm(null)}
              >
                Отмена
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  handleLeaveGroup(showLeaveConfirm);
                  setShowLeaveConfirm(null);
                }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Groups Limit Modal */}
      {showActiveGroupsLimit && (
        <div
          className="modal-overlay"
          onClick={() => setShowActiveGroupsLimit(false)}
        >
          <div
            className="modal confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon">✨</div>
            <h3>Лимит бесплатной версии</h3>
            <p>
              Для нескольких поездок одновременно удобнее Trip Pass или
              подписка.
            </p>
            <div className="confirm-buttons">
              <button
                className="accept-btn"
                onClick={() => setShowActiveGroupsLimit(false)}
              >
                Ок
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home Screen Tip Toast */}
      {showHomeScreenTip && (
        <div className="toast-tip" onClick={() => setShowHomeScreenTip(false)}>
          <span>📱</span>
          <span>
            Добавьте приложение на главный экран — инструкция в разделе info
            бота
          </span>
        </div>
      )}

      {/* About Product Modal */}
      {showAboutProduct && (
        <div
          className="modal-overlay"
          onClick={() => setShowAboutProduct(false)}
        >
          <div
            className="modal about-product-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>О продукте</h3>
              <button
                className="close-btn"
                onClick={() => setShowAboutProduct(false)}
              >
                ✕
              </button>
            </div>
            <div className="about-product-content">
              <div className="about-section">
                <h4>🆓 Бесплатно</h4>
                <ul className="about-list">
                  <li>Создание и ведение групп</li>
                  <li>Траты вручную</li>
                  <li>Текущий баланс и список трат</li>
                  <li>Участие в распределении чеков</li>
                  <li>Учёт только в валюте поездки</li>
                </ul>
              </div>
              <div className="about-section">
                <h4>✨ Trip Pass</h4>
                <ul className="about-list">
                  <li>Сканирование чеков</li>
                  <li>Распределение по позициям</li>
                  <li>Предварительные и финальные итоги</li>
                  <li>Закрытие поездки и фиксация долгов</li>
                  <li>Домашняя валюта и отчёт</li>
                  <li>SplitCost и быстрые сценарии без рутины</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Pass Upsell Modal */}
      {tripPassUpsell && (
        <div className="modal-overlay" onClick={() => setTripPassUpsell(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {tripPassUpsell.reason === "close"
                  ? "Итоги поездки"
                  : tripPassUpsell.reason === "scan"
                    ? "Сканирование чеков"
                    : "Trip Pass"}
              </h3>
              <button
                className="close-btn"
                onClick={() => setTripPassUpsell(null)}
              >
                ✕
              </button>
            </div>
            <p style={{ marginTop: 0, opacity: 0.9 }}>
              {tripPassUpsell.reason === "scan"
                ? "Добавьте трату за секунды — приложение само распознает сумму, дату и позиции из чека. Ручной ввод всегда доступен бесплатно."
                : tripPassUpsell.reason === "fx"
                  ? "Мультивалютные траты доступны с Trip Pass."
                  : tripPassUpsell.reason === "close"
                    ? "Итоги — это не просто баланс, а финальный разбор поездки: статистика расходов, роли участников и готовый план переводов для закрытия."
                    : "Trip Pass открывает мультивалюту, скан чеков и умные итоги поездки."}
            </p>
            <button
              className="primary-btn trip-pass-buy-btn"
              style={{ width: "100%", marginTop: 6 }}
              onClick={() =>
                handleBuyTripPass(tripPassUpsell.reason === "close")
              }
              disabled={tripPassBuying}
            >
              {tripPassBuying ? (
                "..."
              ) : (
                <>
                  Купить Trip Pass (30 дней)
                  <span className="trip-pass-price">
                    <span className="old-price">200⭐</span>
                    <span className="new-price">100⭐</span>
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Trip Pass Split Cost Modal */}
      {showTripPassSplitModal && lastPurchaseId && (
        <div
          className="modal-overlay"
          onClick={() => setShowTripPassSplitModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 340 }}
          >
            <div className="modal-header">
              <h3>🎉 Trip Pass активирован!</h3>
              <button
                className="close-btn"
                onClick={() => setShowTripPassSplitModal(false)}
              >
                ✕
              </button>
            </div>
            <p style={{ marginTop: 0, opacity: 0.9, fontSize: 14 }}>
              Хотите разделить стоимость Trip Pass между участниками группы?
            </p>
            <button
              className="primary-btn"
              style={{ width: "100%", marginTop: 8 }}
              onClick={async () => {
                try {
                  await api.enableTripPassSplit(lastPurchaseId);
                  const balance = await api.getGroupBalance(selectedGroup);
                  setGroupBalance(balance);
                  setShowTripPassSplitModal(false);
                  setLastPurchaseId(null);
                } catch (err) {
                  alert(`Ошибка: ${(err as Error).message}`);
                }
              }}
            >
              Да, разделить
            </button>
            <button
              className="secondary-btn"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                setShowTripPassSplitModal(false);
                setLastPurchaseId(null);
              }}
            >
              Нет, оплачу сам
            </button>
            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Вы сможете изменить распределение позже, отредактировав трату в
              истории
            </p>
          </div>
        </div>
      )}

      {/* Trip Pass Feature Placeholder */}
      {tripPassComingSoon && (
        <div
          className="modal-overlay"
          onClick={() => setTripPassComingSoon(null)}
        >
          <div
            className="modal confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon">⏳</div>
            <h3>{tripPassComingSoon.title}</h3>
            <p>Функция в разработке</p>
            <div className="confirm-buttons">
              <button
                className="accept-btn"
                onClick={() => setTripPassComingSoon(null)}
              >
                Ок
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Scan Flow */}
      {scanStep && groupBalance && (
        <div
          className="modal-overlay"
          onClick={() => {
            setScanStep(null);
            setScanImage(null);
            setScanResult(null);
            setScanError(null);
            setScanSplitParticipants([]);
            setScanPrevDistribution(null);
          }}
        >
          <div
            className="modal scan-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step: select */}
            {scanStep === "select" && (
              <>
                <div className="modal-header">
                  <h3>📷 Сканировать чек</h3>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setScanStep(null);
                      setScanImage(null);
                      setScanResult(null);
                      setScanError(null);
                      setScanSplitParticipants([]);
                      setScanPrevDistribution(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="scan-hint">Сфотографируйте чек целиком</p>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  id="scan-receipt-input"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setScanImage(file);
                    setScanStep("processing");
                    setScanError(null);
                    setScanPaidBy(user?.id ?? null);
                    try {
                      const result = await api.scanReceipt(selectedGroup, file);
                      const allMemberIds = Object.keys(groupBalance.balances);
                      const items: ScanItem[] = (result.items || []).map(
                        (it: any, i: number) => {
                          const qty = it.qty ?? 1;
                          // totalPrice — источник истины
                          // OCR может дать price (за единицу) или amount (итого)
                          const totalPrice =
                            it.totalPrice ??
                            (it.price ? it.price * qty : (it.amount ?? 0));
                          const unitPrice =
                            it.price ??
                            (totalPrice && qty > 0
                              ? totalPrice / qty
                              : undefined);
                          const distribution: Record<string, number> = {};
                          allMemberIds.forEach((uid) => {
                            distribution[uid] = 0;
                          });
                          return {
                            id: `item-${i}`,
                            name: it.name || `Позиция ${i + 1}`,
                            quantity: qty,
                            totalPrice,
                            unitPrice:
                              unitPrice && unitPrice > 0
                                ? unitPrice
                                : undefined,
                            distribution,
                            needsReview: !totalPrice || totalPrice <= 0,
                          };
                        }
                      );
                      setScanResult({ ...result, items });
                      setScanStep("edit");
                    } catch (err) {
                      setScanError(
                        (err as Error).message || "Ошибка распознавания"
                      );
                      setScanStep("select");
                    }
                  }}
                />
                <label
                  htmlFor="scan-receipt-input"
                  className="primary-btn"
                  style={{
                    display: "block",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  Сделать фото
                </label>
                <input
                  type="file"
                  accept="image/*"
                  id="scan-receipt-gallery"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setScanImage(file);
                    setScanStep("processing");
                    setScanError(null);
                    setScanPaidBy(user?.id ?? null);
                    try {
                      const result = await api.scanReceipt(selectedGroup, file);
                      const allMemberIds = Object.keys(groupBalance.balances);
                      const items: ScanItem[] = (result.items || []).map(
                        (it: any, i: number) => {
                          const qty = it.qty ?? 1;
                          const totalPrice =
                            it.totalPrice ??
                            (it.price ? it.price * qty : (it.amount ?? 0));
                          const unitPrice =
                            it.price ??
                            (totalPrice && qty > 0
                              ? totalPrice / qty
                              : undefined);
                          const distribution: Record<string, number> = {};
                          allMemberIds.forEach((uid) => {
                            distribution[uid] = 0;
                          });
                          return {
                            id: `item-${i}`,
                            name: it.name || `Позиция ${i + 1}`,
                            quantity: qty,
                            totalPrice,
                            unitPrice:
                              unitPrice && unitPrice > 0
                                ? unitPrice
                                : undefined,
                            distribution,
                            needsReview: !totalPrice || totalPrice <= 0,
                          };
                        }
                      );
                      setScanResult({ ...result, items });
                      setScanStep("edit");
                    } catch (err) {
                      setScanError(
                        (err as Error).message || "Ошибка распознавания"
                      );
                      setScanStep("select");
                    }
                  }}
                />
                <label
                  htmlFor="scan-receipt-gallery"
                  className="secondary-btn"
                  style={{
                    display: "block",
                    textAlign: "center",
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  Выбрать из галереи
                </label>
                {scanError && <p className="scan-error">{scanError}</p>}
              </>
            )}

            {/* Step: processing */}
            {scanStep === "processing" && (
              <div className="scan-processing">
                <div className="scan-spinner" />
                <p>{scanProcessingMessages[scanProcessingMsgIndex]}</p>
              </div>
            )}

            {/* Step: edit - редактирование позиций */}
            {scanStep === "edit" && scanResult && (
              <>
                <div className="modal-header">
                  <h3>Проверьте данные</h3>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setScanStep(null);
                      setScanImage(null);
                      setScanResult(null);
                      setScanError(null);
                      setScanSplitParticipants([]);
                      setScanPrevDistribution(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {scanResult.warnings && scanResult.warnings.length > 0 && (
                  <p className="scan-warning">
                    {scanResult.warnings.join(". ")}
                  </p>
                )}
                <div className="scan-form">
                  <div className="scan-row">
                    <label>Название</label>
                    <input
                      type="text"
                      value={scanResult.description ?? ""}
                      onChange={(e) =>
                        setScanResult((prev) =>
                          prev ? { ...prev, description: e.target.value } : prev
                        )
                      }
                      placeholder="Чек"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="scan-row">
                    <label>Сумма</label>
                    <input
                      type="number"
                      value={scanResult.amount ?? ""}
                      onChange={(e) =>
                        setScanResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                amount: Number(e.target.value) || undefined,
                              }
                            : prev
                        )
                      }
                      placeholder="0"
                    />
                    <span className="scan-currency-label">
                      {scanResult.currency ??
                        groupBalance.group.settlementCurrency}
                    </span>
                  </div>
                  <div className="scan-row">
                    <label>Дата</label>
                    <input
                      type="date"
                      value={
                        scanResult.date ??
                        new Date().toISOString().split("T")[0]
                      }
                      onChange={(e) =>
                        setScanResult((prev) =>
                          prev ? { ...prev, date: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                </div>

                <div className="scan-items-edit">
                  <div className="scan-items-header">
                    <span className="label">Позиции</span>
                    <button
                      className="add-item-btn"
                      onClick={() => {
                        const allMemberIds = Object.keys(groupBalance.balances);
                        const distribution: Record<string, number> = {};
                        allMemberIds.forEach((uid) => {
                          distribution[uid] = 0;
                        });
                        setScanResult((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: [
                                  ...prev.items,
                                  {
                                    id: `item-${Date.now()}`,
                                    name: "",
                                    quantity: 1,
                                    totalPrice: 0,
                                    distribution,
                                  },
                                ],
                              }
                            : prev
                        );
                      }}
                    >
                      + Добавить
                    </button>
                  </div>
                  {scanResult.items.length === 0 && (
                    <p className="scan-no-items">
                      Позиции не распознаны. Добавьте вручную или разделите
                      поровну.
                    </p>
                  )}
                  {scanResult.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`scan-item-row ${item.needsReview ? "needs-review" : ""}`}
                    >
                      <input
                        type="text"
                        className="item-name-input"
                        value={item.name}
                        placeholder="Название позиции"
                        onChange={(e) => {
                          const newItems = [...scanResult.items];
                          newItems[idx] = {
                            ...newItems[idx],
                            name: e.target.value,
                          };
                          setScanResult((prev) =>
                            prev ? { ...prev, items: newItems } : prev
                          );
                        }}
                      />
                      <div className="scan-item-row-bottom">
                        <div className="item-qty-controls">
                          <button
                            className="qty-btn"
                            onClick={() => {
                              const newItems = [...scanResult.items];
                              const newQty = Math.max(1, item.quantity - 1);
                              newItems[idx] = {
                                ...newItems[idx],
                                quantity: newQty,
                                // totalPrice не меняется при изменении qty
                              };
                              setScanResult((prev) =>
                                prev ? { ...prev, items: newItems } : prev
                              );
                            }}
                          >
                            −
                          </button>
                          <span className="qty-value">{item.quantity}</span>
                          <button
                            className="qty-btn"
                            onClick={() => {
                              const newItems = [...scanResult.items];
                              const newQty = item.quantity + 1;
                              newItems[idx] = {
                                ...newItems[idx],
                                quantity: newQty,
                              };
                              setScanResult((prev) =>
                                prev ? { ...prev, items: newItems } : prev
                              );
                            }}
                          >
                            +
                          </button>
                        </div>
                        <span className="item-price-label">шт</span>
                        <input
                          type="number"
                          className="item-price-input"
                          value={item.totalPrice || ""}
                          placeholder="Сумма"
                          onChange={(e) => {
                            const newItems = [...scanResult.items];
                            const newTotal = Number(e.target.value) || 0;
                            newItems[idx] = {
                              ...newItems[idx],
                              totalPrice: newTotal,
                              unitPrice:
                                item.quantity > 0
                                  ? newTotal / item.quantity
                                  : undefined,
                              needsReview: newTotal <= 0,
                            };
                            setScanResult((prev) =>
                              prev ? { ...prev, items: newItems } : prev
                            );
                          }}
                        />
                        {item.unitPrice && item.quantity > 1 && (
                          <span className="item-unit-hint">
                            ≈{Math.round(item.unitPrice)}/шт
                          </span>
                        )}
                        <button
                          className="remove-item-btn"
                          onClick={() => {
                            const newItems = scanResult.items.filter(
                              (_, i) => i !== idx
                            );
                            setScanResult((prev) =>
                              prev ? { ...prev, items: newItems } : prev
                            );
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Сверка суммы позиций с итогом */}
                {scanResult.items.length > 0 &&
                  (() => {
                    const itemsSum = scanResult.items.reduce(
                      (sum, it) => sum + it.totalPrice,
                      0
                    );
                    const receiptTotal = scanResult.amount ?? 0;
                    const diff = receiptTotal - itemsSum;
                    const hasDiff = Math.abs(diff) > 0.01;
                    return (
                      <div
                        className={`scan-sum-check ${hasDiff ? "has-diff" : "ok"}`}
                      >
                        <div className="sum-row">
                          <span>Сумма позиций:</span>
                          <span>
                            {itemsSum.toFixed(2)} {scanResult.currency}
                          </span>
                        </div>
                        <div className="sum-row">
                          <span>Итого по чеку:</span>
                          <span>
                            {receiptTotal.toFixed(2)} {scanResult.currency}
                          </span>
                        </div>
                        {hasDiff && (
                          <>
                            <div className="sum-row diff-row">
                              <span>Разница:</span>
                              <span className="diff-value">
                                {diff > 0 ? "+" : ""}
                                {diff.toFixed(2)} {scanResult.currency}
                              </span>
                            </div>
                            <div className="diff-actions">
                              <button
                                className="diff-action-btn"
                                onClick={() => {
                                  // Добавить разницу отдельной строкой
                                  const allMemberIds = Object.keys(
                                    groupBalance.balances
                                  );
                                  const distribution: Record<string, number> =
                                    {};
                                  allMemberIds.forEach((uid) => {
                                    distribution[uid] = 0;
                                  });
                                  setScanResult((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          items: [
                                            ...prev.items,
                                            {
                                              id: `item-diff-${Date.now()}`,
                                              name:
                                                diff > 0
                                                  ? "Доплата/Сервис"
                                                  : "Скидка",
                                              quantity: 1,
                                              totalPrice: diff,
                                              distribution,
                                            },
                                          ],
                                        }
                                      : prev
                                  );
                                }}
                              >
                                Добавить строкой
                              </button>
                              <button
                                className="diff-action-btn"
                                onClick={() => {
                                  // Распределить пропорционально
                                  if (itemsSum === 0) return;
                                  const factor = receiptTotal / itemsSum;
                                  const newItems = scanResult.items.map(
                                    (it) => ({
                                      ...it,
                                      totalPrice: it.totalPrice * factor,
                                      unitPrice:
                                        it.quantity > 0
                                          ? (it.totalPrice * factor) /
                                            it.quantity
                                          : undefined,
                                    })
                                  );
                                  setScanResult((prev) =>
                                    prev ? { ...prev, items: newItems } : prev
                                  );
                                }}
                              >
                                Распределить
                              </button>
                              <button
                                className="diff-action-btn"
                                onClick={() => {
                                  // Изменить итого чека на сумму позиций
                                  setScanResult((prev) =>
                                    prev ? { ...prev, amount: itemsSum } : prev
                                  );
                                }}
                              >
                                Принять сумму позиций
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                <div className="scan-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      // Разделить поровну — убираем позиции и выбираем всех участников
                      setScanResult((prev) =>
                        prev ? { ...prev, items: [] } : prev
                      );
                      setScanSplitParticipants(
                        Object.keys(groupBalance.balances)
                      );
                      setScanStep("confirm");
                    }}
                  >
                    Разделить поровну
                  </button>
                  <button
                    className="primary-btn"
                    disabled={!scanResult.amount}
                    onClick={() => setScanStep("distribute")}
                  >
                    Распределить позиции
                  </button>
                </div>
              </>
            )}

            {/* Step: distribute - выбор СВОИХ позиций */}
            {scanStep === "distribute" && scanResult && (
              <>
                <div className="modal-header">
                  <h3>Что вы брали?</h3>
                  <button
                    className="close-btn"
                    onClick={() => setScanStep("edit")}
                  >
                    ←
                  </button>
                </div>
                <p className="distribute-hint">
                  Выберите позиции, которые вы заказывали. Остальные участники
                  выберут свои позиции позже.
                </p>
                <div className="scan-distribute my-items-only">
                  {scanResult.items.map((item, idx) => {
                    const myId = user?.id || "";
                    const myQty = item.distribution?.[myId] || 0;
                    const unitCost =
                      item.quantity > 0 ? item.totalPrice / item.quantity : 0;
                    const myAmount = myQty > 0 ? unitCost * myQty : 0;

                    return (
                      <div
                        key={item.id}
                        className={`distribute-item-simple ${myQty > 0 ? "selected" : ""}`}
                      >
                        <div className="distribute-item-info">
                          <span className="item-name">
                            {item.name || `Позиция ${idx + 1}`}
                          </span>
                          <span className="item-price">
                            {item.quantity > 1 && (
                              <span className="item-qty-badge">
                                ×{item.quantity}
                              </span>
                            )}
                            {item.totalPrice.toFixed(0)} {scanResult.currency}
                          </span>
                        </div>
                        <div className="my-qty-controls">
                          <button
                            className="qty-btn"
                            disabled={myQty <= 0}
                            onClick={() => {
                              const newItems = [...scanResult.items];
                              const newDist = {
                                ...newItems[idx].distribution,
                              };
                              newDist[myId] = Math.max(0, myQty - 1);
                              newItems[idx] = {
                                ...newItems[idx],
                                distribution: newDist,
                              };
                              setScanResult((prev) =>
                                prev ? { ...prev, items: newItems } : prev
                              );
                            }}
                          >
                            −
                          </button>
                          <span className="qty-value">{myQty}</span>
                          <button
                            className="qty-btn"
                            disabled={myQty >= item.quantity}
                            onClick={() => {
                              const newItems = [...scanResult.items];
                              const newDist = {
                                ...newItems[idx].distribution,
                              };
                              newDist[myId] = Math.min(
                                item.quantity,
                                myQty + 1
                              );
                              newItems[idx] = {
                                ...newItems[idx],
                                distribution: newDist,
                              };
                              setScanResult((prev) =>
                                prev ? { ...prev, items: newItems } : prev
                              );
                            }}
                          >
                            +
                          </button>
                        </div>
                        {myQty > 0 && (
                          <div className="my-item-amount">
                            {myAmount.toFixed(0)} {scanResult.currency}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Итог моего выбора */}
                {(() => {
                  const myId = user?.id || "";
                  const myTotal = scanResult.items.reduce((sum, item) => {
                    const myQty = item.distribution?.[myId] || 0;
                    const unitCost =
                      item.quantity > 0 ? item.totalPrice / item.quantity : 0;
                    return sum + unitCost * myQty;
                  }, 0);
                  const myItemsCount = scanResult.items.filter(
                    (item) => (item.distribution?.[myId] || 0) > 0
                  ).length;

                  return (
                    <div className="my-selection-summary">
                      <span>Выбрано: {myItemsCount} поз.</span>
                      <strong>
                        Ваш итог: {myTotal.toFixed(0)} {scanResult.currency}
                      </strong>
                    </div>
                  );
                })()}

                {(() => {
                  const myId = user?.id || "";
                  const allMine = scanResult.items.every(
                    (item) => (item.distribution?.[myId] || 0) === item.quantity
                  );
                  return (
                    <button
                      className={`take-all-btn ${allMine ? "active" : ""}`}
                      onClick={() => {
                        if (allMine && scanPrevDistribution) {
                          // Восстанавливаем предыдущее состояние
                          const newItems = scanResult.items.map(
                            (item, idx) => ({
                              ...item,
                              distribution: scanPrevDistribution[idx] || {},
                            })
                          );
                          setScanResult((prev) =>
                            prev ? { ...prev, items: newItems } : prev
                          );
                          setScanPrevDistribution(null);
                        } else {
                          // Сохраняем текущее и берём всё себе
                          setScanPrevDistribution(
                            scanResult.items.map((item) => ({
                              ...item.distribution,
                            }))
                          );
                          const newItems = scanResult.items.map((item) => ({
                            ...item,
                            distribution: { [myId]: item.quantity },
                          }));
                          setScanResult((prev) =>
                            prev ? { ...prev, items: newItems } : prev
                          );
                        }
                      }}
                    >
                      {allMine ? "✓ Всё моё" : "Взять всё себе"}
                    </button>
                  );
                })()}

                <button
                  className="primary-btn"
                  onClick={() => setScanStep("confirm")}
                >
                  Далее
                </button>
              </>
            )}

            {/* Step: confirm - финальный предпросмотр */}
            {scanStep === "confirm" && scanResult && (
              <>
                <div className="modal-header">
                  <h3>
                    {scanResult.items.length > 0
                      ? "Подтверждение"
                      : "Разделить поровну"}
                  </h3>
                  <button
                    className="close-btn"
                    onClick={() =>
                      setScanStep(
                        scanResult.items.length > 0 ? "distribute" : "edit"
                      )
                    }
                  >
                    ←
                  </button>
                </div>
                <div className="scan-confirm">
                  <div className="confirm-total">
                    <span>Итого:</span>
                    <strong>
                      {scanResult.amount} {scanResult.currency}
                    </strong>
                  </div>

                  <div className="confirm-payer">
                    <label>Кто заплатил:</label>
                    <div className="payer-select">
                      <div
                        className="payer-input"
                        onClick={() =>
                          setShowScanPaidByDropdown(!showScanPaidByDropdown)
                        }
                      >
                        <span>
                          {scanPaidBy
                            ? groupBalance.userNames[scanPaidBy] || "?"
                            : "Выберите"}
                        </span>
                        <span className="arrow">▼</span>
                      </div>
                      {showScanPaidByDropdown && (
                        <div className="payer-dropdown">
                          <div className="payer-list">
                            {Object.keys(groupBalance.balances).map((uid) => (
                              <div
                                key={uid}
                                className={`payer-option ${scanPaidBy === uid ? "selected" : ""}`}
                                onClick={() => {
                                  setScanPaidBy(uid);
                                  setShowScanPaidByDropdown(false);
                                }}
                              >
                                {groupBalance.userNames[uid] || "?"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Режим с позициями */}
                  {scanResult.items.length > 0 && (
                    <>
                      <div className="confirm-breakdown">
                        <label>Ваш выбор (остальные выберут позже):</label>
                        {(() => {
                          const myId = user?.id;
                          const myItems = scanResult.items.filter(
                            (item) => (item.distribution?.[myId || ""] || 0) > 0
                          );
                          const myTotal = myItems.reduce((sum, item) => {
                            const myQty = item.distribution?.[myId || ""] || 0;
                            const unitCost =
                              item.quantity > 0
                                ? item.totalPrice / item.quantity
                                : 0;
                            return sum + unitCost * myQty;
                          }, 0);

                          return (
                            <div className="my-selection">
                              {myItems.length > 0 ? (
                                <>
                                  <ul className="my-items-list">
                                    {myItems.map((item) => {
                                      const myQty =
                                        item.distribution?.[myId || ""] || 0;
                                      const unitCost =
                                        item.quantity > 0
                                          ? item.totalPrice / item.quantity
                                          : 0;
                                      return (
                                        <li key={item.id}>
                                          <span>
                                            {item.name} ×{myQty}
                                          </span>
                                          <span>
                                            {(unitCost * myQty).toFixed(0)}{" "}
                                            {scanResult.currency}
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <div className="my-total">
                                    <strong>Ваш итог:</strong>
                                    <strong>
                                      {myTotal.toFixed(0)} {scanResult.currency}
                                    </strong>
                                  </div>
                                </>
                              ) : (
                                <p className="no-selection">
                                  Вы не выбрали ни одной позиции
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="confirm-note">
                        <p>
                          💡 После сохранения другие участники смогут открыть
                          этот чек и выбрать свои позиции
                        </p>
                      </div>
                    </>
                  )}

                  {/* Режим поровну */}
                  {scanResult.items.length === 0 && (
                    <>
                      <div className="split-participants-section">
                        <label>Разделить между:</label>
                        <div className="participants-list">
                          {Object.entries(groupBalance.balances)
                            .filter(
                              ([uid]) => !groupBalance.inactiveMembers?.[uid]
                            )
                            .map(([uid]) => (
                              <button
                                key={uid}
                                className={`participant-chip ${scanSplitParticipants.includes(uid) ? "selected" : ""}`}
                                onClick={() => {
                                  setScanSplitParticipants((prev) =>
                                    prev.includes(uid)
                                      ? prev.filter((id) => id !== uid)
                                      : [...prev, uid]
                                  );
                                }}
                              >
                                {groupBalance.userNames?.[uid] || "Участник"}
                                {uid === user?.id && " (вы)"}
                              </button>
                            ))}
                        </div>
                      </div>

                      {scanSplitParticipants.length > 0 &&
                        scanResult.amount && (
                          <div className="split-breakdown">
                            <div className="split-per-person">
                              <span>На каждого:</span>
                              <strong>
                                {(
                                  scanResult.amount /
                                  scanSplitParticipants.length
                                ).toFixed(0)}{" "}
                                {scanResult.currency}
                              </strong>
                            </div>
                            <div className="split-list">
                              {scanSplitParticipants.map((uid) => (
                                <div key={uid} className="split-row">
                                  <span>
                                    {groupBalance.userNames?.[uid] ||
                                      "Участник"}
                                  </span>
                                  <span>
                                    {(
                                      scanResult.amount! /
                                      scanSplitParticipants.length
                                    ).toFixed(0)}{" "}
                                    {scanResult.currency}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </>
                  )}
                </div>

                <button
                  className="primary-btn"
                  disabled={
                    !scanResult.amount ||
                    !scanPaidBy ||
                    (scanResult.items.length === 0 &&
                      scanSplitParticipants.length === 0)
                  }
                  onClick={async () => {
                    try {
                      if (scanResult.items.length > 0) {
                        // Режим с позициями
                        const myId = user?.id;
                        const myClaims: Array<{
                          itemIndex: number;
                          quantity: number;
                        }> = [];
                        scanResult.items.forEach((item, idx) => {
                          const myQty = item.distribution?.[myId || ""] || 0;
                          if (myQty > 0) {
                            myClaims.push({ itemIndex: idx, quantity: myQty });
                          }
                        });

                        // Проверяем, взял ли пользователь все на себя
                        const allMine = scanResult.items.every(
                          (item) =>
                            (item.distribution?.[myId || ""] || 0) ===
                            item.quantity
                        );

                        const receipt = await api.createReceipt({
                          groupId: selectedGroup,
                          description: scanResult.description || "Чек",
                          totalAmount: scanResult.amount ?? 0,
                          currency:
                            scanResult.currency ||
                            groupBalance.group.settlementCurrency ||
                            "USD",
                          date: scanResult.date,
                          paidByUserId: scanPaidBy!,
                          items: scanResult.items.map((item) => ({
                            name: item.name,
                            quantity: item.quantity,
                            totalPrice: item.totalPrice,
                            unitPrice: item.unitPrice,
                          })),
                          myClaims,
                        });

                        // Если все позиции на себя - автоматически финализируем чек
                        if (allMine && receipt?.id) {
                          await api.finalizeReceipt(receipt.id);
                        }
                      } else {
                        // Режим поровну - создаём обычный расход
                        const owed =
                          scanResult.amount! / scanSplitParticipants.length;
                        const shares = scanSplitParticipants.map((uid) => ({
                          userId: uid,
                          paid: uid === scanPaidBy ? scanResult.amount! : 0,
                          owed,
                        }));
                        // Если плательщик не в списке участников
                        if (!scanSplitParticipants.includes(scanPaidBy!)) {
                          shares.push({
                            userId: scanPaidBy!,
                            paid: scanResult.amount!,
                            owed: 0,
                          });
                        }
                        await api.createExpense({
                          groupId: selectedGroup,
                          description: scanResult.description || "Чек",
                          amount: scanResult.amount!,
                          currency:
                            scanResult.currency ||
                            groupBalance.group.settlementCurrency ||
                            "RUB",
                          shares,
                        });
                      }
                      setScanStep(null);
                      setScanImage(null);
                      setScanResult(null);
                      setScanError(null);
                      setScanPaidBy(null);
                      setScanSplitParticipants([]);
                      setScanPrevDistribution(null);
                      handleSelectGroup(selectedGroup);
                    } catch (err) {
                      setScanError(
                        (err as Error).message || "Ошибка сохранения"
                      );
                    }
                  }}
                >
                  Сохранить чек
                </button>
                {scanError && <p className="scan-error">{scanError}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Receipt Claim Modal - для просмотра и claim позиций участниками */}
      {viewingReceipt && (
        <div className="modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div
            className="modal receipt-claim-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="receipt-claim-sticky">
              <div className="modal-header">
                <h3>🧾 {viewingReceipt.expense.description}</h3>
                <button
                  className="close-btn"
                  onClick={() => setViewingReceipt(null)}
                >
                  ✕
                </button>
              </div>

              <div className="receipt-claim-actions">
                {/* Кнопка сохранения для участников (не создателя) */}
                {viewingReceipt.expense.createdBy.id !== user?.id &&
                  viewingReceipt.status !== "FINALIZED" && (
                    <button
                      className="primary-btn"
                      onClick={() => {
                        setViewingReceipt(null);
                        // Обновляем данные группы
                        if (selectedGroup) {
                          handleSelectGroup(selectedGroup);
                        }
                      }}
                    >
                      Сохранить мой выбор
                    </button>
                  )}

                {/* Кнопка перехода к проверке/финализации для создателя */}
                {viewingReceipt.expense.createdBy.id === user?.id &&
                  viewingReceipt.status !== "FINALIZED" && (
                    <button
                      className="primary-btn"
                      disabled={receiptClaimLoading}
                      onClick={() => {
                        // Инициализируем ручное распределение пустым
                        setManualDistribution({});
                        setShowFinalizeReview(true);
                      }}
                    >
                      {viewingReceipt.stats.isFullyDistributed
                        ? "Закрыть чек"
                        : "Проверить и закрыть чек"}
                    </button>
                  )}

                {viewingReceipt.status === "FINALIZED" && (
                  <div className="receipt-finalized-notice">
                    ✓ Чек закрыт, расчёты применены
                  </div>
                )}
              </div>
            </div>

            <div className="receipt-claim-info">
              <div className="receipt-claim-total">
                <span>Итого:</span>
                <strong>
                  {viewingReceipt.totalAmount} {viewingReceipt.currency}
                </strong>
              </div>
              <div className="receipt-claim-status">
                <span>Статус:</span>
                <span
                  className={`status-badge ${viewingReceipt.status.toLowerCase()}`}
                >
                  {viewingReceipt.status === "PENDING"
                    ? "Ожидает распределения"
                    : viewingReceipt.status === "DISTRIBUTED"
                      ? "Распределён"
                      : "Закрыт"}
                </span>
              </div>
              <div className="receipt-claim-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(viewingReceipt.stats.totalClaimed / viewingReceipt.totalAmount) * 100}%`,
                    }}
                  />
                </div>
                <span>
                  {viewingReceipt.stats.totalClaimed.toFixed(0)} /{" "}
                  {viewingReceipt.totalAmount} {viewingReceipt.currency}{" "}
                  распределено
                </span>
              </div>
              {/* Кто отметился */}
              <div className="receipt-claimed-users">
                <span className="claimed-label">Отметились:</span>
                <div className="claimed-avatars">
                  {viewingReceipt.members.map((member) => {
                    const hasClaimed =
                      viewingReceipt.stats.claimedUserIds?.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        className={`claimed-avatar ${hasClaimed ? "claimed" : "pending"}`}
                        title={`${member.firstName || member.username || "?"} — ${hasClaimed ? "отметился" : "ожидает"}`}
                      >
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" />
                        ) : (
                          <span>
                            {(member.firstName || member.username || "?")[0]}
                          </span>
                        )}
                        {hasClaimed && <span className="check-mark">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="receipt-claim-items">
              <h4>Выберите свои позиции:</h4>
              {viewingReceipt.items.map((item) => {
                const myClaim = item.claims.find((c) => c.userId === user?.id);
                const myQty = myClaim?.quantity || 0;
                const canClaimMore = item.remainingQuantity > 0 || myQty > 0;
                const unitCost = item.totalPrice / item.quantity;

                return (
                  <div
                    key={item.id}
                    className={`receipt-claim-item ${item.isFullyClaimed && myQty === 0 ? "fully-claimed" : ""}`}
                  >
                    <div className="claim-item-info">
                      <div className="claim-item-name">{item.name}</div>
                      <div className="claim-item-price">
                        {item.quantity > 1 && (
                          <span className="claim-item-qty">
                            ×{item.quantity} ={" "}
                          </span>
                        )}
                        {item.totalPrice.toFixed(0)} {viewingReceipt.currency}
                      </div>
                      {item.claims.length > 0 && (
                        <div className="claim-item-claimers">
                          {item.claims.map((c) => (
                            <span
                              key={c.userId}
                              className={`claimer-chip ${c.userId === user?.id ? "me" : ""}`}
                            >
                              {c.user.firstName || c.user.username || "?"} ×
                              {c.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="claim-item-controls">
                      {canClaimMore && viewingReceipt.status !== "FINALIZED" ? (
                        <>
                          <button
                            className="qty-btn"
                            disabled={myQty === 0 || receiptClaimLoading}
                            onClick={async () => {
                              setReceiptClaimLoading(true);
                              try {
                                const updated = await api.claimReceiptItems({
                                  receiptId: viewingReceipt.id,
                                  claims: [
                                    { itemId: item.id, quantity: myQty - 1 },
                                  ],
                                });
                                setViewingReceipt(updated);
                              } catch (err) {
                                console.error("Claim error:", err);
                              }
                              setReceiptClaimLoading(false);
                            }}
                          >
                            −
                          </button>
                          <span className="qty-value">{myQty}</span>
                          <button
                            className="qty-btn"
                            disabled={
                              item.remainingQuantity === 0 ||
                              receiptClaimLoading
                            }
                            onClick={async () => {
                              setReceiptClaimLoading(true);
                              try {
                                const updated = await api.claimReceiptItems({
                                  receiptId: viewingReceipt.id,
                                  claims: [
                                    { itemId: item.id, quantity: myQty + 1 },
                                  ],
                                });
                                setViewingReceipt(updated);
                              } catch (err) {
                                console.error("Claim error:", err);
                              }
                              setReceiptClaimLoading(false);
                            }}
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <span className="claim-status">
                          {item.isFullyClaimed ? "✓" : "—"}
                        </span>
                      )}
                    </div>
                    {myQty > 0 && (
                      <div className="my-claim-amount">
                        Ваша доля: {(unitCost * myQty).toFixed(0)}{" "}
                        {viewingReceipt.currency}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Распределение по всем участникам */}
            <div className="receipt-all-shares">
              <h4>
                Распределение
                {viewingReceipt.stats.isPreliminary ? " (предв.)" : ""}:
              </h4>
              <div className="shares-list">
                {viewingReceipt.members.map((member) => {
                  const owed = viewingReceipt.stats.owedByUser[member.id] || 0;
                  const hasClaimed =
                    viewingReceipt.stats.claimedUserIds?.includes(member.id);
                  const isMe = member.id === user?.id;
                  return (
                    <div
                      key={member.id}
                      className={`share-row ${isMe ? "me" : ""} ${!hasClaimed ? "not-claimed" : ""}`}
                    >
                      <div className="share-user">
                        <div className="share-avatar">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" />
                          ) : (
                            <span>
                              {(member.firstName || member.username || "?")[0]}
                            </span>
                          )}
                        </div>
                        <span className="share-name">
                          {isMe
                            ? "Вы"
                            : member.firstName || member.username || "?"}
                          {!hasClaimed && (
                            <span className="not-marked"> (не отметился)</span>
                          )}
                        </span>
                      </div>
                      <span className="share-amount">
                        {owed.toFixed(0)} {viewingReceipt.currency}
                      </span>
                    </div>
                  );
                })}
              </div>
              {viewingReceipt.stats.isPreliminary && (
                <div className="preliminary-notice">
                  * Нераспределённые позиции временно поделены поровну
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finalize Review Modal - шаг проверки перед закрытием чека */}
      {showFinalizeReview &&
        viewingReceipt &&
        (() => {
          // Нераспределённые позиции
          const unclaimedItems = viewingReceipt.items.filter(
            (item) => item.remainingQuantity > 0
          );
          const hasUnclaimed = unclaimedItems.length > 0;

          // Рассчитываем итоговое распределение с учётом ручных правок
          const calculateFinalOwed = () => {
            const owedByUser: Record<string, number> = {};
            viewingReceipt.members.forEach((m) => (owedByUser[m.id] = 0));

            for (const item of viewingReceipt.items) {
              const unitCost = item.totalPrice / item.quantity;

              // Учитываем существующие claims
              for (const claim of item.claims) {
                owedByUser[claim.userId] =
                  (owedByUser[claim.userId] || 0) + unitCost * claim.quantity;
              }

              // Учитываем ручное распределение
              const manualForItem = manualDistribution[item.id] || {};
              let manuallyDistributed = 0;
              for (const [uid, qty] of Object.entries(manualForItem)) {
                owedByUser[uid] = (owedByUser[uid] || 0) + unitCost * qty;
                manuallyDistributed += qty;
              }

              // Оставшееся после claims и ручного распределения — поровну
              const claimedQty = item.claims.reduce(
                (sum, c) => sum + c.quantity,
                0
              );
              const stillUnclaimed =
                item.quantity - claimedQty - manuallyDistributed;
              if (stillUnclaimed > 0) {
                const perPerson =
                  (unitCost * stillUnclaimed) / viewingReceipt.members.length;
                viewingReceipt.members.forEach((m) => {
                  owedByUser[m.id] = (owedByUser[m.id] || 0) + perPerson;
                });
              }
            }

            return owedByUser;
          };

          const finalOwed = calculateFinalOwed();

          // Обработчик изменения ручного распределения
          const handleManualChange = (
            itemId: string,
            userId: string,
            delta: number
          ) => {
            setManualDistribution((prev) => {
              const newDist = { ...prev };
              if (!newDist[itemId]) newDist[itemId] = {};
              const current = newDist[itemId][userId] || 0;
              const item = viewingReceipt.items.find((it) => it.id === itemId);
              if (!item) return prev;

              // Сколько уже распределено (claims + manual)
              const claimedQty = item.claims.reduce(
                (sum, c) => sum + c.quantity,
                0
              );
              const manualTotal = Object.values(newDist[itemId]).reduce(
                (sum, q) => sum + q,
                0
              );
              const available =
                item.quantity - claimedQty - manualTotal + current;

              const newQty = Math.max(0, Math.min(current + delta, available));
              newDist[itemId][userId] = newQty;

              return newDist;
            });
          };

          // Финализация с ручными правками
          const handleFinalize = async () => {
            setReceiptClaimLoading(true);
            try {
              // Сначала применяем все ручные распределения как claims от создателя
              for (const [itemId, userDist] of Object.entries(
                manualDistribution
              )) {
                for (const [userId, quantity] of Object.entries(userDist)) {
                  if (quantity > 0) {
                    await api.claimReceiptItems({
                      receiptId: viewingReceipt.id,
                      claims: [{ itemId, quantity }],
                      forUserId: userId, // распределяем для другого пользователя
                    });
                  }
                }
              }
              // Затем финализируем
              const updated = await api.finalizeReceipt(viewingReceipt.id);
              setViewingReceipt(updated);
              setShowFinalizeReview(false);
              if (selectedGroup) {
                handleSelectGroup(selectedGroup);
              }
            } catch (err) {
              console.error("Finalize error:", err);
            }
            setReceiptClaimLoading(false);
          };

          return (
            <div
              className="modal-overlay"
              onClick={() => setShowFinalizeReview(false)}
            >
              <div
                className="modal finalize-review-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Проверка перед закрытием</h3>
                  <button
                    className="close-btn"
                    onClick={() => setShowFinalizeReview(false)}
                  >
                    ✕
                  </button>
                </div>

                {hasUnclaimed ? (
                  <>
                    <div className="finalize-notice">
                      <p>
                        ⚠️ Есть нераспределённые позиции. Вы можете распределить
                        их вручную или оставить автоматическое распределение
                        (поровну).
                      </p>
                    </div>

                    <div className="unclaimed-items">
                      <h4>Нераспределённые позиции:</h4>
                      {unclaimedItems.map((item) => {
                        const claimedQty = item.claims.reduce(
                          (sum, c) => sum + c.quantity,
                          0
                        );
                        const manualForItem = manualDistribution[item.id] || {};
                        const manualTotal = Object.values(manualForItem).reduce(
                          (sum, q) => sum + q,
                          0
                        );
                        const stillUnclaimed =
                          item.quantity - claimedQty - manualTotal;
                        const unitCost = item.totalPrice / item.quantity;

                        return (
                          <div key={item.id} className="unclaimed-item">
                            <div className="unclaimed-item-header">
                              <span className="item-name">{item.name}</span>
                              <span className="item-unclaimed">
                                Осталось: {stillUnclaimed} из {item.quantity} (
                                {(unitCost * stillUnclaimed).toFixed(0)}{" "}
                                {viewingReceipt.currency})
                              </span>
                            </div>
                            {stillUnclaimed > 0 && (
                              <div className="manual-distribution">
                                {viewingReceipt.members.map((member) => {
                                  const manualQty =
                                    manualForItem[member.id] || 0;
                                  return (
                                    <div
                                      key={member.id}
                                      className="manual-dist-row"
                                    >
                                      <span className="dist-user">
                                        {member.firstName ||
                                          member.username ||
                                          "?"}
                                      </span>
                                      <div className="dist-controls">
                                        <button
                                          className="qty-btn"
                                          disabled={manualQty === 0}
                                          onClick={() =>
                                            handleManualChange(
                                              item.id,
                                              member.id,
                                              -1
                                            )
                                          }
                                        >
                                          −
                                        </button>
                                        <span className="qty-value">
                                          {manualQty}
                                        </span>
                                        <button
                                          className="qty-btn"
                                          disabled={stillUnclaimed === 0}
                                          onClick={() =>
                                            handleManualChange(
                                              item.id,
                                              member.id,
                                              1
                                            )
                                          }
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="finalize-notice success">
                    <p>✓ Все позиции распределены участниками.</p>
                  </div>
                )}

                {/* Итоговое распределение */}
                <div className="final-distribution">
                  <h4>Итоговое распределение:</h4>
                  <div className="shares-list">
                    {viewingReceipt.members.map((member) => {
                      const owed = finalOwed[member.id] || 0;
                      const isMe = member.id === user?.id;
                      return (
                        <div
                          key={member.id}
                          className={`share-row ${isMe ? "me" : ""}`}
                        >
                          <div className="share-user">
                            <div className="share-avatar">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt="" />
                              ) : (
                                <span>
                                  {
                                    (member.firstName ||
                                      member.username ||
                                      "?")[0]
                                  }
                                </span>
                              )}
                            </div>
                            <span className="share-name">
                              {isMe
                                ? "Вы"
                                : member.firstName || member.username || "?"}
                            </span>
                          </div>
                          <span className="share-amount">
                            {owed.toFixed(0)} {viewingReceipt.currency}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="finalize-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => setShowFinalizeReview(false)}
                  >
                    Назад
                  </button>
                  <button
                    className="primary-btn"
                    disabled={receiptClaimLoading}
                    onClick={handleFinalize}
                  >
                    {receiptClaimLoading ? "Закрываю..." : "Закрыть чек"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Trip Summary Screen */}
      {showTripSummary &&
        tripSummary &&
        groupBalance &&
        (() => {
          // Подготовка данных для графиков
          const dailyData = tripSummary.charts.dailySpending;
          const maxDailyAmount = Math.max(...dailyData.map((d) => d.amount), 1);
          const memberData = tripSummary.charts.spendingByMember;
          const totalPaid = memberData.reduce((s, m) => s + m.paid, 0);
          const pieColors = [
            "#b39ddb",
            "#81c784",
            "#ffab91",
            "#a8d8ea",
            "#f5a3c7",
            "#ffb545",
          ];

          // Режим превью (без Trip Pass)
          const isPreview = !tripPassStatus?.active;

          // Функция для скрытия числа в превью
          const blurValue = (value: number | string) =>
            isPreview ? "•••" : value;

          return (
            <div
              className="modal-overlay trip-summary-overlay"
              onClick={() => setShowTripSummary(false)}
            >
              <div
                className={`trip-summary-screen ${isPreview ? "preview-mode" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="trip-summary-header">
                  <h2>📊 Итоги поездки</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowTripSummary(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* Preview Banner */}
                {isPreview && (
                  <div className="trip-summary-preview-banner">
                    <span className="preview-banner-icon">🔒</span>
                    <span className="preview-banner-text">
                      Разблокируйте полный отчёт
                    </span>
                    <button
                      className="preview-banner-btn"
                      onClick={() => {
                        setShowTripSummary(false);
                        openTripPassUpsellModal("close");
                      }}
                    >
                      Trip Pass
                    </button>
                  </div>
                )}

                {/* Hero: Ваша доля */}
                <div className="trip-summary-hero">
                  <div className="trip-summary-hero-icon">🎒</div>
                  <div className="trip-summary-hero-label">
                    Ваша доля расходов
                  </div>
                  <div
                    className={`trip-summary-hero-amount ${isPreview ? "blurred" : ""}`}
                  >
                    {blurValue(tripSummary.header.yourTripTotal.toFixed(0))}{" "}
                    {getCurrencySymbol(tripSummary.header.tripCurrency)}
                  </div>
                  {tripSummary.header.homeApprox !== undefined &&
                    tripSummary.header.homeCurrency && (
                      <div
                        className={`trip-summary-hero-approx ${isPreview ? "blurred" : ""}`}
                      >
                        ≈ {blurValue(tripSummary.header.homeApprox.toFixed(0))}{" "}
                        {getCurrencySymbol(tripSummary.header.homeCurrency)}
                      </div>
                    )}
                  <div className="trip-summary-hero-hint">
                    Сколько вы потратили в этой поездке
                  </div>
                </div>

                {/* Блок: Статистика */}
                <div className="trip-summary-block">
                  <div className="trip-summary-block-title">
                    📈 Расходы группы
                  </div>
                  <div className="trip-summary-stats-grid">
                    <div className="stats-card stats-card-total">
                      <span
                        className={`stats-card-value ${isPreview ? "blurred" : ""}`}
                      >
                        {blurValue(
                          tripSummary.spendingStats.groupTotalSpent.toFixed(0)
                        )}
                      </span>
                      <span className="stats-card-label">
                        {getCurrencySymbol(tripSummary.header.tripCurrency)}{" "}
                        потратила группа
                      </span>
                      {tripSummary.header.homeCurrency &&
                        tripSummary.header.homeFxRate && (
                          <span
                            className={`stats-card-home ${isPreview ? "blurred" : ""}`}
                          >
                            ≈{" "}
                            {blurValue(
                              (
                                tripSummary.spendingStats.groupTotalSpent *
                                tripSummary.header.homeFxRate
                              ).toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.homeCurrency)}
                          </span>
                        )}
                    </div>
                    <div className="stats-card">
                      <span
                        className={`stats-card-value ${isPreview ? "blurred" : ""}`}
                      >
                        {blurValue(
                          tripSummary.spendingStats.avgPerPerson.toFixed(0)
                        )}
                      </span>
                      <span className="stats-card-label">
                        {getCurrencySymbol(tripSummary.header.tripCurrency)} в
                        среднем на человека
                      </span>
                      {tripSummary.header.homeCurrency &&
                        tripSummary.header.homeFxRate && (
                          <span
                            className={`stats-card-home ${isPreview ? "blurred" : ""}`}
                          >
                            ≈{" "}
                            {blurValue(
                              (
                                tripSummary.spendingStats.avgPerPerson *
                                tripSummary.header.homeFxRate
                              ).toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.homeCurrency)}
                          </span>
                        )}
                    </div>
                    <div className="stats-card">
                      <span
                        className={`stats-card-value ${isPreview ? "blurred" : ""}`}
                      >
                        {blurValue(
                          tripSummary.spendingStats.avgPerDay.toFixed(0)
                        )}
                      </span>
                      <span className="stats-card-label">
                        {getCurrencySymbol(tripSummary.header.tripCurrency)} в
                        среднем за день
                      </span>
                      {tripSummary.header.homeCurrency &&
                        tripSummary.header.homeFxRate && (
                          <span
                            className={`stats-card-home ${isPreview ? "blurred" : ""}`}
                          >
                            ≈{" "}
                            {blurValue(
                              (
                                tripSummary.spendingStats.avgPerDay *
                                tripSummary.header.homeFxRate
                              ).toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.homeCurrency)}
                          </span>
                        )}
                    </div>
                    <div className="stats-card">
                      <span className="stats-card-value">
                        {dailyData.length}
                      </span>
                      <span className="stats-card-label">дней поездки</span>
                    </div>
                    <div className="stats-card">
                      <span className="stats-card-value">
                        {memberData.length}
                      </span>
                      <span className="stats-card-label">участников</span>
                    </div>
                    <div className="stats-card">
                      <span className="stats-card-value">
                        {tripSummary.spendingStats.expensesCount}
                      </span>
                      <span className="stats-card-label">трат всего</span>
                    </div>
                    <div className="stats-card">
                      <span
                        className={`stats-card-value ${isPreview ? "blurred" : ""}`}
                      >
                        {blurValue(
                          tripSummary.spendingStats.expensesCount > 0
                            ? Math.round(
                                tripSummary.spendingStats.groupTotalSpent /
                                  tripSummary.spendingStats.expensesCount
                              )
                            : 0
                        )}
                      </span>
                      <span className="stats-card-label">
                        {getCurrencySymbol(tripSummary.header.tripCurrency)}{" "}
                        средний чек
                      </span>
                    </div>
                  </div>
                </div>

                {/* Блок: График по дням */}
                {dailyData.length > 1 && (
                  <div className="trip-summary-block">
                    <div className="trip-summary-block-title">
                      📅 Расходы по дням
                    </div>
                    <div className="daily-chart">
                      {dailyData.map((day, i) => {
                        const heightPercent =
                          (day.amount / maxDailyAmount) * 100;
                        const isMax =
                          tripSummary.spendingStats.mostExpensiveDay?.date ===
                          day.date;
                        return (
                          <div key={i} className="daily-chart-bar-wrapper">
                            <div
                              className={`daily-chart-amount ${isPreview ? "blurred" : ""}`}
                            >
                              {blurValue(day.amount.toFixed(0))}
                            </div>
                            <div
                              className={`daily-chart-bar ${isMax ? "daily-chart-bar-max" : ""}`}
                              style={{
                                height: `${Math.max(heightPercent, 8)}%`,
                              }}
                            />
                            <div className="daily-chart-label">
                              {new Date(day.date)
                                .toLocaleDateString("ru-RU", {
                                  day: "numeric",
                                  month: "short",
                                })
                                .replace(".", "")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {tripSummary.spendingStats.mostExpensiveDay && (
                      <div className="daily-chart-legend">
                        🔥 Самый дорогой день:{" "}
                        <strong>
                          {new Date(
                            tripSummary.spendingStats.mostExpensiveDay.date
                          ).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                          })}
                        </strong>{" "}
                        —{" "}
                        <span className={isPreview ? "blurred" : ""}>
                          {blurValue(
                            tripSummary.spendingStats.mostExpensiveDay.amount.toFixed(
                              0
                            )
                          )}
                        </span>{" "}
                        {getCurrencySymbol(tripSummary.header.tripCurrency)}
                      </div>
                    )}
                  </div>
                )}

                {/* Блок: Кто сколько оплатил (Pie Chart) */}
                {memberData.length > 1 && (
                  <div className="trip-summary-block">
                    <div className="trip-summary-block-title">
                      💰 Кто сколько оплатил
                    </div>
                    <div className="pie-chart-container">
                      <div className="pie-chart">
                        <svg viewBox="0 0 100 100" className="pie-chart-svg">
                          {(() => {
                            let cumulative = 0;
                            return memberData.map((member, i) => {
                              const percent =
                                totalPaid > 0
                                  ? (member.paid / totalPaid) * 100
                                  : 0;
                              const startAngle = cumulative * 3.6;
                              cumulative += percent;
                              const endAngle = cumulative * 3.6;

                              const startRad =
                                ((startAngle - 90) * Math.PI) / 180;
                              const endRad = ((endAngle - 90) * Math.PI) / 180;

                              const x1 = 50 + 40 * Math.cos(startRad);
                              const y1 = 50 + 40 * Math.sin(startRad);
                              const x2 = 50 + 40 * Math.cos(endRad);
                              const y2 = 50 + 40 * Math.sin(endRad);

                              const largeArc = percent > 50 ? 1 : 0;

                              if (percent < 0.5) return null;

                              return (
                                <path
                                  key={i}
                                  d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                  fill={pieColors[i % pieColors.length]}
                                />
                              );
                            });
                          })()}
                        </svg>
                      </div>
                      <div className="pie-chart-legend">
                        {memberData.map((member, i) => {
                          const percent =
                            totalPaid > 0 ? (member.paid / totalPaid) * 100 : 0;
                          return (
                            <div key={i} className="pie-legend-item">
                              <span
                                className="pie-legend-color"
                                style={{
                                  background: pieColors[i % pieColors.length],
                                }}
                              />
                              <span className="pie-legend-name">
                                {member.name}
                              </span>
                              <span
                                className={`pie-legend-value ${isPreview ? "blurred" : ""}`}
                              >
                                {blurValue(member.paid.toFixed(0))}{" "}
                                {getCurrencySymbol(
                                  tripSummary.header.tripCurrency
                                )}
                                <span className="pie-legend-percent">
                                  ({blurValue(percent.toFixed(0))}%)
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Блок: Роли в поездке */}
                <div className="trip-summary-block">
                  <div className="trip-summary-block-title">
                    🏆 Кто как участвовал
                  </div>
                  <div className="trip-summary-roles">
                    {tripSummary.roles.topPayer && (
                      <div className="trip-summary-role role-highlight">
                        <span className="role-emoji">💳</span>
                        <div className="role-content">
                          <span className="role-text">
                            <strong className={isPreview ? "blurred" : ""}>
                              {isPreview
                                ? "••••••"
                                : tripSummary.roles.topPayer.name}
                            </strong>{" "}
                            — больше всех платил за группу
                          </span>
                          <span
                            className={`role-detail ${isPreview ? "blurred" : ""}`}
                          >
                            Оплатил расходов на{" "}
                            {blurValue(
                              tripSummary.roles.topPayer.amount.toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.tripCurrency)}
                          </span>
                        </div>
                      </div>
                    )}
                    {tripSummary.roles.mostFrequentParticipant && (
                      <div className="trip-summary-role">
                        <span className="role-emoji">🎯</span>
                        <div className="role-content">
                          <span className="role-text">
                            <strong className={isPreview ? "blurred" : ""}>
                              {isPreview
                                ? "••••••"
                                : tripSummary.roles.mostFrequentParticipant
                                    .name}
                            </strong>{" "}
                            — чаще всех участвовал в тратах
                          </span>
                          <span
                            className={`role-detail ${isPreview ? "blurred" : ""}`}
                          >
                            Был в{" "}
                            {blurValue(
                              tripSummary.roles.mostFrequentParticipant.count
                            )}{" "}
                            общих расходах
                          </span>
                        </div>
                      </div>
                    )}
                    {tripSummary.roles.topCreditor && (
                      <div className="trip-summary-role role-positive">
                        <span className="role-emoji">💚</span>
                        <div className="role-content">
                          <span className="role-text">
                            <strong className={isPreview ? "blurred" : ""}>
                              {isPreview
                                ? "••••••"
                                : tripSummary.roles.topCreditor.name}
                            </strong>{" "}
                            — заплатил больше своей доли
                          </span>
                          <span
                            className={`role-detail ${isPreview ? "blurred" : ""}`}
                          >
                            Ему должны вернуть{" "}
                            {blurValue(
                              tripSummary.roles.topCreditor.amount.toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.tripCurrency)}
                          </span>
                        </div>
                      </div>
                    )}
                    {tripSummary.roles.topDebtor && (
                      <div className="trip-summary-role role-negative">
                        <span className="role-emoji">🧾</span>
                        <div className="role-content">
                          <span className="role-text">
                            <strong className={isPreview ? "blurred" : ""}>
                              {isPreview
                                ? "••••••"
                                : tripSummary.roles.topDebtor.name}
                            </strong>{" "}
                            — заплатил меньше своей доли
                          </span>
                          <span
                            className={`role-detail ${isPreview ? "blurred" : ""}`}
                          >
                            Должен вернуть{" "}
                            {blurValue(
                              tripSummary.roles.topDebtor.amount.toFixed(0)
                            )}{" "}
                            {getCurrencySymbol(tripSummary.header.tripCurrency)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Блок: Финальные расчёты */}
                <div className="trip-summary-block">
                  <div className="trip-summary-block-title">
                    🤝 Финальные расчёты
                  </div>
                  {tripSummary.finalPlan.length === 0 ? (
                    <div className="trip-summary-empty">
                      <span className="empty-icon">✅</span>
                      <span>Все расчёты завершены!</span>
                    </div>
                  ) : (
                    <div className="trip-summary-plan">
                      {tripSummary.finalPlan.map((transfer, i) => (
                        <div key={i} className="trip-summary-transfer">
                          <div className="transfer-users">
                            <span className="transfer-from">
                              {transfer.fromName}
                            </span>
                            <span className="transfer-arrow">→</span>
                            <span className="transfer-to">
                              {transfer.toName}
                            </span>
                          </div>
                          <div className="transfer-amounts">
                            <span
                              className={`transfer-amount ${isPreview ? "blurred" : ""}`}
                            >
                              {blurValue(transfer.amount.toFixed(0))}{" "}
                              {getCurrencySymbol(
                                tripSummary.header.tripCurrency
                              )}
                            </span>
                            {tripSummary.header.homeCurrency &&
                              tripSummary.header.homeFxRate && (
                                <span
                                  className={`transfer-amount-home ${isPreview ? "blurred" : ""}`}
                                >
                                  ≈{" "}
                                  {blurValue(
                                    (
                                      transfer.amount *
                                      tripSummary.header.homeFxRate
                                    ).toFixed(0)
                                  )}{" "}
                                  {getCurrencySymbol(
                                    tripSummary.header.homeCurrency
                                  )}
                                </span>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Блок: Закрытие поездки */}
                {!isPreview && (
                  <div className="trip-summary-block trip-summary-close-block">
                    <div className="trip-summary-block-title">
                      🔒 Закрытие поездки
                    </div>
                    {tripSummary.meta.closedAt ? (
                      <div className="trip-summary-closed-info">
                        <span className="closed-icon">✅</span>
                        <span>
                          Поездка завершена{" "}
                          {new Date(
                            tripSummary.meta.closedAt
                          ).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="trip-summary-close-text">
                          После закрытия все цифры фиксируются, группа станет
                          архивной, но итоги всегда будут доступны.
                        </p>
                        {tripSummary.meta.canClose && (
                          <button
                            className="primary-btn trip-summary-close-btn"
                            onClick={handleCloseTripFromSummary}
                          >
                            Завершить поездку
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
    </OnboardingProvider>
  );
}

export default App;
