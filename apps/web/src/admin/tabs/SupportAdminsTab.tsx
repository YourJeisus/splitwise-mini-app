import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../adminApi";

export function SupportAdminsTab() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="support-admins-tab">
      <h2>Управление админами саппорта</h2>
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
    </div>
  );
}

