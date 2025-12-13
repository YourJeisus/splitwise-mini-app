import { useState, useRef } from "react";

interface SwipeableExpenseProps {
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
  hasReceipt?: boolean;
  children: React.ReactNode;
}

export const SwipeableExpense = ({
  isOwner,
  onEdit,
  onDelete,
  onLongPress,
  hasReceipt,
  children,
}: SwipeableExpenseProps) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    hasMoved.current = false;

    if (onLongPress && hasReceipt) {
      longPressTimer.current = setTimeout(() => {
        if (!hasMoved.current) {
          onLongPress();
        }
      }, 500);
    }

    if (isOwner) {
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    const diff = Math.abs(startX.current - currentX.current);
    if (diff > 10) {
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!isSwiping || !isOwner) return;
    const swipeDiff = startX.current - currentX.current;
    if (swipeDiff > 0) {
      setSwipeX(Math.min(swipeDiff, 120));
    } else {
      setSwipeX(0);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!isOwner) return;
    setIsSwiping(false);
    if (swipeX > 60) {
      setSwipeX(120);
    } else {
      setSwipeX(0);
    }
  };

  const handleClose = () => {
    setSwipeX(0);
  };

  return (
    <div className="swipeable-expense-wrapper">
      <div
        className={`expense-item ${hasReceipt ? "has-receipt" : ""}`}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping ? "none" : "transform 0.3s ease",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={swipeX > 0 ? handleClose : undefined}
      >
        {children}
        {hasReceipt && (
          <div
            className="receipt-indicator"
            title="Удерживайте для просмотра чека"
          >
            🧾
          </div>
        )}
      </div>
      {isOwner && (
        <div
          className="swipe-actions"
          style={{
            width: `${swipeX}px`,
            opacity: swipeX > 30 ? 1 : 0,
          }}
        >
          <button className="swipe-action-btn edit" onClick={onEdit}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M4.5 17.207V19a.5.5 0 0 0 .5.5h1.793a.5.5 0 0 0 .353-.146l8.5-8.5l-2.5-2.5l-8.5 8.5a.5.5 0 0 0-.146.353Z" />
              <path d="M15.09 6.41l2.5 2.5l1.203-1.203a1 1 0 0 0 0-1.414l-1.086-1.086a1 1 0 0 0-1.414 0z" />
            </svg>
          </button>
          <button className="swipe-action-btn delete" onClick={onDelete}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

