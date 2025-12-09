import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { createApiClient } from './api';
import type { User, Group, GroupBalance } from './api';

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
  
  // Присоединение к группе
  const [inviteCode, setInviteCode] = useState('');
  
  // Выбранная группа
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupBalance, setGroupBalance] = useState<GroupBalance | null>(null);
  
  // Расходы
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  // Погашение
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmount, setSettleAmount] = useState<number>(0);

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

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp?.initData) {
      webApp.ready?.();
      webApp.expand?.();
      setInitData(webApp.initData);
      setStatus('Telegram готов');
    } else {
      setStatus('Нет Telegram WebApp');
    }
  }, []);

  useEffect(() => {
    if (!api.hasAuth()) return;
    void bootstrap();
  }, [api]);

  // Проверяем URL на invite-код при загрузке
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('startapp') || params.get('invite');
    if (code) {
      setInviteCode(code);
    }
  }, []);

  const bootstrap = async () => {
    try {
      setStatus('Авторизация...');
      const me = await api.verify();
      setUser(me);
      const groupList = await api.listGroups();
      setGroups(groupList);
      if (groupList[0]) {
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

  const handleJoinGroup = async () => {
    if (!inviteCode) return;
    try {
      const group = await api.joinGroup(inviteCode.trim());
      setInviteCode('');
      const updated = await api.listGroups();
      setGroups(updated);
      await handleSelectGroup(group.id);
      alert(`Вы присоединились к группе "${group.name}"!`);
    } catch (error) {
      alert(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroup(groupId);
    const balance = await api.getGroupBalance(groupId);
    setGroupBalance(balance);
    // По умолчанию выбираем всех участников
    setSelectedParticipants(Object.keys(balance.balances));
  };

  const handleCopyInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = 'JeisusSplitBot'; // Замените на username вашего бота
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    navigator.clipboard.writeText(link);
    
    // Показываем через Telegram
    window.Telegram?.WebApp?.showAlert?.('Ссылка скопирована!') || alert('Ссылка скопирована!');
  };

  const handleShareInviteLink = () => {
    if (!groupBalance?.group.inviteCode) return;
    const botUsername = 'JeisusSplitBot';
    const link = `https://t.me/${botUsername}?startapp=${groupBalance.group.inviteCode}`;
    const text = `Присоединяйся к группе "${groupBalance.group.name}" в Splitwise!`;
    
    // Используем Telegram share
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
      setGroupBalance(await api.getGroupBalance(selectedGroup));
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

      {/* Присоединиться к группе */}
      <section className="card">
        <h3>🔗 Присоединиться к группе</h3>
        <div className="inline-form">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Введите код приглашения"
          />
          <button onClick={handleJoinGroup} disabled={!inviteCode}>
            Войти
          </button>
        </div>
      </section>

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

      {/* Баланс группы */}
      {selectedGroup && groupBalance && (
        <section className="card">
          <div className="card-header">
            <h3>⚖️ Баланс: {groupBalance.group.name}</h3>
            <div className="invite-actions">
              <button className="icon-btn" onClick={handleCopyInviteLink} title="Копировать ссылку">
                📋
              </button>
              <button className="icon-btn" onClick={handleShareInviteLink} title="Поделиться">
                📤
              </button>
            </div>
          </div>
          
          <p className="muted">{groupBalance.expensesCount} расходов</p>
          
          <div className="balance-list">
            {Object.entries(groupBalance.balances).map(([uid, balance]) => (
              <div className="balance-row" key={uid}>
                <span className="balance-name">
                  {groupBalance.userNames?.[uid] || 'Участник'}
                </span>
                <span className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
                  {balance >= 0 ? '+' : ''}
                  {balance.toFixed(2)} {getCurrencySymbol(groupBalance.group.currency)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Добавить расход */}
      {selectedGroup && groupBalance && (
        <section className="card">
          <h3>🧾 Добавить расход</h3>
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
            placeholder="Сумма"
            className="full-width"
          />
          
          <p className="label">Кто участвует:</p>
          <div className="participants-list">
            {Object.entries(groupBalance.balances).map(([uid]) => (
              <button
                key={uid}
                className={`participant-chip ${selectedParticipants.includes(uid) ? 'selected' : ''}`}
                onClick={() => toggleParticipant(uid)}
              >
                {groupBalance.userNames?.[uid] || 'Участник'}
                {selectedParticipants.includes(uid) && ' ✓'}
              </button>
            ))}
          </div>
          
          <button onClick={handleAddExpense} disabled={!expenseAmount || selectedParticipants.length === 0} className="primary-btn">
            Добавить расход
          </button>
        </section>
      )}

      {/* Погашение долга */}
      {selectedGroup && groupBalance && (
        <section className="card">
          <h3>💸 Погасить долг</h3>
          
          <p className="label">Кому:</p>
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
            placeholder="Сумма"
            className="full-width"
          />
          
          <button onClick={handleSettle} disabled={!settleToUser || !settleAmount} className="primary-btn">
            Отметить перевод
          </button>
        </section>
      )}
    </div>
  );
}

export default App;
