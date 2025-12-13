import { useState } from "react";
import { adminApi } from "../adminApi";

export function UserCard({ user, canEdit, onBack }: { user: any; canEdit: boolean; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [showModal, setShowModal] = useState<"godmode" | "revoke" | null>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);

  const handleGodMode = async (enabled: boolean) => {
    if (!reason.trim()) return alert("Укажите причину");
    try {
      await adminApi.toggleGodMode(user.id, enabled, reason);
      setShowModal(null);
      setReason("");
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  const handleRevokeEntitlement = async () => {
    if (!reason.trim()) return alert("Укажите причину");
    if (!selectedEntitlement) return;
    try {
      await adminApi.revokeEntitlement(selectedEntitlement.id, reason);
      setShowModal(null);
      setReason("");
      setSelectedEntitlement(null);
      onBack();
    } catch (err) {
      alert("Ошибка: " + ((err as Error).message || "Неизвестная ошибка"));
    }
  };

  return (
    <div className="user-card">
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <h2>{user.firstName} {user.lastName} (@{user.username})</h2>
      <div className="user-info">
        <p><strong>ID:</strong> {user.id}</p>
        <p><strong>Telegram ID:</strong> {user.telegramId}</p>
        <p><strong>GodMode:</strong> {user.godModeEnabled ? "Включён ✅" : "Выключен"}</p>
        <p><strong>Последняя активность:</strong> {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "—"}</p>
        <p><strong>Групп:</strong> {user.groupMembers?.length || 0}</p>
      </div>

      {canEdit && (
        <div className="user-actions">
          <button onClick={() => setShowModal("godmode")}>
            {user.godModeEnabled ? "Выключить GodMode" : "Включить GodMode"}
          </button>
        </div>
      )}

      <h3>Активные Trip Pass ({user.activeEntitlements?.length || 0})</h3>
      {user.activeEntitlements?.length > 0 ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Группа</th>
              <th>До</th>
              {canEdit && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {user.activeEntitlements.map((e: any) => (
              <tr key={e.id}>
                <td>{e.product?.title || e.productCode}</td>
                <td>{e.group?.name || e.groupId}</td>
                <td>{new Date(e.endsAt).toLocaleDateString()}</td>
                {canEdit && (
                  <td>
                    <button
                      className="revoke-btn"
                      onClick={() => {
                        setSelectedEntitlement(e);
                        setShowModal("revoke");
                      }}
                    >
                      Отозвать
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Нет активных Trip Pass</p>
      )}

      <h3>Группы пользователя</h3>
      {user.groupMembers?.length > 0 ? (
        <ul>
          {user.groupMembers.map((gm: any) => (
            <li key={gm.groupId}>
              {gm.group?.name} ({gm.group?.settlementCurrency}) {gm.group?.closedAt ? "— закрыта" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>Нет групп</p>
      )}

      {showModal === "godmode" && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{user.godModeEnabled ? "Выключить" : "Включить"} GodMode</h3>
            <textarea
              placeholder="Причина (обязательно)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowModal(null)}>Отмена</button>
              <button onClick={() => handleGodMode(!user.godModeEnabled)}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {showModal === "revoke" && selectedEntitlement && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Отозвать Trip Pass</h3>
            <p>
              <strong>Группа:</strong> {selectedEntitlement.group?.name}<br />
              <strong>До:</strong> {new Date(selectedEntitlement.endsAt).toLocaleDateString()}
            </p>
            <textarea
              placeholder="Причина отзыва (обязательно)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => { setShowModal(null); setSelectedEntitlement(null); }}>Отмена</button>
              <button className="danger-btn" onClick={handleRevokeEntitlement}>Отозвать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

