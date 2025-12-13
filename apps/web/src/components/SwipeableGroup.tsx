import { useState, useRef } from "react";

interface SwipeableGroupProps {
  canLeave: boolean;
  onLeave: () => void;
  onClick: () => void;
  children: React.ReactNode;
}

export const SwipeableGroup = ({
  canLeave,
  onLeave,
  onClick,
  children,
}: SwipeableGroupProps) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canLeave) return;
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || !canLeave) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (diff > 0) {
      setSwipeX(Math.min(diff, 60));
    } else {
      setSwipeX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!canLeave) return;
    setIsSwiping(false);
    if (swipeX > 30) {
      setSwipeX(60);
    } else {
      setSwipeX(0);
    }
  };

  const handleClose = () => {
    setSwipeX(0);
  };

  return (
    <div className="swipeable-group-wrapper">
      <div
        className="group-item-inner"
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping ? "none" : "transform 0.3s ease",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={swipeX > 0 ? handleClose : onClick}
      >
        {children}
      </div>
      {canLeave && (
        <div
          className="swipe-actions group-swipe-actions"
          style={{
            width: `${swipeX}px`,
            opacity: swipeX > 20 ? 1 : 0,
          }}
        >
          <button className="swipe-action-btn leave" onClick={onLeave}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

