import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useOnboarding } from './OnboardingProvider';

export const CoachmarkOverlay: React.FC = () => {
  const { activeTip, markSeen } = useOnboarding();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const requestRef = useRef<number>();

  const updateRect = () => {
    if (activeTip) {
      const el = document.querySelector(`[data-onb="${activeTip.anchor}"]`);
      if (el) {
        const newRect = el.getBoundingClientRect();
        setRect(newRect);
        
        // Auto scroll if needed
        if (newRect.top < 0 || newRect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setRect(null);
      }
    } else {
      setRect(null);
    }
    requestRef.current = requestAnimationFrame(updateRect);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateRect);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [activeTip]);

  useEffect(() => {
    if (activeTip) {
      // Haptic on show
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    }
  }, [activeTip?.id]);

  if (!activeTip || !rect) return null;

  const padding = 10;
  
  const isBottom = rect.top > window.innerHeight / 2;

  return (
    <div className="onboarding-overlay">
      <svg className="onboarding-mask" width="100%" height="100%">
        <defs>
          <mask id="coachmark-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx="45"
              ry="45"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#coachmark-mask)"
        />
      </svg>

      <div 
        className={`onboarding-tooltip ${isBottom ? 'top' : 'bottom'}`}
        style={{
          left: Math.max(10, Math.min(window.innerWidth - 290, rect.left + rect.width / 2 - 140)),
          top: isBottom ? rect.top - 20 : rect.bottom + 20,
        }}
      >
        <div className="onboarding-tooltip-content">
          <h4>{activeTip.title}</h4>
          <p>{activeTip.text}</p>
          <button 
            className="onboarding-got-it" 
            onClick={() => {
              markSeen(activeTip.id);
              window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
            }}
          >
            Понятно
          </button>
        </div>
        
        {activeTip.actionType === 'swipe' && (
          <div className="onboarding-animation swipe">
            <div className="hand">👆</div>
            <div className="arrow">←</div>
          </div>
        )}
        
        {activeTip.actionType === 'hold' && (
          <div className="onboarding-animation hold">
            <div className="ring" />
            <div className="hand">👆</div>
          </div>
        )}
      </div>
      
      <div 
        className="onboarding-highlight"
        style={{
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      />
    </div>
  );
};

