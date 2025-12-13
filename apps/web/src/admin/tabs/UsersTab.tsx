import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../adminApi";
import { UserCard } from "../components/UserCard";

export function UsersTab({ role }: { role: string }) {
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
                <th>Trip Pass</th>
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
                  <td>{u.activeTripPasses > 0 ? `✅ ${u.activeTripPasses}` : ""}</td>
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

