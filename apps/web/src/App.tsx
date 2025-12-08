import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { createApiClient } from './api';
import type { User, Friend, Group, GroupBalance } from './api';

function App() {
  const [initData, setInitData] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState('Ожидание Telegram...');
  const [friendTgId, setFriendTgId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('USD');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupBalance, setGroupBalance] = useState<GroupBalance | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseParticipants, setExpenseParticipants] = useState('');
  const [settleToUser, setSettleToUser] = useState('');
  const [settleAmount, setSettleAmount] = useState<number>(0);

  const api = useMemo(
    () => createApiClient(initData || import.meta.env.VITE_TG_INIT_DATA || ''),
    [initData]
  );

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready?.();
      webApp.expand?.();
      setInitData(webApp.initData || '');
      setStatus('Telegram готов');
    } else {
      setStatus('Нет Telegram WebApp, используем VITE_TG_INIT_DATA');
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
      const [friendsList, groupList] = await Promise.all([api.listFriends(), api.listGroups()]);
      setFriends(friendsList);
      setGroups(groupList);
      if (groupList[0]) {
        await handleSelectGroup(groupList[0].id);
      }
      setStatus('Готово');
    } catch (error) {
      setStatus(`Ошибка: ${(error as Error).message}`);
    }
  };

  const handleAddFriend = async () => {
    if (!friendTgId) return;
    await api.addFriend(friendTgId.trim());
    setFriendTgId('');
    setFriends(await api.listFriends());
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    const memberIds = newGroupMembers
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    await api.createGroup({
      name: newGroupName,
      currency: newGroupCurrency,
      memberIds
    });
    setNewGroupName('');
    setNewGroupMembers('');
    const updated = await api.listGroups();
    setGroups(updated);
    if (updated[0]) {
      await handleSelectGroup(updated[0].id);
    }
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroup(groupId);
    const balance = await api.getGroupBalance(groupId);
    setGroupBalance(balance);
  };

  const handleAddExpense = async () => {
    if (!selectedGroup || !user || !expenseAmount) return;
    const participants = Array.from(
      new Set([
        user.id,
        ...expenseParticipants
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      ])
    );
    const owed = participants.length ? expenseAmount / participants.length : expenseAmount;
    const shares = participants.map((id) => ({
      userId: id,
      paid: id === user.id ? expenseAmount : 0,
      owed
    }));
    await api.createExpense({
      groupId: selectedGroup,
      description: expenseTitle || 'Расход',
      amount: expenseAmount,
      currency: groupBalance?.group.currency ?? 'USD',
      shares
    });
    setExpenseTitle('');
    setExpenseAmount(0);
    setExpenseParticipants('');
    setGroupBalance(await api.getGroupBalance(selectedGroup));
  };

  const handleSettle = async () => {
    if (!settleToUser || !settleAmount) return;
    await api.createSettlement({
      toUserId: settleToUser.trim(),
      amount: settleAmount
    });
    setSettleAmount(0);
    setSettleToUser('');
    if (selectedGroup) {
      setGroupBalance(await api.getGroupBalance(selectedGroup));
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="muted">Статус: {status}</p>
          {user && (
            <h2>
              {user.firstName || 'Без имени'} @{user.username || 'tg'}
            </h2>
          )}
        </div>
        <div className="pill">Mini App Splitwise</div>
      </header>

      <section className="card">
        <h3>Друзья</h3>
        <div className="inline-form">
          <input
            value={friendTgId}
            onChange={(e) => setFriendTgId(e.target.value)}
            placeholder="Telegram ID друга"
          />
          <button onClick={handleAddFriend}>Добавить</button>
        </div>
        <div className="chips">
          {friends.map((f) => (
            <span className="chip" key={f.id}>
              {f.firstName || 'Друг'} ({f.telegramId})
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Группы</h3>
        <div className="inline-form">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Название группы"
          />
          <input
            value={newGroupCurrency}
            onChange={(e) => setNewGroupCurrency(e.target.value)}
            placeholder="Валюта"
          />
        </div>
        <input
          value={newGroupMembers}
          onChange={(e) => setNewGroupMembers(e.target.value)}
          placeholder="Участники через запятую (userId)"
        />
        <div className="actions">
          <button onClick={handleCreateGroup}>Создать группу</button>
        </div>
        <div className="chips">
          {groups.map((g) => (
            <button
              key={g.id}
              className={`chip ${selectedGroup === g.id ? 'chip-active' : ''}`}
              onClick={() => handleSelectGroup(g.id)}
            >
              {g.name} · {g.currency}
            </button>
          ))}
        </div>
      </section>

      {selectedGroup && groupBalance && (
        <section className="card">
          <h3>Баланс группы</h3>
          <p className="muted">
            {groupBalance.group.name} · {groupBalance.expensesCount} расходов
          </p>
          <div className="list">
            {Object.entries(groupBalance.balances).map(([uid, balance]) => (
              <div className="list-row" key={uid}>
                <span>{uid}</span>
                <span className={balance >= 0 ? 'pos' : 'neg'}>
                  {balance >= 0 ? '+' : ''}
                  {balance.toFixed(2)} {groupBalance.group.currency}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedGroup && (
        <section className="card">
          <h3>Добавить расход</h3>
          <input
            value={expenseTitle}
            onChange={(e) => setExpenseTitle(e.target.value)}
            placeholder="Описание"
          />
          <div className="inline-form">
            <input
              type="number"
              value={expenseAmount || ''}
              onChange={(e) => setExpenseAmount(Number(e.target.value))}
              placeholder="Сумма"
            />
            <input
              value={expenseParticipants}
              onChange={(e) => setExpenseParticipants(e.target.value)}
              placeholder="Участники (userId, через запятую)"
            />
          </div>
          <button onClick={handleAddExpense}>Создать расход</button>
        </section>
      )}

      <section className="card">
        <h3>Погашение</h3>
        <div className="inline-form">
          <input
            value={settleToUser}
            onChange={(e) => setSettleToUser(e.target.value)}
            placeholder="Кому (userId)"
          />
          <input
            type="number"
            value={settleAmount || ''}
            onChange={(e) => setSettleAmount(Number(e.target.value))}
            placeholder="Сумма"
          />
        </div>
        <button onClick={handleSettle}>Отметить перевод</button>
      </section>
    </div>
  );
}

export default App;
