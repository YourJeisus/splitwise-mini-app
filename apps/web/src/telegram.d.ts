export {};

declare global {
  interface TelegramWebAppInitDataUnsafe {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
    auth_date?: number;
    hash?: string;
  }

  interface TelegramWebApp {
    initData?: string;
    initDataUnsafe?: TelegramWebAppInitDataUnsafe;
    ready?: () => void;
    expand?: () => void;
    close?: () => void;
    showAlert?: (message: string, callback?: () => void) => void;
    showConfirm?: (message: string, callback?: (confirmed: boolean) => void) => void;
    showPopup?: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string) => void) => void;
    openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
    openTelegramLink?: (url: string) => void;
    switchInlineQuery?: (query: string, choose_chat_types?: string[]) => void;
    MainButton?: {
      text: string;
      color: string;
      textColor: string;
      isVisible: boolean;
      isActive: boolean;
      isProgressVisible: boolean;
      setText: (text: string) => void;
      onClick: (callback: () => void) => void;
      offClick: (callback: () => void) => void;
      show: () => void;
      hide: () => void;
      enable: () => void;
      disable: () => void;
      showProgress: (leaveActive?: boolean) => void;
      hideProgress: () => void;
    };
    BackButton?: {
      isVisible: boolean;
      onClick: (callback: () => void) => void;
      offClick: (callback: () => void) => void;
      show: () => void;
      hide: () => void;
    };
    HapticFeedback?: {
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
      notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
      selectionChanged: () => void;
    };
    colorScheme?: 'light' | 'dark';
    themeParams?: Record<string, string>;
    platform?: string;
    version?: string;
  }

  interface TelegramSDK {
    WebApp?: TelegramWebApp;
  }

  interface Window {
    Telegram?: TelegramSDK;
  }
}

