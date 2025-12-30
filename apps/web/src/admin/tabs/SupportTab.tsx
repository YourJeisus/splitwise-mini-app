import { useState, useEffect, useCallback, useRef } from "react";
import { adminApi } from "../adminApi";

export function SupportTab({
  currentAdminId,
  onMessagesRead,
}: {
  currentAdminId: string;
  onMessagesRead: (ticketId: string) => void;
}) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(() => {
    setLoading(true);
    adminApi.listTickets({ status: statusFilter }).then((res) => {
      setTickets(res.items);
      setLoading(false);
    });
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadMessages = useCallback(
    (ticketId: string) => {
      adminApi.getTicketMessages(ticketId).then((res) => {
        setMessages(res);
        onMessagesRead(ticketId);
      });
    },
    [onMessagesRead]
  );

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
      const interval = setInterval(() => loadMessages(selectedTicket.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTicket, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    try {
      await adminApi.replyToTicket(selectedTicket.id, replyText);
      setReplyText("");
      loadMessages(selectedTicket.id);
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
    }
  };

  const handleToggleStatus = async (ticket: any) => {
    const newStatus = ticket.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      await adminApi.setTicketStatus(ticket.id, newStatus);
      loadTickets();
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
    }
  };

  const handleAssignMe = async (ticketId: string) => {
    try {
      await adminApi.assignTicket(ticketId, currentAdminId);
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, assignedAdminId: currentAdminId });
      }
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
    }
  };

  return (
    <div className="support-tab">
      <div className="support-sidebar">
        <div className="support-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="OPEN">Открытые</option>
            <option value="CLOSED">Закрытые</option>
            <option value="">Все</option>
          </select>
          <button onClick={loadTickets}>🔄</button>
        </div>
        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <div className="ticket-list">
            {tickets.map((t) => (
              <div
                key={t.id}
                className={`ticket-item ${selectedTicket?.id === t.id ? "active" : ""} ${t.status.toLowerCase()}`}
                onClick={() => setSelectedTicket(t)}
              >
                <div className="ticket-header">
                  <strong>{t.user.firstName || "User"}</strong>
                  <span className="time">
                    {new Date(t.lastMessageAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="ticket-meta">
                  <span>ID: {t.user.telegramId}</span>
                  {t.assignedAdmin && (
                    <span className="assigned">👤 {t.assignedAdmin.email}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="support-content">
        {selectedTicket ? (
          <>
            <div className="support-content-header">
              <div className="user-info">
                <h3>{selectedTicket.user.firstName}</h3>
                <span>@{selectedTicket.user.username || "no_username"}</span>
              </div>
              <div className="ticket-actions">
                {!selectedTicket.assignedAdminId && (
                  <button onClick={() => handleAssignMe(selectedTicket.id)}>
                    Взять себе
                  </button>
                )}
                <button onClick={() => handleToggleStatus(selectedTicket)}>
                  {selectedTicket.status === "OPEN" ? "Закрыть" : "Открыть"}
                </button>
              </div>
            </div>
            <div className="messages-container">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`message ${m.direction.toLowerCase()}`}
                >
                  <div className="message-bubble">
                    <p>{m.text}</p>
                    <span className="time">
                      {new Date(m.createdAt).toLocaleTimeString()}
                      {m.admin && ` • ${m.admin.email}`}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="reply-form" onSubmit={handleReply}>
              <textarea
                placeholder="Ваш ответ..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply(e);
                  }
                }}
              />
              <button type="submit" disabled={!replyText.trim()}>
                Отправить
              </button>
            </form>
          </>
        ) : (
          <div className="no-selection">Выберите тикет для начала общения</div>
        )}
      </div>
    </div>
  );
}

