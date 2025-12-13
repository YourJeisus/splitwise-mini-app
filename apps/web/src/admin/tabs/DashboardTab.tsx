import { useState, useEffect } from "react";
import { adminApi } from "../adminApi";

export function DashboardTab() {
  const [period, setPeriod] = useState("7d");
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getKPI(period).then(setKpi).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="dashboard-tab">
      <div className="period-selector">
        {["today", "7d", "30d"].map((p) => (
          <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
            {p === "today" ? "Сегодня" : p === "7d" ? "7 дней" : "30 дней"}
          </button>
        ))}
      </div>
      {kpi && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-value">{kpi.revenue?.stars || 0} ⭐</div>
            <div className="kpi-label">Выручка</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.purchases?.count || 0}</div>
            <div className="kpi-label">Покупок</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.tripPass?.activeCount || 0}</div>
            <div className="kpi-label">Активных Trip Pass</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.users?.total || 0}</div>
            <div className="kpi-label">Всего пользователей</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.users?.activeInPeriod || 0}</div>
            <div className="kpi-label">Активных за период</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.groups?.activeCount || 0}</div>
            <div className="kpi-label">Активных групп</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.conversion?.rate || "0%"}</div>
            <div className="kpi-label">Конверсия</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpi.purchases?.failed || 0}</div>
            <div className="kpi-label">Ошибок оплаты</div>
          </div>
        </div>
      )}
    </div>
  );
}

