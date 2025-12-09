import { useEffect, useMemo, useState, useCallback } from 'react';
import './App.css';
import { createApiClient } from './api';
import type { User, Group, GroupBalance, Expense } from './api';

// Популярные валюты
const CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£' },
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥' },
  { code: 'JPY', name: 'Японская иена', symbol: '¥' },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾' },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏' },
  { code: 'AZN', name: 'Азербайджанский манат', symbol: '₼' },
  { code: 'THB', name: 'Тайский бат', symbol: '฿' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'د.إ' },
];

type Tab = 'balance' | 'expenses';

type InviteInfo = {
  id: string;
  name: string;
  currency: string;
  membersCount: number;
  inviteCode: string;
};

function App() {
  const [initData, setInitData] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState('Ожидание Telegram...');
  
  // Создание группы
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('RUB');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  
  // Приглашение в группу
  const [pendingInvite, setPendingInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  // Выбранная группа
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupBalance, setGroupBalance] = useState<GroupBalance | null>(null);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('balance');
  
  // Расходы
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  
  // Погашение
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [showSettle, setShowSettle] = useState(false);

  const api = useMemo(
    () => createApiClient(initData || import.meta.env.VITE_TG_INIT_DATA || ''),
    [initData]
  );

  // Фильтрация валют
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch) return CURRENCIES;
    const search = currencySearch.toLowerCase();
    return CURRENCIES.filter(
      c => c.code.toLowerCase().includes(search) || c.name.toLowerCase().includes(search)
    );
  }, [currencySearch]);

  // Проверка invite-кода и показ модалки
  const checkInviteCode = useCallback(async (code: string) => {
    if (!code) return;
    
    setInviteLoading(true);
    setInviteError(null);
    
    try {
      const groupInfo = await api.getGroupByInvite(code);
      
      // Проверяем, не состоит ли пользователь уже в этой группе
      const userGroups = await api.listGroups();
      const alreadyMember = userGroups.some(g => g.id === groupInfo.id);
      
      if (alreadyMember) {
        setInviteError('Вы уже состоите в этой группе');
        // Выбираем эту группу
        setGroups(userGroups);
        await handleSelectGroup(groupInfo.id);
      } else {
        setPendingInvite({ ...groupInfo, inviteCode: code });
      }
    } catch (error) {
      setInviteError((error as Error).message || 'Группа не найдена');
    } finally {
      setInviteLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData) {
      webApp.ready?.();
      webApp.expand?.();
      setInitData(webApp.initData);
      setStatus('Telegram готов');
      
      // Получаем start_param из Telegram
      const startParam = webApp.initDataUnsafe?.start_param;
      if (startParam) {
        // Сохраняем для обработки после авторизации
        sessionStorage.setItem('pendingInviteCode', startParam);
      }
    } else {
      setStatus('Нет Telegram WebApp');
    }
  }, []);

  useEffect(() => {
    if (!api.hasAuth()) return;
    void bootstrap();
  }, [api]);

  const bootstrap = async () => {
    try {
      setStatus('Авторизация...');
      const me = await api.verify();
      setUser(me);
      const groupList = await api.listGroups();
      setGroups(groupList);
      
      // Проверяем pending invite после авторизации
      const pendingCode = sessionStorage.getItem('pendingInviteCode');
      if (pendingCode) {
        sessionStorage.removeItem('pendingInviteCode');
        await checkInviteCode(pendingCode);
      } else if (groupList[0]) {
        await handleSelectGroup(groupList[0].id);
      }
      
      setStatus('Готово');
    } catch (error) {
      setStatus(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      await api.createGroup({
        name: newGroupName,
        currency: newGroupCurrency
      });
      setNewGroupName('');
      const updated = await api.listGroups();
      setGroups(updated);
      if (updated[0]) {
        await handleSelectGroup(updated[0].id);
      }
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
      
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      window.Telegram?.WebApp?.showAlert?.(`Вы присоединились к группе "${group.name}"!`);
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('уже в этой группе')) {
        setPendingInvite(null);
        setInviteError('Вы уже состоите в этой группе');
      } else {
        alert(`Ошибка: ${message}`);
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeclineInvite = () => {
    setPendingInvite(null);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroup(groupId);
    setShowAddExpense(false);
    setShowSettle(false);
    const [balance, expenses] = await Promise.all([
      api.getGroupBalance(groupId),
      api.getGroupExpenses(groupId)
    ]);
    setGroupBalance(balance);
    setGroupExpenses(expenses);
    setSelectedParticipants(Object.keys(balance.balances));
  };

  const handleCopyInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = 'JeisusSplitBot';
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    navigator.clipboard.writeText(link);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    window.Telegram?.WebApp?.showAlert?.('Ссылка скопирована!') || alert('Ссылка скопирована!');
  };

  const handleShareInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = 'JeisusSplitBot';
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    const text = `Присоединяйся к группе "${groupBalance.group.name}" в Splitwise!`;
    window.Telegram?.WebApp?.openTelegramLink?.(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    );
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddExpense = async () => {
    if (!selectedGroup || !user || !expenseAmount || selectedParticipants.length === 0) return;
    
    const owed = expenseAmount / selectedParticipants.length;
    const shares = selectedParticipants.map((id) => ({
      userId: id,
      paid: id === user.id ? expenseAmount : 0,
      owed
    }));
    
    try {
      await api.createExpense({
        groupId: selectedGroup,
        description: expenseTitle || 'Расход',
        amount: expenseAmount,
        currency: groupBalance?.group.currency ?? 'RUB',
        shares
      });
      setExpenseTitle('');
      setExpenseAmount(0);
      setShowAddExpense(false);
      
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      
      const [balance, expenses] = await Promise.all([
        api.getGroupBalance(selectedGroup),
        api.getGroupExpenses(selectedGroup)
      ]);
      setGroupBalance(balance);
      setGroupExpenses(expenses);
      setActiveTab('expenses');
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
        currency: groupBalance?.group.currency
      });
      setSettleAmount(0);
      setSettleToUser('');
      setShowSettle(false);
      
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      
      if (selectedGroup) {
        setGroupBalance(await api.getGroupBalance(selectedGroup));
      }
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || code;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return `${days} дн. назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getUserName = (userObj: { firstName?: string; username?: string } | undefined) => {
    if (!userObj) return 'Участник';
    return userObj.firstName || userObj.username || 'Участник';
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="status-text">Статус: {status}</p>
          {user && (
            <h2 className="user-name">
              {user.firstName || 'Пользователь'} {user.lastName || ''}
            </h2>
          )}
        </div>
        <div className="logo">💰 Splitwise</div>
      </header>

      {/* Ошибка приглашения */}
      {inviteError && (
        <div className="invite-error">
          <span>{inviteError}</span>
          <button onClick={() => setInviteError(null)}>✕</button>
        </div>
      )}

      {/* Создание группы */}
      <section className="card">
        <h3>➕ Создать группу</h3>
        <input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Название группы"
          className="full-width"
        />
        
        <div className="currency-select">
          <div 
            className="currency-input"
            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
          >
            <span>{getCurrencySymbol(newGroupCurrency)} {newGroupCurrency}</span>
            <span className="arrow">▼</span>
          </div>
          
          {showCurrencyDropdown && (
            <div className="currency-dropdown">
              <input
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                placeholder="Поиск валюты..."
                className="currency-search"
                autoFocus
              />
              <div className="currency-list">
                {filteredCurrencies.map(c => (
                  <div
                    key={c.code}
                    className={`currency-option ${newGroupCurrency === c.code ? 'selected' : ''}`}
                    onClick={() => {
                      setNewGroupCurrency(c.code);
                      setShowCurrencyDropdown(false);
                      setCurrencySearch('');
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
        
        <button onClick={handleCreateGroup} disabled={!newGroupName} className="primary-btn">
          Создать группу
        </button>
      </section>

      {/* Список групп */}
      {groups.length > 0 && (
        <section className="card">
          <h3>📋 Мои группы</h3>
          <div className="group-list">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`group-item ${selectedGroup === g.id ? 'active' : ''}`}
                onClick={() => handleSelectGroup(g.id)}
              >
                <span className="group-name">{g.name}</span>
                <span className="group-currency">{getCurrencySymbol(g.currency)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Детали группы с вкладками */}
      {selectedGroup && groupBalance && (
        <>
          <section className="card group-detail-card">
            <div className="card-header">
              <h3>{groupBalance.group.name}</h3>
              <div className="invite-actions">
                <button className="icon-btn" onClick={handleCopyInviteLink} title="Копировать ссылку">
                  📋
                </button>
                <button className="icon-btn" onClick={handleShareInviteLink} title="Поделиться">
                  📤
                </button>
              </div>
            </div>

            {/* Вкладки */}
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'balance' ? 'active' : ''}`}
                onClick={() => setActiveTab('balance')}
              >
                ⚖️ Баланс
              </button>
              <button 
                className={`tab ${activeTab === 'expenses' ? 'active' : ''}`}
                onClick={() => setActiveTab('expenses')}
              >
                🧾 Траты ({groupExpenses.length})
              </button>
            </div>

            {/* Контент вкладки Баланс */}
            {activeTab === 'balance' && (
              <div className="tab-content">
                <div className="balance-list">
                  {Object.entries(groupBalance.balances).map(([uid, balance]) => (
                    <div className="balance-row" key={uid}>
                      <span className="balance-name">
                        {groupBalance.userNames?.[uid] || 'Участник'}
                        {uid === user?.id && ' (вы)'}
                      </span>
                      <span className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
                        {balance >= 0 ? '+' : ''}
                        {balance.toFixed(2)} {getCurrencySymbol(groupBalance.group.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                
                {Object.keys(groupBalance.balances).length === 0 && (
                  <p className="empty-state">Пока нет участников</p>
                )}
              </div>
            )}

            {/* Контент вкладки Траты */}
            {activeTab === 'expenses' && (
              <div className="tab-content">
                {groupExpenses.length === 0 ? (
                  <p className="empty-state">Пока нет расходов. Добавьте первый!</p>
                ) : (
                  <div className="expenses-list">
                    {groupExpenses.map((expense) => (
                      <div className="expense-item" key={expense.id}>
                        <div className="expense-icon">🧾</div>
                        <div className="expense-details">
                          <div className="expense-title">{expense.description}</div>
                          <div className="expense-meta">
                            {getUserName(expense.createdBy)} оплатил(а) • {formatDate(expense.createdAt)}
                          </div>
                          <div className="expense-participants">
                            {expense.shares.map(s => getUserName(s.user)).join(', ')}
                          </div>
                        </div>
                        <div className="expense-amount">
                          {Number(expense.amount).toFixed(2)} {getCurrencySymbol(expense.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Кнопки действий */}
          <div className="action-buttons">
            <button className="action-btn expense-btn" onClick={() => setShowAddExpense(true)}>
              ➕ Добавить расход
            </button>
            <button className="action-btn settle-btn" onClick={() => setShowSettle(true)}>
              💸 Погасить долг
            </button>
          </div>
        </>
      )}

      {/* Модалка приглашения в группу */}
      {pendingInvite && (
        <div className="modal-overlay">
          <div className="modal invite-modal">
            <div className="invite-icon">👥</div>
            <h3>Приглашение в группу</h3>
            <div className="invite-group-name">{pendingInvite.name}</div>
            <div className="invite-details">
              <span>{pendingInvite.membersCount} участник(ов)</span>
              <span>•</span>
              <span>{getCurrencySymbol(pendingInvite.currency)} {pendingInvite.currency}</span>
            </div>
            <p className="invite-question">Хотите присоединиться к этой группе?</p>
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
                {inviteLoading ? 'Загрузка...' : 'Да, присоединиться'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка добавления расхода */}
      {showAddExpense && groupBalance && (
        <div className="modal-overlay" onClick={() => setShowAddExpense(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🧾 Новый расход</h3>
              <button className="close-btn" onClick={() => setShowAddExpense(false)}>✕</button>
            </div>
            
            <input
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              placeholder="Описание (например: Ужин)"
              className="full-width"
            />
            <input
              type="number"
              value={expenseAmount || ''}
              onChange={(e) => setExpenseAmount(Number(e.target.value))}
              placeholder={`Сумма в ${getCurrencySymbol(groupBalance.group.currency)}`}
              className="full-width"
            />
            
            <p className="label">Разделить между:</p>
            <div className="participants-list">
              {Object.entries(groupBalance.balances).map(([uid]) => (
                <button
                  key={uid}
                  className={`participant-chip ${selectedParticipants.includes(uid) ? 'selected' : ''}`}
                  onClick={() => toggleParticipant(uid)}
                >
                  {groupBalance.userNames?.[uid] || 'Участник'}
                  {uid === user?.id && ' (вы)'}
                  {selectedParticipants.includes(uid) && ' ✓'}
                </button>
              ))}
            </div>
            
            {selectedParticipants.length > 0 && expenseAmount > 0 && (
              <p className="split-info">
                По {(expenseAmount / selectedParticipants.length).toFixed(2)} {getCurrencySymbol(groupBalance.group.currency)} на человека
              </p>
            )}
            
            <button 
              onClick={handleAddExpense} 
              disabled={!expenseAmount || selectedParticipants.length === 0} 
              className="primary-btn"
            >
              Добавить расход
            </button>
          </div>
        </div>
      )}

      {/* Модалка погашения долга */}
      {showSettle && groupBalance && (
        <div className="modal-overlay" onClick={() => setShowSettle(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💸 Погасить долг</h3>
              <button className="close-btn" onClick={() => setShowSettle(false)}>✕</button>
            </div>
            
            <p className="label">Кому вы перевели:</p>
            <div className="participants-list">
              {Object.entries(groupBalance.balances)
                .filter(([uid]) => uid !== user?.id)
                .map(([uid]) => (
                  <button
                    key={uid}
                    className={`participant-chip ${settleToUser === uid ? 'selected' : ''}`}
                    onClick={() => setSettleToUser(uid)}
                  >
                    {groupBalance.userNames?.[uid] || 'Участник'}
                    {settleToUser === uid && ' ✓'}
                  </button>
                ))}
            </div>
            
            <input
              type="number"
              value={settleAmount || ''}
              onChange={(e) => setSettleAmount(Number(e.target.value))}
              placeholder={`Сумма в ${getCurrencySymbol(groupBalance.group.currency)}`}
              className="full-width"
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
    </div>
  );
}

export default App;
