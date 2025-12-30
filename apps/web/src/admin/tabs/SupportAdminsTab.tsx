import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../adminApi";

export function SupportAdminsTab() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    password: "",
    role: "SUPPORT",
  });

  const loadAdmins = useCallback(() => {
    setLoading(true);
    adminApi.listSupportAdmins().then((res) => {
      setAdmins(res);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleGenerateToken = async (adminId: string) => {
    try {
      const res = await adminApi.generateAdminLinkToken(adminId);
      prompt(
        "Токен сгенерирован (действует 10 мин). Отправьте боту команду:",
        `/admin_link ${res.token}`
      );
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
    }
  };

  const handleToggleNotifications = async (adminId: string, enabled: boolean) => {
    try {
      await adminApi.toggleAdminSupportNotifications(adminId, enabled);
      loadAdmins();
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createAdmin(newAdmin);
      setShowAddModal(false);
      setNewAdmin({ email: "", password: "", role: "SUPPORT" });
      loadAdmins();
    } catch (err) {
      alert("Ошибка при создании админа: " + (err as Error).message);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="support-admins-tab">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Управление админами саппорта</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          style={{ padding: "10px 20px", background: "#1a1a2e", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          + Добавить админа
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Роль</th>
            <th>Telegram</th>
            <th>Уведомления</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td>{a.email}</td>
              <td>{a.role}</td>
              <td>
                {a.telegramUserId ? (
                  <span title={a.telegramChatId}>✅ Привязан ({a.telegramUserId})</span>
                ) : (
                  <span className="not-linked">❌ Не привязан</span>
                )}
              </td>
              <td>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={a.supportNotificationsEnabled}
                    onChange={(e) =>
                      handleToggleNotifications(a.id, e.target.checked)
                    }
                  />
                  <span className="slider round"></span>
                </label>
              </td>
              <td>
                <button onClick={() => handleGenerateToken(a.id)}>
                  Привязать Telegram
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Добавить нового админа</h3>
            <form onSubmit={handleAddAdmin}>
              <input
                type="email"
                placeholder="Email"
                required
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              />
              <input
                type="password"
                placeholder="Пароль"
                required
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              />
              <select
                value={newAdmin.role}
                onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
              >
                <option value="SUPPORT">SUPPORT (Только саппорт)</option>
                <option value="ADMIN">ADMIN (Полный доступ)</option>
                <option value="READ_ONLY">READ_ONLY (Только просмотр)</option>
              </select>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)}>Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

