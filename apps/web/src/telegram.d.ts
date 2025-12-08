export {};

declare global {
  interface TelegramWebApp {
    initData?: string;
    initDataUnsafe?: unknown;
    ready?: () => void;
    expand?: () => void;
  }

  interface TelegramSDK {
    WebApp?: TelegramWebApp;
  }

  interface Window {
    Telegram?: TelegramSDK;
  }
}

