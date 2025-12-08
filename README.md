# Telegram Splitwise (Mini App + NestJS + PostgreSQL)

## Что внутри
- `apps/backend` — NestJS API (Telegram auth, друзья, группы, расходы, погашения), Prisma + PostgreSQL.
- `apps/web` — Telegram Mini App на React/Vite (авторизация, группы, расходы).
- GitHub Actions/ Railway готовы к подключению (укажите переменные окружения).

## Быстрый старт локально
```bash
cd /Users/aleksandrbaranov/Documents/Work/MY_CODE_PROJECTS/SplitWise
npm install

# Backend
cp apps/backend/env.example apps/backend/.env    # подставьте BOT_TOKEN, DATABASE_URL
npm run prisma:generate --workspace backend
npm run start:dev --workspace backend            # порт 3001 по умолчанию

# Front
cp apps/web/env.example apps/web/.env            # укажите VITE_API_URL и при необходимости VITE_TG_INIT_DATA
npm run dev --workspace web
```

## Prisma
- Схема: `apps/backend/prisma/schema.prisma`
- Миграции: `npm run prisma:migrate --workspace backend`
- Сиды демо-данных: `npm run db:seed --workspace backend`

## Telegram Mini App
- В приложении используется `window.Telegram.WebApp.initData`; для локального режима можно подставить `VITE_TG_INIT_DATA`.
- Для продакшн нужно указать `BOT_TOKEN` (backend) и включить домен Railway в настройках бот-фазера.

## Railway / CI
- Поднимите PostgreSQL-инстанс на Railway, сохраните `DATABASE_URL`.
- Сервис backend: Node 20+, команда сборки `npm run build --workspace backend`, старт `npm run start:prod --workspace backend` (требуется `PRISMA_GENERATE=true` или отдельный шаг).
- Статика web: `npm run build --workspace web`, `dist` как артефакт.
- GitHub Actions можно расширить: линт/тест/билд и деплой на Railway через CLI или Deploy Hooks.

