import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type TipId = 
  | 'create-group-empty'
  | 'create-group-plus'
  | 'invite-copy'
  | 'invite-share'
  | 'expense-swipe'
  | 'receipt-hold';

type OnboardingContextInput = Omit<OnboardingContextType, 'activeTip' | 'markSeen' | 'dismiss'>;

interface TipDef {
  id: TipId;
  title: string;
  text: string;
  anchor: string;
  actionType?: 'swipe' | 'hold' | 'click';
  priority: number;
  condition: (context: OnboardingContextInput) => boolean;
}

interface OnboardingContextType {
  userId?: string;
  groupsCount: number;
  selectedGroupId?: string;
  activeTab: 'balance' | 'expenses';
  hasEditableExpenses: boolean;
  hasReceiptExpenses: boolean;
  isModalOpen: boolean;
  
  activeTip: TipDef | null;
  markSeen: (tipId: TipId) => void;
  dismiss: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const ONBOARDING_VERSION = 'v1';

export const OnboardingProvider: React.FC<{
  children: React.ReactNode;
  context: OnboardingContextInput;
}> = ({ children, context }) => {
  const [seenTipIds, setSeenTipIds] = useState<Set<TipId>>(new Set());
  const [dismissedTipId, setDismissedTipId] = useState<TipId | null>(null);

  // Storage key: onboarding:v1:<userId>
  const storageKey = useMemo(() => 
    `onboarding:${ONBOARDING_VERSION}:${context.userId || 'anonymous'}`, 
  [context.userId]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSeenTipIds(new Set(parsed));
        }
      } catch (e) {
        console.error('Failed to load onboarding progress', e);
      }
    }
  }, [storageKey]);

  const saveProgress = useCallback((newSeen: Set<TipId>) => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newSeen)));
  }, [storageKey]);

  const markSeen = useCallback((tipId: TipId) => {
    setSeenTipIds(prev => {
      if (prev.has(tipId)) return prev;
      const next = new Set(prev);
      next.add(tipId);
      saveProgress(next);
      return next;
    });
  }, [saveProgress]);

  useEffect(() => {
    const handler = (e: any) => markSeen(e.detail);
    window.addEventListener('onboarding-mark-seen', handler as EventListener);
    return () => window.removeEventListener('onboarding-mark-seen', handler as EventListener);
  }, [markSeen]);

  const tips: TipDef[] = useMemo(() => [
    {
      id: 'create-group-empty',
      title: 'Создайте группу',
      text: 'Начните с создания первой группы для совместных трат',
      anchor: 'create-group-empty',
      priority: 10,
      condition: (ctx) => ctx.groupsCount === 0 && !ctx.isModalOpen
    },
    {
      id: 'create-group-plus',
      title: 'Новая поездка',
      text: 'Здесь можно создать еще одну группу для другой поездки',
      anchor: 'create-group-plus',
      priority: 20,
      condition: (ctx) => ctx.groupsCount > 0 && !ctx.isModalOpen
    },
    {
      id: 'invite-copy',
      title: 'Пригласите друзей',
      text: 'Скопируйте ссылку и отправьте её участникам поездки',
      anchor: 'invite-copy',
      priority: 30,
      condition: (ctx) => !!ctx.selectedGroupId && ctx.activeTab === 'balance' && !ctx.isModalOpen
    },
    {
      id: 'invite-share',
      title: 'Поделиться ссылкой',
      text: 'Или сразу отправьте ссылку в чат Telegram',
      anchor: 'invite-share',
      priority: 31,
      condition: (ctx) => !!ctx.selectedGroupId && ctx.activeTab === 'balance' && !ctx.isModalOpen && seenTipIds.has('invite-copy')
    },
    {
      id: 'expense-swipe',
      title: 'Управление тратой',
      text: 'Смахните влево, чтобы изменить или удалить свою трату',
      anchor: 'expense-swipe',
      actionType: 'swipe',
      priority: 40,
      condition: (ctx) => ctx.activeTab === 'expenses' && ctx.hasEditableExpenses && !ctx.isModalOpen
    },
    {
      id: 'receipt-hold',
      title: 'Детали чека',
      text: 'Зажмите иконку чека, чтобы выбрать свои позиции из списка',
      anchor: 'expense-receipt-receipt',
      actionType: 'hold',
      priority: 50,
      condition: (ctx) => ctx.activeTab === 'expenses' && ctx.hasReceiptExpenses && !ctx.isModalOpen
    }
  ], [seenTipIds]);

  const activeTip = useMemo(() => {
    if (context.isModalOpen) return null;
    
    const available = tips
      .filter(tip => !seenTipIds.has(tip.id))
      .filter(tip => tip.id !== dismissedTipId)
      .filter(tip => tip.condition(context))
      .sort((a, b) => a.priority - b.priority);
      
    return available[0] || null;
  }, [tips, seenTipIds, dismissedTipId, context]);

  const dismiss = useCallback(() => {
    if (!activeTip) return;
    setDismissedTipId(activeTip.id);
  }, [activeTip]);

  const value = useMemo(() => ({
    ...context,
    activeTip,
    markSeen,
    dismiss
  }), [context, activeTip, markSeen, dismiss]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
};

